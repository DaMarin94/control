import { IsEnum, IsOptional } from 'class-validator';

/**
 * DTO del body de POST /settings/reference-rates/sync.
 *
 * El body NO acepta valores de cotización (whitelist los descarta automáticamente
 * por el ValidationPipe global con whitelist:true).
 *
 * Solo permite un selector de scope opcional: qué fuentes correr.
 *   "fx"  — solo cotizaciones FX (dolarapi.com + frankfurter.dev)
 *   "ipc" — solo IPC argentino (apis.datos.gob.ar)
 *   "all" — todo (default)
 */
export enum SyncScope {
  FX = 'fx',
  IPC = 'ipc',
  ALL = 'all',
}

export class SyncRatesDto {
  @IsOptional()
  @IsEnum(SyncScope, {
    message: 'scope debe ser "fx", "ipc" o "all"',
  })
  scope?: SyncScope = SyncScope.ALL;
}
