"use client";

/**
 * Sidebar de navegación global — RF-NAV-001.
 *
 * Client Component por:
 * - usePathname() para marcar la sección activa
 * - useState para el estado colapsado (mobile hamburguesa)
 *
 * Layout:
 * - Desktop: fijo a la izquierda (w-64), siempre visible
 * - Mobile: oculto por defecto; drawer overlay activado por botón hamburguesa
 *
 * Recibe el email del usuario del layout padre (Server Component que llama a auth()).
 */

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NewTransactionButton } from "@/components/movements/new-transaction-button";
import { UserMenu } from "@/components/layout/user-menu";

interface AppSidebarProps {
  email: string;
}

const NAV_LINKS = [
  { href: "/", label: "Dashboard", exact: true },
  { href: "/mes", label: "Vista del mes", exact: false },
  { href: "/categorias", label: "Categorías", exact: false },
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
    <div className="flex h-full flex-col">
      {/* ── Logo / nombre ── */}
      <div className="border-b px-6 py-5">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight hover:opacity-80 transition-opacity"
          onClick={() => setMobileOpen(false)}
        >
          Control
        </Link>
      </div>

      {/* ── Botón "Nuevo movimiento" ── */}
      <div className="px-4 py-4 border-b">
        <NewTransactionButton label="Nuevo movimiento" variant="default" />
      </div>

      {/* ── Links de navegación ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1" role="list">
          {NAV_LINKS.map(({ href, label, exact }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive(href, exact)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
                aria-current={isActive(href, exact) ? "page" : undefined}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Menú de usuario (parte inferior) ── */}
      <div className="border-t px-4 py-4">
        <UserMenu email={email} />
      </div>
    </div>
  );

  return (
    <>
      {/* ── Botón hamburguesa — solo en mobile ── */}
      <button
        type="button"
        aria-label="Abrir menú"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-40 flex items-center justify-center rounded-md p-2 text-foreground hover:bg-accent lg:hidden"
      >
        {/* Hamburguesa icon (3 líneas) */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      </button>

      {/* ── Sidebar desktop — siempre visible ── */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:border-r lg:bg-background z-30">
        {sidebarContent}
      </aside>

      {/* ── Drawer mobile — overlay ── */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            aria-hidden="true"
            onClick={() => setMobileOpen(false)}
          />
          {/* Panel del drawer */}
          <aside className="fixed inset-y-0 left-0 z-50 w-64 flex-col border-r bg-background shadow-xl lg:hidden flex">
            {/* Botón cerrar dentro del drawer */}
            <button
              type="button"
              aria-label="Cerrar menú"
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
