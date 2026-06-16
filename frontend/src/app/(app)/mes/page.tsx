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
 * Fase 1.1.3 (revisado): PeriodNav es ahora el grid de 3 columnas.
 * El cap de 1120px y el px-10 viven en la columna central de PeriodNav
 * (dentro de MonthViewClient), no en un wrapper de esta página.
 */

import { Suspense } from "react";
import { MonthViewWrapper } from "@/components/movements/month-view-wrapper";

export default function MesPage() {
  return (
    /*
     * Wrapper de animación y espaciado vertical.
     * SIN max-w ni px: el cap de 1120px y el px-10 viven en la columna
     * central del grid de PeriodNav (dentro de MonthViewClient).
     */
    <div className="py-[34px] pb-20 animate-screen-fade">
      {/* Suspense necesario porque MonthViewWrapper usa useSearchParams */}
      <Suspense
        fallback={
          <div
            className="mx-auto px-10 space-y-[var(--gap)]"
            style={{ maxWidth: 1120 }}
          >
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
