/**
 * Root layout — Server Component.
 * Monta los providers globales (ReactQuery, Toast, SessionProvider) y carga la validación de env.
 */

// La importación de env.ts dispara la validación al arrancar.
// Si falta una variable requerida, la app no compila/arranca.
import "@/lib/env";

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ReactQueryProvider } from "@/lib/react-query";
import { ToastProvider } from "@/components/ui/toast";
import { AuthSessionProvider } from "@/lib/session-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthSessionProvider>
          <ReactQueryProvider>
            <ToastProvider>{children}</ToastProvider>
          </ReactQueryProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
