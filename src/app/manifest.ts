import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MealDeal",
    short_name: "MealDeal",
    description: "Turn your budget and local grocery prices into meals you can actually make.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f1ea",
    theme_color: "#00704a",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
