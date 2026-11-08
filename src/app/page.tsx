import Link from "next/link";
import { ArrowRight, Camera, HeartHandshake } from "lucide-react";

export default function Home() {
  return (
    <main className="page home-page">
      <p className="planning-eyebrow" style={{ marginTop: 4 }}>This week&apos;s prices</p>
      <h1 className="home-title">How are you<br />eating today?</h1>

      <div className="home-grid">
        <Link className="home-card" href="/cook">
          <div className="meal-art meal-art-cook" role="img" aria-label="A warm bowl of noodles with vegetables" />
          <div className="home-card-label">
            <div><strong>Cook at home</strong><span>Meals built around what&apos;s on sale</span></div>
            <span className="home-card-go" aria-hidden="true"><ArrowRight size={20} /></span>
          </div>
        </Link>
        <Link className="home-card" href="/eat-out">
          <div className="meal-art meal-art-out" role="img" aria-label="A tray of prepared food" />
          <div className="home-card-label">
            <div><strong>Eat out</strong><span>End-of-day meals for less</span></div>
            <span className="home-card-go" aria-hidden="true"><ArrowRight size={20} /></span>
          </div>
        </Link>
        <Link className="home-row" href="/support">
          <HeartHandshake size={24} aria-hidden="true" />
          <span>Need food support?<small>Food banks, free meals and fridges nearby</small></span>
          <ArrowRight size={20} aria-hidden="true" />
        </Link>
      </div>

      <Link className="fab" href="/report"><Camera size={22} aria-hidden="true" />Share a price</Link>
    </main>
  );
}
