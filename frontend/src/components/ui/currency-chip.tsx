"use client";

/**
 * CurrencyChip — Indicador de moneda default a nivel de app (Fase 1.2.3 — extensión).
 *
 * Spec visual: docs/design.md §"Indicador de moneda default a nivel app"
 * y docs/design/specs-archive.md §"Indicador de moneda default a nivel app".
 *
 * Composición:
 *   - Glifo Wallet (13px, --muted, aria-hidden) — distingue del badge por-ítem
 *   - Código de moneda ("ARS" / "USD") en mono 11.5px·600·.04em --ink-2
 *   - En hover: ChevronRight (11px, --faint) a la derecha — indica "gestión externa"
 *
 * Caja: --panel-3, --r-chip 7px, px-[8px] py-[3px]. Neutro estricto.
 * Es un Link a /configuracion. NO cambia la moneda in-situ. NO popover.
 *
 * Se muestra SIEMPRE (incluso mono-moneda): es el ancla de contexto de la pantalla.
 *
 * Reglas duras:
 * - Nunca verde/rojo (regla dura 1) ni índigo de marca (regla dura 2).
 * - El índigo solo aparece como focus ring (cromo de interacción).
 * - El código va en mono tabular (regla dura 3).
 */

import Link from "next/link";
import { Wallet, ChevronRight } from "lucide-react";
import type { CurrencyCode } from "@/types/settings";

interface CurrencyChipProps {
  /** Código de moneda default vigente. */
  currency: CurrencyCode;
}

export function CurrencyChip({ currency }: CurrencyChipProps) {
  return (
    <Link
      href="/configuracion"
      aria-label={`Moneda por defecto: ${currency}. Cambiar en Configuración`}
      className={[
        // Caja base
        "inline-flex items-center gap-[6px]",
        "rounded-[7px] bg-panel-3 px-[8px] py-[3px]",
        // Reposo
        "transition-colors duration-[140ms]",
        // Hover: fondo panel-2, código ink, glifo ink-2, chevron visible
        "hover:bg-panel-2",
        // Focus (teclado): ring accent-soft 3px — cromo de interacción (ok)
        "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
        // Grupo para gestionar visibilidad del chevron en hover
        "group",
      ].join(" ")}
    >
      {/* Wallet — comunica "moneda del contexto"; distingue del badge por-ítem */}
      <Wallet
        size={13}
        aria-hidden="true"
        className="shrink-0 text-muted group-hover:text-ink-2 transition-colors duration-[140ms]"
      />

      {/* Código de moneda en mono tabular */}
      <span
        className="mono text-[11.5px] font-semibold tracking-[0.04em] text-ink-2 group-hover:text-ink transition-colors duration-[140ms]"
        /* Tabular numbers para el código (regla dura 3) */
        style={{ fontFeatureSettings: '"tnum" 1' }}
      >
        {currency}
      </span>

      {/* ChevronRight — indica "se gestiona en otro lado"; solo en hover */}
      <ChevronRight
        size={11}
        aria-hidden="true"
        className="shrink-0 text-faint opacity-0 group-hover:opacity-100 transition-opacity duration-[140ms]"
      />
    </Link>
  );
}
