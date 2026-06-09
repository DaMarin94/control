import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

/**
 * DTO para editar un movimiento fijo (PATCH /recurring/:id).
 *
 * Campos editables: SOLO amountCents, categoryId, description (RF-MF-003).
 * - type NO se edita (RF-MF-003 — decisión D1).
 * - startMonth NO se edita.
 * - currentMonth es REQUERIDO (decisión D2): el front manda el mes actual
 *   para determinar si aplica split o update in-place.
 * - description puede venir null explícito para limpiarla, o string para actualizarla.
 */
export class UpdateRecurringDto {
  @IsOptional()
  @IsInt({ message: 'El monto debe ser un entero en centavos' })
  @Min(1, { message: 'El monto debe ser mayor a 0' })
  amountCents?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El categoryId no puede estar vacío' })
  categoryId?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsString()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'currentMonth debe tener formato YYYY-MM (ej: 2026-06)',
  })
  currentMonth!: string;
}
