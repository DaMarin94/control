import { Injectable } from '@nestjs/common';
import { Currency } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildPivotRates,
  deriveExchangeRate,
  resolveNearestYearMonth,
  PivotRates,
} from '../common/currency.helper';

/**
 * Shape de la respuesta del pre-fill de cotización.
 */
export interface ReferenceRatePreFill {
  /** Moneda del movimiento */
  currency: Currency;
  /** Moneda default del usuario */
  defaultCurrency: Currency;
  /**
   * Mes consultado (YYYY-MM).
   * Puede diferir del mes pedido si se aplicó clamp al rango disponible.
   */
  yearMonth: string;
  /**
   * exchangeRate derivado: unidades de defaultCurrency por 1 unidad de currency.
   * null si no hay cotizaciones de referencia en absoluto (tabla vacía).
   * Si currency === defaultCurrency, siempre 1.
   */
  exchangeRate: number | null;
}

@Injectable()
export class ReferenceRatesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Carga todos los yearMonths disponibles en ReferenceRate (una sola query).
   * La tabla es pequeña (~54 filas con el seed actual), así que es eficiente.
   * Se usa para aplicar el clamp: resolver el mes más cercano cuando el mes
   * pedido no tiene cobertura.
   */
  private async loadAvailableYearMonths(): Promise<string[]> {
    const rows = await this.prisma.referenceRate.findMany({
      distinct: ['yearMonth'],
      select: { yearMonth: true },
    });
    return rows.map((r) => r.yearMonth);
  }

  /**
   * Devuelve las cotizaciones de referencia del mes como pivot rates (unidades por 1 USD).
   *
   * CLAMP: si el mes pedido no tiene filas en ReferenceRate, se usa el mes
   * disponible más cercano (Fase 1.2.4 fix):
   *   - Mes futuro → el máximo disponible (último conocido).
   *   - Mes pasado → el mínimo disponible (primero conocido).
   *   - Hueco intermedio → el más cercano por distancia en meses.
   *
   * Retorna null solo si la tabla está completamente vacía.
   */
  async getPivotRatesForMonth(
    yearMonth: string,
  ): Promise<Partial<PivotRates> | null> {
    // Intentar carga directa del mes primero (caso optimista — mes en rango)
    const rows = await this.prisma.referenceRate.findMany({
      where: { yearMonth },
      select: { currency: true, rate: true },
    });

    if (rows.length > 0) {
      return buildPivotRates(
        rows.map((r) => ({ currency: r.currency, rate: Number(r.rate) })),
      );
    }

    // Miss: cargar todos los meses disponibles y resolver el más cercano
    const available = await this.loadAvailableYearMonths();
    const resolved = resolveNearestYearMonth(yearMonth, available);

    if (resolved === null) return null; // tabla vacía

    // Si el resolved es el mismo que el pedido, ya sabemos que no hay datos
    // (no debería ocurrir con el clamp, pero proteger de loop infinito)
    if (resolved === yearMonth) return null;

    const resolvedRows = await this.prisma.referenceRate.findMany({
      where: { yearMonth: resolved },
      select: { currency: true, rate: true },
    });

    if (resolvedRows.length === 0) return null;

    return buildPivotRates(
      resolvedRows.map((r) => ({ currency: r.currency, rate: Number(r.rate) })),
    );
  }

  /**
   * Devuelve el exchangeRate pre-fill para un movimiento en una moneda dada
   * en un mes dado, respecto a la moneda default del usuario.
   *
   * Usado por GET /settings/reference-rate.
   *
   * Con clamp activo: si el mes pedido está fuera del rango de ReferenceRate
   * (ej: mes futuro 2026-09 cuando el máximo disponible es 2026-06), se usa
   * el mes disponible más cercano para derivar el exchangeRate. El campo
   * `yearMonth` en la respuesta refleja el mes original pedido (no el resuelto),
   * para que el formulario no confunda al usuario.
   *
   * La derivación pasa por el pivote USD:
   *   exchangeRate = rate_pivot(defaultCurrency) / rate_pivot(currency)
   *
   * Si currency === defaultCurrency → 1.
   * Si no hay datos en absoluto (tabla vacía) → null.
   */
  async getPreFill(
    currency: Currency,
    defaultCurrency: Currency,
    yearMonth: string,
  ): Promise<ReferenceRatePreFill> {
    if (currency === defaultCurrency) {
      return {
        currency,
        defaultCurrency,
        yearMonth,
        exchangeRate: 1,
      };
    }

    const pivotRates = await this.getPivotRatesForMonth(yearMonth);
    const exchangeRate = deriveExchangeRate(currency, defaultCurrency, pivotRates);

    return {
      currency,
      defaultCurrency,
      yearMonth,
      exchangeRate,
    };
  }
}
