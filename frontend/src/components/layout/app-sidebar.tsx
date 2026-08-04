"use client";

/**
 * Sidebar de navegación global — RF-NAV-001 + RF-NAV-002 (mostrar/ocultar).
 *
 * Re-estilada con tokens del DS "Precise Ledger" (Fase 3).
 * Rework: chrome toggleable (docs/design.md §"Sidebar — mostrar/ocultar").
 *
 * Un solo elemento, 248px, dos estados — válido en TODO ancho ≥640px. Ya NO
 * auto-colapsa por breakpoint (se retiró el modelo de hamburguesa + drawer +
 * overlay). El estado (`open`) y su persistencia viven en el padre (AppShell
 * + useSidebarOpen); este componente es puramente presentacional + dueño de
 * las DOS encarnaciones del control (nunca las dos a la vez):
 *   - Abierto: botón "Ocultar menú" (PanelLeftClose) al extremo derecho de la
 *     fila del logo, dentro del propio sidebar.
 *   - Cerrado: chip flotante "Mostrar menú" (PanelLeft), fixed top-4 left-4,
 *     con cuerpo propio (flota sobre contenido arbitrario de la página).
 *
 * El <aside> queda SIEMPRE montado (nunca se desmonta al cerrar) y se
 * desliza fuera de pantalla vía `transform` — así se puede animar la
 * transición de 0.24s. Cerrado, queda a translateX(-100%): 0px visibles, sin
 * rail residual ("desaparece por completo"), y además `inert` + `aria-hidden`
 * para que no sea focuseable ni visible a lectores de pantalla mientras está
 * fuera de pantalla.
 *
 * Recibe el email del usuario del layout padre (Server Component que llama a auth()).
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NewTransactionButton } from "@/components/movements/new-transaction-button";
import { UserMenu } from "@/components/layout/user-menu";
import { ThemeIconToggle } from "@/components/ui/theme-icon-toggle";
import { useTheme } from "@/hooks/use-theme";
import {
  LayoutDashboard,
  CalendarDays,
  BarChart2,
  History,
  Settings,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";

interface AppSidebarProps {
  email: string;
  /** Estado abierto/cerrado del sidebar (RF-NAV-002). */
  open: boolean;
  /** Alterna abierto ↔ cerrado. La persistencia la maneja el llamador. */
  onToggle: () => void;
}

const NAV_LINKS = [
  { href: "/", label: "Dashboard", exact: true, Icon: LayoutDashboard },
  { href: "/mes", label: "Vista del mes", exact: false, Icon: CalendarDays },
  { href: "/reportes", label: "Reportes", exact: false, Icon: BarChart2 },
  { href: "/historial", label: "Historial", exact: false, Icon: History },
  { href: "/configuracion", label: "Configuración", exact: false, Icon: Settings },
] as const;

export function AppSidebar({ email, open, onToggle }: AppSidebarProps) {
  const pathname = usePathname();
  const { theme, resolvedTheme, setTheme, isSaving: isThemeSaving } = useTheme();

  /**
   * Determina si un link está activo.
   * Para el dashboard (href="/"), la comparación es EXACTA — no marcar activo
   * en /mes, /categorias, etc. Para el resto, prefijo (pathname.startsWith).
   */
  function isActive(href: string, exact: boolean): boolean {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* ── Sidebar — 248px, dos estados (RF-NAV-002) ── */}
      <aside
        aria-hidden={!open}
        inert={!open}
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-[248px] flex flex-col",
          "border-r border-line bg-panel",
          "px-4 py-[22px]",
          "transition-transform duration-[240ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col gap-1">
          {/* ── Logo + botón de colapsar ── */}
          <div className="flex items-center gap-[11px] pb-[18px] pt-[10px]">
            <Link
              href="/"
              className="flex min-w-0 flex-1 items-center gap-[11px] -mx-2 -my-1 rounded-ctl px-2 py-1 transition-colors duration-[140ms] hover:bg-panel-2 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
            >
              {/* Gem */}
              <div className="h-[34px] w-[34px] shrink-0 rounded-[10px] overflow-hidden shadow-[var(--shadow-sm),inset_0_1px_0_oklch(1_0_0_/_0.25)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand-icon.svg"
                  alt=""
                  aria-hidden="true"
                  className="h-full w-full object-cover"
                />
              </div>
              {/* Wordmark */}
              <div className="min-w-0">
                <span className="block text-[18px] font-bold tracking-[-0.01em] text-ink leading-none">
                  Control
                </span>
                <span className="block text-[11px] font-medium text-muted tracking-[0.04em] mt-[-2px]">
                  Finanzas del mes
                </span>
              </div>
            </Link>

            {/* Botón "Ocultar menú" — chrome del propio sidebar, no un ítem de nav */}
            <button
              type="button"
              onClick={onToggle}
              aria-label="Ocultar menú"
              aria-expanded="true"
              className="ml-auto shrink-0 flex items-center justify-center rounded-ctl p-1.5 text-muted transition-colors duration-[140ms] hover:bg-panel-2 hover:text-ink active:bg-panel-3 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)] motion-reduce:transition-none"
            >
              <PanelLeftClose size={18} aria-hidden="true" />
            </button>
          </div>

          {/* ── Label de sección ── */}
          <p className="px-[10px] pb-[6px] pt-[10px] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-faint">
            Menú
          </p>

          {/* ── Links de navegación ── */}
          <nav aria-label="Navegación principal">
            <ul className="flex flex-col gap-0.5" role="list">
              {NAV_LINKS.map(({ href, label, exact, Icon }) => {
                const active = isActive(href, exact);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={cn(
                        "flex items-center gap-[11px] rounded-ctl px-[11px] py-[9px]",
                        "text-[14.5px] font-medium transition-colors duration-[140ms]",
                        active
                          ? "bg-accent-soft text-accent-ink font-semibold"
                          : "text-ink-2 hover:bg-panel-2 hover:text-ink",
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon
                        size={18}
                        className={cn("shrink-0", active ? "opacity-100" : "opacity-70")}
                        aria-hidden="true"
                      />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* ── Spacer ── */}
          <div className="flex-1" />

          {/* ── CTA Nuevo movimiento ── */}
          <div className="mx-0.5 mb-[14px] mt-1 [&>*]:w-full [&>*>button]:w-full">
            <NewTransactionButton label="+ Nuevo movimiento" variant="default" />
          </div>

          {/* ── Fila de tema — toggle de iconos encima del UserMenu ── */}
          <div
            className="flex items-center justify-between mb-[10px]"
            style={{ borderTop: "1px solid var(--hair)", paddingTop: "10px" }}
          >
            <span
              className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-faint select-none"
            >
              Tema
            </span>
            <ThemeIconToggle
              value={theme}
              onChange={(newTheme) => void setTheme(newTheme)}
              disabled={isThemeSaving}
              resolvedTheme={resolvedTheme}
            />
          </div>

          {/* ── Menú de usuario (parte inferior) ── */}
          <UserMenu email={email} />
        </div>
      </aside>

      {/* ── Chip flotante "Mostrar menú" — solo cuando el sidebar está cerrado ──
          Nunca convive con el botón de colapsar de arriba (un control lógico,
          dos encarnaciones). Flota sobre contenido arbitrario: cuerpo propio
          (bg-panel + border + shadow), a diferencia del botón de colapsar que
          vive sobre el bg-panel del sidebar. */}
      {!open && (
        <button
          type="button"
          onClick={onToggle}
          aria-label="Mostrar menú"
          aria-expanded="false"
          className="fixed top-4 left-4 z-40 flex items-center justify-center rounded-ctl border border-line bg-panel p-2.5 text-ink-2 shadow-[var(--shadow-sm)] transition-colors duration-[140ms] hover:bg-panel-2 hover:text-ink active:bg-panel-3 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)] motion-reduce:transition-none"
        >
          <PanelLeft size={20} aria-hidden="true" />
        </button>
      )}
    </>
  );
}
