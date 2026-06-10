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
 */

import { Suspense } from "react";
import { MonthViewWrapper } from "@/components/movements/month-view-wrapper";

export default function MesPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      {/* Suspense necesario porque MonthViewWrapper usa useSearchParams */}
      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="h-10 animate-pulse rounded-lg bg-muted" />
            <div className="h-20 animate-pulse rounded-lg bg-muted" />
          </div>
        }
      >
        <MonthViewWrapper />
      </Suspense>
    </div>
  );
}
