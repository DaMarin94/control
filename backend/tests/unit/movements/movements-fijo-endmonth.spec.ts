/**
 * Tests unitarios — endMonth del fijo lógico (Card de detalle de movimiento).
 *
 * Espejo del patrón ya usado para startMonth (P4 — arranque del fijo lógico):
 * el endMonth de un fijo (origin==='fijo') se resuelve por CADENA (chainId), no
 * por la fila vigente devuelta por la query principal de findFijosByMonth:
 * - endMonth = deletedFrom de la ÚLTIMA fila de la cadena (mayor startMonth).
 * - null = activo indefinidamente.
 *
 * Cubre:
 * 1. Cadena de una sola fila, sin deletedFrom → endMonth null.
 * 2. Cadena de una sola fila, con deletedFrom → endMonth = ese valor.
 * 3. Cadena con split (R1 → R2): startMonth se resuelve por R1 (la primera),
 *    endMonth se resuelve por R2 (la última / vigente).
 * 4. Calculado de fijo: resuelve endMonth por SU PROPIA cadena (calc.chainId),
 *    no por la cadena del origen (sourceChainId).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { FormulaOperator, MovementType } from '@prisma/client';
import { MovementsRepository } from '../../../src/movements/movements.repository';
import { PrismaService } from '../../../src/prisma/prisma.service';

const USER_A = 'user-endmonth-test';
const CAT_ID = 'cat-endmonth-test';
const MONTH = '2026-06';

const mockPrisma = {
  recurring: { findMany: jest.fn() },
  transaction: { findMany: jest.fn() },
  installmentGroup: { findMany: jest.fn() },
  referenceRate: { findMany: jest.fn().mockResolvedValue([]) },
  $queryRaw: jest.fn().mockResolvedValue([]),
};

/**
 * Distingue la query principal de findFijosByMonth (usa `include`) de la query
 * interna de loadChainBounds (usa `select: { chainId, startMonth, deletedFrom }`).
 */
function isChainBoundsQuery(args: any): boolean {
  return (
    args?.select?.chainId === true &&
    args?.select?.startMonth === true &&
    args?.select?.deletedFrom === true
  );
}

describe('MovementsRepository — endMonth del fijo lógico (card de detalle)', () => {
  let repo: MovementsRepository;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.referenceRate.findMany.mockResolvedValue([]);
    mockPrisma.recurring.findMany.mockResolvedValue([]);
    mockPrisma.installmentGroup.findMany.mockResolvedValue([]);
    mockPrisma.transaction.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovementsRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repo = module.get<MovementsRepository>(MovementsRepository);
  });

  it('fijo sin split, activo indefinidamente → endMonth null', async () => {
    const row = {
      id: 'rec-1',
      chainId: 'chain-1',
      sourceChainId: null,
      startMonth: '2026-01',
      deletedFrom: null,
      frequency: 1,
      type: MovementType.EXPENSE,
      amountCents: 5000,
      currency: 'ARS',
      exchangeRate: 1,
      anchorCurrency: 'ARS',
      description: 'Netflix',
      category: { id: CAT_ID, name: 'Servicios', color: '#4F86C6', scope: 'EXPENSE' },
      paymentMethod: null,
      skips: [],
    };
    mockPrisma.recurring.findMany.mockImplementation((args: any) =>
      Promise.resolve(isChainBoundsQuery(args) ? [row] : [row]),
    );

    const result = await repo.findFijosByMonth(USER_A, MONTH);

    expect(result).toHaveLength(1);
    expect(result[0].startMonth).toBe('2026-01');
    expect(result[0].endMonth).toBeNull();
  });

  it('fijo sin split, con deletedFrom futuro → endMonth = deletedFrom', async () => {
    const row = {
      id: 'rec-2',
      chainId: 'chain-2',
      sourceChainId: null,
      startMonth: '2026-01',
      deletedFrom: '2026-12',
      frequency: 1,
      type: MovementType.EXPENSE,
      amountCents: 5000,
      currency: 'ARS',
      exchangeRate: 1,
      anchorCurrency: 'ARS',
      description: 'Suscripción',
      category: { id: CAT_ID, name: 'Servicios', color: '#4F86C6', scope: 'EXPENSE' },
      paymentMethod: null,
      skips: [],
    };
    mockPrisma.recurring.findMany.mockImplementation((args: any) =>
      Promise.resolve(isChainBoundsQuery(args) ? [row] : [row]),
    );

    const result = await repo.findFijosByMonth(USER_A, MONTH);

    expect(result[0].endMonth).toBe('2026-12');
  });

  it('cadena con split: startMonth por R1 (primera fila), endMonth por R2 (última fila / vigente)', async () => {
    // R1: fila original, terminada por el split en 2026-03 (deletedFrom del split anterior).
    const r1 = {
      chainId: 'chain-split',
      startMonth: '2026-01',
      deletedFrom: '2026-03',
    };
    // R2: fila vigente tras el split, con su propio deletedFrom (fin real de la cadena).
    const r2 = {
      id: 'rec-r2',
      chainId: 'chain-split',
      sourceChainId: null,
      startMonth: '2026-03',
      deletedFrom: '2026-12',
      frequency: 1,
      type: MovementType.EXPENSE,
      amountCents: 15000,
      currency: 'ARS',
      exchangeRate: 1,
      anchorCurrency: 'ARS',
      description: 'Alquiler',
      category: { id: CAT_ID, name: 'Vivienda', color: '#4F86C6', scope: 'EXPENSE' },
      paymentMethod: null,
      skips: [],
    };
    mockPrisma.recurring.findMany.mockImplementation((args: any) =>
      Promise.resolve(isChainBoundsQuery(args) ? [r1, r2] : [r2]),
    );

    const result = await repo.findFijosByMonth(USER_A, MONTH);

    expect(result).toHaveLength(1);
    // Arranque real de la cadena: R1 (la primera fila).
    expect(result[0].startMonth).toBe('2026-01');
    // Fin real de la cadena: R2 (la última fila, la vigente).
    expect(result[0].endMonth).toBe('2026-12');
  });

  it('calculado de fijo resuelve endMonth por SU PROPIA cadena, no por la del origen', async () => {
    // Origen: fijo activo indefinidamente (endMonth null).
    const origin = {
      id: 'rec-origin',
      chainId: 'chain-origin',
      sourceChainId: null,
      startMonth: '2026-01',
      deletedFrom: null,
      frequency: 1,
      type: MovementType.EXPENSE,
      amountCents: 10000,
      currency: 'ARS',
      exchangeRate: 1,
      anchorCurrency: 'ARS',
      description: 'Sueldo',
      category: { id: CAT_ID, name: 'Ingresos', color: '#4F86C6', scope: 'INCOME' },
      paymentMethod: null,
      skips: [],
    };
    // Calculado: cadena propia (chain-calc), con deletedFrom propio distinto del origen.
    const calc = {
      id: 'calc-fijo',
      chainId: 'chain-calc',
      sourceChainId: 'chain-origin',
      startMonth: '2026-02',
      deletedFrom: '2026-08',
      frequency: 1,
      type: MovementType.EXPENSE,
      amountCents: 0,
      currency: 'ARS',
      exchangeRate: 1,
      anchorCurrency: 'ARS',
      description: 'Descuento',
      category: { id: CAT_ID, name: 'Impuestos', color: '#000', scope: 'EXPENSE' },
      paymentMethod: null,
      skips: [],
      formulaOperator: FormulaOperator.PCT,
      formulaOperand: 1000,
      formulaSign: -1,
    };
    mockPrisma.recurring.findMany.mockImplementation((args: any) =>
      Promise.resolve(isChainBoundsQuery(args) ? [origin, calc] : [origin, calc]),
    );

    const result = await repo.findFijosByMonth(USER_A, MONTH);

    const originItem = result.find((r) => r.id === 'rec-origin');
    const calcItem = result.find((r) => r.calculated !== null);

    expect(originItem).toBeDefined();
    expect(originItem!.endMonth).toBeNull(); // origen activo indefinidamente

    expect(calcItem).toBeDefined();
    // El calculado muestra SU PROPIO fin (chain-calc), no el del origen (null).
    expect(calcItem!.endMonth).toBe('2026-08');
    expect(calcItem!.startMonth).toBe('2026-02');
  });
});
