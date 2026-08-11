/**
 * Tests unitarios — campo `chainId` propio del MovementItem.
 *
 * Espejo del patrón ya usado para startMonth/endMonth (P4 — arranque/fin del
 * fijo lógico): el chainId expuesto en el ítem del listado del mes es el de
 * SU PROPIA cadena, no el `sourceChainId` del origen para calculados de fijo.
 *
 * Cubre:
 * 1. Fijo normal → chainId = su propio chainId.
 * 2. Calculado de fijo → chainId = SU PROPIO chainId (calc.chainId), NO
 *    sourceChainId (el chainId del fijo de origen). Caso más importante.
 * 3. Único → chainId null.
 * 4. Cuota → chainId null.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { FormulaOperator, MovementType } from '@prisma/client';
import { MovementsRepository } from '../../../src/movements/movements.repository';
import { PrismaService } from '../../../src/prisma/prisma.service';

const USER_A = 'user-chainid-test';
const CAT_ID = 'cat-chainid-test';
const MONTH = '2026-06';

const mockPrisma = {
  recurring: { findMany: jest.fn() },
  transaction: { findMany: jest.fn() },
  installmentGroup: { findMany: jest.fn() },
  referenceRate: { findMany: jest.fn().mockResolvedValue([]) },
  $queryRaw: jest.fn().mockResolvedValue([]),
};

describe('MovementsRepository — chainId propio del MovementItem', () => {
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

  it('fijo normal → chainId = su propio chainId', async () => {
    const row = {
      id: 'rec-1',
      chainId: 'chain-normal-1',
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
    mockPrisma.recurring.findMany.mockResolvedValue([row]);

    const result = await repo.findFijosByMonth(USER_A, MONTH);

    expect(result).toHaveLength(1);
    expect(result[0].origin).toBe('fijo');
    expect(result[0].chainId).toBe('chain-normal-1');
  });

  it('calculado de fijo → chainId = SU PROPIO chainId, no sourceChainId del origen', async () => {
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
    const calc = {
      id: 'calc-fijo',
      chainId: 'chain-calc-propio',
      sourceChainId: 'chain-origin',
      startMonth: '2026-01',
      deletedFrom: null,
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
    mockPrisma.recurring.findMany.mockResolvedValue([origin, calc]);

    const result = await repo.findFijosByMonth(USER_A, MONTH);

    const originItem = result.find((r) => r.id === 'rec-origin');
    const calcItem = result.find((r) => r.calculated !== null);

    expect(originItem).toBeDefined();
    expect(originItem!.chainId).toBe('chain-origin');

    expect(calcItem).toBeDefined();
    // El error a no cometer: el calculado NO debe exponer sourceChainId (el
    // chainId del origen) sino SU PROPIO chainId.
    expect(calcItem!.chainId).toBe('chain-calc-propio');
    expect(calcItem!.chainId).not.toBe(calc.sourceChainId);
  });

  it('único → chainId null', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        id: 'tx-1',
        userId: USER_A,
        type: 'EXPENSE',
        amountCents: 1000,
        description: null,
        occurredAt: new Date('2026-06-10T12:00:00Z'),
        timezone: 'America/Argentina/Buenos_Aires',
        currency: 'ARS',
        exchangeRate: '1',
        anchorCurrency: 'ARS',
        skipped: false,
        categoryId: CAT_ID,
        categoryName: 'Consumibles',
        categoryColor: '#4F86C6',
        categoryScope: 'EXPENSE',
        paymentMethodId: null,
        paymentMethodName: null,
        paymentMethodIcon: null,
        paymentMethodType: null,
        paymentMethodClosingDay: null,
        paymentMethodPaymentDay: null,
        autoDebit: null,
      },
    ]);

    const result = await repo.findUnicosByMonth(USER_A, MONTH);

    expect(result).toHaveLength(1);
    expect(result[0].origin).toBe('unico');
    expect(result[0].chainId).toBeNull();
  });

  it('cuota → chainId null', async () => {
    mockPrisma.installmentGroup.findMany
      .mockResolvedValueOnce([
        {
          id: 'grp-1',
          type: MovementType.EXPENSE,
          amountCents: 2000,
          totalInstallments: 12,
          startMonth: '2026-01',
          currency: 'ARS',
          exchangeRate: 1,
          anchorCurrency: 'ARS',
          description: 'Notebook',
          category: { id: CAT_ID, name: 'Tecnología', color: '#4F86C6', scope: 'EXPENSE' },
          paymentMethod: null,
          skips: [],
        },
      ])
      .mockResolvedValueOnce([]); // groupRows para calculados (no aplica acá)

    const result = await repo.findCuotasByMonth(USER_A, MONTH);

    expect(result).toHaveLength(1);
    expect(result[0].origin).toBe('cuota');
    expect(result[0].chainId).toBeNull();
  });
});
