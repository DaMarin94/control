/**
 * Pantalla dedicada del gráfico anual — /anual (RF-GRA-003).
 *
 * Monta el widget AnnualChartWidget con navigable=true y año inicial = año actual.
 * El año es estado interno de esta pantalla (no va en la URL → no usa useSearchParams).
 *
 * Header de página .phead: eyebrow "Tu actividad" + H1 "Anual".
 * El año vive en el control ‹ › del widget, NO en el H1.
 *
 * Vive en (app)/ para heredar el sidebar del layout compartido.
 *
 * Spec visual: docs/design.md, sección "Ubicación en cada anfitrión".
 * Alto del área de gráfico: 340px (más aire que en el dashboard, al ser pantalla dedicada).
 */

"use client";

import { useState } from "react";
import { AnnualChartWidget } from "@/components/charts/annual-chart-widget";
import { getCurrentMonth } from "@/lib/format";

/** Deriva el año actual del mes actual (usa el helper del DS, no new Date() directo). */
function getCurrentYear(): number {
  const month = getCurrentMonth(); // "YYYY-MM"
  return parseInt(month.split("-")[0] ?? String(new Date().getFullYear()), 10);
}

export default function AnualPage() {
  const [year, setYear] = useState(() => getCurrentYear());

  return (
    <div className="px-10 py-[34px] pb-20 max-w-[1120px] mx-auto animate-screen-fade">
      {/* ── Header de página .phead ── */}
      <div className="mb-7">
        <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted mb-[6px]">
          Tu actividad
        </p>
        <h1 className="text-[32px] font-bold tracking-[-0.02em] leading-[1.05] text-ink m-0">
          Anual
        </h1>
      </div>

      {/* ── Widget de gráfico anual ── */}
      <AnnualChartWidget
        year={year}
        navigable={true}
        onYearChange={setYear}
        chartHeight={340}
      />
    </div>
  );
}
