import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className={`brand ${compact ? "brand-compact" : ""}`} href="/" aria-label="MealDeal home">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19.5 4.5c-7.8-.6-12.6 2.2-12.8 7.1-.1 2.4 1.6 4.2 4.2 4.4 4.6.4 7.4-4.3 8.6-11.5Z" />
          <path d="M4.5 19.5c2.1-4 5.4-7 10.2-9.2" />
        </svg>
      </span>
      <span>MealDeal</span>
    </Link>
  );
}
