// Letras del sitio público (Inter y Inter Tight). Se cargan solo en las páginas públicas, no en la app.
import { Inter, Inter_Tight } from "next/font/google";

export const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
export const tight = Inter_Tight({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-tight", display: "swap" });
