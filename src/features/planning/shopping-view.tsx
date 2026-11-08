"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { mealPlanStore } from "@/lib/meal-plan-store";
import type { MealPlan } from "@/types";
import { formatMoney, formatWeight } from "./format";
import { useSaved } from "./use-saved";
import { useProductDeals } from "./use-product-deals";
import { dealLabel } from "./deals";
import { plural } from "@/lib/plural";
import { ScreenHeader } from "@/components/screen-header";
import { syncShopping } from "./plan-sync";

export function ShoppingView() {
  const saved = useSaved(mealPlanStore.getSelected);
  if (!saved.loaded) {
    return <main className="page"><p role="status">Loading your shopping list…</p></main>;
  }
  if (!saved.value) {
    return <main className="page"><h1>Your shopping list starts here</h1><Link className="btn" href="/cook/plan">Plan a meal</Link></main>;
  }
  return <ShoppingList initialPlan={saved.value} />;
}

function ShoppingList({ initialPlan }: { initialPlan: MealPlan }) {
  const [plan, setPlan] = useState(initialPlan);
  const [error, setError] = useState("");
  const router = useRouter();
  const saved = mealPlanStore.getOptions();
  const storeIds = [...new Set(plan.chosen.shoppingList.map((item) => item.storeId))];
  const bought = plan.chosen.shoppingList.filter((item) => item.bought).length;
  const total = plan.chosen.shoppingList.length;
  const deals = useProductDeals(plan.chosen.shoppingList);

  function save(next: MealPlan): boolean {
    try {
      mealPlanStore.setSelected(next);
      setPlan(next);
      setError("");
      // Best effort: the browser copy keeps working even if the account copy can't be updated.
      void syncShopping(next);
      return true;
    } catch {
      setError("Could not save your progress. Enable browser storage and try again.");
      return false;
    }
  }

  function toggle(productId: string) {
    const shoppingList = plan.chosen.shoppingList.map((item) => item.productId === productId ? { ...item, bought: !item.bought } : item);
    save({ ...plan, status: "shopping", chosen: { ...plan.chosen, shoppingList } });
  }

  function finish() {
    if (bought !== total) {
      return;
    }
    if (save({ ...plan, status: "cooking" })) {
      router.push("/cook/cooking");
    }
  }

  return <main className="page planning-page">
    <ScreenHeader backHref="/cook/options" />
    <p className="planning-eyebrow">COOK AT HOME / SHOPPING</p><h1>Shopping list</h1>
    <p className="muted">{plan.chosen.title}</p>
    {saved?.response.meta.isSample && <p className="planning-notice">Sample stores and prices. Check current prices before purchasing.</p>}
    <div className="card planning-section"><div className="planning-row"><span>Expected checkout</span><strong className="planning-total">{formatMoney(plan.chosen.shoppingCost)}</strong></div><p className="planning-small muted">{formatMoney(plan.request.budget)} budget · full packages included</p><label htmlFor="shopping-progress" className="planning-small">{bought} of {plural(total, "item")} bought</label><progress id="shopping-progress" className="planning-progress" value={bought} max={Math.max(1, total)} /></div>
    {total === 0 && <p className="planning-notice">Everything is already in your pantry. You&apos;re ready to cook.</p>}
    {storeIds.map((storeId) => {
      const store = saved?.response.meta.stores.find((item) => item.id === storeId);
      const items = plan.chosen.shoppingList.filter((item) => item.storeId === storeId);
      const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
      return <section className="card planning-section" key={storeId}>
        <div className="planning-row"><h2>{store?.name ?? storeId}</h2><strong>{formatMoney(subtotal)}</strong></div>
        {store?.address && <p className="muted planning-small">{store.address}</p>}
        <ul className="planning-shopping">{items.map((item) => {
          const product = saved?.response.meta.products.find((candidate) => candidate.id === item.productId);
          return <li key={item.productId}><label className={`planning-shopping-item ${item.bought ? "is-bought" : ""}`}>
            <input type="checkbox" checked={item.bought} onChange={() => toggle(item.productId)} />
            <span><strong>{item.name}</strong><small className="muted">{item.packages} × {saved ? formatWeight(item.packageSizeG, saved.units) : `${item.packageSizeG} g`} package · {formatMoney(item.packagePrice)} each</small>
              {product?.source === "report" && <small className="planning-source">Community reported · {product.reportedAt.slice(0, 10)}</small>}
              {product?.isSale && <small className="planning-source">Sale{product.validUntil ? ` · valid until ${product.validUntil.slice(0, 10)}` : ""}</small>}
              {deals[item.productId] && <small className="planning-source">{dealLabel(deals[item.productId])}</small>}
            </span><strong>{formatMoney(item.lineTotal)}</strong>
          </label></li>;
        })}</ul>
      </section>;
    })}
    {error && <p role="alert" className="planning-error">{error}</p>}
    {bought === total && <button type="button" className="btn primary planning-full" onClick={finish}>Start cooking →</button>}
    <p className="planning-small muted">{bought === total ? "Your ingredients are ready. Your plan is saved on this device." : "Check off each item after buying it to finish shopping."}</p>
  </main>;
}
