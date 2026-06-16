import { IsString, Matches } from 'class-validator';

/**
 * DTO para el toggle de anulación de un fijo en un mes puntual.
 * POST /recurring/:id/skip
 *
 * Recibe el mes a anular/des-anular (YYYY-MM).
 * La acción es un toggle: si el skip (fijo, mes) existe lo elimina (des-anula);
 * si no existe lo crea (anula). Devuelve el estado resultante.
 *
 * Solo tiene sentido para meses en los que el fijo efectivamente aparece
 * según su frecuencia y rango de actividad (la validación semántica es
 * responsabilidad del frontend; el backend valida formato y aislamiento userId).
 */
export class ToggleSkipRecurringDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'month debe tener formato YYYY-MM (ej: 2026-06)',
  })
  month!: string;
}
