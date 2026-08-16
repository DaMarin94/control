/**
 * Root layout — Server Component.
 * Monta los providers globales (ReactQuery, Toast, SessionProvider) y carga la validación de env.
 *
 * Fuentes del design system "Precise Ledger":
 *   - Space Grotesk  → var(--font-ui)   → consumida por --ui en globals.css
 *   - IBM Plex Mono  → var(--font-mono) → consumida por --mono en globals.css
 */

// La importación de env.ts dispara la validación al arrancar (si falta una
// variable requerida, la app no compila/arranca) y expone `isGoogleConfigured`
// — lo necesita `CaptureSurfaceRoot` para el acceso en régimen de captura
// (RF-APP-004), igual que ya lo necesitaba app/login/page.tsx.
import { isGoogleConfigured } from "@/lib/env";

import type { Metadata, Viewport } from "next";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { ReactQueryProvider } from "@/lib/react-query";
import { ToastProvider } from "@/components/ui/toast";
import { AuthSessionProvider } from "@/lib/session-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { CaptureSurfaceRoot } from "@/components/capture/capture-surface-root";
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
 * Viewport — `interactiveWidget: "overlays-content"` (deliberado, NO
 * "resizes-content"): esta última encogería el VIEWPORT DE LAYOUT al abrir
 * el teclado virtual, lo que alteraría CUALQUIER media query de `height` —
 * incluidas las que ahora deciden el RÉGIMEN mismo (`capture:`/`app-regime:`,
 * criterio `min(ancho, alto) < 600px` sobre el VIEWPORT, no la pantalla
 * física — docs/design.md §Contención responsive) y `short:` (max-height:
 * 480px, §Superficie de captura → "12. Disposición corta"). Con
 * "resizes-content", un teclado virtual alto en un viewport ya angosto de
 * alto podría cruzar el umbral de 600px MIENTRAS EL USUARIO ESTÁ TIPEANDO
 * en la superficie de captura, sacándolo al régimen de app a mitad de
 * carga — exactamente lo que la frontera "continua, sin recarga y sin
 * pantalla intermedia" no debe permitir. Con "overlays-content" el viewport
 * de layout (y por lo tanto `dvh` y toda media query de alto, incluido el
 * criterio de régimen) queda estable sin importar el teclado. El requisito
 * de "Guardar visible sobre el teclado" (RF-APP-003) se resuelve en cambio
 * con `visualViewport` (`useVisualViewportInset`, hook consumido solo por
 * `CaptureShell`): la spec habilita explícitamente esta alternativa
 * ("declaración de interactive-widget... y/o seguimiento del viewport
 * visual").
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "overlays-content",
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
  const isAuthenticated = !!session?.user;
  const email = session?.user?.email ?? "";

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
              <ToastProvider>
                {/* Rama de app — oculta por completo en régimen de captura
                    (RF-APP-003: "nada más de la app es alcanzable"). `capture:hidden`
                    es CSS puro: decidido antes del primer paint, sin JS ni
                    listener de resize, así que cruzar la frontera (redimensionar,
                    rotar) conmuta sin recarga y sin flash. */}
                <div className="capture:hidden">{children}</div>
                {/* Superficie de captura / acceso en régimen de captura
                    (RF-APP-003/004) — montada siempre, visible solo bajo
                    `capture:` (ver globals.css). No hay ningún estado en el
                    que la app bloquee al usuario por tamaño: por debajo del
                    umbral hay siempre esta superficie. */}
                <CaptureSurfaceRoot
                  isAuthenticated={isAuthenticated}
                  email={email}
                  isGoogleConfigured={isGoogleConfigured}
                />
              </ToastProvider>
            </ThemeProvider>
          </ReactQueryProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
