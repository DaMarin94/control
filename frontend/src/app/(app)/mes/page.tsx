/**
 * Vista del mes — /mes
 *
 * RF-VM-001/002/003/004
 * Lista completa de movimientos del mes activo con totales.
 *
 * Lee ?month=YYYY-MM del query. Si no viene, default = mes actual (zona del navegador).
 * El mes actual se calcula en el client via getCurrentMonth().
 *
 * Ruta privada: el middleware redirige a /login si no hay sesión activa.
 * El header y la navegación global viven en el AppSidebar del layout (app).
 * Suspense necesario porque MonthViewWrapper usa useSearchParams().
 *
 * Re-estilado con tokens del DS "Precise Ledger" (Fase 3).
 * PeriodNav ya no es un grid (ver docstring de period-nav.tsx): el ancho de
 * contenido (max-w-[1120px] mx-auto) lo aporta PeriodNav, y el px-10 +
 * padding vertical (py-[34px] pb-20) los aporta el div de contenido dentro
 * de MonthViewClient — mismo mecanismo canónico que las otras cinco
 * pantallas. Esta página solo envuelve con la animación de entrada; el
 * fallback de Suspense (visible brevemente antes de montar MonthViewWrapper)
 * replica el mismo bloque canónico para no saltar al aterrizar el contenido
 * real.
 */

import { Suspense } from "react";
import { MonthViewWrapper } from "@/components/movements/month-view-wrapper";

export default function MesPage() {
  return (
    <div className="animate-screen-fade">
      {/* Suspense necesario porque MonthViewWrapper usa useSearchParams */}
      <Suspense
        fallback={
          <div className="px-10 py-[34px] pb-20 max-w-[1120px] mx-auto space-y-[var(--gap)]">
            <div className="h-12 animate-pulse rounded-card bg-panel-3" />
            <div className="grid grid-cols-3 gap-[var(--gap)]">
              <div className="h-[90px] animate-pulse rounded-card bg-panel-3" />
              <div className="h-[90px] animate-pulse rounded-card bg-panel-3" />
              <div className="h-[90px] animate-pulse rounded-card bg-panel-3" />
            </div>
          </div>
        }
      >
        <MonthViewWrapper />
      </Suspense>
    </div>
  );
}
