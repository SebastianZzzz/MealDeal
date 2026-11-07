import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { lang } = (await request.json()) as { lang?: string };
  return NextResponse.json(lang === "zh"
    ? { lang: "zh", weight: "jin", volume: "ml" }
    : { lang: "en", weight: "lb", volume: "cup" });
}
