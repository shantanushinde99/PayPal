import { Crumbs } from "@/components/chrome";
import { ContactForm } from "@/components/widgets";

export const metadata = { title: "Contact", description: "Talk to a Northwind travel expert." };

export default function Contact() {
  return (
    <>
      <Crumbs items={[["/", "Home"], [null, "Contact"]]} />
      <section><div className="wrap split"><div><h1>Talk to a travel expert</h1><p className="lead">We reply within 24 hours, Monday to Saturday.</p><ContactForm /></div>
        <aside className="panel"><h2>Office</h2><p>21 Harbour Row<br />Bristol BS1 4QD<br />United Kingdom</p>
          <p>📞 <a href="tel:+442079460958">+44 20 7946 0958</a><br />✉️ <a href="mailto:hello@northwindtravel.co">hello@northwindtravel.co</a></p>
          <p><b>Hours</b><br />Mon–Fri 9:00–18:00 (UK time)<br />Sat 10:00–14:00</p></aside></div></section>
    </>
  );
}
