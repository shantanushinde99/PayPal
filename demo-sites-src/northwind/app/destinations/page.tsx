import Link from "next/link";
import { Crumbs } from "@/components/chrome";
import { DESTINATIONS } from "@/components/data";

export const metadata = { title: "Destinations", description: "Where Northwind Travel goes: Japan, Peru and Iceland." };

export default function Destinations() {
  return (
    <>
      <Crumbs items={[["/", "Home"], [null, "Destinations"]]} />
      <section><div className="wrap"><h1>Destinations</h1><p className="lead">Three countries we know inside out.</p>
        <div className="cards">{DESTINATIONS.map((d) => (
          <article className="card" key={d.slug}><div className="art">{d.emoji}</div><div className="body"><h2>{d.name}</h2><p>{d.tag}</p>
            <Link className="btn alt" href={`/destinations/${d.slug}/`}>Explore {d.name}</Link></div></article>
        ))}</div></div></section>
    </>
  );
}
