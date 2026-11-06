import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight, Roboto } from "next/font/google";
import "./globals.css";
import "./nx.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-roboto", display: "swap" });
const interTight = Inter_Tight({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-inter-tight", display: "swap" });

export const metadata: Metadata = {
  title: { default: "NEXO Finanzas", template: "%s · NEXO" },
  description: "Sabé cuánto tenés, cuánto debés y cuánto vas a tener. Finanzas personales en tu moneda.",
  appleWebApp: { capable: true, title: "NEXO", statusBarStyle: "default" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#1A5FD0" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${inter.variable} ${interTight.variable} ${roboto.variable}`}>
      <body>{children}</body>
    </html>
  );
}
