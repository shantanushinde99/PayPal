import { generate } from "@/lib/gemini";

export type JobPlan = { title: string; milestones: { title: string; amount: number; checklist: string[] }[] };

const schema = {
  type: "object",
  properties: {
    title: { type: "string" },
    milestones: {
      type: "array", minItems: 1, maxItems: 5,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          amount: { type: "number" },
          checklist: { type: "array", minItems: 2, maxItems: 8, items: { type: "string" } },
        },
        required: ["title", "amount", "checklist"],
      },
    },
  },
  required: ["title", "milestones"],
};

export async function planJob(description: string, budget: number): Promise<JobPlan> {
  const res = await generate({
    contents: `Job description from a client:\n"""${description}"""\nTotal budget: ${budget}`,
    config: {
      systemInstruction:
        "You split freelance web jobs into 1-3 milestones whose amounts sum exactly to the budget. " +
        "Each milestone's proof is a live website URL. Write checklist items that a reviewer can verify " +
        "just by visiting the website: concrete, observable, one requirement each. No vague items like 'high quality'.",
      responseMimeType: "application/json",
      responseJsonSchema: schema,
    },
  });
  return JSON.parse(res.text ?? "{}") as JobPlan;
}
