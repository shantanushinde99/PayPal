export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { failInterruptedChecks } = await import("@/lib/verify/run");
    await failInterruptedChecks();
    const { deleteOldDemos } = await import("@/lib/demo");
    const { releaseDue } = await import("@/lib/review-window");
    const { settleDueDisputes } = await import("@/lib/disputes");
    // Demo workspaces live 48h (daily sweep); review windows release on the minute.
    const sweepDemos = () => deleteOldDemos(48).catch((e) => console.error("demo cleanup failed", e));
    const sweepReleases = () => Promise.all([
      releaseDue().catch((e) => console.error("auto-release sweep failed", e)),
      settleDueDisputes().catch((e) => console.error("dispute sweep failed", e)),
    ]);
    await sweepDemos();
    await sweepReleases();
    setInterval(sweepDemos, 24 * 3600_000).unref();
    setInterval(sweepReleases, 60_000).unref();
  }
}
