// What a freelancer may submit as a link, checked the same way in the browser (instant message) and on the server.
export type ProofLink = { kind: "website" | "repo"; problem?: undefined } | { kind?: undefined; problem: string };

const CODE_HOSTS = /^(www\.)?(github\.com|gitlab\.com|bitbucket\.org|codeberg\.org)$/i;
export const isCodeHostUrl = (u: string) => URL.canParse(u) && CODE_HOSTS.test(new URL(u).hostname);

export function checkProofLink(raw: string): ProofLink {
  const text = raw.trim();
  if (!URL.canParse(text)) return { problem: "Use a full link, like https://your-site.com or https://github.com/you/project" };
  const u = new URL(text);
  if (u.protocol !== "https:" && u.protocol !== "http:") return { problem: "The link must start with https://" };
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || /^[\d.]+$/.test(h) || h.includes(":")) return { problem: "That's an address only your computer can open. Deploy the site (Vercel, Netlify…) and submit its public link." };
  if (!CODE_HOSTS.test(h)) return { kind: "website" };
  if (!/github\.com$/.test(h)) return { problem: "Only GitHub repositories can be checked so far. Submit the deployed website instead, or a public GitHub repo." };
  const [owner, repo] = u.pathname.split("/").filter(Boolean);
  if (!owner || !repo) return { problem: "Use the repository's link, like https://github.com/you/project (not a profile page)." };
  return { kind: "repo" };
}
