import Link from "next/link";
import { notFound } from "next/navigation";
import { Crumbs } from "@/components/chrome";
import { TOURS } from "@/components/data";
import { Price } from "@/components/providers";
import { EnquireButton } from "@/components/widgets";

export const dynamicParams = false;
export const generateStaticParams = () => TOURS.map((t) => ({ slug: t.slug }));
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = TOURS.find((x) => x.slug === slug);
  return { title: t?.title, description: `${t?.days}-day small-group tour: ${t?.title}.` };
}

export default async function TourPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = TOURS.find((x) => x.slug === slug);
  if (!t) notFound();
  return (
    <>
      <Crumbs items={[["/", "Home"], ["/tours/", "Tours"], [null, t.title]]} />
      <section><div className="wrap split"><div><span className="badge">{t.region}</span><h1>{t.emoji} {t.title}</h1>
        <p className="lead">{t.days} days · max {t.group} travellers · ★ {t.rating}</p>
        <h2>Day by day</h2><ol className="itinerary">{t.plan.map((d, i) => <li key={d}><b>Day {i + 1}:</b> {d}</li>)}</ol>
        <h2>What&apos;s included</h2><ul>{t.incl.map((x) => <li key={x}>{x}</li>)}</ul>
        <h2>Not included</h2><ul>{t.excl.map((x) => <li key={x}>{x}</li>)}</ul></div>
        <aside className="panel"><p>From</p><p style={{ fontSize: "2rem" }}><Price usd={t.usd} /></p><p className="meta">per person, twin share</p>
          <p><Link className="btn" href={`/booking/?tour=${t.slug}`}>Book this tour</Link> <EnquireButton tour={t.title} /></p>
          <p className="meta">Questions? <Link href="/contact/">Talk to a travel expert</Link> or see <Link href={`/destinations/${t.rslug}/`}>more about {t.region}</Link>.</p></aside></div></section>
    </>
  );
}
