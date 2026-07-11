/**
 * Layout compartido del hub de administración — /configuracion (P6).
 *
 * docs/design.md §"Panel de gestión de límites" → 1. "Control de navegación
 * — /configuracion es el hub de administración con navegación vertical de
 * secciones" y 1.b/1.c.
 *
 * Contiene lo PERSISTENTE entre las 4 secciones (General · Categorías ·
 * Métodos de pago · Límites), para que NO se re-monte al navegar entre
 * rutas hijas:
 * - Cabecera de página `.phead` (eyebrow "Ajustes" + único H1 "Configuración"
 *   + bajada "Preferencias de tu cuenta.").
 * - Columna de navegación vertical (landmark `<nav>` con `Link`, ítem activo
 *   con `aria-current="page"` derivado de `usePathname()` — NO tablist, NO
 *   estado efímero, ver §1.c).
 *
 * `{children}` = el contenido de la sección activa (la ruta hija).
 *
 * Responsive (≤940px, `max-wide`): una columna, nav arriba como fila que
 * envuelve (`flex-wrap`), contenido debajo — ver §1.c "Responsive".
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/configuracion", label: "General" },
  { href: "/configuracion/categorias", label: "Categorías" },
  { href: "/configuracion/metodos-pago", label: "Métodos de pago" },
  { href: "/configuracion/limites", label: "Límites" },
] as const;

export default function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="px-10 py-[34px] pb-20 max-w-[1120px] mx-auto animate-screen-fade">
      {/* Cabecera .phead — único H1 y único eyebrow de la pantalla (§1.b) */}
      <div className="mb-6">
        <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted mb-1">
          Ajustes
        </p>
        <h1 className="text-[32px] font-bold tracking-[-0.02em] text-ink leading-tight">
          Configuración
        </h1>
        <p className="text-[14px] text-muted mt-2">
          Preferencias de tu cuenta.
        </p>
      </div>

      <div className="flex flex-col gap-6 wide:flex-row wide:items-start wide:gap-8">
        {/* Nav de secciones — landmark de navegación, no tablist (§1.c) */}
        <nav
          aria-label="Secciones de configuración"
          className="flex flex-row flex-wrap gap-1 bg-panel-2 border border-line rounded-[var(--r-card)] p-1 wide:flex-col wide:w-[200px] wide:shrink-0 wide:p-1.5"
        >
          {SECTIONS.map((section) => {
            const active = pathname === section.href;
            return (
              <Link
                key={section.href}
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "w-auto text-left px-3 py-2.5 rounded-ctl wide:w-full",
                  "border border-transparent",
                  "text-[13.5px] font-semibold",
                  "transition-colors duration-[140ms] motion-reduce:transition-none",
                  "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
                  active
                    ? "bg-panel border-line shadow-[var(--shadow-sm)] text-ink"
                    : "text-muted hover:bg-panel-3 hover:text-ink",
                )}
              >
                {section.label}
              </Link>
            );
          })}
        </nav>

        {/* Contenido de la sección activa (ruta hija) */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
