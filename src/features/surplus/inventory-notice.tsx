import Link from "next/link";
import type { InventorySource } from "./client";
import styles from "./surplus.module.css";

export function InventoryNotice({ source }: { source: InventorySource }) {
  return <>
    <nav className={styles.viewSwitch} aria-label="Inventory source">
      <Link href="/eat-out" aria-current={source === "local" ? "page" : undefined}>Local demo</Link>
      <Link href="/eat-out/shared" aria-current={source === "shared" ? "page" : undefined}>Shared preview</Link>
    </nav>
    <aside className="planning-notice"><strong>{source === "local" ? "Sample meals. No real reservations." : "Shared preview. Sign in to reserve."}</strong><br />
      {source === "local" ? "Browser-only. No food or payment arranged." : "Sample labels mean fictional food. No online payment."}
    </aside>
  </>;
}
