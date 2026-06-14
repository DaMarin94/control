/**
 * Dashboard — / (raíz)
 *
 * RF-DASH-001/002/003/005
 * Pantalla de inicio tras autenticarse. Muestra el resumen financiero del mes
 * actual. No lista movimientos individuales.
 *
 * Ruta privada: el middleware redirige a /login si no hay sesión activa.
 * La navegación global vive en el AppSidebar del layout (app).
 *
 * Re-estilado con tokens del DS "Precise Ledger" (Fase 3).
 * Padding y max-width del DS: 34px 40px, max-width 1120px.
 */

import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default function DashboardPage() {
  return (
    <div className="px-10 py-[34px] pb-20 max-w-[1120px] mx-auto animate-screen-fade">
      <DashboardClient />
    </div>
  );
}
