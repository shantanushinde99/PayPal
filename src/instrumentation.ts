export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { failInterruptedChecks } = await import("@/lib/verify/run");
    await failInterruptedChecks();
    // Demo workspaces live 48h; sweep at start and daily.
    const { deleteOldDemos } = await import("@/lib/demo");
    const sweep = () => deleteOldDemos(48).catch((e) => console.error("demo cleanup failed", e));
    await sweep();
    setInterval(sweep, 24 * 3600_000).unref();
  }
}
