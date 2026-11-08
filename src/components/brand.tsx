import Image from "next/image";
import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className={`brand ${compact ? "brand-compact" : ""}`} href="/" aria-label="MealDeal home">
      <span className="brand-mark" aria-hidden="true">
        <Image src="/images/mealdeal-logo.svg" alt="" width={30} height={30} priority />
      </span>
      <span>MealDeal</span>
    </Link>
  );
}
