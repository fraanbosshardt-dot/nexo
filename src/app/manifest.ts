import type { MetadataRoute } from "next";

// Permite instalar Somos Guafra en el celular como una app (ícono en la pantalla de inicio, pantalla completa).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "Somos Guafra",
    short_name: "Somos Guafra",
    description: "Sabé cuánto tenés, cuánto debés y cuánto podés gastar hasta tu próximo cobro.",
    start_url: "/app?origen=app",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#FFFFFF",
    theme_color: "#16493A",
    lang: "es",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Cargar un gasto", short_name: "Gasto", url: "/app/movimientos/nuevo", icons: [{ src: "/icons/192", sizes: "192x192", type: "image/png" }] },
      { name: "Próximos pagos", short_name: "Próximos", url: "/app/proximos", icons: [{ src: "/icons/192", sizes: "192x192", type: "image/png" }] },
    ],
  };
}
