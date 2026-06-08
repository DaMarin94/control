/**
 * Middleware de Next.js — protección de rutas.
 *
 * Rutas públicas: /login, /registro, /api/auth/* (callbacks de NextAuth)
 * Rutas privadas: todo lo demás. Sin sesión → redirige a /login.
 * Usuario autenticado en /login o /registro → redirige al dashboard.
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/registro"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthenticated = !!req.auth;

  // Rutas de API de auth — siempre permitir
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Si ya está autenticado y entra a /login o /registro → redirigir al dashboard
  if (isAuthenticated && PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Si no está autenticado y la ruta es privada → redirigir a /login
  if (!isAuthenticated && !PUBLIC_PATHS.includes(pathname)) {
    const loginUrl = new URL("/login", req.url);
    // Guardar la URL original para redirigir después del login
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Matchea todo excepto:
     * - _next/static  (archivos estáticos de Next.js)
     * - _next/image   (optimización de imágenes)
     * - favicon.ico   (favicon)
     * - archivos con extensión (imágenes, fonts, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
