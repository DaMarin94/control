/**
 * Tests unitarios de ExternalRatesService.
 *
 * Cubre:
 * - getSnapshot: shape general (ipc.latest, ipc.history, ipc.from, ipc.hasMore, fx.*)
 * - Default de `today` ausente → usa el mes/año actuales (fallback new Date()).
 * - Default de `ipcFrom` ausente → enero del año derivado de `today`.
 * - `ipcFrom` explícito → se respeta como cota inferior del historial.
 * - `hasMore`: true si hay filas de IPC anteriores a `from`, false si no.
 * - Cotizaciones FX: mapeo correcto de (currency, variant) → arsOficial/arsBlue/eur/brl.
 * - Cotización ausente para el mes → null (no rompe).
 * - `monthlyVariation` se devuelve tal cual (puntos %, sin re-convertir).
 */

import { Currency } from '@prisma/client';
import { ExternalRatesService } from '../../../src/settings/external-rates.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

// ---------------------------------------------------------------------------
// Mock de PrismaService
// ---------------------------------------------------------------------------

const mockPrisma = {
  inflationRate: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  currencyQuote: {
    findMany: jest.fn(),
  },
};

function makeIpcRow(yearMonth: string, variation: string, index: string) {
  return {
    yearMonth,
    monthlyVariation: variation,
    indexValue: index,
    source: 'apis.datos.gob.ar',
    fetchedAt: new Date('2026-07-01T12:00:00Z'),
  };
}

function makeFxRow(
  currency: Currency,
  variant: string,
  compra: string,
  venta: string,
) {
  return {
    currency,
    variant,
    yearMonth: '2026-07',
    compra,
    venta,
    source: currency === Currency.ARS ? 'dolarapi.com' : 'api.frankfurter.dev',
    fetchedAt: new Date('2026-07-10T09:00:00Z'),
  };
}

describe('ExternalRatesService', () => {
  let service: ExternalRatesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ExternalRatesService(mockPrisma as unknown as PrismaService);
  });

  describe('getSnapshot — IPC', () => {
    it('devuelve latest + history + from + hasMore con shape correcto', async () => {
      mockPrisma.inflationRate.findFirst
        .mockResolvedValueOnce(makeIpcRow('2026-07', '1.58', '450.2')) // latest
        .mockResolvedValueOnce({ id: 'older-1' }); // olderRow (hasMore)
      mockPrisma.inflationRate.findMany.mockResolvedValue([
        makeIpcRow('2026-07', '1.58', '450.2'),
        makeIpcRow('2026-06', '2.20', '443.1'),
        makeIpcRow('2026-01', '3.10', '410.0'),
      ]);
      mockPrisma.currencyQuote.findMany.mockResolvedValue([]);

      const result = await service.getSnapshot('2026-07-14');

      expect(result.ipc.latest).toEqual({
        yearMonth: '2026-07',
        monthlyVariation: 1.58,
        indexValue: 450.2,
        fetchedAt: expect.any(Date),
        source: 'apis.datos.gob.ar',
      });
      expect(result.ipc.history).toHaveLength(3);
      expect(result.ipc.history[0].yearMonth).toBe('2026-07');
      expect(result.ipc.from).toBe('2026-01');
      expect(result.ipc.hasMore).toBe(true);
    });

    it('monthlyVariation se devuelve tal cual, en puntos porcentuales (sin re-convertir)', async () => {
      mockPrisma.inflationRate.findFirst
        .mockResolvedValueOnce(makeIpcRow('2026-07', '1.58', '450.2'))
        .mockResolvedValueOnce(null);
      mockPrisma.inflationRate.findMany.mockResolvedValue([
        makeIpcRow('2026-07', '1.58', '450.2'),
      ]);
      mockPrisma.currencyQuote.findMany.mockResolvedValue([]);

      const result = await service.getSnapshot('2026-07-14');

      // 1.58 puntos %, NO 0.0158
      expect(result.ipc.latest?.monthlyVariation).toBe(1.58);
      expect(result.ipc.history[0].monthlyVariation).toBe(1.58);
    });

    it('hasMore = false si no hay filas de IPC anteriores a `from`', async () => {
      mockPrisma.inflationRate.findFirst
        .mockResolvedValueOnce(makeIpcRow('2026-07', '1.58', '450.2'))
        .mockResolvedValueOnce(null); // no hay fila anterior
      mockPrisma.inflationRate.findMany.mockResolvedValue([
        makeIpcRow('2026-07', '1.58', '450.2'),
      ]);
      mockPrisma.currencyQuote.findMany.mockResolvedValue([]);

      const result = await service.getSnapshot('2026-07-14');

      expect(result.ipc.hasMore).toBe(false);
    });

    it('latest = null si la tabla de IPC está vacía', async () => {
      mockPrisma.inflationRate.findFirst
        .mockResolvedValueOnce(null) // latest
        .mockResolvedValueOnce(null); // olderRow
      mockPrisma.inflationRate.findMany.mockResolvedValue([]);
      mockPrisma.currencyQuote.findMany.mockResolvedValue([]);

      const result = await service.getSnapshot('2026-07-14');

      expect(result.ipc.latest).toBeNull();
      expect(result.ipc.history).toEqual([]);
    });

    it('`ipcFrom` explícito se respeta como cota inferior del historial', async () => {
      mockPrisma.inflationRate.findFirst
        .mockResolvedValueOnce(makeIpcRow('2026-07', '1.58', '450.2'))
        .mockResolvedValueOnce({ id: 'older-1' });
      mockPrisma.inflationRate.findMany.mockResolvedValue([
        makeIpcRow('2026-07', '1.58', '450.2'),
      ]);
      mockPrisma.currencyQuote.findMany.mockResolvedValue([]);

      const result = await service.getSnapshot('2026-07-14', '2020-03');

      expect(result.ipc.from).toBe('2020-03');
      expect(mockPrisma.inflationRate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { yearMonth: { gte: '2020-03', lte: '2026-07' } },
        }),
      );
    });

    it('sin `today` → usa el mes/año actuales (fallback new Date())', async () => {
      mockPrisma.inflationRate.findFirst.mockResolvedValue(null);
      mockPrisma.inflationRate.findMany.mockResolvedValue([]);
      mockPrisma.currencyQuote.findMany.mockResolvedValue([]);

      const now = new Date();
      const expectedMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      const expectedFrom = `${now.getUTCFullYear()}-01`;

      const result = await service.getSnapshot();

      expect(result.fx.month).toBe(expectedMonth);
      expect(result.ipc.from).toBe(expectedFrom);
    });
  });

  describe('getSnapshot — FX', () => {
    it('mapea (currency, variant) a arsOficial/arsBlue/eur/brl', async () => {
      mockPrisma.inflationRate.findFirst.mockResolvedValue(null);
      mockPrisma.inflationRate.findMany.mockResolvedValue([]);
      mockPrisma.currencyQuote.findMany.mockResolvedValue([
        makeFxRow(Currency.ARS, 'oficial', '1200.00', '1250.00'),
        makeFxRow(Currency.ARS, 'blue', '1300.00', '1320.00'),
        makeFxRow(Currency.EUR, 'oficial', '0.86', '0.86'),
        makeFxRow(Currency.BRL, 'oficial', '5.4', '5.4'),
      ]);

      const result = await service.getSnapshot('2026-07-14');

      expect(result.fx.month).toBe('2026-07');
      expect(result.fx.arsOficial).toEqual({
        compra: 1200,
        venta: 1250,
        fetchedAt: expect.any(Date),
        source: 'dolarapi.com',
      });
      expect(result.fx.arsBlue).toEqual({
        compra: 1300,
        venta: 1320,
        fetchedAt: expect.any(Date),
        source: 'dolarapi.com',
      });
      expect(result.fx.eur).toEqual({
        compra: 0.86,
        venta: 0.86,
        fetchedAt: expect.any(Date),
        source: 'api.frankfurter.dev',
      });
      expect(result.fx.brl).toEqual({
        compra: 5.4,
        venta: 5.4,
        fetchedAt: expect.any(Date),
        source: 'api.frankfurter.dev',
      });
    });

    it('cotización ausente para el mes → null, no rompe', async () => {
      mockPrisma.inflationRate.findFirst.mockResolvedValue(null);
      mockPrisma.inflationRate.findMany.mockResolvedValue([]);
      // Solo ARS oficial disponible; el resto falta
      mockPrisma.currencyQuote.findMany.mockResolvedValue([
        makeFxRow(Currency.ARS, 'oficial', '1200.00', '1250.00'),
      ]);

      const result = await service.getSnapshot('2026-07-14');

      expect(result.fx.arsOficial).not.toBeNull();
      expect(result.fx.arsBlue).toBeNull();
      expect(result.fx.eur).toBeNull();
      expect(result.fx.brl).toBeNull();
    });

    it('sin ninguna cotización del mes → los 4 valores en null', async () => {
      mockPrisma.inflationRate.findFirst.mockResolvedValue(null);
      mockPrisma.inflationRate.findMany.mockResolvedValue([]);
      mockPrisma.currencyQuote.findMany.mockResolvedValue([]);

      const result = await service.getSnapshot('2026-07-14');

      expect(result.fx.arsOficial).toBeNull();
      expect(result.fx.arsBlue).toBeNull();
      expect(result.fx.eur).toBeNull();
      expect(result.fx.brl).toBeNull();
    });
  });
});
