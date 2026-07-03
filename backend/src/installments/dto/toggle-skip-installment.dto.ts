import { IsString, Matches } from 'class-validator';

/**
 * DTO para el toggle de anulación de una cuota puntual de un grupo, en un mes puntual.
 * POST /installments/:id/skip
 *
 * Recibe el mes a anular/des-anular (YYYY-MM).
 * La acción es un toggle: si el skip (grupo, mes) existe lo elimina (des-anula);
 * si no existe lo crea (anula). Devuelve el estado resultante.
 *
 * Espejo exacto de ToggleSkipRecurringDto (P1 — Fase 1.1.1) para la anulación
 * de cuotas (P3 — Fase 1.1.1.ext). Anula SOLO la instancia de ese mes, no el grupo.
 *
 * Solo tiene sentido para meses en los que la cuota efectivamente aparece
 * (dentro del rango del grupo). La validación semántica es responsabilidad
 * del frontend; el backend valida formato y aislamiento userId.
 */
export class ToggleSkipInstallmentDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'month debe tener formato YYYY-MM (ej: 2026-06)',
  })
  month!: string;
}
