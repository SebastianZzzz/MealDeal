import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import { TopBar } from "@/components/top-bar";
import { getIdentity } from "@/lib/session";
import { isAuth0Configured } from "@/lib/env";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-fraunces", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-dm-sans", display: "swap" });

export const metadata: Metadata = {
  title: "MealDeal",
  description: "Turn your budget and local grocery prices into meals you can actually make.",
  applicationName: "MealDeal",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "MealDeal" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#f4f1ea" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const identity = await getIdentity();
  const account = identity?.sub === "demo|student" ? "demo" : identity?.sub ? "signed-in" : isAuth0Configured() ? "signed-out" : "unavailable";
  const name = typeof identity?.name === "string" ? identity.name : typeof identity?.email === "string" ? identity.email : undefined;
  return (
    <html lang="en" className={`${fraunces.variable} ${dmSans.variable}`}>
      <body>
        <div className="app">
          <TopBar account={account} name={name} />
          {children}
        </div>
      </body>
    </html>
  );
}
