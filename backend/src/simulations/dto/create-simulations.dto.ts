import { ArrayNotEmpty, ArrayUnique, IsArray, IsString } from 'class-validator';

/**
 * Body de POST /simulations (RF-SIM-001). Acepta VARIAS categorías en una
 * sola llamada, con fallo parcial tolerado por categoría (ver
 * `SimulationsService.createMany`): las inválidas no impiden crear las
 * válidas. Lo único que se ingresa por categoría es su id — RN-029: ni monto,
 * ni dirección, ni horizonte se piden, todo se deriva del cálculo (RF-SIM-002).
 *
 * `categoryIds` no admite duplicados dentro del mismo request (400 a nivel
 * DTO): dos veces el mismo id no tiene un resultado bien definido y se
 * rechaza antes de procesar nada, en vez de dejar que la segunda ocurrencia
 * falle "por casualidad" contra la que ya se creó en la primera.
 */
export class CreateSimulationsDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Debe indicar al menos una categoría' })
  @ArrayUnique({ message: 'No se puede repetir la misma categoría en la misma solicitud' })
  @IsString({ each: true, message: 'Cada categoría debe ser un id válido' })
  categoryIds!: string[];
}
