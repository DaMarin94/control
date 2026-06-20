/**
 * Página de configuración — /configuracion (Fase 1.2.3).
 *
 * Shell idéntico a /categorias (docs/design.md §"A. Pantalla /configuracion"):
 * - div px-10 py-[34px] pb-20 max-w-[1120px] mx-auto animate-screen-fade
 * - Cabecera .phead: eyebrow "Ajustes" + H1 "Configuración"
 * - Bajada opcional: "Preferencias de tu cuenta."
 * - Contenido: tarjeta de ajuste única (Moneda por defecto)
 *
 * Server Component — shell estático; el control de settings es client-side.
 */

import { SettingsClient } from "./settings-client";

export const metadata = {
  title: "Configuración — Control",
  description: "Preferencias de tu cuenta",
};

export default function ConfiguracionPage() {
  return (
    <div className="px-10 py-[34px] pb-20 max-w-[1120px] mx-auto animate-screen-fade">
      {/* Cabecera .phead */}
      <div className="mb-6">
        <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted mb-1">
          Ajustes
        </p>
        <h1 className="text-[32px] font-bold tracking-[-0.02em] text-ink leading-tight">
          Configuración
        </h1>
        <p className="text-[14px] text-muted mt-2">
          Preferencias de tu cuenta.
        </p>
      </div>

      {/* Contenido: tarjetas de ajuste */}
      <SettingsClient />
    </div>
  );
}
