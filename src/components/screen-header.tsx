import Link from "next/link";
import { Brand } from "./brand";

export function ScreenHeader({ backHref, backLabel = "Back" }: { backHref?: string; backLabel?: string }) {
  return (
    <>
      <header className="screen-header"><Brand compact /><span>VANCOUVER</span></header>
      {backHref && <Link className="screen-back" href={backHref}>← {backLabel}</Link>}
    </>
  );
}
