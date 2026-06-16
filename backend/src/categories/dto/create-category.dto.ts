import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { CategoryScope } from '@prisma/client';
import { isValidCategoryColor, normalizeColorHex } from '../color-pool';

/**
 * Decorador de validación que verifica si un hex pertenece a la COLOR_MATRIX (70 colores).
 * Case-insensitive: "#4f86c6" y "#4F86C6" son equivalentes.
 */
function IsColorInMatrix(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isColorInMatrix',
      target: (object as { constructor: Function }).constructor,
      propertyName,
      options: {
        message: 'El color debe pertenecer a la paleta de colores disponibles',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown, _args: ValidationArguments): boolean {
          if (typeof value !== 'string') return false;
          return isValidCategoryColor(value);
        },
      },
    });
  };
}

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la categoría no puede estar vacío' })
  name!: string;

  @IsOptional()
  @IsEnum(CategoryScope, {
    message: 'El scope debe ser BOTH, EXPENSE o INCOME',
  })
  scope?: CategoryScope;

  @IsOptional()
  @IsString()
  @IsColorInMatrix()
  color?: string;
}

/**
 * Normaliza el hex del color a mayúsculas si viene en el DTO.
 * Llamar tras validación exitosa para obtener el valor canónico.
 */
export function normalizeCreateDtoColor(dto: CreateCategoryDto): string | undefined {
  if (dto.color === undefined) return undefined;
  return normalizeColorHex(dto.color);
}
