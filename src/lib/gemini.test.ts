import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/env", () => ({ env: { GEMINI_API_KEY: "k", GEMINI_MODEL_PRIMARY: "a", GEMINI_MODEL_FALLBACK: "b", MISTRAL_API_KEY: "m" } }));
const genai = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock("@google/genai", () => ({ GoogleGenAI: class { models = genai; } }));
import { generate, isTextTask, shouldTryOtherModel } from "./gemini";

describe("shouldTryOtherModel", () => {
  it("falls back on quota limits and on overloaded models", () => {
    expect(shouldTryOtherModel(new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}'))).toBe(true);
    expect(shouldTryOtherModel(new Error('{"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}'))).toBe(true);
  });
  it("does not hide real errors", () => {
    expect(shouldTryOtherModel(new Error('{"error":{"code":400,"status":"INVALID_ARGUMENT"}}'))).toBe(false);
  });
});

describe("splitting work between Mistral and Gemini", () => {
  const json = { contents: "Plan this job", config: { systemInstruction: "You plan jobs.", responseMimeType: "application/json", responseJsonSchema: { type: "object" } } };
  const ok = (text: string) => new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 });

  it("sends text-in, JSON-out tasks to Mistral with the schema", async () => {
    const f = vi.fn(async () => ok('{"title":"Bakery site"}'));
    const res = await generate(json, undefined, f as unknown as typeof fetch);
    expect(res.text).toBe('{"title":"Bakery site"}');
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({ model: "ministral-14b-latest", messages: [{ role: "system", content: "You plan jobs." }, { role: "user", content: "Plan this job" }], response_format: { type: "json_schema" } });
    expect(genai.generateContent).not.toHaveBeenCalled();
  });

  it("tries the second Mistral model, then Gemini, when Mistral is busy", async () => {
    const f = vi.fn(async () => new Response('{"message":"Rate limit exceeded"}', { status: 429 }));
    genai.generateContent.mockResolvedValueOnce({ text: '{"from":"gemini"}' });
    const res = await generate(json, undefined, f as unknown as typeof fetch);
    expect(f).toHaveBeenCalledTimes(2);
    expect(res.text).toBe('{"from":"gemini"}');
  });

  it("keeps tool and image work on Gemini", () => {
    expect(isTextTask(json)).toBe(true);
    expect(isTextTask({ contents: "x", config: { tools: [{ functionDeclarations: [] }] } })).toBe(false);
    expect(isTextTask({ contents: [{ role: "user", parts: [{ text: "x" }, { inlineData: { mimeType: "image/jpeg", data: "" } }] }] })).toBe(false);
  });
});
