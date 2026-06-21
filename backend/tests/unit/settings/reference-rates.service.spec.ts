/**
 * Tests unitarios de ReferenceRatesService (Fase 1.2.4)
 *
 * Cubre:
 * - getPivotRatesForMonth: carga filas de DB y construye PivotRates
 * - getPivotRatesForMonth con CLAMP: mes futuro/pasado resuelve al más cercano
 * - getPreFill: derivación del exchangeRate por mes/moneda
 * - getPreFill con mes futuro: usa el clamp, devuelve rate sensato (no null)
 * - currency === defaultCurrency: devuelve exchangeRate=1 sin consultar DB
 * - tabla vacía: devuelve exchangeRate=null
 * - todas las combinaciones de monedas del set curado
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Currency } from '@prisma/client';
import { ReferenceRatesService } from '../../../src/settings/reference-rates.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

// ---------------------------------------------------------------------------
// Mock de PrismaService
// ---------------------------------------------------------------------------

const mockPrisma = {
  referenceRate: {
    findMany: jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Pivot rates para 2026-06
const ROWS_2026_06 = [
  { currency: Currency.ARS, yearMonth: '2026-06', rate: '1432.000000' },
  { currency: Currency.BRL, yearMonth: '2026-06', rate: '5.110000' },
  { currency: Currency.EUR, yearMonth: '2026-06', rate: '0.865000' },
];

// Simulación de toda la tabla (18 meses: 2025-01 a 2026-06)
// Para tests de clamp, nos basta con tener los yearMonths y las filas del mes resuelto.
function buildAllRatesTable(): Array<{ currency: Currency; yearMonth: string; rate: string }> {
  const rows: Array<{ currency: Currency; yearMonth: string; rate: string }> = [];
  for (let y = 2025; y <= 2026; y++) {
    const maxM = y === 2026 ? 6 : 12;
    for (let m = 1; m <= maxM; m++) {
      const ym = `${y}-${String(m).padStart(2, '0')}`;
      rows.push({ currency: Currency.ARS, yearMonth: ym, rate: '1432.000000' });
      rows.push({ currency: Currency.BRL, yearMonth: ym, rate: '5.110000' });
      rows.push({ currency: Currency.EUR, yearMonth: ym, rate: '0.865000' });
    }
  }
  return rows;
}

/**
 * Mockea una query exacta para un mes con rows simples (sin yearMonth en cada fila).
 */
function mockRowsExact(rows: Array<{ currency: Currency; rate: string }>) {
  // La primera llamada es la query directa (donde: { yearMonth }); necesitamos mapearla sin yearMonth
  mockPrisma.referenceRate.findMany.mockResolvedValueOnce(rows);
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('ReferenceRatesService', () => {
  let service: ReferenceRatesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferenceRatesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ReferenceRatesService>(ReferenceRatesService);
  });

  // ── getPivotRatesForMonth — caso directo (mes en rango) ──────────────────

  describe('getPivotRatesForMonth — mes en rango', () => {
    it('devuelve las 3 monedas disponibles como PivotRates', async () => {
      // Primera query (directa) retorna las filas del mes
      mockPrisma.referenceRate.findMany.mockResolvedValueOnce(
        ROWS_2026_06.map(r => ({ currency: r.currency, rate: r.rate })),
      );
      const result = await service.getPivotRatesForMonth('2026-06');
      expect(result).toEqual({ ARS: 1432, BRL: 5.11, EUR: 0.865 });
    });

    it('consulta por el yearMonth correcto', async () => {
      mockPrisma.referenceRate.findMany.mockResolvedValueOnce(
        ROWS_2026_06.map(r => ({ currency: r.currency, rate: r.rate })),
      );
      await service.getPivotRatesForMonth('2026-06');
      expect(mockPrisma.referenceRate.findMany).toHaveBeenCalledWith({
        where: { yearMonth: '2026-06' },
        select: { currency: true, rate: true },
      });
    });
  });

  // ── getPivotRatesForMonth — clamp (mes fuera de rango) ───────────────────

  describe('getPivotRatesForMonth — clamp al rango disponible', () => {
    it('[CLAMP] mes futuro 2026-09: usa el máximo disponible (2026-06)', async () => {
      // 1ª call: query directa por 2026-09 → vacía (miss)
      mockPrisma.referenceRate.findMany.mockResolvedValueOnce([]);
      // 2ª call: loadAvailableYearMonths → todos los yearMonths
      mockPrisma.referenceRate.findMany.mockResolvedValueOnce(
        buildAllRatesTable().map(r => ({ yearMonth: r.yearMonth })),
      );
      // 3ª call: query por el resuelto 2026-06 → rates reales
      mockPrisma.referenceRate.findMany.mockResolvedValueOnce(
        ROWS_2026_06.map(r => ({ currency: r.currency, rate: r.rate })),
      );

      const result = await service.getPivotRatesForMonth('2026-09');
      expect(result).toEqual({ ARS: 1432, BRL: 5.11, EUR: 0.865 });
      expect(mockPrisma.referenceRate.findMany).toHaveBeenCalledTimes(3);
    });

    it('[CLAMP] mes pasado 2024-12: usa el mínimo disponible (2025-01)', async () => {
      const rows2025_01 = [
        { currency: Currency.ARS, rate: '1100.000000' },
        { currency: Currency.BRL, rate: '5.00000' },
        { currency: Currency.EUR, rate: '0.920000' },
      ];
      // 1ª call: query directa por 2024-12 → vacía (miss)
      mockPrisma.referenceRate.findMany.mockResolvedValueOnce([]);
      // 2ª call: loadAvailableYearMonths
      mockPrisma.referenceRate.findMany.mockResolvedValueOnce(
        buildAllRatesTable().map(r => ({ yearMonth: r.yearMonth })),
      );
      // 3ª call: query por el resuelto 2025-01
      mockPrisma.referenceRate.findMany.mockResolvedValueOnce(rows2025_01);

      const result = await service.getPivotRatesForMonth('2024-12');
      expect(result).toEqual({ ARS: 1100, BRL: 5.0, EUR: 0.92 });
    });

    it('[CLAMP] tabla completamente vacía: devuelve null', async () => {
      // 1ª call: query directa → vacía
      mockPrisma.referenceRate.findMany.mockResolvedValueOnce([]);
      // 2ª call: loadAvailableYearMonths → vacía
      mockPrisma.referenceRate.findMany.mockResolvedValueOnce([]);

      const result = await service.getPivotRatesForMonth('2026-09');
      expect(result).toBeNull();
    });
  });

  // ── getPreFill ────────────────────────────────────────────────────────────

  describe('getPreFill', () => {
    it('currency === defaultCurrency (ARS→ARS): exchangeRate=1, sin consulta DB', async () => {
      const result = await service.getPreFill(Currency.ARS, Currency.ARS, '2026-06');
      expect(result).toEqual({
        currency: Currency.ARS,
        defaultCurrency: Currency.ARS,
        yearMonth: '2026-06',
        exchangeRate: 1,
      });
      // No debe consultar la DB
      expect(mockPrisma.referenceRate.findMany).not.toHaveBeenCalled();
    });

    it('currency === defaultCurrency (EUR→EUR): exchangeRate=1', async () => {
      const result = await service.getPreFill(Currency.EUR, Currency.EUR, '2026-06');
      expect(result.exchangeRate).toBe(1);
      expect(mockPrisma.referenceRate.findMany).not.toHaveBeenCalled();
    });

    it('USD→ARS mes disponible: exchangeRate = 1432 (ARS_rate / USD_rate = 1432 / 1)', async () => {
      mockPrisma.referenceRate.findMany.mockResolvedValueOnce(
        ROWS_2026_06.map(r => ({ currency: r.currency, rate: r.rate })),
      );
      const result = await service.getPreFill(Currency.USD, Currency.ARS, '2026-06');
      expect(result.exchangeRate).toBeCloseTo(1432, 4);
      expect(result.currency).toBe(Currency.USD);
      expect(result.defaultCurrency).toBe(Currency.ARS);
      expect(result.yearMonth).toBe('2026-06');
    });

    it('EUR→ARS: exchangeRate = 1432 / 0.865 ≈ 1655.49', async () => {
      mockPrisma.referenceRate.findMany.mockResolvedValueOnce(
        ROWS_2026_06.map(r => ({ currency: r.currency, rate: r.rate })),
      );
      const result = await service.getPreFill(Currency.EUR, Currency.ARS, '2026-06');
      expect(result.exchangeRate).toBeCloseTo(1432 / 0.865, 2);
    });

    it('BRL→ARS: exchangeRate = 1432 / 5.11 ≈ 280.23', async () => {
      mockPrisma.referenceRate.findMany.mockResolvedValueOnce(
        ROWS_2026_06.map(r => ({ currency: r.currency, rate: r.rate })),
      );
      const result = await service.getPreFill(Currency.BRL, Currency.ARS, '2026-06');
      expect(result.exchangeRate).toBeCloseTo(1432 / 5.11, 2);
    });

    it('ARS→USD: exchangeRate = 1 / 1432 ≈ 0.000699', async () => {
      mockPrisma.referenceRate.findMany.mockResolvedValueOnce(
        ROWS_2026_06.map(r => ({ currency: r.currency, rate: r.rate })),
      );
      const result = await service.getPreFill(Currency.ARS, Currency.USD, '2026-06');
      expect(result.exchangeRate).toBeCloseTo(1 / 1432, 6);
    });

    it('EUR→USD: exchangeRate = 1 / 0.865 ≈ 1.156', async () => {
      mockPrisma.referenceRate.findMany.mockResolvedValueOnce(
        ROWS_2026_06.map(r => ({ currency: r.currency, rate: r.rate })),
      );
      const result = await service.getPreFill(Currency.EUR, Currency.USD, '2026-06');
      expect(result.exchangeRate).toBeCloseTo(1 / 0.865, 4);
    });

    it('USD→EUR: exchangeRate = 0.865', async () => {
      mockPrisma.referenceRate.findMany.mockResolvedValueOnce(
        ROWS_2026_06.map(r => ({ currency: r.currency, rate: r.rate })),
      );
      const result = await service.getPreFill(Currency.USD, Currency.EUR, '2026-06');
      expect(result.exchangeRate).toBeCloseTo(0.865, 4);
    });

    it('BRL→EUR: exchangeRate = 0.865 / 5.11 ≈ 0.1693', async () => {
      mockPrisma.referenceRate.findMany.mockResolvedValueOnce(
        ROWS_2026_06.map(r => ({ currency: r.currency, rate: r.rate })),
      );
      const result = await service.getPreFill(Currency.BRL, Currency.EUR, '2026-06');
      expect(result.exchangeRate).toBeCloseTo(0.865 / 5.11, 4);
    });

    it('[CLAMP] mes futuro 2026-09 USD→ARS: usa rates de 2026-06 → exchangeRate sensato (no null)', async () => {
      // 1ª call getPivotRatesForMonth: query directa por 2026-09 → miss
      mockPrisma.referenceRate.findMany.mockResolvedValueOnce([]);
      // 2ª call: loadAvailableYearMonths → 18 meses (rango del seed)
      mockPrisma.referenceRate.findMany.mockResolvedValueOnce(
        buildAllRatesTable().map(r => ({ yearMonth: r.yearMonth })),
      );
      // 3ª call: query por el resuelto 2026-06
      mockPrisma.referenceRate.findMany.mockResolvedValueOnce(
        ROWS_2026_06.map(r => ({ currency: r.currency, rate: r.rate })),
      );

      const result = await service.getPreFill(Currency.USD, Currency.ARS, '2026-09');
      // Debe devolver exchangeRate sensato usando rates de 2026-06
      expect(result.exchangeRate).toBeCloseTo(1432, 2);
      // El yearMonth devuelto sigue siendo el pedido (no el resuelto)
      expect(result.yearMonth).toBe('2026-09');
    });

    it('[CLAMP] mes pasado 2024-12 USD→ARS: usa rates del mínimo disponible', async () => {
      const rows2025_01 = [
        { currency: Currency.ARS, rate: '1100.000000' },
        { currency: Currency.BRL, rate: '5.000000' },
        { currency: Currency.EUR, rate: '0.920000' },
      ];
      mockPrisma.referenceRate.findMany.mockResolvedValueOnce([]);
      mockPrisma.referenceRate.findMany.mockResolvedValueOnce(
        buildAllRatesTable().map(r => ({ yearMonth: r.yearMonth })),
      );
      mockPrisma.referenceRate.findMany.mockResolvedValueOnce(rows2025_01);

      const result = await service.getPreFill(Currency.USD, Currency.ARS, '2024-12');
      // ARS_rate/USD_rate = 1100 / 1 = 1100
      expect(result.exchangeRate).toBeCloseTo(1100, 2);
      expect(result.yearMonth).toBe('2024-12');
    });

    it('[CLAMP] tabla vacía: exchangeRate = null', async () => {
      mockPrisma.referenceRate.findMany.mockResolvedValueOnce([]); // query directa
      mockPrisma.referenceRate.findMany.mockResolvedValueOnce([]); // loadAvailableYearMonths

      const result = await service.getPreFill(Currency.USD, Currency.ARS, '2099-01');
      expect(result.exchangeRate).toBeNull();
    });

    it('devuelve shape completo con todos los campos', async () => {
      mockPrisma.referenceRate.findMany.mockResolvedValueOnce(
        ROWS_2026_06.map(r => ({ currency: r.currency, rate: r.rate })),
      );
      const result = await service.getPreFill(Currency.BRL, Currency.USD, '2026-05');
      expect(result).toHaveProperty('currency');
      expect(result).toHaveProperty('defaultCurrency');
      expect(result).toHaveProperty('yearMonth');
      expect(result).toHaveProperty('exchangeRate');
    });
  });
});
