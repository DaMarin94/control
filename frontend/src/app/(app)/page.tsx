/**
 * Dashboard — / (raíz)
 *
 * RF-DASH-001/002/003/005
 * Pantalla de inicio tras autenticarse. Muestra el resumen financiero del mes
 * actual. No lista movimientos individuales.
 *
 * Ruta privada: el middleware redirige a /login si no hay sesión activa.
 * El header y la navegación global viven en el AppSidebar del layout (app).
 */

import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <DashboardClient />
    </div>
  );
}
