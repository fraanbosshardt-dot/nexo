// Guarda la invitación mientras la persona entra o crea su cuenta; después de ingresar vuelve sola a aceptarla.
import { NextResponse, type NextRequest } from "next/server";
import { INVITE_COOKIE } from "@/server/sharing";

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const to = req.nextUrl.searchParams.get("a") === "registro" ? "/registro" : "/ingresar";
  const res = NextResponse.redirect(new URL(to, req.url));
  if (/^[\w-]{20,64}$/.test(token)) res.cookies.set(INVITE_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 3600 });
  return res;
}
