import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import { SITE } from "@/lib/seo";
import { PwaRegister } from "@/components/pwa";
import "./globals.css";
import "./nx.css";

const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-roboto", display: "swap" });

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
    <html lang="es" suppressHydrationWarning className={roboto.variable}>
      <body><script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem("nexo-big")==="1")document.documentElement.setAttribute("data-big","")}catch(e){}` }} /></body>{children}<PwaRegister />
    </html>
  );
}
