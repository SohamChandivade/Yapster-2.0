import type { MetadataRoute } from "next";

/** Web app manifest, served at /manifest.webmanifest and linked from every page by Next. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Yapster",
    short_name: "Yapster",
    description: "Practise German by talking to a tutor who remembers you.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "en",
    background_color: "#F7F5F2",
    theme_color: "#F7F5F2",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Start talking", url: "/talk", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Scenarios", url: "/scenarios" },
    ],
  };
}
