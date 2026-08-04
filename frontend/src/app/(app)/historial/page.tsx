/**
 * Historial de cambios — /historial (RF-HIST-002).
 *
 * Ruta privada bajo el route group `(app)`: sidebar + layout compartido ya
 * los aporta `app/(app)/layout.tsx`. Sin navegación de período ni chip de
 * moneda (docs/design.md §1 — "el historial no se recorre por período").
 *
 * Server Component — shell estático; el contenido (fetch + estado + modales)
 * es client-side (`HistoryClient`).
 */

import { HistoryClient } from "@/components/history/history-client";

export const metadata = {
  title: "Historial — Control",
  description: "Cambios recientes sobre tus movimientos, con la opción de deshacerlos",
};

export default function HistorialPage() {
  return <HistoryClient />;
}
