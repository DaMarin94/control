/**
 * Root layout — Server Component.
 * Monta los providers globales (ReactQuery, Toast, SessionProvider) y carga la validación de env.
 *
 * Fuentes del design system "Precise Ledger":
 *   - Space Grotesk  → var(--font-ui)   → consumida por --ui en globals.css
 *   - IBM Plex Mono  → var(--font-mono) → consumida por --mono en globals.css
 */

// La importación de env.ts dispara la validación al arrancar.
// Si falta una variable requerida, la app no compila/arranca.
import "@/lib/env";

import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { ReactQueryProvider } from "@/lib/react-query";
import { ToastProvider } from "@/components/ui/toast";
import { AuthSessionProvider } from "@/lib/session-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { auth } from "@/auth";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Control — Diario de gastos",
  description: "Registrá y controlá tus gastos personales",
};

/**
 * Script inline anti-flash (FOUC) para el modo de color.
 *
 * Se ejecuta de forma síncrona antes del primer paint — nunca como módulo
 * (los scripts de módulo son diferidos). Lee el mirror de localStorage
 * ("control:theme") que el hook useTheme mantiene sincronizado con la
 * fuente canónica (clave `theme` del blob de preferencias en DB).
 *
 * Lógica:
 *   1. Lee el mirror ("system" | "light" | "dark" | null/ausente).
 *   2. "system" (o ausente) → resuelve con matchMedia('prefers-color-scheme: dark').
 *   3. Setea document.documentElement.dataset.theme = "light" | "dark".
 *
 * La fuente canónica (DB) se sincroniza en el cliente cuando la sesión carga
 * (ver hook useTheme). El mirror existe solo para el boot sin flash.
 */
const themeScript = `(function(){try{var t=localStorage.getItem('control:theme');var resolved=(t==='dark'||(!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';document.documentElement.dataset.theme=resolved;}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="es" suppressHydrationWarning>
      {/* Script inline síncrono — resuelve el tema ANTES del primer paint (anti-FOUC) */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} antialiased`}>
        <AuthSessionProvider session={session}>
          <ReactQueryProvider>
            <ThemeProvider>
              <ToastProvider>{children}</ToastProvider>
            </ThemeProvider>
          </ReactQueryProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
