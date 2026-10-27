import Link from "next/link";
import { notFound } from "next/navigation";
import { Crumbs } from "@/components/chrome";
import { POSTS, TOURS } from "@/components/data";

export const dynamicParams = false;
export const generateStaticParams = () => POSTS.map((p) => ({ slug: p.slug }));
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = POSTS.find((x) => x.slug === slug);
  return { title: p?.title, description: p?.lead };
}

export default async function Post({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = POSTS.find((x) => x.slug === slug);
  if (!p) notFound();
  const t = TOURS.find((x) => x.slug === p.tour)!;
  return (
    <>
      <Crumbs items={[["/", "Home"], ["/blog/", "Journal"], [null, p.title]]} />
      <article><section><div className="wrap" style={{ maxWidth: 760 }}><p className="meta">{p.date} · by the Northwind guides</p><h1>{p.title}</h1><p className="lead">{p.lead}</p>
        {p.body.map((b) => <p key={b}>{b}</p>)}
        {p.list.length > 0 && <><h2>The checklist</h2><ul>{p.list.map((x) => <li key={x}>{x}</li>)}</ul></>}
        <p>Read the full <Link href={`/tours/${t.slug}/`}>{t.title}</Link> itinerary.</p>
        <p><Link href="/blog/">← Back to the journal</Link></p></div></section></article>
    </>
  );
}
