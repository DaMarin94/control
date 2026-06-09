import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

/**
 * DTO para editar un grupo de cuotas (PATCH /installments/:id).
 *
 * Campos editables: amountCents, totalInstallments, startMonth, categoryId, description.
 * - type NO es editable (las cuotas son siempre EXPENSE en v1).
 * - description puede venir null explícito para limpiarla.
 *
 * No recibe currentMonth (D2): las cuotas no tienen inmutabilidad del pasado;
 * la edición aplica al grupo completo (RF-MC-003).
 */
export class UpdateInstallmentDto {
  @IsOptional()
  @IsInt({ message: 'El monto debe ser un entero en centavos' })
  @Min(1, { message: 'El monto debe ser mayor a 0' })
  amountCents?: number;

  @IsOptional()
  @IsInt({ message: 'La cantidad de cuotas debe ser un entero' })
  @Min(1, { message: 'La cantidad de cuotas debe ser mayor a 0' })
  totalInstallments?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'startMonth debe tener formato YYYY-MM (ej: 2026-06)',
  })
  startMonth?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El categoryId no puede estar vacío' })
  categoryId?: string;

  @IsOptional()
  @IsString()
  description?: string | null;
}
