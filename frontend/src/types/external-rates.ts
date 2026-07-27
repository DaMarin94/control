/**
 * Tipos del dominio de datos externos (IPC + cotizaciones FX) — sección
 * "Datos externos" de /configuracion (dentro de General).
 *
 * GET  /settings/external-rates?today=YYYY-MM-DD&ipcFrom=YYYY-MM → data: ExternalRatesSnapshot
 * POST /settings/external-rates/sync (sin body, JWT + rate limit) → data: SyncResult
 *
 * Espejo de backend/src/settings/external-rates.service.ts y rate-sync.service.ts.
 * No hay paquete de tipos compartido con el backend — si el shape cambia de
 * ese lado, hay que actualizar este archivo a mano.
 */

/** Fila de IPC lista para display. */
export interface IpcEntry {
  /** Mes YYYY-MM del dato. */
  yearMonth: string;
  /** Variación mensual del IPC, en PUNTOS PORCENTUALES (ej. 1.58 → "1,58%"). */
  monthlyVariation: number;
  /** Nivel del índice IPC. */
  indexValue: number;
  /** Instante ISO 8601 UTC de la última escritura de esta fila. */
  fetchedAt: string;
  source: string;
}

/** Fila de cotización FX (una variante) lista para display. */
export interface FxEntry {
  compra: number;
  venta: number;
  /** Instante ISO 8601 UTC de la última escritura de esta fila. */
  fetchedAt: string;
  source: string;
}

export interface ExternalRatesSnapshot {
  ipc: {
    /** Último dato de IPC disponible en la tabla, independiente del mes consultado. */
    latest: IpcEntry | null;
    /** Historial en [ipcFrom efectivo, mes actual], orden DESC (más reciente primero). */
    history: IpcEntry[];
    /** Mes YYYY-MM efectivo desde el que arranca `history` (el pedido o el default). */
    from: string;
    /** true si hay IPC anterior a `from` — habilita "Ver meses anteriores". */
    hasMore: boolean;
  };
  fx: {
    /** Mes YYYY-MM efectivo de las cotizaciones (el pedido o el mes actual). */
    month: string;
    arsOficial: FxEntry | null;
    arsBlue: FxEntry | null;
    eur: FxEntry | null;
    brl: FxEntry | null;
  };
}

/** Resultado por target de una corrida de sync. */
export interface SyncTargetResult {
  target: string;
  accepted: boolean;
  reason?: string;
}

/** Respuesta de POST /settings/external-rates/sync (y /settings/reference-rates/sync). */
export interface SyncResult {
  scope: string;
  results: SyncTargetResult[];
  acceptedCount: number;
  rejectedCount: number;
}
