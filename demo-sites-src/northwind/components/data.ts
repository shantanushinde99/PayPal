export type Tour = {
  slug: string; title: string; region: string; rslug: string; days: number; usd: number; emoji: string; group: number; rating: number;
  plan: string[]; incl: string[]; excl: string[];
};

// Bookable tours with their own pages. The full catalogue (incl. sold-out ones) is public/tours.json, loaded in the browser.
export const TOURS: Tour[] = [
  { slug: "kyoto-temples", title: "Kyoto Temples & Tea", region: "Japan", rslug: "japan", days: 7, usd: 2450, emoji: "⛩️", group: 12, rating: 4.9,
    plan: ["Arrive in Kyoto, welcome dinner in Gion", "Fushimi Inari at sunrise, sake tasting", "Arashiyama bamboo grove and Tenryu-ji", "Private tea ceremony with a tea master", "Day trip to Nara's deer park", "Night in a traditional ryokan with onsen", "Farewell breakfast, transfer to Kansai Airport"],
    incl: ["6 nights' accommodation (incl. 1 ryokan night)", "All breakfasts and 3 dinners", "English-speaking guide", "Rail pass for the week"], excl: ["International flights", "Travel insurance"] },
  { slug: "inca-trail", title: "Classic Inca Trail to Machu Picchu", region: "Peru", rslug: "peru", days: 5, usd: 1890, emoji: "🏔️", group: 10, rating: 4.8,
    plan: ["Cusco briefing and acclimatisation walk", "Trek to Wayllabamba (12 km)", "Dead Woman's Pass, 4,215 m (11 km)", "Cloud-forest ruins to Wiñay Wayna (16 km)", "Sun Gate at dawn and guided tour of Machu Picchu"],
    incl: ["Inca Trail permit", "Porters, cook and tents", "All meals on the trail", "Return train to Cusco"], excl: ["Sleeping bag hire ($25)", "Tips for porters"] },
  { slug: "northern-lights", title: "Northern Lights & Ice Caves", region: "Iceland", rslug: "iceland", days: 6, usd: 2980, emoji: "🌌", group: 14, rating: 4.9,
    plan: ["Reykjavík arrival and harbour walk", "Golden Circle: Þingvellir, Geysir, Gullfoss", "South coast waterfalls and black-sand beach", "Crystal ice cave on Vatnajökull glacier", "Jökulsárlón lagoon and aurora hunt", "Blue Lagoon and departure"],
    incl: ["5 nights in boutique hotels", "Glacier guide and safety gear", "Nightly aurora hunts (weather permitting)", "Blue Lagoon entry"], excl: ["Lunches", "Flights to Iceland"] },
];

export const DESTINATIONS = [
  { slug: "japan", name: "Japan", emoji: "⛩️", tag: "Temples, tea and neon-lit cities.", best: "Best time: March–May for cherry blossom, October–November for autumn colours.", tour: "kyoto-temples", other: "Tokyo After Dark Food Tour (sold out)" },
  { slug: "peru", name: "Peru", emoji: "🏔️", tag: "Ancient trails high in the Andes.", best: "Best time: May–September (dry season). The Inca Trail closes every February.", tour: "inca-trail", other: "Amazon Rainforest Lodge (sold out)" },
  { slug: "iceland", name: "Iceland", emoji: "🌌", tag: "Fire, ice and the northern lights.", best: "Best time: September–March for auroras, June–August for the midnight sun.", tour: "northern-lights", other: "Iceland Ring Road Self-Drive (coming soon)" },
];

export const POSTS = [
  { slug: "packing-for-iceland", title: "What to pack for Iceland in winter", date: "12 Oct 2026", lead: "Layers, crampons and why you need a swimsuit in January.",
    body: ["Iceland's winter weather changes by the hour. Pack thermal base layers, a waterproof shell and microspikes for icy paths."],
    list: ["Thermal base layers", "Waterproof jacket and trousers", "Microspikes or crampons", "A swimsuit for the hot springs"], tour: "northern-lights" },
  { slug: "altitude-on-the-inca-trail", title: "Handling altitude on the Inca Trail", date: "28 Sep 2026", lead: "Dead Woman's Pass is 4,215 m high. Here's how to feel fine at the top.",
    body: ["Spend at least two nights in Cusco before you start, drink plenty of water and walk slowly.", "Headache, nausea or dizziness that gets worse means you should descend. Every guide carries oxygen."],
    list: [], tour: "inca-trail" },
];
export const OLDER = [["Kyoto's best tea houses", "3 Aug 2026"], ["A first-timer's guide to Machu Picchu tickets", "19 Jul 2026"], ["Chasing auroras: a photographer's notes", "2 Jun 2026"]];

export const FAQ = [
  ["How big are the groups?", "Never more than 14 travellers, and most departures have 8–10."],
  ["What deposit do I pay?", "20% when you book. The balance is due 60 days before departure."],
  ["Can I cancel?", "Yes. Cancel more than 60 days out and you lose only the deposit. See our booking terms."],
  ["Do you arrange flights?", "No. Tours start and end in the destination city, so you can use your air miles."],
  ["Is travel insurance required?", "Yes, insurance covering medical evacuation is a condition of booking."],
  ["Can you cater for dietary needs?", "Yes: vegetarian, vegan, gluten-free and halal on every tour. Tell us when booking."],
];

export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export type CatalogueTour = { slug: string; title: string; region: string; days: number; priceUsd: number; rating: number; status: string; summary: string };
