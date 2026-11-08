import Image from "next/image";
import styles from "./surplus.module.css";

const PHOTOS: Record<string, string> = {
  "sample-noodle-bar": "/images/home-noodles.jpg",
  "sample-bento-house": "/images/home-bento.jpg",
};

const TILES = [
  { match: /bread|pastry|bakery|croissant/i, path: "M4 13c0-4 3.6-7 8-7s8 3 8 7v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM9 9v3M12 8v4M15 9v3" },
  { match: /sandwich|wrap|burger/i, path: "M3 14h18M5 10l7-5 7 5zM4 14v2a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-2" },
  { match: /salad|green|vegetable/i, path: "M3 12h18c-.5 4.5-4 8-9 8s-8.5-3.5-9-8zM8 12c0-3 2-5 4-6M12 12c.5-3 2.5-5 5-5M7 9c1 0 2 .5 3 1.5" },
  { match: /sushi|roll|fish/i, path: "M4 8h16v8H4zM8 8v8M12 8v8M16 8v8" },
];
const BOWL = "M3 11h18c-.5 5-4 9-9 9s-8.5-4-9-9zM8 8c-1-1.5 1-2.5 0-4M12 8c-1-1.5 1-2.5 0-4M16 8c-1-1.5 1-2.5 0-4";

export function DishArt({ id, title }: { id: string; title: string }) {
  const photo = PHOTOS[id];
  if (photo) {
    return <div className={styles.art}>
      <Image src={photo} alt="" fill sizes="(max-width: 440px) 85vw, 360px" className={styles.photo} />
    </div>;
  }
  const path = TILES.find((tile) => tile.match.test(title))?.path ?? BOWL;
  return <div className={styles.art} aria-hidden="true">
    <svg className={styles.drawing} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>
  </div>;
}
