// Picture for a listing card. Sample dishes with a photo use it; everything else gets a drawn tile
// in the home page's style. Add a photo by dropping it in public/images and listing the id here.
const PHOTOS: Record<string, string> = {
  "sample-noodle-bar": "/images/home-noodles.jpg",
  "sample-bento-house": "/images/home-bento.jpg",
};

const TILES: { match: RegExp; background: string; color: string; path: string }[] = [
  { match: /bread|pastry|bakery|croissant/i, background: "#f1e3c8", color: "#8a6a3b", path: "M4 13c0-4 3.6-7 8-7s8 3 8 7v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM9 9v3M12 8v4M15 9v3" },
  { match: /sandwich|wrap|burger/i, background: "#efe0c9", color: "#8a6a3b", path: "M3 14h18M5 10l7-5 7 5zM4 14v2a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-2" },
  { match: /salad|green|vegetable/i, background: "#e1ebd5", color: "#5c7a45", path: "M3 12h18c-.5 4.5-4 8-9 8s-8.5-3.5-9-8zM8 12c0-3 2-5 4-6M12 12c.5-3 2.5-5 5-5M7 9c1 0 2 .5 3 1.5" },
  { match: /sushi|roll|fish/i, background: "#e3e7ea", color: "#4f6470", path: "M4 8h16v8H4zM8 8v8M12 8v8M16 8v8" },
  { match: /curry|rice|bowl|soup|noodle/i, background: "#f3dcc0", color: "#8d5a2b", path: "M3 11h18c-.5 5-4 9-9 9s-8.5-4-9-9zM8 8c-1-1.5 1-2.5 0-4M12 8c-1-1.5 1-2.5 0-4M16 8c-1-1.5 1-2.5 0-4" },
];
const FALLBACK = { background: "#e7ecdf", color: "#5c6f53", path: "M3 11h18c-.5 5-4 9-9 9s-8.5-4-9-9zM12 3v5" };

export function DishArt({ id, title }: { id: string; title: string }) {
  const photo = PHOTOS[id];
  if (photo) {
    return <div role="img" aria-label={title} style={{ height: 150, borderRadius: 14, margin: "0 0 14px", background: `#f3d28e url("${photo}") center / cover no-repeat` }} />;
  }
  const tile = TILES.find((item) => item.match.test(title)) ?? FALLBACK;
  return (
    <div aria-hidden="true" style={{ height: 150, borderRadius: 14, margin: "0 0 14px", background: tile.background, color: tile.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d={tile.path} /></svg>
    </div>
  );
}
