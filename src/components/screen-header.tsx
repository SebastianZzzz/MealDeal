// The app-wide TopBar (src/components/top-bar.tsx) now renders the brand and Back on every screen.
// Kept as a no-op so existing page imports stay valid; remove the call sites when convenient.
export function ScreenHeader(_props: { backHref?: string; backLabel?: string }) {
  return null;
}
