# Demo sites

Websites for trying Verifund. GitHub Pages hosts them at
`https://shantanushinde99.github.io/PayPal/demo-sites/<folder>/`. All of them are Verifund sample sites, so they
skip the site ownership check.

| Folder | Site | Difficulty |
|---|---|---|
| `bakery-v1/` | Sunrise Bakery, broken version: the email has a typo (`helo@`), there's no contact form, and the team link is broken | easy |
| `bakery-v2/` | Sunrise Bakery, fixed version | easy |
| `intermediate/` | Greenleaf Dental: 7 pages, appointment form with validation, pricing table, FAQ, mobile menu | intermediate |
| `hard-site/` | Northwind Travel: 19 pages across 3 folder levels, see below | hard |

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

Why it's harder for the AI checker:
- **The header, menu and footer are built by JavaScript**, not written in the HTML.
- **The tour list is loaded from a JSON file**, and has filters and an "only bookable" toggle. Three of the six tours are sold out or coming soon, and they have no page.
- **Pages sit three folders deep** (`destinations/japan/`, `blog/posts/…`), with breadcrumbs and a Destinations dropdown.
- **The booking form has three steps:** trip, then lead traveller, then review. Each step checks its own fields, and the review shows the total and a 20% deposit.
- **There is a login form.** The demo account is `demo@northwindtravel.co` / `travel2026`.
- **A currency switcher** shows prices in USD, EUR or GBP. The journal is split across two pages, and the FAQ uses accordions.

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
