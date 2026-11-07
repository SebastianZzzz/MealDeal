import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "MealDeal", description: "Your budget, turned into real meals." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f7f6ee" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
