import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Body de POST /simulations (RF-SIM-001). Lo único que se ingresa es la
 * categoría — RN-029: ni monto, ni dirección, ni horizonte se piden, todo se
 * deriva del cálculo (RF-SIM-002).
 */
export class CreateSimulationDto {
  @IsString()
  @IsNotEmpty({ message: 'La categoría es obligatoria' })
  categoryId!: string;
}
