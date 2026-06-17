"use client";

/**
 * Sidebar de navegación global — RF-NAV-001.
 *
 * Re-estilada con tokens del DS "Precise Ledger" (Fase 3).
 *
 * Client Component por:
 * - usePathname() para marcar la sección activa
 * - useState para el estado colapsado (mobile hamburguesa)
 *
 * Layout:
 * - Desktop: fijo a la izquierda (248px), siempre visible
 * - Mobile (≤940px): oculto por defecto; drawer overlay activado por botón hamburguesa
 *
 * Recibe el email del usuario del layout padre (Server Component que llama a auth()).
 */

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NewTransactionButton } from "@/components/movements/new-transaction-button";
import { UserMenu } from "@/components/layout/user-menu";
import {
  LayoutDashboard,
  CalendarDays,
  BarChart2,
  Tags,
  Menu,
  X,
} from "lucide-react";

interface AppSidebarProps {
  email: string;
}

const NAV_LINKS = [
  { href: "/", label: "Dashboard", exact: true, Icon: LayoutDashboard },
  { href: "/mes", label: "Vista del mes", exact: false, Icon: CalendarDays },
  { href: "/reportes", label: "Reportes", exact: false, Icon: BarChart2 },
  { href: "/categorias", label: "Categorías", exact: false, Icon: Tags },
] as const;

export function AppSidebar({ email }: AppSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  /**
   * Determina si un link está activo.
   * Para el dashboard (href="/"), la comparación es EXACTA — no marcar activo
   * en /mes, /categorias, etc. Para el resto, prefijo (pathname.startsWith).
   */
  function isActive(href: string, exact: boolean): boolean {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  const sidebarContent = (
    <div className="flex h-full flex-col gap-1">
      {/* ── Logo ── */}
      <Link
        href="/"
        onClick={() => setMobileOpen(false)}
        className="flex items-center gap-[11px] px-2 pb-[18px] pt-1 rounded-ctl transition-colors duration-[140ms] hover:bg-panel-2 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
      >
        {/* Gem */}
        <span
          aria-hidden="true"
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] text-white font-bold text-[18px] leading-none shadow-[var(--shadow-sm),inset_0_1px_0_oklch(1_0_0_/_0.25)]"
          style={{ background: "linear-gradient(150deg, var(--accent), var(--accent-press))" }}
        >
          C
        </span>
        {/* Wordmark */}
        <div>
          <span className="block text-[18px] font-bold tracking-[-0.01em] text-ink leading-none">
            Control
          </span>
          <span className="block text-[11px] font-medium text-muted tracking-[0.04em] mt-[-2px]">
            Finanzas del mes
          </span>
        </div>
      </Link>

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
                  onClick={() => setMobileOpen(false)}
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

      {/* ── Menú de usuario (parte inferior) ── */}
      <UserMenu email={email} />
    </div>
  );

  return (
    <>
      {/* ── Botón hamburguesa — solo en mobile (≤940px) ── */}
      <button
        type="button"
        aria-label="Abrir menú"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen(true)}
        className={cn(
          "fixed top-4 left-4 z-40",
          "flex items-center justify-center rounded-ctl p-2",
          "text-ink-2 hover:bg-panel-2 transition-colors duration-[140ms]",
          "[@media(min-width:941px)]:hidden",
        )}
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      {/* ── Sidebar desktop — siempre visible en ≥941px ── */}
      <aside
        className={cn(
          "hidden [@media(min-width:941px)]:flex",
          "fixed inset-y-0 left-0 z-30 w-[248px] flex-col",
          "border-r border-line bg-panel",
          "px-4 py-[22px]",
        )}
      >
        {sidebarContent}
      </aside>

      {/* ── Drawer mobile — overlay ── */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-ink/50 [@media(min-width:941px)]:hidden"
            aria-hidden="true"
            onClick={() => setMobileOpen(false)}
          />
          {/* Panel del drawer */}
          <aside
            className={cn(
              "fixed inset-y-0 left-0 z-50 w-[248px] flex flex-col",
              "border-r border-line bg-panel shadow-[var(--shadow-lg)]",
              "px-4 py-[22px]",
              "[@media(min-width:941px)]:hidden",
            )}
          >
            {/* Botón cerrar dentro del drawer */}
            <button
              type="button"
              aria-label="Cerrar menú"
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 flex items-center justify-center rounded-ctl p-1.5 text-muted hover:bg-panel-2 hover:text-ink transition-colors duration-[140ms]"
            >
              <X size={18} aria-hidden="true" />
            </button>
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
