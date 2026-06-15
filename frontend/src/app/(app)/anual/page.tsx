/**
 * Pantalla dedicada del gráfico anual — /anual (RF-GRA-003).
 *
 * Monta las dos tarjetas apiladas:
 *   - IncomeExpenseCard (Forma 1) arriba
 *   - ByCategoryCard   (Forma 2) abajo
 *
 * El año es estado interno de la página (no va en la URL → no usa useSearchParams).
 * El control ‹ › compartido vive en el .phead, a la derecha del H1 "Anual",
 * gobernando ambas tarjetas a la vez.
 *
 * Vive en (app)/ para heredar el sidebar del layout compartido.
 *
 * Spec visual: docs/design.md, sección "Ubicación en cada anfitrión".
 * Alto del área de gráfico: 300px por tarjeta en /anual.
 */

"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { IncomeExpenseCard, ByCategoryCard } from "@/components/charts/annual-chart-widget";
import { getCurrentMonth } from "@/lib/format";
import { useAnnual } from "@/hooks/use-annual";
import { cn } from "@/lib/utils";

/** Deriva el año actual del mes actual (usa el helper del DS, no new Date() directo). */
function getCurrentYear(): number {
  const month = getCurrentMonth(); // "YYYY-MM"
  return parseInt(month.split("-")[0] ?? String(new Date().getFullYear()), 10);
}

/**
 * Control de año compartido ‹ › que preside ambas tarjetas.
 * Vive en el .phead de la página, no dentro de ninguna tarjeta.
 *
 * Límites (RF-GRA-003):
 *   ‹ deshabilitado cuando year === earliestYear (o earliestYear es null).
 *   › deshabilitado cuando year === año actual.
 */
interface YearStepperProps {
  year: number;
  currentYear: number;
  earliestYear: number | null;
  onPrev: () => void;
  onNext: () => void;
}

function YearStepper({ year, currentYear, earliestYear, onPrev, onNext }: YearStepperProps) {
  const canGoPrev = earliestYear !== null && year > earliestYear;
  const canGoNext = year < currentYear;

  return (
    <div
      className="flex items-center rounded-pill border border-line bg-panel shadow-[var(--shadow-sm)] p-1"
      role="group"
      aria-label="Navegación de año"
    >
      {/* ‹ Anterior */}
      <button
        type="button"
        onClick={onPrev}
        disabled={!canGoPrev}
        aria-label="Año anterior"
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-[140ms]",
          canGoPrev
            ? "text-ink-2 hover:bg-panel-2 hover:text-ink cursor-pointer"
            : "text-faint opacity-45 cursor-default",
        )}
      >
        <ChevronLeft size={16} aria-hidden="true" />
      </button>

      {/* Año */}
      <span
        className="mono text-[14.5px] font-semibold text-ink min-w-[64px] text-center select-none"
        aria-live="polite"
        aria-atomic="true"
      >
        {year}
      </span>

      {/* › Siguiente */}
      <button
        type="button"
        onClick={onNext}
        disabled={!canGoNext}
        aria-label="Año siguiente"
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-[140ms]",
          canGoNext
            ? "text-ink-2 hover:bg-panel-2 hover:text-ink cursor-pointer"
            : "text-faint opacity-45 cursor-default",
        )}
      >
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Wrapper que lee earliestYear del hook useAnnual para pasarlo al stepper.
 * React Query dedupea la request — useAnnual(year) ya lo consumen las tarjetas.
 */
function AnualPageContent() {
  const [year, setYear] = useState(() => getCurrentYear());
  const [currentYear, setCurrentYear] = useState(() => getCurrentYear());

  useEffect(() => {
    setCurrentYear(getCurrentYear());
  }, []);

  // Leer earliestYear del hook; React Query dedupea (misma key que las tarjetas)
  const { data } = useAnnual(year);
  const earliestYear = data?.earliestYear ?? null;

  function handlePrev() {
    const canGoPrev = earliestYear !== null && year > earliestYear;
    if (canGoPrev) setYear((y) => y - 1);
  }

  function handleNext() {
    if (year < currentYear) setYear((y) => y + 1);
  }

  return (
    <div className="px-10 py-[34px] pb-20 max-w-[1120px] mx-auto animate-screen-fade">
      {/* ── Header de página .phead ── */}
      {/* Desktop: una fila (título izquierda, control de año derecha).
          ≤940px: dos filas (título arriba, control debajo alineado al inicio). */}
      <div className="flex [@media(max-width:940px)]:flex-col items-center [@media(max-width:940px)]:items-start justify-between gap-4 mb-7">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted mb-[6px]">
            Tu actividad
          </p>
          <h1 className="text-[32px] font-bold tracking-[-0.02em] leading-[1.05] text-ink m-0">
            Anual
          </h1>
        </div>

        {/* Control de año compartido — gobierna ambas tarjetas */}
        <YearStepper
          year={year}
          currentYear={currentYear}
          earliestYear={earliestYear}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      </div>

      {/* ── Dos tarjetas apiladas ── */}
      {/* Separación entre tarjetas: --gap (18px) */}
      <div className="flex flex-col gap-[var(--gap)]">
        {/* Forma 1 — Ingresos y gastos (arriba) */}
        <IncomeExpenseCard
          year={year}
          chartHeight={300}
          showYearInHeader={false}
        />

        {/* Forma 2 — Por categoría (abajo) */}
        <ByCategoryCard
          year={year}
          chartHeight={300}
        />
      </div>
    </div>
  );
}

export default function AnualPage() {
  return <AnualPageContent />;
}
