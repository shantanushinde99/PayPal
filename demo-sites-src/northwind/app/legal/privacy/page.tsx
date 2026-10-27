import { Crumbs } from "@/components/chrome";

export const metadata = { title: "Privacy policy", description: "How Northwind Travel uses your data." };

export default function Privacy() {
  return (
    <>
      <Crumbs items={[["/", "Home"], [null, "Privacy"]]} />
      <section><div className="wrap" style={{ maxWidth: 820 }}><h1>Privacy policy</h1><p className="meta">Last updated 1 September 2026</p>
        <h2>What we collect</h2><p>Your name, contact details, passport country and dietary needs, so we can run your trip.</p>
        <h2>Who we share it with</h2><p>Only the local partners who deliver your tour (hotels, guides, rail operators). We never sell data.</p>
        <h2>Your rights</h2><p>Ask for a copy or deletion at any time by emailing <a href="mailto:privacy@northwindtravel.co">privacy@northwindtravel.co</a>.</p></div></section>
    </>
  );
}
