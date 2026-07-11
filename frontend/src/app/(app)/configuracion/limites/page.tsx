/**
 * Sección "Límites" de /configuracion (P6 — hub de administración).
 *
 * Ruta anidada deep-linkable: /configuracion/limites. El shell de página
 * (.phead, nav vertical) vive en el layout compartido del hub
 * (`../layout.tsx`); esta ruta solo aporta el contenido de la sección
 * (`LimitsTab`, docs/design.md §"Panel de gestión de límites" → 2. "Solapa
 * Límites — encabezado y lista").
 */

import { LimitsTab } from "@/components/limits/limits-tab";

export const metadata = {
  title: "Límites — Control",
  description: "Configurá límites que resalten un dato cuando cruza un umbral",
};

export default function ConfiguracionLimitesPage() {
  return <LimitsTab />;
}
