export type MilestoneState =
  | "draft" | "funding" | "funded" | "verifying" | "failed" | "passed" | "disputed" | "paid_out" | "cancelled";

const NEXT: Record<MilestoneState, MilestoneState[]> = {
  draft: ["funding", "cancelled"],
  funding: ["funding", "funded", "cancelled"],
  funded: ["verifying", "cancelled"],
  verifying: ["passed", "failed"],
  failed: ["verifying", "cancelled", "disputed"], // freelancer can dispute the AI's "not met"
  passed: ["paid_out", "disputed"], // review window: client approves, it auto-releases, or client disputes
  disputed: ["paid_out", "cancelled"], // settled by the AI Judge or an admin (full, partial or nothing)
  paid_out: [],
  cancelled: [],
};

export const canTransition = (from: MilestoneState, to: MilestoneState) => NEXT[from]?.includes(to) ?? false;
