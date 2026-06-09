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
 * DTO para editar un movimiento único (PATCH /transactions/:id).
 *
 * Todos los campos son opcionales — es un partial de CreateTransactionDto.
 * Si se cambia el type, el backend revalida que la categoría sea compatible
 * con el nuevo type (RN-010).
 */
export class UpdateTransactionDto {
  @IsOptional()
  @IsEnum(MovementType, {
    message: 'El tipo debe ser EXPENSE o INCOME',
  })
  type?: MovementType;

  @IsOptional()
  @IsInt({ message: 'El monto debe ser un entero en centavos' })
  @Min(1, { message: 'El monto debe ser mayor a 0' })
  amountCents?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El categoryId no puede estar vacío' })
  categoryId?: string;

  @IsOptional()
  @IsISO8601(
    { strict: true },
    { message: 'occurredAt debe ser una fecha ISO 8601 válida' },
  )
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El timezone no puede estar vacío' })
  timezone?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
