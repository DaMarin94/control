import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { MovementType } from '@prisma/client';

/**
 * DTO para crear un movimiento único (POST /transactions).
 *
 * Reglas de validación:
 * - type: enum MovementType (EXPENSE | INCOME), obligatorio
 * - amountCents: entero en centavos, > 0 (RN-002)
 * - categoryId: string no vacío, obligatorio
 * - occurredAt: fecha ISO 8601 con offset explícito (ej: "2026-06-08T14:30:00-03:00"),
 *   se almacena en UTC via @db.Timestamptz (RN-004)
 * - timezone: nombre IANA (ej: "America/Argentina/Buenos_Aires"), obligatorio,
 *   se guarda con el registro para bucketeo por mes y mostrar hora local original
 * - description: texto libre, opcional
 *
 * El color y el userId NO se aceptan en el body — son ignorados por whitelist.
 */
export class CreateTransactionDto {
  @IsEnum(MovementType, {
    message: 'El tipo debe ser EXPENSE o INCOME',
  })
  type!: MovementType;

  @IsInt({ message: 'El monto debe ser un entero en centavos' })
  @Min(1, { message: 'El monto debe ser mayor a 0' })
  amountCents!: number;

  @IsString()
  @IsNotEmpty({ message: 'El categoryId no puede estar vacío' })
  categoryId!: string;

  @IsISO8601(
    { strict: true },
    { message: 'occurredAt debe ser una fecha ISO 8601 válida' },
  )
  occurredAt!: string;

  @IsString()
  @IsNotEmpty({ message: 'El timezone no puede estar vacío' })
  timezone!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
