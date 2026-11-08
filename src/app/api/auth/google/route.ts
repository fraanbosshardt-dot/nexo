// Paso 1: manda a la persona a elegir su cuenta de Google.
import { NextResponse, type NextRequest } from "next/server";
import { GOOGLE_COOKIE, googleEnabled, startGoogle } from "@/lib/auth/google";
import { appUrl } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const base = appUrl();
  if (!googleEnabled()) return NextResponse.redirect(`${base}${req.nextUrl.searchParams.get("desde") === "admin" ? "/admin/ingresar" : "/ingresar"}?google=off`);
  const d = req.nextUrl.searchParams.get("desde");
  const desde = d === "registro" || d === "admin" ? d : "ingresar";
  const { url, cookie } = startGoogle(base, desde);
  const res = NextResponse.redirect(url);
  res.cookies.set(GOOGLE_COOKIE, cookie, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth/google", maxAge: 600 });
  res.headers.set("cache-control", "no-store");
  return res;
}
