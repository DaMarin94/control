/**
 * Tests unitarios — skip propio del calculado de fijo (RF-SKIP-CALC-001).
 *
 * Un calculado de fijo puede tener su propio RecurringSkip (creado por
 * POST /recurring/:id/skip sobre el id del calculado). Antes de este cambio,
 * ese skip era ignorado en la lectura: el campo `skipped` del calculado derivaba
 * solo del origen. Después del cambio:
 *
 *   skipped = originData.skipped || (calc.skips.length > 0)
 *
 * Cubre:
 * 1. findFijosByMonth — calculado con skip propio → skipped=true (padre activo)
 * 2. findFijosByMonth — calculado con skip propio → NO suma a totales del mes
 * 3. findFijosByMonth — herencia del padre sigue funcionando (padre skippeado)
 * 4. findFijosByMonth — calculado SIN skip propio y padre activo → skipped=false
 * 5. getFijosTotalsByMonth — calculado con skip propio no suma (consistencia)
 * 6. getReportsMovements (proyección anual) — calculado con skip propio ese mes
 *    no suma a la serie anual de ese mes
 * 7. getReportsMovements — herencia anual sigue funcionando (padre skippeado)
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  CategoryScope,
  Currency,
  FormulaOperator,
  MovementType,
  RecurringFrequency,
} from '@prisma/client';
import { Logger } from 'nestjs-pino';
import {
  MovementsRepository,
  RecurringForAnnual,
} from '../../../src/movements/movements.repository';
import { MovementsService } from '../../../src/movements/movements.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { SettingsService } from '../../../src/settings/settings.service';

// ---------------------------------------------------------------------------
// Tipos auxiliares
// ---------------------------------------------------------------------------

type RecurringRow = {
  id: string;
  userId: string;
  type: MovementType;
  amountCents: number;
  currency: string;
  exchangeRate: number;
  anchorCurrency: string;
  description: string | null;
  startMonth: string;
  deletedFrom: string | null;
  frequency: RecurringFrequency;
  chainId: string;
  sourceChainId: string | null;
  sourceMovementId: string | null;
  sourceInstallmentGroupId: string | null;
  formulaOperator: FormulaOperator | null;
  formulaOperand: number | null;
  formulaSign: number | null;
  createdAt: Date;
  updatedAt: Date;
  category: {
    id: string;
    name: string;
    color: string;
    scope: CategoryScope;
  };
  skips: { month: string }[];
};

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const USER_A = 'user-skip-calc-test';
const ORIGIN_CHAIN = 'chain-origin-skip';
const CALC_CHAIN = 'chain-calc-skip';
const CAT_ORIGIN = 'cat-origin';
const CAT_CALC = 'cat-calc';
const MONTH = '2026-06';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeOriginRow(overrides: Partial<RecurringRow> = {}): RecurringRow {
  return {
    id: 'origin-001',
    userId: USER_A,
    type: MovementType.EXPENSE,
    amountCents: 10000,
    currency: 'ARS',
    exchangeRate: 1,
    anchorCurrency: 'ARS',
    description: 'Alquiler',
    startMonth: '2026-01',
    deletedFrom: null,
    frequency: RecurringFrequency.MONTHLY,
    chainId: ORIGIN_CHAIN,
    sourceChainId: null,
    sourceMovementId: null,
    sourceInstallmentGroupId: null,
    formulaOperator: null,
    formulaOperand: null,
    formulaSign: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: {
      id: CAT_ORIGIN,
      name: 'Vivienda',
      color: '#4F86C6',
      scope: CategoryScope.EXPENSE,
    },
    skips: [],
    ...overrides,
  };
}

function makeCalcRow(overrides: Partial<RecurringRow> = {}): RecurringRow {
  return {
    id: 'calc-001',
    userId: USER_A,
    type: MovementType.EXPENSE,
    amountCents: 0, // placeholder
    currency: 'ARS',
    exchangeRate: 1,
    anchorCurrency: 'ARS',
    description: 'Expensas (10% alquiler)',
    startMonth: '2026-01',
    deletedFrom: null,
    frequency: RecurringFrequency.MONTHLY,
    chainId: CALC_CHAIN,
    sourceChainId: ORIGIN_CHAIN,
    sourceMovementId: null,
    sourceInstallmentGroupId: null,
    formulaOperator: FormulaOperator.PCT,
    formulaOperand: 1000, // 10%
    formulaSign: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: {
      id: CAT_CALC,
      name: 'Expensas',
      color: '#6DBF67',
      scope: CategoryScope.EXPENSE,
    },
    skips: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock de Prisma para tests del repositorio
// ---------------------------------------------------------------------------

const mockPrisma = {
  recurring: { findMany: jest.fn() },
  recurringSkip: { findMany: jest.fn() },
  installmentGroup: { findMany: jest.fn().mockResolvedValue([]) },
  transaction: { findMany: jest.fn().mockResolvedValue([]) },
  referenceRate: { findMany: jest.fn().mockResolvedValue([]) },
};

// ---------------------------------------------------------------------------
// Mock del repositorio y settings para tests del servicio (anual)
// ---------------------------------------------------------------------------

const mockRepo = {
  findUnicosByMonth: jest.fn(),
  findFijosByMonth: jest.fn(),
  findCuotasByMonth: jest.fn(),
  getTotalsByMonth: jest.fn(),
  getFijosTotalsByMonth: jest.fn(),
  getCuotasTotalsByMonth: jest.fn(),
  getAnnualUnicosAggregated: jest.fn(),
  getAllFijosForAnnual: jest.fn(),
  getAllCuotasForAnnual: jest.fn(),
  getEarliestYear: jest.fn(),
  findTransactionsByIds: jest.fn().mockResolvedValue([]),
  findInstallmentGroupsByIds: jest.fn().mockResolvedValue([]),
  loadPivotRatesForYear: jest.fn().mockResolvedValue(new Map()),
};

const mockSettingsService = {
  getSettings: jest.fn(),
  updateLastExchangeRate: jest.fn(),
};

const mockLogger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
};

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------

describe('MovementsRepository — skip propio del calculado de fijo', () => {
  let repo: MovementsRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.installmentGroup.findMany.mockResolvedValue([]);
    mockPrisma.transaction.findMany.mockResolvedValue([]);
    mockPrisma.referenceRate.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovementsRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repo = module.get<MovementsRepository>(MovementsRepository);
  });

  // ---- 1. skip propio → skipped=true (padre activo) -----------------------

  it('calculado con skip propio en el mes → skipped=true aunque el padre esté activo', async () => {
    const origin = makeOriginRow({ skips: [] }); // padre activo (sin skip)
    const calc = makeCalcRow({ skips: [{ month: MONTH }] }); // calculado con skip propio
    mockPrisma.recurring.findMany.mockResolvedValue([origin, calc]);

    const result = await repo.findFijosByMonth(USER_A, MONTH);

    const calcItem = result.find((r) => r.id === 'calc-001');
    expect(calcItem).toBeDefined();
    expect(calcItem!.skipped).toBe(true);
  });

  // ---- 2. skip propio → NO suma a totales del mes -------------------------

  it('calculado con skip propio NO suma a getFijosTotalsByMonth', async () => {
    const origin = makeOriginRow({ skips: [] });
    const calc = makeCalcRow({ skips: [{ month: MONTH }] });
    mockPrisma.recurring.findMany.mockResolvedValue([origin, calc]);

    const totals = await repo.getFijosTotalsByMonth(USER_A, MONTH);

    // Solo el origen suma (10000 EXPENSE); el calculado con skip propio no suma
    expect(totals.expenseCents).toBe(10000);
    expect(totals.incomeCents).toBe(0);
  });

  // ---- 3. herencia del padre sigue funcionando ----------------------------

  it('calculado hereda skipped=true cuando el padre está skippeado (comportamiento previo intacto)', async () => {
    const origin = makeOriginRow({ skips: [{ month: MONTH }] }); // padre skippeado
    const calc = makeCalcRow({ skips: [] }); // calculado SIN skip propio
    mockPrisma.recurring.findMany.mockResolvedValue([origin, calc]);

    const result = await repo.findFijosByMonth(USER_A, MONTH);

    const calcItem = result.find((r) => r.id === 'calc-001');
    expect(calcItem).toBeDefined();
    expect(calcItem!.skipped).toBe(true); // heredado del padre
  });

  // ---- 4. sin skip propio y padre activo → skipped=false ------------------

  it('calculado SIN skip propio y padre activo → skipped=false', async () => {
    const origin = makeOriginRow({ skips: [] });
    const calc = makeCalcRow({ skips: [] });
    mockPrisma.recurring.findMany.mockResolvedValue([origin, calc]);

    const result = await repo.findFijosByMonth(USER_A, MONTH);

    const calcItem = result.find((r) => r.id === 'calc-001');
    expect(calcItem).toBeDefined();
    expect(calcItem!.skipped).toBe(false);
  });

  // ---- 5. getFijosTotalsByMonth — consistencia con skip propio -------------

  it('calculado sin skip propio suma correctamente a los totales', async () => {
    const origin = makeOriginRow({ skips: [] });
    const calc = makeCalcRow({ skips: [] }); // sin skip → debe sumar
    mockPrisma.recurring.findMany.mockResolvedValue([origin, calc]);

    const totals = await repo.getFijosTotalsByMonth(USER_A, MONTH);

    // Origen: 10000 EXPENSE; Calculado: 10% de 10000 = 1000 INCOME (sign=+1)
    expect(totals.expenseCents).toBe(10000);
    expect(totals.incomeCents).toBe(1000);
  });

  // ---- OR semántico: ambos skips al mismo tiempo --------------------------

  it('calculado con skip propio Y padre skippeado → skipped=true (OR semántico)', async () => {
    const origin = makeOriginRow({ skips: [{ month: MONTH }] }); // padre skippeado
    const calc = makeCalcRow({ skips: [{ month: MONTH }] }); // calculado también skippeado
    mockPrisma.recurring.findMany.mockResolvedValue([origin, calc]);

    const result = await repo.findFijosByMonth(USER_A, MONTH);

    const calcItem = result.find((r) => r.id === 'calc-001');
    expect(calcItem).toBeDefined();
    expect(calcItem!.skipped).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suite: proyección anual (MovementsService.getReportsMovements)
// ---------------------------------------------------------------------------

describe('MovementsService.getReportsMovements — skip propio del calculado de fijo', () => {
  let service: MovementsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSettingsService.getSettings.mockResolvedValue({
      defaultCurrency: Currency.ARS,
      lastExchangeRate: null,
    });
    // Defaults vacíos para los meses que no son el foco del test
    mockRepo.getAnnualUnicosAggregated.mockResolvedValue([]);
    mockRepo.getAllCuotasForAnnual.mockResolvedValue([]);
    mockRepo.getEarliestYear.mockResolvedValue(null);
    mockRepo.loadPivotRatesForYear.mockResolvedValue(new Map());
    mockRepo.findTransactionsByIds.mockResolvedValue([]);
    mockRepo.findInstallmentGroupsByIds.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovementsService,
        { provide: MovementsRepository, useValue: mockRepo },
        { provide: Logger, useValue: mockLogger },
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    }).compile();

    service = module.get<MovementsService>(MovementsService);
  });

  // Helper: crea un RecurringForAnnual de fijo normal
  function makeFijoAnual(overrides: Partial<RecurringForAnnual> = {}): RecurringForAnnual {
    return {
      id: 'origin-annual',
      type: MovementType.EXPENSE,
      amountCents: 10000,
      currency: Currency.ARS,
      exchangeRate: 1,
      anchorCurrency: Currency.ARS,
      startMonth: '2026-01',
      deletedFrom: null,
      frequency: RecurringFrequency.MONTHLY,
      skippedMonths: new Set<string>(),
      categoryId: CAT_ORIGIN,
      categoryName: 'Vivienda',
      categoryColor: '#4F86C6',
      categoryScope: 'EXPENSE',
      chainId: ORIGIN_CHAIN,
      sourceChainId: null,
      sourceMovementId: null,
      sourceInstallmentGroupId: null,
      formulaOperator: null,
      formulaOperand: null,
      formulaSign: null,
      ...overrides,
    };
  }

  // Helper: crea un RecurringForAnnual de calculado de fijo
  function makeCalcAnual(overrides: Partial<RecurringForAnnual> = {}): RecurringForAnnual {
    return {
      id: 'calc-annual',
      type: MovementType.EXPENSE,
      amountCents: 0,
      currency: Currency.ARS,
      exchangeRate: 1,
      anchorCurrency: Currency.ARS,
      startMonth: '2026-01',
      deletedFrom: null,
      frequency: RecurringFrequency.MONTHLY,
      skippedMonths: new Set<string>(),
      categoryId: CAT_CALC,
      categoryName: 'Expensas',
      categoryColor: '#6DBF67',
      categoryScope: 'EXPENSE',
      chainId: CALC_CHAIN,
      sourceChainId: ORIGIN_CHAIN, // vinculado al origen
      sourceMovementId: null,
      sourceInstallmentGroupId: null,
      formulaOperator: FormulaOperator.PCT,
      formulaOperand: 1000, // 10%
      formulaSign: 1,
      ...overrides,
    };
  }

  // ---- 6. calculado con skip propio no suma al mes en la proyección anual --

  it('calculado con skip propio en un mes → no suma ese mes en la proyección anual', async () => {
    const fijo = makeFijoAnual();
    // El calculado tiene skip propio solo en junio
    const calcConSkipJunio = makeCalcAnual({
      skippedMonths: new Set(['2026-06']),
    });

    mockRepo.getAllFijosForAnnual.mockResolvedValue([fijo, calcConSkipJunio]);

    const result = await service.getReportsMovements(USER_A, 2026);

    // Junio (índice 5): solo el origen suma (10000 EXPENSE); el calculado está skippeado
    const junio = result.months[5]; // índice 5 = junio
    expect(junio.month).toBe('2026-06');
    // Solo el origen suma a EXPENSE; el calculado (10% sign=+1 → INCOME) no suma
    expect(junio.expenseCents).toBe(10000); // solo el origen
    expect(junio.incomeCents).toBe(0); // el calculado no suma

    // En julio (índice 6), el calculado NO tiene skip → sí suma
    const julio = result.months[6];
    expect(julio.month).toBe('2026-07');
    expect(julio.expenseCents).toBe(10000); // origen
    expect(julio.incomeCents).toBe(1000);   // calculado 10% = 1000 INCOME
  });

  // ---- 7. herencia anual sigue funcionando (padre skippeado) ---------------

  it('calculado hereda skip del padre en proyección anual (comportamiento previo intacto)', async () => {
    // Padre skippeado en junio; calculado sin skip propio
    const fijoConSkipJunio = makeFijoAnual({
      skippedMonths: new Set(['2026-06']),
    });
    const calcSinSkip = makeCalcAnual({
      skippedMonths: new Set<string>(), // sin skip propio
    });

    mockRepo.getAllFijosForAnnual.mockResolvedValue([fijoConSkipJunio, calcSinSkip]);

    const result = await service.getReportsMovements(USER_A, 2026);

    // Junio: el padre está skippeado → ni origen ni calculado suman
    const junio = result.months[5];
    expect(junio.expenseCents).toBe(0);
    expect(junio.incomeCents).toBe(0);

    // Mayo (índice 4): padre activo → origen y calculado suman
    const mayo = result.months[4];
    expect(mayo.expenseCents).toBe(10000);
    expect(mayo.incomeCents).toBe(1000);
  });

  // ---- ambos skips en proyección anual ------------------------------------

  it('calculado con skip propio y padre skippeado → no suma ese mes (OR semántico anual)', async () => {
    const fijoConSkip = makeFijoAnual({ skippedMonths: new Set(['2026-06']) });
    const calcConSkip = makeCalcAnual({ skippedMonths: new Set(['2026-06']) });

    mockRepo.getAllFijosForAnnual.mockResolvedValue([fijoConSkip, calcConSkip]);

    const result = await service.getReportsMovements(USER_A, 2026);

    const junio = result.months[5];
    expect(junio.expenseCents).toBe(0);
    expect(junio.incomeCents).toBe(0);
  });
});
