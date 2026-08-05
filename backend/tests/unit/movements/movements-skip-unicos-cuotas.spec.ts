/**
 * Tests unitarios — P3 (Fase 1.1.1.ext): anulación (skip) de únicos y cuotas.
 *
 * Mismo patrón que movements-calc-fijo-own-skip.spec.ts (skip de fijos), aplicado
 * a únicos y cuotas:
 *
 * - Único: el skip es un flag booleano en la fila (Transaction.skipped), sin mes.
 * - Cuota: el skip es una tabla InstallmentSkip por (grupo, mes) — anula SOLO
 *   esa instancia puntual, no el grupo entero.
 * - Calculados heredan: skipped = originData.skipped || (calc.skips.length > 0)
 *   (mismo criterio OR que el calculado de fijo, reusando RecurringSkip para el
 *   skip propio del calculado — sin tablas nuevas).
 *
 * Cubre:
 * 1. findUnicosByMonth — Transaction.skipped=true → item.skipped=true
 * 2. findUnicosByMonth — calculado de único hereda skip del Transaction origen
 * 3. findUnicosByMonth — calculado de único con skip propio (RecurringSkip) → skipped=true
 * 4. findCuotasByMonth — InstallmentSkip(grupo, mes) → item.skipped=true SOLO ese mes
 * 5. findCuotasByMonth — calculado de cuota hereda skip del grupo origen (para ese mes)
 * 6. findCuotasByMonth — calculado de cuota con skip propio → skipped=true
 * 7. getMonthMovements (service) — único/cuota skippeados no suman a totales (siguen en la lista)
 * 8. getReportsMovements (anual) — cuota skippeada un mes puntual no suma ese mes
 * 9. getReportsMovements (anual) — calculado de único/cuota con skip (propio o heredado) no suma
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  CategoryScope,
  Currency,
  FormulaOperator,
  MovementType,
} from '@prisma/client';
import { Logger } from 'nestjs-pino';
import {
  MovementsRepository,
  RecurringForAnnual,
  InstallmentGroupForAnnual,
} from '../../../src/movements/movements.repository';
import { MovementsService } from '../../../src/movements/movements.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { SettingsService } from '../../../src/settings/settings.service';
import { SimulationsService } from '../../../src/simulations/simulations.service';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const USER_A = 'user-skip-unicos-cuotas-test';
const CAT_TX = 'cat-tx';
const CAT_CUOTA = 'cat-cuota';
const CAT_CALC_TX = 'cat-calc-tx';
const CAT_CALC_CUOTA = 'cat-calc-cuota';
const MONTH = '2026-06';

const TX_ID = 'tx-skip-001';
const GROUP_ID = 'group-skip-001';

// ---------------------------------------------------------------------------
// Mock de Prisma para tests del repositorio
// ---------------------------------------------------------------------------

const mockPrisma = {
  recurring: { findMany: jest.fn() },
  transaction: { findMany: jest.fn() },
  installmentGroup: { findMany: jest.fn() },
  referenceRate: { findMany: jest.fn().mockResolvedValue([]) },
  $queryRaw: jest.fn().mockResolvedValue([]),
};

describe('MovementsRepository — skip de únicos (P3)', () => {
  let repo: MovementsRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.referenceRate.findMany.mockResolvedValue([]);
    mockPrisma.installmentGroup.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovementsRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repo = module.get<MovementsRepository>(MovementsRepository);
  });

  // ---- 1. Transaction.skipped → item.skipped -------------------------------

  it('único con skipped=true en la fila → MovementItem.skipped=true', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        id: TX_ID,
        userId: USER_A,
        type: 'EXPENSE',
        amountCents: 1000,
        description: null,
        occurredAt: new Date('2026-06-10T12:00:00Z'),
        timezone: 'America/Argentina/Buenos_Aires',
        currency: 'ARS',
        exchangeRate: '1',
        anchorCurrency: 'ARS',
        skipped: true,
        categoryId: CAT_TX,
        categoryName: 'Consumibles',
        categoryColor: '#4F86C6',
        categoryScope: 'EXPENSE',
      },
    ]);
    mockPrisma.recurring.findMany.mockResolvedValue([]);

    const result = await repo.findUnicosByMonth(USER_A, MONTH);

    expect(result).toHaveLength(1);
    expect(result[0].skipped).toBe(true);
  });

  it('único con skipped=false → MovementItem.skipped=false', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        id: TX_ID,
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
        categoryId: CAT_TX,
        categoryName: 'Consumibles',
        categoryColor: '#4F86C6',
        categoryScope: 'EXPENSE',
      },
    ]);
    mockPrisma.recurring.findMany.mockResolvedValue([]);

    const result = await repo.findUnicosByMonth(USER_A, MONTH);

    expect(result[0].skipped).toBe(false);
  });

  // ---- 2/3. calculado de único: herencia + skip propio ---------------------

  function makeCalcDeUnico(overrides: Record<string, unknown> = {}) {
    return {
      id: 'calc-tx-skip-001',
      userId: USER_A,
      type: MovementType.EXPENSE,
      amountCents: 0,
      description: 'Impuesto',
      startMonth: MONTH,
      deletedFrom: '2026-07',
      frequency: 1,
      chainId: 'chain-calc-tx-skip',
      sourceChainId: null,
      sourceMovementId: TX_ID,
      sourceInstallmentGroupId: null,
      formulaOperator: FormulaOperator.PCT,
      formulaOperand: 1000, // 10%
      formulaSign: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      category: {
        id: CAT_CALC_TX,
        name: 'Impuestos',
        color: '#FF0000',
        scope: CategoryScope.EXPENSE,
      },
      skips: [],
      ...overrides,
    };
  }

  const TX_ORIGIN = {
    id: TX_ID,
    amountCents: 10000,
    description: 'Viaje',
    occurredAt: new Date('2026-06-15T12:00:00Z'),
    timezone: 'America/Argentina/Buenos_Aires',
    currency: Currency.ARS,
    exchangeRate: '1',
    anchorCurrency: Currency.ARS,
  };

  it('calculado de único hereda skipped=true del Transaction de origen', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.recurring.findMany.mockResolvedValueOnce([makeCalcDeUnico()]);
    mockPrisma.transaction.findMany.mockResolvedValue([{ ...TX_ORIGIN, skipped: true }]);

    const result = await repo.findUnicosByMonth(USER_A, MONTH);
    const item = result.find((u) => u.id === 'calc-tx-skip-001')!;

    expect(item.skipped).toBe(true);
  });

  it('calculado de único con skip propio (RecurringSkip) → skipped=true aunque el origen esté activo', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.recurring.findMany.mockResolvedValueOnce([
      makeCalcDeUnico({ skips: [{ month: MONTH }] }),
    ]);
    mockPrisma.transaction.findMany.mockResolvedValue([{ ...TX_ORIGIN, skipped: false }]);

    const result = await repo.findUnicosByMonth(USER_A, MONTH);
    const item = result.find((u) => u.id === 'calc-tx-skip-001')!;

    expect(item.skipped).toBe(true);
  });

  it('calculado de único SIN skip propio y origen activo → skipped=false', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.recurring.findMany.mockResolvedValueOnce([makeCalcDeUnico()]);
    mockPrisma.transaction.findMany.mockResolvedValue([{ ...TX_ORIGIN, skipped: false }]);

    const result = await repo.findUnicosByMonth(USER_A, MONTH);
    const item = result.find((u) => u.id === 'calc-tx-skip-001')!;

    expect(item.skipped).toBe(false);
  });
});

describe('MovementsRepository — skip de cuotas (P3)', () => {
  let repo: MovementsRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.referenceRate.findMany.mockResolvedValue([]);
    mockPrisma.recurring.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovementsRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repo = module.get<MovementsRepository>(MovementsRepository);
  });

  function makeGroup(overrides: Record<string, unknown> = {}) {
    return {
      id: GROUP_ID,
      userId: USER_A,
      categoryId: CAT_CUOTA,
      type: MovementType.EXPENSE,
      amountCents: 5000,
      currency: Currency.ARS,
      exchangeRate: 1,
      anchorCurrency: Currency.ARS,
      totalInstallments: 12,
      startMonth: '2026-01',
      description: 'Notebook',
      category: {
        id: CAT_CUOTA,
        name: 'Tecnología',
        color: '#A98BD6',
        scope: 'EXPENSE',
      },
      skips: [],
      ...overrides,
    };
  }

  // ---- 4. InstallmentSkip(grupo, mes) → skipped SOLO ese mes ---------------

  it('cuota con InstallmentSkip para el mes pedido → item.skipped=true', async () => {
    mockPrisma.installmentGroup.findMany.mockResolvedValueOnce([
      makeGroup({ skips: [{ month: MONTH }] }),
    ]);

    const result = await repo.findCuotasByMonth(USER_A, MONTH);

    expect(result).toHaveLength(1);
    expect(result[0].skipped).toBe(true);
  });

  it('cuota SIN InstallmentSkip para el mes pedido → item.skipped=false', async () => {
    mockPrisma.installmentGroup.findMany.mockResolvedValueOnce([
      makeGroup({ skips: [] }),
    ]);

    const result = await repo.findCuotasByMonth(USER_A, MONTH);

    expect(result[0].skipped).toBe(false);
  });

  it('el skip anula SOLO la instancia de ese mes: otro mes del mismo grupo no está anulado', async () => {
    // El mock simula el include `skips: { where: { month } }` — para el mes '2026-07'
    // el skip de junio no matchea, así que Prisma devolvería skips=[] para ese mes.
    mockPrisma.installmentGroup.findMany.mockResolvedValueOnce([
      makeGroup({ skips: [] }), // simulando el filtro where:{month:'2026-07'}
    ]);

    const result = await repo.findCuotasByMonth(USER_A, '2026-07');

    expect(result[0].skipped).toBe(false);
  });

  // ---- 5/6. calculado de cuota: herencia + skip propio ---------------------

  function makeCalcDeCuota(overrides: Record<string, unknown> = {}) {
    return {
      id: 'calc-cuota-skip-001',
      userId: USER_A,
      type: MovementType.EXPENSE,
      amountCents: 0,
      description: 'Seguro',
      startMonth: '2026-01',
      deletedFrom: null,
      frequency: 1,
      chainId: 'chain-calc-cuota-skip',
      sourceChainId: null,
      sourceMovementId: null,
      sourceInstallmentGroupId: GROUP_ID,
      formulaOperator: FormulaOperator.PCT,
      formulaOperand: 500, // 5%
      formulaSign: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      category: {
        id: CAT_CALC_CUOTA,
        name: 'Seguros',
        color: '#00FF00',
        scope: CategoryScope.EXPENSE,
      },
      skips: [],
      ...overrides,
    };
  }

  it('calculado de cuota hereda skipped=true del grupo de origen (para ese mes)', async () => {
    mockPrisma.installmentGroup.findMany
      .mockResolvedValueOnce([]) // grupos normales (ninguno en este test)
      .mockResolvedValueOnce([makeGroup({ skips: [{ month: MONTH }] })]); // orígenes de calculados
    mockPrisma.recurring.findMany.mockResolvedValueOnce([makeCalcDeCuota()]);

    const result = await repo.findCuotasByMonth(USER_A, MONTH);
    const item = result.find((c) => c.id === 'calc-cuota-skip-001')!;

    expect(item.skipped).toBe(true);
  });

  it('calculado de cuota con skip propio (RecurringSkip) → skipped=true aunque el grupo esté activo', async () => {
    mockPrisma.installmentGroup.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeGroup({ skips: [] })]);
    mockPrisma.recurring.findMany.mockResolvedValueOnce([
      makeCalcDeCuota({ skips: [{ month: MONTH }] }),
    ]);

    const result = await repo.findCuotasByMonth(USER_A, MONTH);
    const item = result.find((c) => c.id === 'calc-cuota-skip-001')!;

    expect(item.skipped).toBe(true);
  });

  it('calculado de cuota SIN skip propio y grupo activo → skipped=false', async () => {
    mockPrisma.installmentGroup.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeGroup({ skips: [] })]);
    mockPrisma.recurring.findMany.mockResolvedValueOnce([makeCalcDeCuota()]);

    const result = await repo.findCuotasByMonth(USER_A, MONTH);
    const item = result.find((c) => c.id === 'calc-cuota-skip-001')!;

    expect(item.skipped).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Suite: exclusión de totales del mes (MovementsService.getMonthMovements)
// ---------------------------------------------------------------------------

describe('MovementsService.getMonthMovements — exclusión de skip para únicos/cuotas (P3)', () => {
  let service: MovementsService;

  const mockRepoSvc = {
    findUnicosByMonth: jest.fn(),
    findFijosByMonth: jest.fn(),
    findCuotasByMonth: jest.fn(),
  };

  const mockSettingsServiceSvc = {
    getSettings: jest.fn().mockResolvedValue({ defaultCurrency: Currency.ARS, lastExchangeRate: null }),
    updateLastExchangeRate: jest.fn(),
  };

  const mockLoggerSvc = {
    log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), verbose: jest.fn(),
  };

  const mockSimulationsServiceSvc = {
    getSimulatedItemsForMonth: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSettingsServiceSvc.getSettings.mockResolvedValue({ defaultCurrency: Currency.ARS, lastExchangeRate: null });
    mockRepoSvc.findFijosByMonth.mockResolvedValue([]);
    mockSimulationsServiceSvc.getSimulatedItemsForMonth.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovementsService,
        { provide: MovementsRepository, useValue: mockRepoSvc },
        { provide: Logger, useValue: mockLoggerSvc },
        { provide: SettingsService, useValue: mockSettingsServiceSvc },
        { provide: SimulationsService, useValue: mockSimulationsServiceSvc },
      ],
    }).compile();

    service = module.get<MovementsService>(MovementsService);
  });

  const baseCategory = { id: CAT_TX, name: 'Consumibles', color: '#4F86C6', scope: CategoryScope.EXPENSE };

  it('único skippeado aparece en la lista pero NO suma a expenseCents', async () => {
    mockRepoSvc.findUnicosByMonth.mockResolvedValue([
      {
        id: 'u1', origin: 'unico', type: MovementType.EXPENSE,
        amountCents: 1000, convertedAmountCents: 1000, currency: Currency.ARS, exchangeRate: 1,
        description: null, occurredAt: new Date(), timezone: 'America/Argentina/Buenos_Aires',
        category: baseCategory, installment: null, frequency: null,
        skipped: true, calculated: null, hasCalculated: false,
      },
    ]);
    mockRepoSvc.findCuotasByMonth.mockResolvedValue([]);

    const result = await service.getMonthMovements(USER_A, MONTH);

    expect(result.movements.unicos).toHaveLength(1);
    expect(result.movements.unicos[0].skipped).toBe(true);
    expect(result.totals.expenseCents).toBe(0);
    expect(result.totals.incomeCents).toBe(0);
  });

  it('cuota skippeada (instancia del mes) aparece en la lista pero NO suma a expenseCents', async () => {
    mockRepoSvc.findUnicosByMonth.mockResolvedValue([]);
    mockRepoSvc.findCuotasByMonth.mockResolvedValue([
      {
        id: 'c1', origin: 'cuota', type: MovementType.EXPENSE,
        amountCents: 5000, convertedAmountCents: 5000, currency: Currency.ARS, exchangeRate: 1,
        description: null, occurredAt: null, timezone: null,
        category: { id: CAT_CUOTA, name: 'Tecnología', color: '#A98BD6', scope: CategoryScope.EXPENSE },
        installment: { number: 3, total: 12, startMonth: '2026-04' }, frequency: null,
        skipped: true, calculated: null, hasCalculated: false,
      },
    ]);

    const result = await service.getMonthMovements(USER_A, MONTH);

    expect(result.movements.cuotas).toHaveLength(1);
    expect(result.movements.cuotas[0].skipped).toBe(true);
    expect(result.totals.expenseCents).toBe(0);
  });

  it('único/cuota NO skippeados sí suman normalmente (control)', async () => {
    mockRepoSvc.findUnicosByMonth.mockResolvedValue([
      {
        id: 'u1', origin: 'unico', type: MovementType.EXPENSE,
        amountCents: 1000, convertedAmountCents: 1000, currency: Currency.ARS, exchangeRate: 1,
        description: null, occurredAt: new Date(), timezone: 'America/Argentina/Buenos_Aires',
        category: baseCategory, installment: null, frequency: null,
        skipped: false, calculated: null, hasCalculated: false,
      },
    ]);
    mockRepoSvc.findCuotasByMonth.mockResolvedValue([
      {
        id: 'c1', origin: 'cuota', type: MovementType.EXPENSE,
        amountCents: 5000, convertedAmountCents: 5000, currency: Currency.ARS, exchangeRate: 1,
        description: null, occurredAt: null, timezone: null,
        category: { id: CAT_CUOTA, name: 'Tecnología', color: '#A98BD6', scope: CategoryScope.EXPENSE },
        installment: { number: 3, total: 12, startMonth: '2026-04' }, frequency: null,
        skipped: false, calculated: null, hasCalculated: false,
      },
    ]);

    const result = await service.getMonthMovements(USER_A, MONTH);

    expect(result.totals.expenseCents).toBe(6000);
  });
});

// ---------------------------------------------------------------------------
// Suite: proyección anual (MovementsService.getReportsMovements)
// ---------------------------------------------------------------------------

describe('MovementsService.getReportsMovements — skip de únicos/cuotas en el reporte anual (P3)', () => {
  let service: MovementsService;

  const mockRepoAnnual = {
    getAnnualUnicosAggregated: jest.fn(),
    getAllFijosForAnnual: jest.fn(),
    getAllCuotasForAnnual: jest.fn(),
    getEarliestYear: jest.fn(),
    findTransactionsByIds: jest.fn(),
    findInstallmentGroupsByIds: jest.fn(),
    loadPivotRatesForYear: jest.fn().mockResolvedValue(new Map()),
  };

  const mockSettingsAnnual = {
    getSettings: jest.fn(),
    updateLastExchangeRate: jest.fn(),
  };

  const mockLoggerAnnual = {
    log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), verbose: jest.fn(),
  };

  const mockSimulationsAnnual = {
    getSimulatedItemsForMonth: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSettingsAnnual.getSettings.mockResolvedValue({ defaultCurrency: Currency.ARS, lastExchangeRate: null });
    mockRepoAnnual.getAnnualUnicosAggregated.mockResolvedValue([]);
    mockRepoAnnual.getAllFijosForAnnual.mockResolvedValue([]);
    mockRepoAnnual.getAllCuotasForAnnual.mockResolvedValue([]);
    mockRepoAnnual.getEarliestYear.mockResolvedValue(null);
    mockRepoAnnual.findTransactionsByIds.mockResolvedValue([]);
    mockRepoAnnual.findInstallmentGroupsByIds.mockResolvedValue([]);
    mockRepoAnnual.loadPivotRatesForYear.mockResolvedValue(new Map());
    mockSimulationsAnnual.getSimulatedItemsForMonth.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovementsService,
        { provide: MovementsRepository, useValue: mockRepoAnnual },
        { provide: Logger, useValue: mockLoggerAnnual },
        { provide: SettingsService, useValue: mockSettingsAnnual },
        { provide: SimulationsService, useValue: mockSimulationsAnnual },
      ],
    }).compile();

    service = module.get<MovementsService>(MovementsService);
  });

  function makeCuotaAnual(overrides: Partial<InstallmentGroupForAnnual> = {}): InstallmentGroupForAnnual {
    return {
      id: GROUP_ID,
      type: MovementType.EXPENSE,
      amountCents: 2000,
      currency: Currency.ARS,
      exchangeRate: 1,
      anchorCurrency: Currency.ARS,
      totalInstallments: 12,
      startMonth: '2026-01',
      skippedMonths: new Set<string>(),
      categoryId: CAT_CUOTA,
      categoryName: 'Tecnología',
      categoryColor: '#A98BD6',
      categoryScope: 'EXPENSE',
      ...overrides,
    };
  }

  // ---- 8. cuota skippeada un mes puntual → no suma ese mes -----------------

  it('cuota con skippedMonths={junio} → no suma en junio pero sí en los demás meses', async () => {
    const cuota = makeCuotaAnual({ skippedMonths: new Set(['2026-06']) });
    mockRepoAnnual.getAllCuotasForAnnual.mockResolvedValue([cuota]);

    const result = await service.getReportsMovements(USER_A, 2026);

    const junio = result.months[5];
    expect(junio.month).toBe('2026-06');
    expect(junio.expenseCents).toBe(0);

    const julio = result.months[6];
    expect(julio.expenseCents).toBe(2000);
  });

  // ---- 9. calculado de único/cuota: skip propio o heredado excluye del anual

  function makeCalcDeUnicoAnual(overrides: Partial<RecurringForAnnual> = {}): RecurringForAnnual {
    return {
      id: 'calc-tx-annual',
      type: MovementType.EXPENSE,
      amountCents: 0,
      currency: Currency.ARS,
      exchangeRate: 1,
      anchorCurrency: Currency.ARS,
      startMonth: '2026-06',
      deletedFrom: '2026-07',
      frequency: 1,
      skippedMonths: new Set<string>(),
      categoryId: CAT_CALC_TX,
      categoryName: 'Impuestos',
      categoryColor: '#FF0000',
      categoryScope: 'EXPENSE',
      chainId: 'chain-calc-tx-annual',
      sourceChainId: null,
      sourceMovementId: TX_ID,
      sourceInstallmentGroupId: null,
      formulaOperator: FormulaOperator.PCT,
      formulaOperand: 1000, // 10%
      formulaSign: 1,
      ...overrides,
    };
  }

  it('calculado de único con Transaction origen skipped=true → no suma en el mes', async () => {
    const calc = makeCalcDeUnicoAnual();
    mockRepoAnnual.getAllFijosForAnnual.mockResolvedValue([calc]);
    mockRepoAnnual.findTransactionsByIds.mockResolvedValue([
      { id: TX_ID, amountCents: 10000, description: 'Viaje', currency: Currency.ARS, exchangeRate: 1, anchorCurrency: Currency.ARS, skipped: true },
    ]);

    const result = await service.getReportsMovements(USER_A, 2026);

    const junio = result.months[5];
    expect(junio.incomeCents).toBe(0);
    expect(junio.expenseCents).toBe(0);
  });

  it('calculado de único con skip propio (skippedMonths) → no suma en el mes aunque el origen esté activo', async () => {
    const calc = makeCalcDeUnicoAnual({ skippedMonths: new Set(['2026-06']) });
    mockRepoAnnual.getAllFijosForAnnual.mockResolvedValue([calc]);
    mockRepoAnnual.findTransactionsByIds.mockResolvedValue([
      { id: TX_ID, amountCents: 10000, description: 'Viaje', currency: Currency.ARS, exchangeRate: 1, anchorCurrency: Currency.ARS, skipped: false },
    ]);

    const result = await service.getReportsMovements(USER_A, 2026);

    const junio = result.months[5];
    expect(junio.incomeCents).toBe(0);
  });

  it('calculado de único SIN skip (propio ni heredado) → suma normalmente', async () => {
    const calc = makeCalcDeUnicoAnual();
    mockRepoAnnual.getAllFijosForAnnual.mockResolvedValue([calc]);
    mockRepoAnnual.findTransactionsByIds.mockResolvedValue([
      { id: TX_ID, amountCents: 10000, description: 'Viaje', currency: Currency.ARS, exchangeRate: 1, anchorCurrency: Currency.ARS, skipped: false },
    ]);

    const result = await service.getReportsMovements(USER_A, 2026);

    const junio = result.months[5];
    expect(junio.incomeCents).toBe(1000); // 10% de 10000, sign=+1 → INCOME
  });

  function makeCalcDeCuotaAnual(overrides: Partial<RecurringForAnnual> = {}): RecurringForAnnual {
    return {
      id: 'calc-cuota-annual',
      type: MovementType.EXPENSE,
      amountCents: 0,
      currency: Currency.ARS,
      exchangeRate: 1,
      anchorCurrency: Currency.ARS,
      startMonth: '2026-01',
      deletedFrom: null,
      frequency: 1,
      skippedMonths: new Set<string>(),
      categoryId: CAT_CALC_CUOTA,
      categoryName: 'Seguros',
      categoryColor: '#00FF00',
      categoryScope: 'EXPENSE',
      chainId: 'chain-calc-cuota-annual',
      sourceChainId: null,
      sourceMovementId: null,
      sourceInstallmentGroupId: GROUP_ID,
      formulaOperator: FormulaOperator.PCT,
      formulaOperand: 500, // 5%
      formulaSign: 1,
      ...overrides,
    };
  }

  it('calculado de cuota hereda el skip del grupo de origen (para ese mes) → no suma', async () => {
    const calc = makeCalcDeCuotaAnual();
    mockRepoAnnual.getAllFijosForAnnual.mockResolvedValue([calc]);
    mockRepoAnnual.findInstallmentGroupsByIds.mockResolvedValue([
      { id: GROUP_ID, amountCents: 5000, totalInstallments: 6, startMonth: '2026-01', currency: Currency.ARS, exchangeRate: 1, anchorCurrency: Currency.ARS, skippedMonths: new Set(['2026-06']) },
    ]);

    const result = await service.getReportsMovements(USER_A, 2026);

    const junio = result.months[5];
    expect(junio.incomeCents).toBe(0);

    // Mayo: el grupo no está skippeado ese mes → el calculado sí suma
    const mayo = result.months[4];
    expect(mayo.incomeCents).toBe(250); // 5% de 5000
  });

  it('calculado de cuota con skip propio → no suma aunque el grupo esté activo', async () => {
    const calc = makeCalcDeCuotaAnual({ skippedMonths: new Set(['2026-06']) });
    mockRepoAnnual.getAllFijosForAnnual.mockResolvedValue([calc]);
    mockRepoAnnual.findInstallmentGroupsByIds.mockResolvedValue([
      { id: GROUP_ID, amountCents: 5000, totalInstallments: 6, startMonth: '2026-01', currency: Currency.ARS, exchangeRate: 1, anchorCurrency: Currency.ARS, skippedMonths: new Set<string>() },
    ]);

    const result = await service.getReportsMovements(USER_A, 2026);

    const junio = result.months[5];
    expect(junio.incomeCents).toBe(0);
  });
});
