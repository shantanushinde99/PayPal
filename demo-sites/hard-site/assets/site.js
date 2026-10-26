// Northwind Travel: shared header/footer, currency switcher and small widgets. Pages only provide <main>.
const ROOT = new URL("../", document.currentScript.src).href;
const here = location.href.replace(/index\.html$/, "");
const link = (path, text) => `<a href="${ROOT}${path}"${here === ROOT + path ? ' aria-current="page"' : ""}>${text}</a>`;

document.body.insertAdjacentHTML("afterbegin", `
<header id="site-header"><div class="wrap">
  <a class="brand" href="${ROOT}">North<b>wind</b> Travel</a>
  <button class="burger" aria-expanded="false" aria-controls="main-nav">Menu</button>
  <nav id="main-nav" aria-label="Main">
    ${link("", "Home")}
    <div class="drop"><button aria-expanded="false">Destinations ▾</button><div class="drop-menu">
      ${link("destinations/", "All destinations")}${link("destinations/japan/", "Japan")}${link("destinations/peru/", "Peru")}${link("destinations/iceland/", "Iceland")}
    </div></div>
    ${link("tours/", "Tours")}${link("blog/", "Journal")}${link("help/faq.html", "Help")}${link("contact.html", "Contact")}
  </nav>
  <div class="tools">
    <select id="currency" aria-label="Currency"><option>USD</option><option>EUR</option><option>GBP</option></select>
    <a href="${ROOT}account/login.html">Sign in</a></div>
</div></header>`);

document.body.insertAdjacentHTML("beforeend", `
<footer id="site-footer"><div class="wrap cols">
  <div><h4>Northwind Travel</h4><p>Small-group adventures since 2012.<br>21 Harbour Row, Bristol BS1 4QD, United Kingdom</p>
    <p>ATOL protected · Licence no. 11847</p></div>
  <div><h4>Explore</h4><ul><li>${link("tours/", "All tours")}</li><li>${link("destinations/", "Destinations")}</li><li>${link("booking/", "Book a trip")}</li><li>${link("blog/", "Journal")}</li></ul></div>
  <div><h4>Company</h4><ul><li>${link("contact.html", "Contact")}</li><li>${link("help/faq.html", "FAQ")}</li><li>${link("legal/privacy.html", "Privacy")}</li><li>${link("legal/terms.html", "Terms")}</li></ul></div>
  <div><h4>Newsletter</h4><form id="newsletter"><label for="nl">Monthly travel ideas, no spam.</label>
    <input id="nl" name="email" type="email" placeholder="you@example.com" required><button class="btn alt" type="submit">Subscribe</button></form>
    <p id="nl-ok" hidden>Thanks, you're subscribed!</p>
    <p>📞 <a href="tel:+442079460958">+44 20 7946 0958</a><br>✉️ <a href="mailto:hello@northwindtravel.co">hello@northwindtravel.co</a></p></div>
</div></footer>`);

// Mobile menu + destinations dropdown
const burger = document.querySelector(".burger"), nav = document.getElementById("main-nav");
burger.onclick = () => burger.setAttribute("aria-expanded", nav.classList.toggle("open"));
const drop = document.querySelector(".drop");
drop.querySelector("button").onclick = (e) => { e.stopPropagation(); e.currentTarget.setAttribute("aria-expanded", drop.classList.toggle("open")); };
document.addEventListener("click", () => drop.classList.remove("open"));

document.getElementById("newsletter").onsubmit = (e) => { e.preventDefault(); e.target.hidden = true; document.getElementById("nl-ok").hidden = false; };

// Prices are stored in USD (data-usd); the selector converts every price on the page.
const RATES = { USD: [1, "$"], EUR: [0.92, "€"], GBP: [0.79, "£"] };
const cur = document.getElementById("currency");
try { cur.value = localStorage.getItem("nw-currency") || "USD"; } catch {}
window.formatPrice = (usd) => { const [r, s] = RATES[cur.value]; return s + Math.round(usd * r).toLocaleString("en-US"); };
const paint = () => document.querySelectorAll("[data-usd]").forEach((el) => (el.textContent = formatPrice(+el.dataset.usd)));
cur.onchange = () => { try { localStorage.setItem("nw-currency", cur.value); } catch {} paint(); document.dispatchEvent(new Event("currency")); };
window.paintPrices = paint;
paint();

window.loadTours = () => fetch(ROOT + "assets/tours.json").then((r) => r.json());
window.ROOT = ROOT;
