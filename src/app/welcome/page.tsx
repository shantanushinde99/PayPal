import { Landing } from "@/components/landing/landing";
import { currentUser } from "@/lib/session";
import { demoEnabled } from "@/lib/demo";

// The home page for everyone, including people who are logged in (at "/" they get their dashboard instead).
export default async function Welcome() {
  return <Landing demo={demoEnabled()} signedIn={!!(await currentUser())} />;
}
