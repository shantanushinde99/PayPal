export type MilestoneState =
  | "draft" | "funding" | "funded" | "verifying" | "failed" | "passed" | "paid_out" | "cancelled";

const NEXT: Record<MilestoneState, MilestoneState[]> = {
  draft: ["funding", "cancelled"],
  funding: ["funding", "funded", "cancelled"],
  funded: ["verifying", "cancelled"],
  verifying: ["passed", "failed"],
  failed: ["verifying", "cancelled"],
  passed: ["paid_out"],
  paid_out: [],
  cancelled: [],
};

export const canTransition = (from: MilestoneState, to: MilestoneState) => NEXT[from].includes(to);
