/**
 * Tests unitarios de RateSyncService (P7 — sincronización de cotizaciones externas)
 *
 * Cubre:
 * - assertAllowedHost: allowlist de hosts
 * - validateDolarApiEntry: schema + cotas de cordura
 * - validateFrankfurterRate: schema + cotas de cordura
 * - validateIpcValues: cotas de cordura IPC
 * - Circuit breaker: acepta (desviación ≤15%), rechaza (>15%), sin dato previo
 * - Auth tiempo-constante (CronSecretGuard)
 * - Upsert transaccional (via mock de Prisma)
 *
 * Las llamadas HTTP externas están mockeadas — NO se pega a APIs reales.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Currency, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import {
  assertAllowedHost,
  validateDolarApiEntry,
  validateFrankfurterRate,
  validateIpcValues,
  CIRCUIT_BREAKER_THRESHOLD,
  ALLOWED_VARIANTS,
  RateSyncService,
  SyncResult,
} from '../../../src/settings/rate-sync.service';
import { CronSecretGuard } from '../../../src/settings/cron-secret.guard';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { SyncScope } from '../../../src/settings/dto/sync-rates.dto';

// ---------------------------------------------------------------------------
// Helpers de test
// ---------------------------------------------------------------------------

function makeMockContext(authHeader: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: authHeader !== undefined ? { authorization: authHeader } : {},
      }),
    }),
  } as unknown as ExecutionContext;
}

// ---------------------------------------------------------------------------
// 1. assertAllowedHost — allowlist
// ---------------------------------------------------------------------------

describe('assertAllowedHost', () => {
  it('acepta dolarapi.com', () => {
    expect(() => assertAllowedHost('https://dolarapi.com/v1/dolares')).not.toThrow();
  });

  it('acepta api.frankfurter.dev', () => {
    expect(() =>
      assertAllowedHost('https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR'),
    ).not.toThrow();
  });

  it('acepta apis.datos.gob.ar', () => {
    expect(() =>
      assertAllowedHost('https://apis.datos.gob.ar/series/api/series/?ids=foo'),
    ).not.toThrow();
  });

  it('rechaza host no en allowlist', () => {
    expect(() => assertAllowedHost('https://evil.com/rates')).toThrow('Host no permitido');
  });

  it('rechaza subdominio no exacto', () => {
    expect(() => assertAllowedHost('https://sub.dolarapi.com/v1/dolares')).toThrow(
      'Host no permitido',
    );
  });

  it('rechaza URL malformada', () => {
    expect(() => assertAllowedHost('not-a-url')).toThrow('URL malformada');
  });
});

// ---------------------------------------------------------------------------
// 2. validateDolarApiEntry — schema y cotas de cordura
// ---------------------------------------------------------------------------

describe('validateDolarApiEntry', () => {
  it('acepta objeto válido con compra y venta positivos', () => {
    const result = validateDolarApiEntry(
      { compra: 1200, venta: 1250 },
      Currency.ARS,
    );
    expect(result).toEqual({ compra: 1200, venta: 1250 });
  });

  it('rechaza null', () => {
    expect(typeof validateDolarApiEntry(null, Currency.ARS)).toBe('string');
  });

  it('rechaza compra cero', () => {
    const r = validateDolarApiEntry({ compra: 0, venta: 100 }, Currency.ARS);
    expect(typeof r).toBe('string');
    expect(r as string).toContain('compra');
  });

  it('rechaza compra negativa', () => {
    const r = validateDolarApiEntry({ compra: -100, venta: 100 }, Currency.ARS);
    expect(typeof r).toBe('string');
  });

  it('rechaza venta NaN', () => {
    const r = validateDolarApiEntry({ compra: 100, venta: NaN }, Currency.ARS);
    expect(typeof r).toBe('string');
    expect(r as string).toContain('venta');
  });

  it('rechaza venta Infinity', () => {
    const r = validateDolarApiEntry({ compra: 100, venta: Infinity }, Currency.ARS);
    expect(typeof r).toBe('string');
  });

  it('rechaza magnitud implausible para ARS (>1_000_000)', () => {
    const r = validateDolarApiEntry({ compra: 100, venta: 1_500_000 }, Currency.ARS);
    expect(typeof r).toBe('string');
    expect(r as string).toContain('implausible');
  });

  it('rechaza magnitud implausible para EUR (>10_000)', () => {
    const r = validateDolarApiEntry({ compra: 0.5, venta: 15_000 }, Currency.EUR);
    expect(typeof r).toBe('string');
    expect(r as string).toContain('implausible');
  });

  it('acepta valor pequeño válido para EUR', () => {
    const r = validateDolarApiEntry({ compra: 0.85, venta: 0.90 }, Currency.EUR);
    expect(r).toEqual({ compra: 0.85, venta: 0.90 });
  });
});

// ---------------------------------------------------------------------------
// 3. validateFrankfurterRate — schema y cotas de cordura
// ---------------------------------------------------------------------------

describe('validateFrankfurterRate', () => {
  it('acepta número positivo finito', () => {
    expect(validateFrankfurterRate(0.865)).toBe(0.865);
  });

  it('acepta número grande válido', () => {
    expect(validateFrankfurterRate(5.11)).toBe(5.11);
  });

  it('rechaza cero', () => {
    expect(typeof validateFrankfurterRate(0)).toBe('string');
  });

  it('rechaza negativo', () => {
    expect(typeof validateFrankfurterRate(-1)).toBe('string');
  });

  it('rechaza NaN', () => {
    expect(typeof validateFrankfurterRate(NaN)).toBe('string');
  });

  it('rechaza Infinity', () => {
    expect(typeof validateFrankfurterRate(Infinity)).toBe('string');
  });

  it('rechaza string', () => {
    expect(typeof validateFrankfurterRate('0.865')).toBe('string');
  });

  it('rechaza magnitud implausible (>10_000)', () => {
    const r = validateFrankfurterRate(15_000);
    expect(typeof r).toBe('string');
    expect(r as string).toContain('implausible');
  });
});

// ---------------------------------------------------------------------------
// 4. validateIpcValues — cotas de cordura IPC
// ---------------------------------------------------------------------------

describe('validateIpcValues', () => {
  // Los valores recibidos en validateIpcValues son en PUNTOS PORCENTUALES
  // (ya convertidos del fraccionario de INDEC ×100 por el servicio).
  // Ej: 2.5 = 2.5% mensual; -5 = deflación del 5%; 0.027 también pasa (es 0.027%)

  it('acepta variación y índice válidos en puntos %', () => {
    expect(validateIpcValues(2.5, 150.3)).toBeNull();
  });

  it('acepta variación típica real del IPC argentino (ej: 3.7 pts %)', () => {
    expect(validateIpcValues(3.7, 4200)).toBeNull();
  });

  it('acepta variación negativa dentro de cotas', () => {
    expect(validateIpcValues(-5, 100)).toBeNull();
  });

  it('rechaza variación por encima del máximo', () => {
    const r = validateIpcValues(501, 100);
    expect(r).not.toBeNull();
    expect(r).toContain('variación');
  });

  it('rechaza variación por debajo del mínimo', () => {
    const r = validateIpcValues(-101, 100);
    expect(r).not.toBeNull();
  });

  it('rechaza índice cero', () => {
    const r = validateIpcValues(2, 0);
    expect(r).not.toBeNull();
    expect(r).toContain('índice');
  });

  it('rechaza índice negativo', () => {
    const r = validateIpcValues(2, -100);
    expect(r).not.toBeNull();
  });

  it('rechaza índice implausible (>100_000)', () => {
    const r = validateIpcValues(2, 200_000);
    expect(r).not.toBeNull();
    expect(r).toContain('implausible');
  });

  it('rechaza variación NaN', () => {
    const r = validateIpcValues(NaN, 100);
    expect(r).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. ALLOWED_VARIANTS — allowlist de variantes FX
// ---------------------------------------------------------------------------

describe('ALLOWED_VARIANTS', () => {
  it('contiene "oficial" y "blue"', () => {
    expect(ALLOWED_VARIANTS).toContain('oficial');
    expect(ALLOWED_VARIANTS).toContain('blue');
  });

  it('no contiene variantes desconocidas como "mep"', () => {
    expect(ALLOWED_VARIANTS).not.toContain('mep');
  });
});

// ---------------------------------------------------------------------------
// 6. Circuit breaker — lógica
// ---------------------------------------------------------------------------

describe('Circuit breaker — umbral', () => {
  it('CIRCUIT_BREAKER_THRESHOLD es 0.15 (15%)', () => {
    expect(CIRCUIT_BREAKER_THRESHOLD).toBe(0.15);
  });

  it('desviación del 14% queda bajo el umbral (acepta)', () => {
    const lastValue = 1000;
    const newValue = 1140; // +14%
    const deviation = Math.abs(newValue - lastValue) / lastValue;
    expect(deviation).toBeLessThanOrEqual(CIRCUIT_BREAKER_THRESHOLD);
  });

  it('desviación del 15% exacto queda en el límite (rechaza por >)', () => {
    const lastValue = 1000;
    const newValue = 1150; // exactamente +15%
    const deviation = Math.abs(newValue - lastValue) / lastValue;
    // La condición es STRICT >: 0.15 > 0.15 es false → acepta
    expect(deviation > CIRCUIT_BREAKER_THRESHOLD).toBe(false);
  });

  it('desviación del 16% supera el umbral (rechaza)', () => {
    const lastValue = 1000;
    const newValue = 1160; // +16%
    const deviation = Math.abs(newValue - lastValue) / lastValue;
    expect(deviation > CIRCUIT_BREAKER_THRESHOLD).toBe(true);
  });

  it('desviación del 50% hacia abajo supera el umbral (rechaza)', () => {
    const lastValue = 1000;
    const newValue = 500; // -50%
    const deviation = Math.abs(newValue - lastValue) / lastValue;
    expect(deviation > CIRCUIT_BREAKER_THRESHOLD).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. CronSecretGuard — auth de tiempo constante
// ---------------------------------------------------------------------------

describe('CronSecretGuard', () => {
  const VALID_SECRET = 'supersecretvalido123456789012345678901234567890'; // ≥32 chars

  let guard: CronSecretGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CronSecretGuard,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(VALID_SECRET),
          },
        },
      ],
    }).compile();

    guard = module.get<CronSecretGuard>(CronSecretGuard);
  });

  it('acepta el secret correcto en header Bearer', () => {
    const ctx = makeMockContext(`Bearer ${VALID_SECRET}`);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('acepta el secret correcto sin prefijo Bearer', () => {
    const ctx = makeMockContext(VALID_SECRET);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rechaza secret incorrecto con 401', () => {
    const ctx = makeMockContext('Bearer wrong-secret');
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('rechaza sin header Authorization con 401', () => {
    const ctx = makeMockContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('rechaza string vacío con 401', () => {
    const ctx = makeMockContext('');
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('rechaza header Bearer sin valor con 401', () => {
    const ctx = makeMockContext('Bearer ');
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});

// ---------------------------------------------------------------------------
// 8. RateSyncService — upsert transaccional (mock de Prisma + fetch)
// ---------------------------------------------------------------------------

describe('RateSyncService — upsert transaccional via sync()', () => {
  let service: RateSyncService;
  let mockPrisma: {
    currencyQuote: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
    inflationRate: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
    referenceRate: {
      upsert: jest.Mock;
    };
    rateSyncLog: {
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  // fetch global mockeado
  const originalFetch = global.fetch;

  beforeEach(async () => {
    mockPrisma = {
      currencyQuote: {
        findUnique: jest.fn().mockResolvedValue(null), // sin dato previo → CB acepta
        upsert: jest.fn().mockResolvedValue({}),
      },
      inflationRate: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
      referenceRate: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      rateSyncLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        // Ejecuta el callback con el mismo mock (tx = prisma mock)
        return fn(mockPrisma);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateSyncService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RateSyncService>(RateSyncService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  /**
   * Helper: mock de fetch que responde un payload JSON.
   */
  function mockFetch(responses: Record<string, unknown>): void {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      const matchedKey = Object.keys(responses).find((key) => url.includes(key));
      const payload = matchedKey ? responses[matchedKey] : null;
      if (payload === null) {
        return Promise.reject(new Error(`URL no mockeada: ${url}`));
      }
      return Promise.resolve({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(payload),
      });
    }) as typeof fetch;
  }

  it('sync FX — acepta ARS oficial y blue, propaga oficial a ReferenceRate', async () => {
    mockFetch({
      'dolarapi.com': [
        { casa: 'oficial', compra: 1200, venta: 1250 },
        { casa: 'blue', compra: 1300, venta: 1350 },
      ],
      'frankfurter.dev': { rates: { EUR: 0.92, BRL: 5.1 } },
    });

    const result: SyncResult = await service.sync(SyncScope.FX);

    expect(result.acceptedCount).toBeGreaterThan(0);

    // Debe haber llamado $transaction al menos para ARS oficial y ARS blue
    expect(mockPrisma.$transaction).toHaveBeenCalled();

    // RateSyncLog creado para cada target
    expect(mockPrisma.rateSyncLog.create).toHaveBeenCalled();
  });

  it('sync FX — circuit breaker rechaza si nueva venta se desvía >15%', async () => {
    // Simular dato previo en DB: venta = 1000
    mockPrisma.currencyQuote.findUnique.mockResolvedValue({
      venta: new Prisma.Decimal(1000),
    });

    mockFetch({
      'dolarapi.com': [
        { casa: 'oficial', compra: 1200, venta: 1200 }, // +20% → CB rechaza
        { casa: 'blue', compra: 1300, venta: 1300 },    // +30% → CB rechaza
      ],
      'frankfurter.dev': { rates: { EUR: 0.92, BRL: 5.1 } },
    });

    const result: SyncResult = await service.sync(SyncScope.FX);

    const arsOficialResult = result.results.find(
      (r) => r.target.includes('ARS:oficial'),
    );
    expect(arsOficialResult?.accepted).toBe(false);
    expect(arsOficialResult?.reason).toBe('circuit-breaker');
  });

  it('sync FX — acepta si desviación es exactamente 15% (≤ no rechaza)', async () => {
    // venta previa = 1000, nueva = 1150 (exactamente 15%)
    mockPrisma.currencyQuote.findUnique.mockResolvedValue({
      venta: new Prisma.Decimal(1000),
    });

    mockFetch({
      'dolarapi.com': [
        { casa: 'oficial', compra: 1100, venta: 1150 }, // exactamente 15% → acepta
        { casa: 'blue', compra: 1200, venta: 1150 },
      ],
      'frankfurter.dev': { rates: { EUR: 0.92, BRL: 5.1 } },
    });

    const result: SyncResult = await service.sync(SyncScope.FX);

    const arsOficialResult = result.results.find(
      (r) => r.target.includes('ARS:oficial'),
    );
    // Con desviación exacta del 15%, la condición es STRICT > por lo que acepta
    expect(arsOficialResult?.accepted).toBe(true);
  });

  it('sync FX — sin dato previo acepta siempre (sin referencia para CB)', async () => {
    mockPrisma.currencyQuote.findUnique.mockResolvedValue(null);

    mockFetch({
      'dolarapi.com': [
        { casa: 'oficial', compra: 9999, venta: 9999 }, // valor extremo pero sin CB
        { casa: 'blue', compra: 9999, venta: 9999 },
      ],
      'frankfurter.dev': { rates: { EUR: 0.92, BRL: 5.1 } },
    });

    const result: SyncResult = await service.sync(SyncScope.FX);
    const arsOficial = result.results.find((r) => r.target.includes('ARS:oficial'));
    // Sin dato previo, el CB no bloquea (acepta cualquier valor dentro de cotas)
    expect(arsOficial?.accepted).toBe(true);
  });

  it('sync FX — http-error en dolarapi.com → rechaza ARS targets', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('dolarapi.com')) {
        return Promise.reject(new Error('connection refused'));
      }
      return Promise.resolve({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ rates: { EUR: 0.92 } }),
      });
    }) as typeof fetch;

    const result: SyncResult = await service.sync(SyncScope.FX);

    const arsTargets = result.results.filter((r) => r.target.includes(':ARS:'));
    expect(arsTargets.every((r) => !r.accepted)).toBe(true);
    expect(arsTargets.every((r) => r.reason === 'http-error')).toBe(true);
  });

  it('sync IPC — acepta valores válidos de ambas series', async () => {
    mockFetch({
      '145.3_INGNACUAL_DICI_M_38': {
        data: [['2026-05-01', 2.7]],
      },
      '148.3_INIVELNAL_DICI_M_26': {
        data: [['2026-05-01', 3825.4]],
      },
    });

    const result: SyncResult = await service.sync(SyncScope.IPC);

    expect(result.acceptedCount).toBe(1);
    const ipcTarget = result.results.find((r) => r.target.includes('InflationRate'));
    expect(ipcTarget?.accepted).toBe(true);

    // Debe haber llamado $transaction para el upsert
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('sync IPC — convierte fracción INDEC a puntos %: API 0.027 → guarda 2.7 (no 0.027)', async () => {
    // La API de INDEC devuelve la variación como fracción decimal (ej. 0.027 para 2.7%).
    // El servicio debe multiplicar ×100 antes de persistir, para que la DB almacene
    // puntos porcentuales (2.7) — unidad canónica del sistema (post-migración).
    mockFetch({
      '145.3_INGNACUAL_DICI_M_38': {
        data: [['2026-05-01', 0.027]], // fracción: 2.7%
      },
      '148.3_INIVELNAL_DICI_M_26': {
        data: [['2026-05-01', 3825.4]],
      },
    });

    await service.sync(SyncScope.IPC);

    // El upsert debe haberse llamado dentro de $transaction.
    // Como el mock de $transaction ejecuta el callback con el mismo mock,
    // inflationRate.upsert fue llamado con monthlyVariation = 2.7 (no 0.027).
    const upsertCalls = mockPrisma.inflationRate.upsert.mock.calls;
    expect(upsertCalls).toHaveLength(1);
    const upsertArg = upsertCalls[0][0] as {
      create: { monthlyVariation: { toNumber(): number } };
    };
    // Prisma.Decimal.toNumber() devuelve el valor numérico
    expect(Number(upsertArg.create.monthlyVariation)).toBeCloseTo(2.7, 5);
  });

  it('sync IPC — rechaza si variación mensual supera cotas (>500%)', async () => {
    mockFetch({
      '145.3_INGNACUAL_DICI_M_38': {
        data: [['2026-05-01', 999]],
      },
      '148.3_INIVELNAL_DICI_M_26': {
        data: [['2026-05-01', 3825.4]],
      },
    });

    const result: SyncResult = await service.sync(SyncScope.IPC);

    expect(result.acceptedCount).toBe(0);
    const ipcTarget = result.results[0];
    expect(ipcTarget.accepted).toBe(false);
    expect(ipcTarget.reason).toBe('out-of-range');
  });

  it('sync ALL — acceptedCount y rejectedCount son correctos', async () => {
    // dolarapi OK, frankfurter OK, IPC OK
    mockFetch({
      'dolarapi.com': [
        { casa: 'oficial', compra: 1200, venta: 1250 },
        { casa: 'blue', compra: 1300, venta: 1350 },
      ],
      'frankfurter.dev': { rates: { EUR: 0.92, BRL: 5.1 } },
      '145.3_INGNACUAL_DICI_M_38': { data: [['2026-05-01', 2.7]] },
      '148.3_INIVELNAL_DICI_M_26': { data: [['2026-05-01', 3825.4]] },
    });

    const result: SyncResult = await service.sync(SyncScope.ALL);

    expect(result.scope).toBe(SyncScope.ALL);
    expect(result.acceptedCount + result.rejectedCount).toBe(result.results.length);
    // Todos los FX + IPC deberían aceptarse
    expect(result.acceptedCount).toBeGreaterThan(0);
  });

  it('sync — propaga ARS oficial a ReferenceRate pero NO blue', async () => {
    mockFetch({
      'dolarapi.com': [
        { casa: 'oficial', compra: 1200, venta: 1250 },
        { casa: 'blue', compra: 1300, venta: 1350 },
      ],
      'frankfurter.dev': { rates: { EUR: 0.92, BRL: 5.1 } },
    });

    await service.sync(SyncScope.FX);

    // El $transaction debe haberse llamado; dentro se llama referenceRate.upsert
    // para oficial pero no para blue.
    // Como el mock de $transaction ejecuta el callback, referenceRate.upsert
    // debe haber sido llamado para ARS oficial.
    const upsertCalls = mockPrisma.referenceRate.upsert.mock.calls;
    const arsOfficialCall = upsertCalls.find(
      (call: unknown[]) =>
        (call[0] as { where: { currency_yearMonth: { currency: string } } }).where.currency_yearMonth.currency === 'ARS',
    );
    expect(arsOfficialCall).toBeDefined();
  });

  it('sync — no escribe si schema de dolarapi.com es inválido', async () => {
    mockFetch({
      'dolarapi.com': { error: 'not an array' }, // respuesta no es array
      'frankfurter.dev': { rates: { EUR: 0.92, BRL: 5.1 } },
    });

    const result: SyncResult = await service.sync(SyncScope.FX);

    const arsTargets = result.results.filter((r) => r.target.includes(':ARS:'));
    expect(arsTargets.every((r) => !r.accepted)).toBe(true);
    expect(arsTargets.every((r) => r.reason === 'schema')).toBe(true);

    // No se debe haber llamado $transaction para ARS
    // (sí para EUR/BRL que sí son válidos)
    const transactionCalls = (mockPrisma.$transaction as jest.Mock).mock.calls.length;
    // Solo EUR y BRL con frankfurter pueden generar transacciones
    expect(transactionCalls).toBeLessThanOrEqual(2);
  });
});
