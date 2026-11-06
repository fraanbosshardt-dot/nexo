import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const interTight = Inter_Tight({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-inter-tight", display: "swap" });

export const metadata: Metadata = {
  title: { default: "NEXO Finanzas", template: "%s · NEXO" },
  description: "Sabé cuánto tenés, cuánto debés y cuánto vas a tener. Finanzas personales en tu moneda.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${inter.variable} ${interTight.variable}`}>
      <body>{children}</body>
    </html>
  );
}
