import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

/**
 * DTO para POST /recurring/:id/skip (RF-MF-005).
 *
 * Dos alcances mutuamente excluyentes, distinguidos por qué campos llegan
 * (la exclusividad y la completitud del combo se validan en el controller,
 * no acá, porque `class-validator` no expresa bien un XOR entre dos shapes):
 *
 * - Puntual (TOGGLE, comportamiento sin cambios): { month }.
 * - Rango (operación EXPLÍCITA, no toggle): { from, to, action }.
 *
 * Todos los campos son opcionales a nivel DTO; el formato YYYY-MM se valida
 * acá, el resto (valor semántico del mes, límites del rango) en el service.
 */
export class ToggleSkipRecurringDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'month debe tener formato YYYY-MM (ej: 2026-06)',
  })
  month?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'from debe tener formato YYYY-MM (ej: 2026-06)',
  })
  from?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'to debe tener formato YYYY-MM (ej: 2026-06)',
  })
  to?: string;

  @IsOptional()
  @IsIn(['skip', 'unskip'], {
    message: 'action debe ser "skip" o "unskip"',
  })
  action?: 'skip' | 'unskip';
}
