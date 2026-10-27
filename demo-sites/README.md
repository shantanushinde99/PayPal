# Demo sites

Websites for trying Verifund. GitHub Pages hosts them at
`https://shantanushinde99.github.io/PayPal/demo-sites/<folder>/`. All of them are Verifund sample sites, so they
skip the site ownership check.

| Folder | Site | Difficulty |
|---|---|---|
| `bakery-v1/` | Sunrise Bakery, broken version: the email has a typo (`helo@`), there's no contact form, and the team link is broken | easy |
| `bakery-v2/` | Sunrise Bakery, fixed version | easy |
| `intermediate/` | Greenleaf Dental: 7 pages, appointment form with validation, pricing table, FAQ, mobile menu | intermediate |
| `hard-site/` | Northwind Travel: a **Next.js + React** app (static export), 21 routes, see below | hard |

`screenshots/<folder>/` has screenshots of each site. Upload `01-home-desktop.jpg` as the client's **Reference design**.
The `-phone` and `-full-page` versions are there for viewing.

## Intermediate: Greenleaf Dental
URL: `https://shantanushinde99.github.io/PayPal/demo-sites/intermediate/`

Checklist that should **pass**:
```
Has pages for Services, Our dentists, Pricing, FAQ and Contact
The pricing page lists teeth whitening (in-chair) at $350
The contact page shows the email care@greenleafdental.com and phone +1 (555) 014-2290
Has an appointment booking form that confirms the booking with a reference number
The site is closed on Sundays
The site works on a phone (mobile menu)
All links on the site work
```

Items that should **fail**:
```
Has a live chat widget
The pricing page lists a dental implant for under $2,000
Patients can pay online with a card on the booking page
```

## Hard: Northwind Travel
URL: `https://shantanushinde99.github.io/PayPal/demo-sites/hard-site/`

Why it's harder for the AI checker: it's built the way many real client sites are now.
- **A Next.js + React app**, exported as static files. Its source is in [`demo-sites-src/northwind`](../demo-sites-src/northwind).
- **Pages change by client-side navigation.** Following a link swaps the page without a full reload.
- **The tour catalogue isn't in the HTML at all.** It's fetched in the browser after the page loads, then filtered and sorted with React state. Three of the six tours are sold out or coming soon, and they have no page.
- **The booking form is a React wizard** with three steps: trip, then lead traveller, then review. Each step validates its own fields, and the review shows the total and a 20% deposit.
- **There is a login form.** The demo account is `demo@northwindtravel.co` / `travel2026`.
- **A currency switcher** shows prices in USD, EUR or GBP, and remembers the choice.
- **A cookie-consent bar** covers the bottom of the page until it's dismissed.
- **An "Ask a question" pop-up** confirms with a toast notification.
- The FAQ uses accordions, the journal is split across two pages, and there are breadcrumbs and a Destinations dropdown.

To rebuild after editing the source:
```
cd demo-sites-src/northwind
npm install
npm run build   # exports the site and copies it into demo-sites/hard-site
```

Checklist that should **pass**:
```
Has a Destinations section with separate pages for Japan, Peru and Iceland
The tours page can be filtered by destination and shows which tours are sold out
The Kyoto Temples & Tea tour costs $2,450 and has a 7-day itinerary
Has a 3-step booking form that shows the total price and a 20% deposit before confirming
Has a sign-in page with an email and password form
Prices can be shown in USD, EUR and GBP
The contact page shows hello@northwindtravel.co and +44 20 7946 0958
Has privacy policy and booking terms pages linked from the footer
All links on the site work
```

Items that should **fail**, or be marked unsure:
```
Every tour listed on the tours page can be booked
The site offers a tour to Norway
Customers can pay the full price online by card
The journal has at least 10 published articles
```
