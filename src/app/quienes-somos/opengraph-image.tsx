import { ogImage, OG_SIZE } from "@/lib/og";

export const alt = "Que llegar a fin de mes deje de ser una sorpresa";
export const size = OG_SIZE;
export const contentType = "image/png";
export default function Image() {
  return ogImage("Que llegar a fin de mes deje de ser una sorpresa", "Una app argentina de finanzas personales.", "Quiénes somos");
}
