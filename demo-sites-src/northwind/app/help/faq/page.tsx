import Link from "next/link";
import { Crumbs } from "@/components/chrome";
import { Faq } from "@/components/widgets";

export const metadata = { title: "Help & FAQ", description: "Answers to common questions about Northwind tours." };

export default function Help() {
  return (
    <>
      <Crumbs items={[["/", "Home"], [null, "Help"]]} />
      <section><div className="wrap" style={{ maxWidth: 820 }}><h1>Help &amp; FAQ</h1><p className="lead">Still stuck? <Link href="/contact/">Contact our team</Link>.</p><Faq /></div></section>
    </>
  );
}
