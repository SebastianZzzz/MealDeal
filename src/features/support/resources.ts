import type { FoodResource } from "@/types";

// The first four were checked against their official pages on November 7, 2026; the rest on November 8, 2026
// from official pages and recent listings. Hours vary between sources, so those entries point to the official page.
// Map coordinates are approximate (building level). Keep notices in the resource itself so they travel with exported data.
export const foodResources: FoodResource[] = [
  {
    id: "ams-food-bank", name: "AMS Food Bank", type: "food_bank", lat: 49.2675, lng: -123.2502,
    address: "UBC Life Building, Room 0023, 6138 Student Union Boulevard, Vancouver",
    hours: "Most Mondays and Thursdays, noon–7 pm. Closed November 9, 2026 for midterm break; scheduled to reopen November 12. Check the official closure calendar.",
    eligibility: "UBC students with a valid student ID and an annual intake form. Bring your student ID and a reusable bag. Visit limits apply.",
    sourceUrl: "https://www.ams.ubc.ca/support-services/student-services/food-bank/", verifiedAt: "2026-11-07",
  },
  {
    id: "ubc-food-hub-market", name: "UBC Food Hub Market", type: "low_cost_market", lat: 49.2622, lng: -123.2534,
    address: "CIRS Building, main floor, 2260 West Mall, Vancouver",
    hours: "Tuesday–Thursday, 10:30 am–4:30 pm. Closed on UBC statutory holidays. Confirm current hours with the market.",
    eligibility: "Affordable groceries for the UBC campus community. This is a paid grocery market. Contact the market if you have questions about access.",
    sourceUrl: "https://students.ubc.ca/about-student-services/food-hub-market/", verifiedAt: "2026-11-07",
  },
  {
    id: "gathering-place", name: "Gathering Place cafeteria", type: "other", lat: 49.2775, lng: -123.1290,
    address: "609 Helmcken Street, Vancouver",
    hours: "Daily: breakfast 9–11:15 am; lunch 11:30 am–4:15 pm; dinner 4:30–7 pm.",
    eligibility: "Low-cost paid meals. Contact the centre about access or membership. Vegetarian options are available; the cafeteria cannot provide special dietary substitutions.",
    sourceUrl: "https://vancouver.ca/parks-recreation-culture/gathering-place-cafeteria.aspx", verifiedAt: "2026-11-07",
  },
  {
    id: "evelyne-saller", name: "Evelyne Saller Centre cafeteria", type: "other", lat: 49.2843, lng: -123.0968,
    address: "404 Alexander Street, Vancouver",
    hours: "Daily: breakfast 10 am–noon; lunch noon–3 pm; dinner 3–5:50 pm.",
    eligibility: "Low-cost paid meals. Pay with cash or a prepaid client meal account. Ask the centre about dietary needs and current service arrangements.",
    sourceUrl: "https://vancouver.ca/parks-recreation-culture/evelyne-saller-centre-cafeteria.aspx", verifiedAt: "2026-11-07",
  },
  {
    id: "sprouts-ubc", name: "Sprouts (by-donation lunch and community fridge)", type: "free_meal", lat: 49.2673, lng: -123.2497,
    address: "Lower level, UBC Life Building, 6138 Student Union Boulevard, Vancouver",
    hours: "Student-run. By-donation vegan lunches, a community fridge and produce days during term. Days change each term; check Sprouts before you go.",
    eligibility: "Open to the UBC community. Lunches are by donation, so pay what you can. Bring your own container and cutlery if you can.",
    sourceUrl: "https://www.ubcsprouts.ca/", verifiedAt: "2026-11-08",
  },
  {
    id: "ubc-meal-share", name: "UBC Meal Share Program", type: "other",
    address: "Apply online. Funds go on your UBCcard for campus food outlets.",
    hours: "Applications open in set windows during the year. Check the program page for the current window.",
    eligibility: "Confidential, non-repayable food funds for UBC students who have trouble affording enough food. No one at the counter can tell that you received support.",
    sourceUrl: "https://students.ubc.ca/health/food-nutrition/", verifiedAt: "2026-11-08",
  },
  {
    id: "kits-community-fridge", name: "Kits Community Fridge and Pantry", type: "community_fridge", lat: 49.2646, lng: -123.1601,
    address: "Outside Kitsilano Neighbourhood House, West 7th Avenue at Vine Street, Vancouver",
    hours: "An outdoor fridge and pantry. What is inside changes through the day.",
    eligibility: "Free for anyone. Take what you need; you can also leave sealed or fresh food for others.",
    sourceUrl: "https://www.kitshouse.org/", verifiedAt: "2026-11-08",
  },
  {
    id: "kits-house-food", name: "Kitsilano Neighbourhood House food programs", type: "free_meal", lat: 49.2648, lng: -123.1596,
    address: "2305 West 7th Avenue, Vancouver",
    hours: "A low-cost Tuesday lunch for older adults and Friday take-home food while supplies last (2024 schedule). Confirm current days with the house: 604-736-3588.",
    eligibility: "Community programs; some are for older adults. Friday food needs no registration.",
    sourceUrl: "https://www.kitshouse.org/", verifiedAt: "2026-11-08",
  },
  {
    id: "union-gospel-mission", name: "Union Gospel Mission meals", type: "free_meal", lat: 49.2811, lng: -123.0921,
    address: "601 East Hastings Street, Vancouver",
    hours: "Serves free meals at its Hastings Street site, with large community dinners on holidays. Call 604-253-3323 for today's meal times.",
    eligibility: "Free meals for people in need. Ask staff about other services at the same site.",
    sourceUrl: "https://ugm.ca/", verifiedAt: "2026-11-08",
  },
  {
    id: "quest-food-exchange", name: "Quest Food Exchange (East Vancouver)", type: "low_cost_market", lat: 49.2840, lng: -123.0640,
    address: "2020 Dundas Street, Vancouver",
    hours: "Weekday market hours vary by listing. Call 604-602-0186 before visiting.",
    eligibility: "Not-for-profit grocery market with low prices. You need a referral from a partner agency to get a Quest card; ask a campus or community counsellor for one.",
    sourceUrl: "https://questoutreach.org/", verifiedAt: "2026-11-08",
  },
  {
    id: "greater-vancouver-food-bank", name: "Greater Vancouver Food Bank", type: "food_bank",
    address: "Pickup depots across Vancouver. Find the nearest one on the locations page.",
    hours: "Depot days differ by location. Register first; walk-in registration is not accepted at most sites. Call 604-876-3601.",
    eligibility: "For people in Vancouver, Burnaby, New Westminster and the North Shore who need groceries. Registration is required.",
    sourceUrl: "https://foodbank.bc.ca/find-food/locations/", verifiedAt: "2026-11-08",
  },
];
