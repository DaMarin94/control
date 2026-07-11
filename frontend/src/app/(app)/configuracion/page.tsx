/**
 * Sección "General" de /configuracion (P6 — hub de administración).
 *
 * docs/design.md §"Panel de gestión de límites" → 1.b "Jerarquía de cabecera
 * del hub": cabecera de sección `h2` 18/700 "General", SIN bajada y SIN botón
 * (las cards de esta sección son autodescriptivas) + `SettingsClient` (card
 * Moneda por defecto, intacta).
 *
 * Server Component — shell estático; el control de moneda es client-side.
 */

import { SettingsClient } from "./settings-client";

export const metadata = {
  title: "Configuración — Control",
  description: "Preferencias de tu cuenta",
};

export default function ConfiguracionGeneralPage() {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-[18px] font-bold tracking-[-0.01em] text-ink">General</h2>
      </div>
      <SettingsClient />
    </div>
  );
}
