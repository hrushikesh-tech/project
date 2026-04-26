import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Amdox ERP",
    short_name: "Amdox",
    description: "Phase 12 frontend with operational modules, offline queue, dashboards, and scheduling.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f5f7fb",
    theme_color: "#0f766e",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
