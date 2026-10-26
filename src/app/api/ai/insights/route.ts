import { currentUser } from "@/lib/session";
import { RateLimiter } from "@/lib/rate-limiter";
import { askStudio, type StudioRequest } from "@/lib/insights-ai";
import { AiBusyError } from "@/lib/gemini";

// Shares the free Gemini quota with the checker, so each person gets a small budget (one question can take a few turns).
const perUser = new RateLimiter(30, 300);
const MAX_BODY = 400_000;

// AG Studio's "Ask your data" model call. The key stays here; the browser only sees answers and tool calls.
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Please log in." }, { status: 401 });
  const raw = await req.text();
  if (raw.length > MAX_BODY) return Response.json({ error: "That conversation is too long. Start a new chat." }, { status: 413 });
  if (perUser.waitMs(user.id) > 0) return Response.json({ error: "You're asking quickly. Wait a minute and try again." }, { status: 429 });
  perUser.record(user.id);
  try {
    const body = JSON.parse(raw) as StudioRequest;
    if (!Array.isArray(body?.input)) return Response.json({ error: "Bad request" }, { status: 400 });
    return Response.json(await askStudio(body));
  } catch (e) {
    console.error("insights ai failed", e);
    const busy = e instanceof AiBusyError;
    return Response.json({ error: busy ? "The AI is busy right now. Try again in a minute." : "The AI couldn't answer that. Try rephrasing." }, { status: busy ? 503 : 502 });
  }
}
