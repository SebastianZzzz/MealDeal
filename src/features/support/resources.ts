import type { FoodResource } from "@/types";

// Checked against the linked official service pages on November 7, 2026.
// Keep notices in the resource itself so they travel with copied/exported data.
export const foodResources: FoodResource[] = [
  {
    id: "ams-food-bank", name: "AMS Food Bank", type: "food_bank",
    address: "UBC Life Building, Room 0023, 6138 Student Union Boulevard, Vancouver",
    hours: "Most Mondays and Thursdays, noon–7 pm. Closed November 9, 2026 for midterm break; scheduled to reopen November 12. Check the official closure calendar.",
    eligibility: "UBC students with a valid student ID and an annual intake form. Bring your student ID and a reusable bag. Visit limits apply.",
    sourceUrl: "https://www.ams.ubc.ca/support-services/student-services/food-bank/", verifiedAt: "2026-11-07",
  },
  {
    id: "ubc-food-hub-market", name: "UBC Food Hub Market", type: "low_cost_market",
    address: "CIRS Building, main floor, 2260 West Mall, Vancouver",
    hours: "Tuesday–Thursday, 10:30 am–4:30 pm. Closed on UBC statutory holidays. Confirm current hours with the market.",
    eligibility: "Affordable groceries for the UBC campus community. This is a paid grocery market. Contact the market if you have questions about access.",
    sourceUrl: "https://students.ubc.ca/about-student-services/food-hub-market/", verifiedAt: "2026-11-07",
  },
  {
    id: "gathering-place", name: "Gathering Place cafeteria", type: "other",
    address: "609 Helmcken Street, Vancouver",
    hours: "Daily: breakfast 9–11:15 am; lunch 11:30 am–4:15 pm; dinner 4:30–7 pm.",
    eligibility: "Low-cost paid meals. Contact the centre about access or membership. Vegetarian options are available; the cafeteria cannot provide special dietary substitutions.",
    sourceUrl: "https://vancouver.ca/parks-recreation-culture/gathering-place-cafeteria.aspx", verifiedAt: "2026-11-07",
  },
  {
    id: "evelyne-saller", name: "Evelyne Saller Centre cafeteria", type: "other",
    address: "404 Alexander Street, Vancouver",
    hours: "Daily: breakfast 10 am–noon; lunch noon–3 pm; dinner 3–5:50 pm.",
    eligibility: "Low-cost paid meals. Pay with cash or a prepaid client meal account. Ask the centre about dietary needs and current service arrangements.",
    sourceUrl: "https://vancouver.ca/parks-recreation-culture/evelyne-saller-centre-cafeteria.aspx", verifiedAt: "2026-11-07",
  },
];
