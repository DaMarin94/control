"use client";

/**
 * AppShell — contenedor del sidebar toggleable + <main> (RF-NAV-002).
 *
 * Es el punto donde vive el estado de abierto/cerrado del sidebar, compartido
 * por dos hermanos del árbol (AppSidebar y <main>): AppSidebar decide qué
 * encarnación del control mostrar, <main> reajusta su offset izquierdo.
 *
 * <main> es el `@container` de la app autenticada (docs/design.md §"Ancho de
 * contenido de página"): todo lo que vive bajo <main> mide el régimen
 * amplio/compacto (`@wide:`/`@max-wide:`, mismo umbral 941px que `--bp-wide`)
 * contra el ancho REAL disponible acá, no contra el viewport.
 *
 * Offset del sidebar vía `margin-left` (NO `padding-left`): container queries
 * de tipo `inline-size` miden el tamaño propio del contenedor INCLUYENDO su
 * padding — si offseteáramos con padding, <main> se "creería" más ancho de lo
 * que el contenido realmente puede usar (rompe el checkpoint crítico:
 * sidebar abierto a viewport ~1000px, contenido real ~712px, no debe montar
 * régimen amplio). `margin-left` no participa del tamaño propio del elemento
 * (para un bloque `width:auto`, el ancho usado ya descuenta los márgenes), así
 * que el ancho medido por `@container` coincide exactamente con el ancho de
 * contenido documentado en docs/design.md (viewport − 248px si está abierto).
 *
 * Transición 0.24s cubic-bezier(0.4,0,0.2,1) — coordinada con el deslizamiento
 * del propio AppSidebar (misma duración/easing, dos elementos independientes
 * animando en sincronía). `prefers-reduced-motion` → instantáneo.
 *
 * `paddingTop: 36px` con el sidebar CERRADO (`0` si está abierto) — banda
 * reservada para el chip flotante "Mostrar menú" (docs/design.md §"Sidebar —
 * mostrar/ocultar" → "Banda reservada del chip flotante"). El chip flota en
 * coordenadas de viewport y, sin esta banda, se pinta encima del arranque del
 * contenido a anchos ≲1200px (ej. "Historial" se leía "listorial"). Vertical
 * ÚNICAMENTE — nunca `padding-left`: desalinearía el header respecto del
 * cuerpo e inflaría el `inline-size` que miden las container queries (mismo
 * motivo por el que el offset del sidebar usa `margin-left`, no `padding-left`,
 * arriba). Anima dentro de la MISMA transición que `margin-left`: cerrar el
 * sidebar es un solo movimiento coordinado.
 */

import { AppSidebar } from "@/components/layout/app-sidebar";
import { useSidebarOpen } from "@/hooks/use-sidebar-open";

interface AppShellProps {
  email: string;
  /** Preferencia `sidebarOpen` ya resuelta server-side (default `true`). */
  initialSidebarOpen: boolean;
  children: React.ReactNode;
}

export function AppShell({ email, initialSidebarOpen, children }: AppShellProps) {
  const { sidebarOpen, toggleSidebar } = useSidebarOpen(initialSidebarOpen);

  return (
    <div className="min-h-screen bg-paper">
      <AppSidebar email={email} open={sidebarOpen} onToggle={toggleSidebar} />

      <main
        className="@container min-h-screen transition-[margin-left,padding-top] duration-[240ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none"
        style={{ marginLeft: sidebarOpen ? 248 : 0, paddingTop: sidebarOpen ? 0 : 36 }}
      >
        {children}
      </main>
    </div>
  );
}
