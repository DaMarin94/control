"use client";

/**
 * SettingsClient — Contenido client-side de /configuracion.
 *
 * Spec visual (docs/design.md §"A. Pantalla /configuracion"):
 * - Shell idéntico a /categorias (ya aplicado en page.tsx).
 * - Tarjeta de ajuste (.card del DS): `--panel`, borde `--line`, `--r-card` 14px,
 *   `--shadow-sm`, padding `--card-pad` 22px.
 * - Fila de ajuste: flex items-center justify-between gap-6, con flex-wrap
 *   (control debajo del rótulo si no entran ambos en el piso del régimen de
 *   app, 600px — evita el scroll horizontal del body, invariante 1 de
 *   docs/design.md §Contención responsive).
 *   Izq: identidad (título 14.5px/600 --ink + descripción 12.5px/500 --muted mt-[2px]).
 *   Der: control (segmented neutro).
 * - Estado loading: skeleton pill animate-pulse del tamaño del segmented.
 * - Estado error: texto --expense-ink "No se pudo cargar la configuración. Recargá la página."
 * - Persistencia en vivo al seleccionar (sin botón Guardar).
 * - Toast de confirmación en éxito; toast de error en fallo.
 *
 * Tarjetas:
 *   1. Moneda por defecto — CurrencySegmented (Fase 1.2.3).
 *
 * Nota: El control de modo de color (Apariencia) se mudó al sidebar como
 * toggle de iconos (ThemeIconToggle). Ya no vive en /configuracion.
 *
 * Sección "Datos externos" (IPC + cotizaciones): debajo de la tarjeta de
 * Moneda, dentro de esta misma pantalla General (decisión cerrada — NO es
 * una ruta/nav nueva). Ver external-rates-section.tsx y docs/design.md
 * §"Sección 'Datos externos' de /configuracion".
 */

import { CurrencySegmented } from "@/components/ui/currency-segmented";
import { useSettings } from "@/hooks/use-settings";
import { useToast } from "@/hooks/use-toast";
import type { CurrencyCode } from "@/types/settings";
import { SkeletonPill } from "@/components/ui/skeleton";
import { ExternalRatesSection } from "./external-rates-section";

export function SettingsClient() {
  const { defaultCurrency, isLoading: isSettingsLoading, isError: isSettingsError, updateSettings, isSaving: isCurrencySaving } =
    useSettings();
  const { toast } = useToast();

  async function handleCurrencyChange(newCurrency: CurrencyCode) {
    const result = await updateSettings({ defaultCurrency: newCurrency });
    if (result.success) {
      toast.success("Moneda por defecto actualizada.");
    } else {
      toast.error(result.error ?? "No se pudo guardar la configuración.");
    }
  }

  return (
    <div className="space-y-4">
      {/* Tarjeta 1: Moneda por defecto */}
      <div
        className="rounded-[14px] border border-line bg-panel shadow-[var(--shadow-sm)]"
        style={{ padding: "var(--card-pad)" }}
      >
        <div className="flex items-center justify-between gap-6 flex-wrap">
          {/* Izquierda: identidad del ajuste */}
          <div>
            <p className="text-[14.5px] font-semibold text-ink">
              Moneda por defecto
            </p>
            <p className="text-[12.5px] font-medium text-muted mt-[2px]">
              Los totales y reportes se muestran en esta moneda.
            </p>
          </div>

          {/* Derecha: control */}
          {isSettingsLoading ? (
            <div role="status" aria-label="Cargando configuración">
              <SkeletonPill width={220} height={36} />
            </div>
          ) : isSettingsError ? (
            null
          ) : (
            <div className="shrink-0">
              <CurrencySegmented
                value={defaultCurrency}
                onChange={handleCurrencyChange}
                ariaLabel="Moneda por defecto"
                disabled={isCurrencySaving}
              />
            </div>
          )}
        </div>

        {/* Error al cargar (inline en la tarjeta) */}
        {isSettingsError && !isSettingsLoading && (
          <p className="mt-3 text-[13px] text-expense-ink">
            No se pudo cargar la configuración. Recargá la página.
          </p>
        )}
      </div>

      {/* Sección: Datos externos (inflación IPC + cotizaciones) */}
      <ExternalRatesSection />
    </div>
  );
}
