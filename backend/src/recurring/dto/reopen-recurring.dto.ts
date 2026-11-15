import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

/** Reemplazo de categoría de un calculado reabierto en espejo (clave: su `chainId`). */
export class CalculatedCategoryReplacementDto {
  @IsString()
  @IsNotEmpty({ message: 'chainId no puede estar vacío' })
  chainId!: string;

  @IsString()
  @IsNotEmpty({ message: 'categoryId no puede estar vacío' })
  categoryId!: string;
}

/**
 * DTO para POST /recurring/:id/reopen (RF-MF-008).
 *
 * - currentMonth: mes en curso real (lo manda el front, igual que PATCH/DELETE).
 * - reopenMonth (X): >= máx(currentMonth, endMonth) — se valida en el service.
 * - amountCents: monto nuevo desde X (> 0, RN-001; tope RN-023).
 * - categoryId / paymentMethodId: SOLO si los actuales del fijo están dados de baja
 *   (obligatorios en ese caso, rechazados con 400 si no hacen falta).
 * - calculatedCategories: ídem para los calculados reabiertos en espejo cuya categoría
 *   está dada de baja.
 */
export class ReopenRecurringDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'currentMonth debe tener formato YYYY-MM (ej: 2026-06)' })
  currentMonth!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'reopenMonth debe tener formato YYYY-MM (ej: 2026-06)' })
  reopenMonth!: string;

  @IsInt({ message: 'El monto debe ser un entero en centavos' })
  @Min(1, { message: 'El monto debe ser mayor a 0' })
  @Max(2147483647, { message: 'El monto es demasiado grande' })
  amountCents!: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El categoryId no puede estar vacío' })
  categoryId?: string;

  // `null` = "sin método" (válido como reemplazo); omitido = falta el reemplazo.
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsString()
  @IsNotEmpty({ message: 'El paymentMethodId no puede estar vacío' })
  paymentMethodId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CalculatedCategoryReplacementDto)
  calculatedCategories?: CalculatedCategoryReplacementDto[];
}
