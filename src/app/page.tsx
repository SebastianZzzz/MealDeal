import Link from "next/link";
import { getIdentity } from "@/lib/session";
import { isAuth0Configured } from "@/lib/env";

export default async function Home() {
  const user = await getIdentity();
  const authReady = isAuth0Configured();
  return (
    <main className="page" style={{ display: "grid", alignContent: "space-between", gap: 36 }}>
      <section style={{ paddingTop: 22 }}>
        <div style={{ fontWeight: 900, fontSize: 21 }}>Meal<span style={{ color: "var(--green)" }}>Deal</span></div>
        <div style={{ marginTop: 55 }}>
          <p style={{ color: "var(--green)", fontWeight: 800 }}>Your budget. Real local prices.</p>
          <h1 style={{ fontSize: 47, lineHeight: .98, letterSpacing: "-2.5px", margin: "12px 0 18px" }}>How are you eating today?</h1>
          <p className="muted">We turn this week&apos;s affordable groceries into meals you can actually make.</p>
        </div>
      </section>
      <section style={{ display: "grid", gap: 12 }}>
        <Link className="btn" href="/cook">Cook at home</Link>
        <Link className="btn" href="/eat-out">Eat Out</Link>
        <Link className="btn" href="/support">Need food support?</Link>
        {user ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <Link className="muted" href="/onboarding">Update my kitchen</Link>
            <a className="muted" href="/auth/logout">Log out</a>
          </div>
        ) : authReady ? (
          <a className="muted" style={{ textAlign: "center", marginTop: 8 }} href="/auth/login?returnTo=/cook">Log in with Auth0</a>
        ) : (
          <p className="muted" style={{ fontSize: 13, textAlign: "center" }}>Auth0 environment variables are required to log in.</p>
        )}
      </section>
    </main>
  );
}
