import { generate } from "@/lib/gemini";

export type ProofType = "website" | "photo";
export type JobPlan = { title: string; milestones: { title: string; amount: number; proofType: ProofType; checklist: string[] }[] };

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
          proofType: { type: "string", enum: ["website", "photo"] },
          checklist: { type: "array", minItems: 2, maxItems: 8, items: { type: "string" } },
        },
        required: ["title", "amount", "proofType", "checklist"],
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
        "You split a freelance job into 1-3 milestones whose amounts sum exactly to the budget. " +
        "Pick each milestone's proofType: 'website' for anything delivered online (sites, pages, web apps), " +
        "'photo' for physical work (painting, repairs, cleaning, installs, crafts) proven with before/after photos. " +
        "Write checklist items a reviewer can verify from that proof alone: concrete, observable, one requirement each. " +
        "No vague items like 'high quality'.",
      responseMimeType: "application/json",
      responseJsonSchema: schema,
    },
  });
  return JSON.parse(res.text ?? "{}") as JobPlan;
}
