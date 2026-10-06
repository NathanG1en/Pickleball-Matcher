import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pickleball Matchmaker",
    short_name: "Pickleball",
    description: "Fair, varied pickleball round generation for recurring groups.",
    start_url: "/",
    display: "standalone",
    background_color: "#071317",
    theme_color: "#17615c",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
