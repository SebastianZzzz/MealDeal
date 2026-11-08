import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MealDeal — A better everyday meal",
  description: "Plan a meal, keep track of your kitchen, and make good food go further.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
