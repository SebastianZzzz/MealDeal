"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChefHat, ChevronLeft, LogIn, LogOut, Ruler, ShieldCheck, UserRound, X } from "lucide-react";
import { Brand } from "./brand";

export type AccountState = "signed-in" | "signed-out" | "demo" | "unavailable";

// Where Back goes from each screen. Fixed parents (not browser history) so deep links behave too.
const PARENTS: [RegExp, string][] = [
  [/^\/cook\/plan$/, "/cook"],
  [/^\/cook\/options$/, "/cook/plan"],
  [/^\/cook\/shopping$/, "/cook/options"],
  [/^\/cook\/ready$/, "/cook/shopping"],
  [/^\/cook\/cooking$/, "/cook/shopping"],
  [/^\/cook\/demo$/, "/cook"],
  [/^\/eat-out\/shared\/post$/, "/eat-out/shared"],
  [/^\/eat-out\/(post|shared)$/, "/eat-out"],
  [/^\/.+/, "/"],
];

function initials(name?: string) {
  const parts = (name ?? "").replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return parts.length ? parts.slice(0, 2).map((part) => part[0]!.toUpperCase()).join("") : "";
}

export function TopBar({ account, name }: { account: AccountState; name?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const parent = pathname === "/" ? null : PARENTS.find(([pattern]) => pattern.test(pathname))?.[1];
  const label = initials(name);
  return (
    <>
      <header className="top-bar">
        <div className="top-bar-left">
          {parent && <Link className="icon-btn" href={parent} aria-label="Back"><ChevronLeft size={22} strokeWidth={2.2} /></Link>}
          <Brand compact={Boolean(parent)} />
        </div>
        <button type="button" className={`icon-btn ${account === "signed-in" ? "avatar-btn" : ""}`} aria-label="Account" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
          {account === "signed-in" && label ? label : <UserRound size={21} strokeWidth={2} />}
        </button>
      </header>
      {open && <AccountSheet account={account} name={name} onClose={() => setOpen(false)} />}
    </>
  );
}

function AccountSheet({ account, name, onClose }: { account: AccountState; name?: string; onClose: () => void }) {
  const first = useRef<HTMLAnchorElement | HTMLButtonElement | null>(null);
  useEffect(() => {
    first.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const signedIn = account === "signed-in" || account === "demo";
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="account-title">
        <div className="sheet-grip" aria-hidden="true" />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <h2 id="account-title">{signedIn ? (account === "demo" ? "Local demo" : name ?? "Your account") : "Welcome"}</h2>
            <p className="muted" style={{ margin: 0 }}>{signedIn ? "Your kitchen and food rules follow you across devices." : "Log in to save your kitchen, plans and shared prices."}</p>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><X size={20} /></button>
        </div>
        <ul className="sheet-list">
          {signedIn ? <>
            <li><Link ref={(node) => { first.current = node; }} href="/cook" onClick={onClose}><ChefHat size={20} />My kitchen</Link></li>
            <li><Link href="/onboarding?step=2" onClick={onClose}><ShieldCheck size={20} />Diet and allergies</Link></li>
            <li><Link href="/onboarding?step=1" onClick={onClose}><Ruler size={20} />Units</Link></li>
            {account === "signed-in" && <li><a href="/auth/logout"><LogOut size={20} />Log out</a></li>}
          </> : account === "signed-out"
            ? <li><a ref={(node) => { first.current = node; }} href="/auth/login?returnTo=/cook"><LogIn size={20} />Log in or sign up</a></li>
            : <li><span className="muted" style={{ display: "block", padding: "16px 4px" }}>Log in isn&apos;t available on this preview link. Use the main MealDeal site to log in.</span></li>}
        </ul>
      </section>
    </>
  );
}
