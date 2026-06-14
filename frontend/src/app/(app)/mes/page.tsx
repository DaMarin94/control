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
 * Mismo padding y max-width que el dashboard.
 */

import { Suspense } from "react";
import { MonthViewWrapper } from "@/components/movements/month-view-wrapper";

export default function MesPage() {
  return (
    <div className="px-10 py-[34px] pb-20 max-w-[1120px] mx-auto animate-screen-fade">
      {/* Suspense necesario porque MonthViewWrapper usa useSearchParams */}
      <Suspense
        fallback={
          <div className="space-y-[var(--gap)]">
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
