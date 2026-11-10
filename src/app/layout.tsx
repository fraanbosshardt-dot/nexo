import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight, Roboto } from "next/font/google";
import { SITE } from "@/lib/seo";
import { PwaRegister } from "@/components/pwa";
import "./globals.css";
import "./nx.css";
import "./site.css";
import "./landing.css";
import "./motion.css";
import Script from "next/script";

const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-roboto", display: "swap" });
// Sitio público: Inter para el texto e Inter Tight para los títulos.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const tight = Inter_Tight({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-tight", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.title, template: "%s · NEXO" },
  description: SITE.description,
  applicationName: SITE.name,
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: SITE.name, title: SITE.title, description: SITE.description, url: "/", locale: "es_419" },
  twitter: { card: "summary_large_image", title: SITE.title, description: SITE.description },
  robots: { index: true, follow: true },
  appleWebApp: { capable: true, title: "NEXO", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#1A5FD0" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={`${roboto.variable} ${inter.variable} ${tight.variable}`}>
      <body><Script id="nexo-big" strategy="beforeInteractive">{`try{var d=document.documentElement;if(localStorage.getItem("nexo-big")==="1")d.setAttribute("data-big","");var t=localStorage.getItem("nexo-theme");if(t==="light"||t==="dark")d.setAttribute("data-theme",t)}catch(e){}`}</Script></body>{children}<PwaRegister />
    </html>
  );
}
