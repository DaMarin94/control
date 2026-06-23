import {
  BadGatewayException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Currency, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SyncScope } from './dto/sync-rates.dto';

// ---------------------------------------------------------------------------
// Tipos de resultado
// ---------------------------------------------------------------------------

export interface SyncTargetResult {
  target: string;
  accepted: boolean;
  reason?: string;
}

export interface SyncResult {
  scope: SyncScope;
  results: SyncTargetResult[];
  acceptedCount: number;
  rejectedCount: number;
}

interface CircuitBreakerResult {
  ok: boolean;
  lastValue?: number;
  deviation?: number;
}

interface FxQuoteParams {
  currency: Currency;
  variant: string;
  yearMonth: string;
  compra: Prisma.Decimal;
  venta: Prisma.Decimal;
  source: string;
  propagateToReferenceRate: boolean;
  referenceRateValue: Prisma.Decimal;
}

// ---------------------------------------------------------------------------
// Constantes de seguridad (hardcoded — NO configurables)
// ---------------------------------------------------------------------------

/** Allowlist de hosts externos permitidos. Ningún host fuera de esta lista se consulta. */
const ALLOWED_HOSTS = new Set([
  'dolarapi.com',
  'api.frankfurter.dev',
  'apis.datos.gob.ar',
]);

/** Allowlist de variantes FX aceptadas. Agregar variante = editar acá, sin migración. */
export const ALLOWED_VARIANTS = ['oficial', 'blue'] as const;
type AllowedVariant = (typeof ALLOWED_VARIANTS)[number];

/** Timeout de fetch saliente en ms */
const FETCH_TIMEOUT_MS = 8_000;

/** Circuit breaker: rechazo si el nuevo valor se desvía más del 15% del último guardado */
export const CIRCUIT_BREAKER_THRESHOLD = 0.15;

/** Cotas de cordura absolutas */
const SANITY = {
  MAX_RATE_ARS: 1_000_000,  // ARS a >1M por USD es implausible
  MAX_RATE_FX: 10_000,      // EUR/BRL: raramente superan 10k por USD
  MIN_IPC_VARIATION: -100,  // variación mensual mínima
  MAX_IPC_VARIATION: 500,   // variación mensual máxima
  MAX_IPC_INDEX: 100_000,   // nivel de índice máximo plausible
};

// ---------------------------------------------------------------------------
// Helpers puros de seguridad del fetch (exportados para tests)
// ---------------------------------------------------------------------------

/**
 * Verifica que el host de la URL esté en la allowlist.
 * Lanza Error si no está permitido.
 */
export function assertAllowedHost(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`URL malformada: ${url}`);
  }
  const host = parsed.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) {
    throw new Error(`Host no permitido: ${host}`);
  }
}

/**
 * Retorna true si val es un número finito > 0.
 */
export function isPositiveFinite(val: unknown): val is number {
  return typeof val === 'number' && isFinite(val) && val > 0;
}

/**
 * Valida un objeto de cotización de dolarapi.com: { compra: number, venta: number }.
 * Retorna el objeto validado o un mensaje de error.
 */
export function validateDolarApiEntry(
  raw: unknown,
  currency: Currency,
): { compra: number; venta: number } | string {
  if (typeof raw !== 'object' || raw === null) return 'Schema inválido: no es objeto';
  const obj = raw as Record<string, unknown>;
  if (!isPositiveFinite(obj.compra)) return `compra inválido: ${String(obj.compra)}`;
  if (!isPositiveFinite(obj.venta)) return `venta inválido: ${String(obj.venta)}`;

  const maxRate =
    currency === Currency.ARS ? SANITY.MAX_RATE_ARS : SANITY.MAX_RATE_FX;

  if ((obj.compra as number) > maxRate)
    return `compra implausible (${obj.compra as number} > ${maxRate})`;
  if ((obj.venta as number) > maxRate)
    return `venta implausible (${obj.venta as number} > ${maxRate})`;

  return { compra: obj.compra as number, venta: obj.venta as number };
}

/**
 * Valida un valor de cotización de Frankfurter (número único > 0).
 * Retorna el número validado o un mensaje de error.
 */
export function validateFrankfurterRate(val: unknown): number | string {
  if (!isPositiveFinite(val)) return `valor inválido: ${String(val)}`;
  if ((val as number) > SANITY.MAX_RATE_FX)
    return `valor implausible (${val as number} > ${SANITY.MAX_RATE_FX})`;
  return val as number;
}

/**
 * Valida cotas de cordura para IPC variación mensual e índice.
 * Retorna null si válido, o mensaje de error.
 */
export function validateIpcValues(
  variation: number,
  indexValue: number,
): string | null {
  if (!isFinite(variation)) return `variación no finita: ${variation}`;
  if (variation < SANITY.MIN_IPC_VARIATION || variation > SANITY.MAX_IPC_VARIATION)
    return `variación fuera de cotas: ${variation} (esperado ${SANITY.MIN_IPC_VARIATION}..${SANITY.MAX_IPC_VARIATION})`;
  if (!isPositiveFinite(indexValue))
    return `índice inválido: ${String(indexValue)}`;
  if (indexValue > SANITY.MAX_IPC_INDEX)
    return `índice implausible: ${indexValue} > ${SANITY.MAX_IPC_INDEX}`;
  return null;
}

/**
 * Fetch seguro hacia fuentes externas.
 * - Solo hosts en allowlist
 * - Solo HTTPS
 * - Timeout corto
 * - Sin seguir redirects
 * - Valida Content-Type: application/json antes de parsear
 *
 * @throws BadGatewayException si la fuente está caída, devuelve no-JSON, o da HTTP error
 */
export async function secureFetch(url: string): Promise<unknown> {
  assertAllowedHost(url);

  if (!url.startsWith('https://')) {
    throw new Error(`Solo se permiten URLs HTTPS: ${url}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      redirect: 'error',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
  } catch (err: unknown) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : String(err);
    throw new BadGatewayException(`Fuente externa inalcanzable (${url}): ${msg}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new BadGatewayException(
      `Fuente externa respondió HTTP ${response.status} (${url})`,
    );
  }

  const ct = response.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    throw new BadGatewayException(
      `Respuesta no-JSON de la fuente (Content-Type: ${ct}) — ${url}`,
    );
  }

  try {
    return (await response.json()) as unknown;
  } catch {
    throw new BadGatewayException(
      `No se pudo parsear la respuesta JSON de ${url}`,
    );
  }
}

// ---------------------------------------------------------------------------
// RateSyncService
// ---------------------------------------------------------------------------

@Injectable()
export class RateSyncService {
  private readonly logger = new Logger(RateSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Punto de entrada
  // -------------------------------------------------------------------------

  async sync(scope: SyncScope): Promise<SyncResult> {
    const results: SyncTargetResult[] = [];

    if (scope === SyncScope.FX || scope === SyncScope.ALL) {
      const fxResults = await this.syncFx();
      results.push(...fxResults);
    }

    if (scope === SyncScope.IPC || scope === SyncScope.ALL) {
      const ipcResults = await this.syncIpc();
      results.push(...ipcResults);
    }

    return {
      scope,
      results,
      acceptedCount: results.filter((r) => r.accepted).length,
      rejectedCount: results.filter((r) => !r.accepted).length,
    };
  }

  // -------------------------------------------------------------------------
  // Sync FX
  // -------------------------------------------------------------------------

  private async syncFx(): Promise<SyncTargetResult[]> {
    const results: SyncTargetResult[] = [];
    results.push(...(await this.syncArs()));
    results.push(await this.syncFrankfurter(Currency.EUR));
    results.push(await this.syncFrankfurter(Currency.BRL));
    return results;
  }

  /**
   * ARS desde dolarapi.com — variantes oficial y blue.
   * GET https://dolarapi.com/v1/dolares → array de { casa, compra, venta, ... }
   */
  private async syncArs(): Promise<SyncTargetResult[]> {
    const url = 'https://dolarapi.com/v1/dolares';
    const source = 'dolarapi.com';
    const currency = Currency.ARS;
    const yearMonth = this.currentYearMonth();
    const results: SyncTargetResult[] = [];

    let rawData: unknown;
    try {
      rawData = await secureFetch(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      for (const variant of ALLOWED_VARIANTS) {
        const target = this.makeTarget('CurrencyQuote', currency, variant, yearMonth);
        await this.logSync(source, target, { error: msg }, false, 'http-error');
        results.push({ target, accepted: false, reason: 'http-error' });
      }
      return results;
    }

    if (!Array.isArray(rawData)) {
      for (const variant of ALLOWED_VARIANTS) {
        const target = this.makeTarget('CurrencyQuote', currency, variant, yearMonth);
        await this.logSync(source, target, rawData ?? {}, false, 'schema');
        results.push({ target, accepted: false, reason: 'schema' });
      }
      return results;
    }

    for (const variant of ALLOWED_VARIANTS as readonly AllowedVariant[]) {
      const target = this.makeTarget('CurrencyQuote', currency, variant, yearMonth);

      const entry = (rawData as Record<string, unknown>[]).find(
        (item) =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as Record<string, unknown>).casa === 'string' &&
          ((item as Record<string, unknown>).casa as string).toLowerCase() === variant,
      );

      if (!entry) {
        this.logger.warn(`dolarapi.com: variante "${variant}" no encontrada`);
        await this.logSync(source, target, rawData, false, 'schema');
        results.push({ target, accepted: false, reason: 'schema' });
        continue;
      }

      const validated = validateDolarApiEntry(entry, currency);
      if (typeof validated === 'string') {
        this.logger.warn(`Validación ARS ${variant}: ${validated}`);
        await this.logSync(source, target, entry, false, 'schema');
        results.push({ target, accepted: false, reason: 'schema' });
        continue;
      }

      const { compra, venta } = validated;
      const cb = await this.circuitBreakerFx(currency, variant, yearMonth, venta);
      if (!cb.ok) {
        this.logger.warn(
          `Circuit breaker ARS ${variant}: nuevo=${venta}, último=${cb.lastValue?.toFixed(2)}, dev=${cb.deviation?.toFixed(3)}`,
        );
        await this.logSync(source, target, entry, false, 'circuit-breaker');
        results.push({ target, accepted: false, reason: 'circuit-breaker' });
        continue;
      }

      try {
        await this.upsertFxQuote({
          currency,
          variant,
          yearMonth,
          compra: new Prisma.Decimal(compra),
          venta: new Prisma.Decimal(venta),
          source,
          propagateToReferenceRate: variant === 'oficial',
          referenceRateValue: new Prisma.Decimal(venta),
        });
        await this.logSync(source, target, entry, true, null);
        results.push({ target, accepted: true });
        this.logger.log(`ARS ${variant} ${yearMonth}: compra=${compra} venta=${venta}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Error persistiendo ARS ${variant}: ${msg}`);
        await this.logSync(source, target, entry, false, 'db-error');
        results.push({ target, accepted: false, reason: 'db-error' });
      }
    }

    return results;
  }

  /**
   * EUR o BRL desde api.frankfurter.dev.
   * GET https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR|BRL
   * Respuesta: { rates: { EUR: number }, ... }
   * Valor único → variante "oficial", compra == venta.
   */
  private async syncFrankfurter(currency: Currency): Promise<SyncTargetResult> {
    const symbol = currency === Currency.EUR ? 'EUR' : 'BRL';
    const url = `https://api.frankfurter.dev/v1/latest?base=USD&symbols=${symbol}`;
    const source = 'api.frankfurter.dev';
    const variant = 'oficial';
    const yearMonth = this.currentYearMonth();
    const target = this.makeTarget('CurrencyQuote', currency, variant, yearMonth);

    let rawData: unknown;
    try {
      rawData = await secureFetch(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.logSync(source, target, { error: msg }, false, 'http-error');
      return { target, accepted: false, reason: 'http-error' };
    }

    if (
      typeof rawData !== 'object' ||
      rawData === null ||
      typeof (rawData as Record<string, unknown>).rates !== 'object' ||
      (rawData as Record<string, unknown>).rates === null
    ) {
      await this.logSync(source, target, rawData ?? {}, false, 'schema');
      return { target, accepted: false, reason: 'schema' };
    }

    const rates = (rawData as { rates: Record<string, unknown> }).rates;
    const validated = validateFrankfurterRate(rates[symbol]);
    if (typeof validated === 'string') {
      this.logger.warn(`Validación ${symbol} Frankfurter: ${validated}`);
      await this.logSync(source, target, rawData, false, 'schema');
      return { target, accepted: false, reason: 'schema' };
    }

    const cb = await this.circuitBreakerFx(currency, variant, yearMonth, validated);
    if (!cb.ok) {
      this.logger.warn(
        `Circuit breaker ${symbol}: nuevo=${validated}, último=${cb.lastValue?.toFixed(4)}, dev=${cb.deviation?.toFixed(3)}`,
      );
      await this.logSync(source, target, rawData, false, 'circuit-breaker');
      return { target, accepted: false, reason: 'circuit-breaker' };
    }

    try {
      const dec = new Prisma.Decimal(validated);
      await this.upsertFxQuote({
        currency,
        variant,
        yearMonth,
        compra: dec,
        venta: dec,
        source,
        propagateToReferenceRate: true,
        referenceRateValue: dec,
      });
      await this.logSync(source, target, rawData, true, null);
      this.logger.log(`${symbol} ${yearMonth}: ${validated}`);
      return { target, accepted: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error persistiendo ${symbol}: ${msg}`);
      await this.logSync(source, target, rawData, false, 'db-error');
      return { target, accepted: false, reason: 'db-error' };
    }
  }

  // -------------------------------------------------------------------------
  // Sync IPC
  // -------------------------------------------------------------------------

  /**
   * IPC desde apis.datos.gob.ar — series de tiempo INDEC.
   * Consulta dos series en paralelo y hace un único upsert de InflationRate.
   */
  private async syncIpc(): Promise<SyncTargetResult[]> {
    const source = 'apis.datos.gob.ar';
    const variationId = '145.3_INGNACUAL_DICI_M_38';
    const indexId = '148.3_INIVELNAL_DICI_M_26';

    const varUrl = `https://apis.datos.gob.ar/series/api/series/?ids=${variationId}&limit=1&sort=desc&format=json`;
    const idxUrl = `https://apis.datos.gob.ar/series/api/series/?ids=${indexId}&limit=1&sort=desc&format=json`;

    const [varRes, idxRes] = await Promise.allSettled([
      secureFetch(varUrl),
      secureFetch(idxUrl),
    ]);

    const varRaw = varRes.status === 'fulfilled' ? varRes.value : { error: String((varRes as PromiseRejectedResult).reason) };
    const idxRaw = idxRes.status === 'fulfilled' ? idxRes.value : { error: String((idxRes as PromiseRejectedResult).reason) };
    const combinedRaw = { variation: varRaw, index: idxRaw };

    const varData = varRes.status === 'fulfilled' ? this.extractIpcValue(varRes.value) : null;
    const idxData = idxRes.status === 'fulfilled' ? this.extractIpcValue(idxRes.value) : null;

    // Determinar yearMonth para el target (incluso si los datos fallan)
    const yearMonth = varData?.yearMonth ?? idxData?.yearMonth ?? this.currentYearMonth();
    const target = this.makeIpcTarget(yearMonth);

    if (varRes.status === 'rejected' && idxRes.status === 'rejected') {
      await this.logSync(source, target, combinedRaw, false, 'http-error');
      return [{ target, accepted: false, reason: 'http-error' }];
    }

    if (!varData || !idxData) {
      await this.logSync(source, target, combinedRaw, false, 'schema');
      return [{ target, accepted: false, reason: 'schema' }];
    }

    const variation = varData.value;
    const indexValue = idxData.value;

    const sanityError = validateIpcValues(variation, indexValue);
    if (sanityError) {
      this.logger.warn(`IPC fuera de cotas: ${sanityError}`);
      await this.logSync(source, target, combinedRaw, false, 'out-of-range');
      return [{ target, accepted: false, reason: 'out-of-range' }];
    }

    const cb = await this.circuitBreakerIpc(yearMonth, variation);
    if (!cb.ok) {
      this.logger.warn(
        `Circuit breaker IPC: nuevo=${variation}, último=${cb.lastValue?.toFixed(2)}, dev=${cb.deviation?.toFixed(3)}`,
      );
      await this.logSync(source, target, combinedRaw, false, 'circuit-breaker');
      return [{ target, accepted: false, reason: 'circuit-breaker' }];
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.inflationRate.upsert({
          where: { yearMonth },
          create: {
            yearMonth,
            monthlyVariation: new Prisma.Decimal(variation),
            indexValue: new Prisma.Decimal(indexValue),
            source,
            fetchedAt: new Date(),
          },
          update: {
            monthlyVariation: new Prisma.Decimal(variation),
            indexValue: new Prisma.Decimal(indexValue),
            source,
            fetchedAt: new Date(),
          },
        });
      });
      await this.logSync(source, target, combinedRaw, true, null);
      this.logger.log(`IPC ${yearMonth}: variación=${variation}% índice=${indexValue}`);
      return [{ target, accepted: true }];
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error persistiendo IPC: ${msg}`);
      await this.logSync(source, target, combinedRaw, false, 'db-error');
      return [{ target, accepted: false, reason: 'db-error' }];
    }
  }

  /**
   * Extrae el valor más reciente de una serie de apis.datos.gob.ar.
   * Formato: { data: [[dateStr, value], ...], ... }
   */
  private extractIpcValue(raw: unknown): { yearMonth: string; value: number } | null {
    if (typeof raw !== 'object' || raw === null) return null;
    const obj = raw as Record<string, unknown>;
    if (!Array.isArray(obj.data) || obj.data.length === 0) return null;

    const first = obj.data[0] as unknown[];
    if (!Array.isArray(first) || first.length < 2) return null;

    const dateStr = first[0];
    const value = first[1];

    if (typeof dateStr !== 'string') return null;
    if (typeof value !== 'number' || !isFinite(value)) return null;

    const yearMonth = dateStr.substring(0, 7);
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) return null;

    return { yearMonth, value };
  }

  // -------------------------------------------------------------------------
  // Circuit breakers
  // -------------------------------------------------------------------------

  private async circuitBreakerFx(
    currency: Currency,
    variant: string,
    yearMonth: string,
    newValue: number,
  ): Promise<CircuitBreakerResult> {
    const last = await this.prisma.currencyQuote.findUnique({
      where: { currency_variant_yearMonth: { currency, variant, yearMonth } },
      select: { venta: true },
    });
    if (!last) return { ok: true };

    const lastValue = Number(last.venta);
    if (lastValue <= 0) return { ok: true };

    const deviation = Math.abs(newValue - lastValue) / lastValue;
    return deviation > CIRCUIT_BREAKER_THRESHOLD
      ? { ok: false, lastValue, deviation }
      : { ok: true, lastValue, deviation };
  }

  private async circuitBreakerIpc(
    yearMonth: string,
    newVariation: number,
  ): Promise<CircuitBreakerResult> {
    const last = await this.prisma.inflationRate.findUnique({
      where: { yearMonth },
      select: { monthlyVariation: true },
    });
    if (!last) return { ok: true };

    const lastValue = Number(last.monthlyVariation);
    if (Math.abs(lastValue) < 0.01) return { ok: true };

    const deviation = Math.abs(newVariation - lastValue) / Math.abs(lastValue);
    return deviation > CIRCUIT_BREAKER_THRESHOLD
      ? { ok: false, lastValue, deviation }
      : { ok: true, lastValue, deviation };
  }

  // -------------------------------------------------------------------------
  // Upsert transaccional
  // -------------------------------------------------------------------------

  private async upsertFxQuote(params: FxQuoteParams): Promise<void> {
    const {
      currency,
      variant,
      yearMonth,
      compra,
      venta,
      source,
      propagateToReferenceRate,
      referenceRateValue,
    } = params;

    await this.prisma.$transaction(async (tx) => {
      await tx.currencyQuote.upsert({
        where: { currency_variant_yearMonth: { currency, variant, yearMonth } },
        create: {
          currency,
          variant,
          yearMonth,
          compra,
          venta,
          source,
          fetchedAt: new Date(),
        },
        update: {
          compra,
          venta,
          source,
          fetchedAt: new Date(),
        },
      });

      if (propagateToReferenceRate) {
        await tx.referenceRate.upsert({
          where: { currency_yearMonth: { currency, yearMonth } },
          create: { currency, yearMonth, rate: referenceRateValue },
          update: { rate: referenceRateValue },
        });
      }
    });
  }

  // -------------------------------------------------------------------------
  // Auditoría
  // -------------------------------------------------------------------------

  /**
   * Registra un intento de escritura en RateSyncLog.
   * NUNCA incluye el CRON_SECRET ni valores de autenticación.
   */
  private async logSync(
    source: string,
    target: string,
    rawPayload: unknown,
    accepted: boolean,
    reason: string | null,
  ): Promise<void> {
    try {
      await this.prisma.rateSyncLog.create({
        data: {
          source,
          target,
          rawPayload: rawPayload as Prisma.InputJsonValue,
          accepted,
          reason: reason ?? undefined,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error al escribir RateSyncLog: ${msg}`);
    }
  }

  // -------------------------------------------------------------------------
  // Helpers de formato
  // -------------------------------------------------------------------------

  private currentYearMonth(): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  private makeTarget(
    table: string,
    currency: Currency,
    variant: string,
    yearMonth: string,
  ): string {
    return `${table}:${currency}:${variant}:${yearMonth}`;
  }

  private makeIpcTarget(yearMonth: string): string {
    return `InflationRate:${yearMonth}`;
  }
}
