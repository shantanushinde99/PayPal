export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { failInterruptedChecks } = await import("@/lib/verify/run");
    await failInterruptedChecks();
  }
}
