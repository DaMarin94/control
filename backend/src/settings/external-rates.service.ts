import { Injectable } from '@nestjs/common';
import { Currency } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Fila de IPC lista para display (data types nativos, no Prisma.Decimal).
 *
 * `monthlyVariation` está en PUNTOS PORCENTUALES (unidad canónica del sistema
 * en InflationRate, post-migración). No se re-convierte acá.
 */
export interface IpcEntry {
  yearMonth: string;
  monthlyVariation: number;
  indexValue: number;
  fetchedAt: Date;
  source: string;
}

/** Fila de cotización FX (una variante) lista para display. */
export interface FxEntry {
  compra: number;
  venta: number;
  fetchedAt: Date;
  source: string;
}

export interface ExternalRatesSnapshot {
  ipc: {
    /** Último dato de IPC disponible en la tabla, sin importar el mes consultado. */
    latest: IpcEntry | null;
    /** Historial IPC en [from, month], orden DESC (más reciente primero). */
    history: IpcEntry[];
    /** Mes (YYYY-MM) efectivo desde el que arranca `history` (el pedido o el default). */
    from: string;
    /** true si existen filas de IPC anteriores a `from` (habilita "cargar más antiguos"). */
    hasMore: boolean;
  };
  fx: {
    /** Mes (YYYY-MM) efectivo de las cotizaciones (el pedido o el default = mes actual). */
    month: string;
    arsOficial: FxEntry | null;
    arsBlue: FxEntry | null;
    eur: FxEntry | null;
    brl: FxEntry | null;
  };
}

/**
 * Lectura de datos externos (IPC + cotizaciones FX) para la sección
 * de configuración user-facing (`GET /settings/external-rates`).
 *
 * Las tablas fuente (`InflationRate`, `CurrencyQuote`) son globales — no
 * hay scope por usuario acá, solo requieren JWT válido para acceder.
 */
@Injectable()
export class ExternalRatesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * @param today   fecha local del usuario YYYY-MM-DD (para derivar "mes actual").
   *                Ausente → cae a `new Date()` UTC (mismo patrón que el resto de
   *                los endpoints de reportes; el backend no calcula "ahora" salvo fallback).
   * @param ipcFrom mes YYYY-MM desde el que arranca el historial de IPC.
   *                Ausente → enero del año derivado de `today`.
   */
  async getSnapshot(
    today?: string,
    ipcFrom?: string,
  ): Promise<ExternalRatesSnapshot> {
    const todayDate = today ? new Date(today + 'T00:00:00Z') : new Date();
    const currentYear = todayDate.getUTCFullYear();
    const currentMonth = todayDate.getUTCMonth() + 1; // 1-based
    const month = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    const from = ipcFrom ?? `${currentYear}-01`;

    const [latestRow, historyRows, olderRow, fxRows] = await Promise.all([
      this.prisma.inflationRate.findFirst({
        orderBy: { yearMonth: 'desc' },
      }),
      this.prisma.inflationRate.findMany({
        where: { yearMonth: { gte: from, lte: month } },
        orderBy: { yearMonth: 'desc' },
      }),
      this.prisma.inflationRate.findFirst({
        where: { yearMonth: { lt: from } },
        select: { id: true },
      }),
      this.prisma.currencyQuote.findMany({
        where: { yearMonth: month },
      }),
    ]);

    const findQuote = (currency: Currency, variant: string) =>
      fxRows.find((r) => r.currency === currency && r.variant === variant) ??
      null;

    return {
      ipc: {
        latest: latestRow ? this.toIpcEntry(latestRow) : null,
        history: historyRows.map((row) => this.toIpcEntry(row)),
        from,
        hasMore: olderRow !== null,
      },
      fx: {
        month,
        arsOficial: this.toFxEntry(findQuote(Currency.ARS, 'oficial')),
        arsBlue: this.toFxEntry(findQuote(Currency.ARS, 'blue')),
        eur: this.toFxEntry(findQuote(Currency.EUR, 'oficial')),
        brl: this.toFxEntry(findQuote(Currency.BRL, 'oficial')),
      },
    };
  }

  private toIpcEntry(row: {
    yearMonth: string;
    monthlyVariation: unknown;
    indexValue: unknown;
    fetchedAt: Date;
    source: string;
  }): IpcEntry {
    return {
      yearMonth: row.yearMonth,
      monthlyVariation: Number(row.monthlyVariation),
      indexValue: Number(row.indexValue),
      fetchedAt: row.fetchedAt,
      source: row.source,
    };
  }

  private toFxEntry(
    row: { compra: unknown; venta: unknown; fetchedAt: Date; source: string } | null,
  ): FxEntry | null {
    if (!row) return null;
    return {
      compra: Number(row.compra),
      venta: Number(row.venta),
      fetchedAt: row.fetchedAt,
      source: row.source,
    };
  }
}
