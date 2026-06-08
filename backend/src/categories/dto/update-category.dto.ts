import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CategoryScope } from '@prisma/client';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la categoría no puede estar vacío' })
  name?: string;

  @IsOptional()
  @IsEnum(CategoryScope, {
    message: 'El scope debe ser BOTH, EXPENSE o INCOME',
  })
  scope?: CategoryScope;
}
