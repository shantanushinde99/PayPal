import Link from "next/link";
import { notFound } from "next/navigation";
import { Crumbs } from "@/components/chrome";
import { DESTINATIONS, TOURS } from "@/components/data";
import { Price } from "@/components/providers";

export const dynamicParams = false;
export const generateStaticParams = () => DESTINATIONS.map((d) => ({ slug: d.slug }));
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = DESTINATIONS.find((x) => x.slug === slug);
  return { title: d?.name, description: `Small-group tours in ${d?.name}.` };
}

export default async function Destination({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = DESTINATIONS.find((x) => x.slug === slug);
  if (!d) notFound();
  const t = TOURS.find((x) => x.slug === d.tour)!;
  return (
    <>
      <Crumbs items={[["/", "Home"], ["/destinations/", "Destinations"], [null, d.name]]} />
      <section><div className="wrap split"><div><h1>{d.emoji} {d.name}</h1><p className="lead">{d.tag}</p><p>{d.best}</p>
        <h2>Tours in {d.name}</h2><article className="card"><div className="body"><h3>{t.title}</h3><p className="meta">{t.days} days · from <Price usd={t.usd} className="" /></p>
          <Link className="btn alt" href={`/tours/${t.slug}/`}>View tour</Link></div></article>
        <p className="meta">Also in {d.name}: {d.other}.</p></div>
        <aside className="panel"><h3>Good to know</h3><ul><li>Visa: check your government&apos;s advice before booking.</li><li>Currency: prices can be shown in USD, EUR or GBP.</li><li>Group size: max {t.group}.</li></ul>
          <Link href={`/booking/?tour=${t.slug}`} className="btn">Book this trip</Link></aside></div></section>
    </>
  );
}
