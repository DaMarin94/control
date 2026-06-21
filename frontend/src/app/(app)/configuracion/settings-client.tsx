"use client";

/**
 * SettingsClient — Contenido client-side de /configuracion (Fase 1.2.3).
 *
 * Spec visual (docs/design.md §"A. Pantalla /configuracion"):
 * - Shell idéntico a /categorias (ya aplicado en page.tsx).
 * - Tarjeta de ajuste (.card del DS): `--panel`, borde `--line`, `--r-card` 14px,
 *   `--shadow-sm`, padding `--card-pad` 22px.
 * - Fila de ajuste: flex items-center justify-between gap-6.
 *   Izq: identidad (título 14.5px/600 --ink + descripción 12.5px/500 --muted mt-[2px]).
 *   Der: control (segmented ARS/USD neutro).
 * - Estado loading: skeleton pill animate-pulse del tamaño del segmented.
 * - Estado error: texto --expense-ink "No se pudo cargar la configuración. Recargá la página."
 * - Persistencia en vivo al seleccionar (sin botón Guardar).
 * - Toast "Moneda por defecto actualizada." en éxito; toast de error en fallo.
 * - Comportamiento: cambiar moneda default invalida movimientos y reportes (en el hook).
 */

import { CurrencySegmented } from "@/components/ui/currency-segmented";
import { useSettings } from "@/hooks/use-settings";
import { useToast } from "@/hooks/use-toast";
import type { CurrencyCode } from "@/types/settings";

export function SettingsClient() {
  const { defaultCurrency, isLoading, isError, updateSettings, isSaving } =
    useSettings();
  const { toast } = useToast();

  async function handleCurrencyChange(newCurrency: CurrencyCode) {
    // Optimista: la UI responde inmediatamente porque el hook actualiza la caché
    // antes de que el PATCH resuelva.
    const result = await updateSettings({ defaultCurrency: newCurrency });
    if (result.success) {
      toast.success("Moneda por defecto actualizada.");
    } else {
      toast.error(result.error ?? "No se pudo guardar la configuración.");
    }
  }

  return (
    <div className="space-y-4">
      {/* Tarjeta de ajuste: Moneda por defecto */}
      <div
        className="rounded-[14px] border border-line bg-panel shadow-[var(--shadow-sm)]"
        style={{ padding: "var(--card-pad)" }}
      >
        <div className="flex items-center justify-between gap-6">
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
          {isLoading ? (
            /* Skeleton del segmented mientras carga — ancho para 4 segmentos */
            <div
              className="rounded-pill bg-panel-3 animate-pulse shrink-0"
              style={{ width: "220px", height: "36px" }}
              aria-hidden="true"
            />
          ) : isError ? (
            /* Error al cargar — el mensaje de error global cubre la pantalla */
            null
          ) : (
            <div className="shrink-0">
              <CurrencySegmented
                value={defaultCurrency}
                onChange={handleCurrencyChange}
                ariaLabel="Moneda por defecto"
                disabled={isSaving}
              />
            </div>
          )}
        </div>

        {/* Error al cargar (inline en la tarjeta) */}
        {isError && !isLoading && (
          <p className="mt-3 text-[13px] text-expense-ink">
            No se pudo cargar la configuración. Recargá la página.
          </p>
        )}
      </div>
    </div>
  );
}
