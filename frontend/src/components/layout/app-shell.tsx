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
        className="@container min-h-screen transition-[margin-left] duration-[240ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none"
        style={{ marginLeft: sidebarOpen ? 248 : 0 }}
      >
        {children}
      </main>
    </div>
  );
}
