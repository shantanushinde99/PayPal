export type Role = "client" | "freelancer";
export type ProfileInput = {
  roles: Role[]; displayName: string; company: string | null;
  headline: string | null; skills: string[]; bio: string | null; portfolioUrl: string | null;
};

const text = (f: FormData, k: string, max: number, label: string) => {
  const v = String(f.get(k) ?? "").trim();
  if (v.length > max) throw new Error(`${label} can be at most ${max} characters.`);
  return v || null;
};

// Untrusted form input → a clean profile, or a message the user can act on.
export function parseProfile(f: FormData): ProfileInput {
  // One role per account: someone who also wants the other role signs in with a different PayPal account.
  const choice = f.get("roleChoice");
  const roles = choice !== null ? [String(choice)] : [...new Set(f.getAll("roles").map(String))];
  if (roles.length > 1) throw new Error("An account has one role. Use a different PayPal account for the other role.");
  if (!roles.length || roles.some((r) => r !== "client" && r !== "freelancer")) throw new Error("Choose whether you're hiring or a freelancer.");
  const displayName = text(f, "displayName", 60, "Your name");
  if (!displayName || displayName.length < 2) throw new Error("Please enter your name (at least 2 characters).");

  const freelancer = roles.includes("freelancer");
  const headline = freelancer ? text(f, "headline", 80, "Headline") : null;
  if (freelancer && (!headline || headline.length < 2)) throw new Error("Add a short headline, like “Web developer”.");

  const seen = new Set<string>();
  const skills = freelancer
    ? String(f.get("skills") ?? "").split(",").map((s) => s.trim()).filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()))
    : [];
  if (skills.length > 10) throw new Error("Add at most 10 skills.");
  if (skills.some((s) => s.length > 30)) throw new Error("Each skill can be at most 30 characters.");

  let portfolioUrl: string | null = null;
  const rawUrl = freelancer ? text(f, "portfolioUrl", 300, "Portfolio link") : null;
  if (rawUrl) {
    let u: URL;
    try { u = new URL(rawUrl); } catch { throw new Error("The portfolio link doesn't look right. Use a full address like https://you.dev"); }
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("The portfolio link must start with https://");
    portfolioUrl = u.toString();
  }

  return {
    roles: (["client", "freelancer"] as const).filter((r) => roles.includes(r)),
    displayName, company: roles.includes("client") ? text(f, "company", 80, "Company") : null,
    headline, skills, bio: freelancer ? text(f, "bio", 600, "Bio") : null, portfolioUrl,
  };
}
