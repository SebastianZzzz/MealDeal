import Link from "next/link";
import { getIdentity } from "@/lib/session";
import { isAuth0Configured } from "@/lib/env";
import { Brand } from "@/components/brand";

export default async function Home() {
  const user = await getIdentity();
  const authReady = isAuth0Configured();
  return (
    <main className="page home-page">
      <header className="screen-header"><Brand compact /><span>VANCOUVER</span></header>
      <h1 className="home-title">How are you<br />eating today?</h1>

      <section className="home-actions" aria-label="Choose what to do">
        <div className="meal-art meal-art-cook" role="img" aria-label="A warm bowl of noodles with vegetables" />
        <Link className="btn home-button" href="/cook">Cook at home →</Link>
        <div className="meal-art meal-art-out" role="img" aria-label="A tray of prepared food" />
        <Link className="btn secondary home-button" href="/eat-out">Eat Out →</Link>
        <Link className="btn secondary home-button home-support" href="/support">Need food support? →</Link>
        <Link className="home-report" href="/report">Share a price ↗</Link>
      </section>

      <footer className="home-footer">
        {user?.sub === "demo|student" ? (
          <Link href="/onboarding">My kitchen →</Link>
        ) : user ? (
          <div>
            <Link href="/onboarding">Update my kitchen</Link>
            <a href="/auth/logout">Log out</a>
          </div>
        ) : authReady ? (
          <a href="/auth/login?returnTo=/cook">Log in to save your kitchen</a>
        ) : (
          <p>Local mode · <Link href="/onboarding">set up my kitchen →</Link></p>
        )}
      </footer>
    </main>
  );
}
