import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Aísla la ventana: otra página no puede manejar la de Somos Guafra ni leer sus recursos.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // Solo se cargan recursos de Somos Guafra. Next necesita scripts en línea; en desarrollo, también eval.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self' https://*.mercadopago.com https://*.mercadopago.com.ar",
      "object-src 'none'",
      "worker-src 'self'",
      "manifest-src 'self'",
      ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["pg"],
  // Para subir el CSV de importación y el PDF del resumen (cada uno se valida hasta 5 MB).
  experimental: { serverActions: { bodySizeLimit: "6mb" }, staleTimes: { dynamic: 30, static: 300 } },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // El logo público del correo debe poder cargarse en clientes de email.
      { source: "/email-logo.png", headers: [{ key: "Cross-Origin-Resource-Policy", value: "cross-origin" }] },
      // El service worker se revisa siempre, para que las actualizaciones lleguen enseguida.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Content-Type", value: "application/javascript; charset=utf-8" }] },
    ];
  },
  async redirects() {
    return [{ source: "/prototipo", destination: "/prototipo.html", permanent: false }];
  },
};

export default nextConfig;
