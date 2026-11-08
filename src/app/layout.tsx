import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MealDeal",
  description: "Turn your budget and local grocery prices into meals you can actually make.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f5f2e8" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
