import type { AgAiEvent, AgAiOutputItem, AgLlmAdapter, AgLlmResponse } from "ag-studio";
import type { StudioReply } from "@/lib/insights-ai";

// AG Studio runs the agent in the browser; each model turn goes through our server route (Gemini key stays there).
// ponytail: one JSON reply per turn, no token streaming; stream from the route if answers feel slow.
export function geminiAdapter(endpoint = "/api/ai/insights"): AgLlmAdapter {
  return {
    executeTurn(request, options) {
      let resolve!: (r: AgLlmResponse) => void;
      const complete = new Promise<AgLlmResponse>((r) => (resolve = r));
      async function* stream(): AsyncGenerator<AgAiEvent> {
        const id = `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; // randomUUID needs https
        const output: AgAiOutputItem[] = [];
        let error: string | undefined;
        try {
          const res = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request), signal: options?.signal });
          const body = (await res.json()) as StudioReply & { error?: string };
          if (!res.ok) throw new Error(body.error ?? `AI request failed (${res.status})`);
          if (body.text) {
            yield { type: "TEXT_MESSAGE_CHUNK", messageId: id, role: "assistant", delta: body.text };
            output.push({ id, kind: "output", type: "message", role: "assistant", status: "completed", content: [{ type: "text", text: body.text, annotations: [] }] });
          }
          for (const c of body.calls) {
            const args = JSON.stringify(c.args ?? {});
            yield { type: "TOOL_CALL_START", toolCallId: c.id, toolCallName: c.name, parentMessageId: id };
            yield { type: "TOOL_CALL_ARGS", toolCallId: c.id, delta: args };
            yield { type: "TOOL_CALL_END", toolCallId: c.id };
            output.push({ id: c.id, kind: "output", type: "function_call", callId: c.id, name: c.name, arguments: args, status: "completed" });
          }
        } catch (e) {
          if (!options?.signal?.aborted) error = e instanceof Error ? e.message : String(e);
        } finally {
          resolve({
            id, createdAt: Date.now(), output,
            status: options?.signal?.aborted ? "cancelled" : error ? "failed" : "completed",
            error: error ? { code: "llm_error", message: error } : undefined,
          });
        }
      }
      return { stream: stream(), complete };
    },
  };
}
