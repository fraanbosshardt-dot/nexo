import type { MetadataRoute } from "next";

// Permite instalar NEXO en el celular como una app (ícono en la pantalla de inicio).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NEXO Finanzas",
    short_name: "NEXO",
    description: "Sabé cuánto tenés, cuánto debés y cuánto podés gastar.",
    start_url: "/app",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#1A5FD0",
    lang: "es",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
