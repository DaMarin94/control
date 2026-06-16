import { IsObject } from 'class-validator';

/**
 * DTO para PUT /preferences.
 *
 * El blob de preferencias es un objeto JSON abierto — no tiene claves fijas.
 * Cada fase consumidora agrega las suyas sin migración de esquema.
 *
 * Validación: solo exige que sea un objeto (no array, no primitivo).
 * El frontend manda el objeto COMPLETO; el servidor reemplaza el blob entero
 * (no hace merge).
 */
export class UpdatePreferencesDto {
  @IsObject()
  data!: Record<string, unknown>;
}
