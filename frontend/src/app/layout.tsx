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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} antialiased`}>
        <AuthSessionProvider>
          <ReactQueryProvider>
            <ToastProvider>{children}</ToastProvider>
          </ReactQueryProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
