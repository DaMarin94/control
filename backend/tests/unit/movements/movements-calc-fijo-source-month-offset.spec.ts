/**
 * Tests unitarios — "mes de referencia" (sourceMonthOffset) en calculados de
 * FIJO. Decisión de producto: la BASE de la fórmula puede salir del monto del
 * origen de N meses atrás (offset), en vez de siempre el mes consultado (M).
 *
 * Alcance: SOLO calculados de fijo. NO cambia cadencia, skip (sigue el skip
 * de M, no de R), split, herencia de moneda/método/autoDebit.
 *
 * Cubre:
 * 1. offset 0 = comportamiento idéntico al actual (regresión)
 * 2. offset 1 toma el monto del mes anterior (R), no el de M
 * 3. origen splitteado entre R y M — la base sale de la fila correcta de la cadena
 * 4. mes sin origen en R (aunque el origen SÍ aparece en M) → el calculado no aparece
 * 5. skip heredado sigue el skip de M, no el de R
 * 6. getFijosTotalsByMonth — mismo comportamiento de offset (call-site espejo)
 * 7. proyección anual (getReportsMovements) — offset 1 usa el monto de R
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CategoryScope, Currency, FormulaOperator, MovementType } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { MovementsRepository, RecurringForAnnual } from '../../../src/movements/movements.repository';
import { MovementsService } from '../../../src/movements/movements.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { SettingsService } from '../../../src/settings/settings.service';
import { SimulationsService } from '../../../src/simulations/simulations.service';

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
  frequency: number;
  chainId: string;
  sourceChainId: string | null;
  sourceMovementId: string | null;
  sourceInstallmentGroupId: string | null;
  formulaOperator: FormulaOperator | null;
  formulaOperand: number | null;
  formulaSign: number | null;
  sourceMonthOffset: number;
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

const USER_A = 'user-offset-test';
const ORIGIN_CHAIN = 'chain-origin-offset';
const CALC_CHAIN = 'chain-calc-offset';
const CAT_ORIGIN = 'cat-origin-offset';
const CAT_CALC = 'cat-calc-offset';

function makeOriginRow(overrides: Partial<RecurringRow> = {}): RecurringRow {
  return {
    id: 'origin-001',
    userId: USER_A,
    type: MovementType.EXPENSE,
    amountCents: 10000,
    currency: 'ARS',
    exchangeRate: 1,
    anchorCurrency: 'ARS',
    description: 'Sueldo',
    startMonth: '2026-01',
    deletedFrom: null,
    frequency: 1,
    chainId: ORIGIN_CHAIN,
    sourceChainId: null,
    sourceMovementId: null,
    sourceInstallmentGroupId: null,
    formulaOperator: null,
    formulaOperand: null,
    formulaSign: null,
    sourceMonthOffset: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: {
      id: CAT_ORIGIN,
      name: 'Ingresos',
      color: '#4F86C6',
      scope: CategoryScope.INCOME,
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
    description: 'Aguinaldo (10% del sueldo de un mes atrás)',
    startMonth: '2026-01',
    deletedFrom: null,
    frequency: 1,
    chainId: CALC_CHAIN,
    sourceChainId: ORIGIN_CHAIN,
    sourceMovementId: null,
    sourceInstallmentGroupId: null,
    formulaOperator: FormulaOperator.PCT,
    formulaOperand: 1000, // 10%
    formulaSign: 1,
    sourceMonthOffset: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: {
      id: CAT_CALC,
      name: 'Aguinaldo',
      color: '#6DBF67',
      scope: CategoryScope.EXPENSE,
    },
    skips: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock de Prisma
// ---------------------------------------------------------------------------

const mockPrisma = {
  recurring: { findMany: jest.fn() },
  recurringSkip: { findMany: jest.fn() },
  installmentGroup: { findMany: jest.fn().mockResolvedValue([]) },
  transaction: { findMany: jest.fn().mockResolvedValue([]) },
  referenceRate: { findMany: jest.fn().mockResolvedValue([]) },
};

const mockRepo = {
  getAllFijosForAnnual: jest.fn(),
  getAnnualUnicosAggregated: jest.fn(),
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

const mockSimulationsService = {
  getSimulatedItemsForMonth: jest.fn().mockResolvedValue([]),
};

const mockLogger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
};

// ---------------------------------------------------------------------------
// Suite: MovementsRepository.findFijosByMonth
// ---------------------------------------------------------------------------

describe('MovementsRepository.findFijosByMonth — mes de referencia (sourceMonthOffset)', () => {
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

  it('offset 0 = comportamiento idéntico al actual (base = monto del origen en M)', async () => {
    const origin = makeOriginRow({ amountCents: 10000 });
    const calc = makeCalcRow({ sourceMonthOffset: 0 });
    mockPrisma.recurring.findMany.mockResolvedValue([origin, calc]);

    const result = await repo.findFijosByMonth(USER_A, '2026-06');

    const calcItem = result.find((r) => r.id === 'calc-001');
    expect(calcItem).toBeDefined();
    // 10% de 10000 = 1000 (mismo mes M, sin query extra)
    expect(calcItem!.amountCents).toBe(1000);
    expect(calcItem!.calculated?.sourceMonthOffset).toBe(0);
    // Sin offset > 0, NO debe haber query de resolución de R: solo la query
    // principal (M) + loadChainBounds (arranque/fin de cadena, sin relación
    // con el offset) = 2 llamadas, ninguna con `sourceChainId: null` en el where
    // (marca distintiva de la query de resolución de R).
    expect(mockPrisma.recurring.findMany).toHaveBeenCalledTimes(2);
    expect(mockPrisma.recurring.findMany.mock.calls.every(
      ([args]: any) => args?.where?.sourceChainId !== null,
    )).toBe(true);
  });

  it('offset 1 toma el monto del ORIGEN DE UN MES ATRÁS (R), no el de M', async () => {
    // Origen: SIN split, mismo monto en cualquier mes — el offset igual debe
    // resolver R correctamente contra la única fila de la cadena.
    const origin = makeOriginRow({ amountCents: 20000, startMonth: '2026-01' });
    const calc = makeCalcRow({ sourceMonthOffset: 1, formulaOperand: 1000 }); // 10%

    // La query de resolución de R se distingue por `sourceChainId: null` en el
    // where (marca que no está en loadChainBounds ni en la query principal).
    mockPrisma.recurring.findMany.mockImplementation((args: any) => {
      if (args?.where?.sourceChainId === null && args?.where?.chainId?.in) {
        return Promise.resolve([
          { chainId: ORIGIN_CHAIN, startMonth: '2026-01', deletedFrom: null, frequency: 1, amountCents: 20000 },
        ]);
      }
      // Query principal (M) y loadChainBounds: activos en el mes / cadena.
      return Promise.resolve([origin, calc]);
    });

    const result = await repo.findFijosByMonth(USER_A, '2026-06');

    const calcItem = result.find((r) => r.id === 'calc-001');
    expect(calcItem).toBeDefined();
    // 10% de 20000 (mismo monto, ya que el origen no cambió) = 2000
    expect(calcItem!.amountCents).toBe(2000);
    expect(calcItem!.calculated?.sourceAmountCents).toBe(20000);
    // El offset viaja en el MovementItem para que el front pueda mostrar de
    // qué mes sale el monto base (spec visual: "Mes del monto base del
    // calculado (desfasaje 0..12)").
    expect(calcItem!.calculated?.sourceMonthOffset).toBe(1);
    // Con offset > 0 hay una query extra (main + chainBounds + resolución de R).
    expect(mockPrisma.recurring.findMany).toHaveBeenCalledTimes(3);
  });

  it('origen splitteado entre R y M: la base sale de la fila CORRECTA de la cadena', async () => {
    // R1: 2026-01..2026-04 (excl.), amountCents=10000
    // R2: 2026-05 en adelante, amountCents=20000
    // Mes consultado M=2026-06, offset=1 → R=2026-05 → resuelve R2 (20000),
    // NO R1 (aunque R1 sea "la fila anterior" cronológicamente, R2 ya cubre 2026-05).
    const R2 = makeOriginRow({ id: 'origin-r2', amountCents: 20000, startMonth: '2026-05', deletedFrom: null });
    const calc = makeCalcRow({ sourceMonthOffset: 1, formulaOperand: 1000 }); // 10%

    mockPrisma.recurring.findMany.mockImplementation((args: any) => {
      if (args?.where?.sourceChainId === null && args?.where?.chainId?.in) {
        return Promise.resolve([
          { chainId: ORIGIN_CHAIN, startMonth: '2026-01', deletedFrom: '2026-05', frequency: 1, amountCents: 10000 },
          { chainId: ORIGIN_CHAIN, startMonth: '2026-05', deletedFrom: null, frequency: 1, amountCents: 20000 },
        ]);
      }
      // La query principal para M=2026-06 solo trae R2 (R1 ya terminó en 2026-05).
      return Promise.resolve([R2, calc]);
    });

    const result = await repo.findFijosByMonth(USER_A, '2026-06');

    const calcItem = result.find((r) => r.id === 'calc-001');
    expect(calcItem).toBeDefined();
    // 10% de 20000 (R2, la fila vigente en R=2026-05) = 2000
    expect(calcItem!.amountCents).toBe(2000);
    expect(calcItem!.calculated?.sourceAmountCents).toBe(20000);
  });

  it('origen splitteado: R cae ANTES del split → la base sale de la fila VIEJA (R1)', async () => {
    // R1: 2026-01..2026-05 (excl.), amountCents=10000
    // R2: 2026-05 en adelante, amountCents=20000
    // M=2026-05 (mes del split, R2 activo), offset=1 → R=2026-04 → resuelve R1 (10000).
    const R2 = makeOriginRow({ id: 'origin-r2', amountCents: 20000, startMonth: '2026-05', deletedFrom: null });
    const calc = makeCalcRow({ sourceMonthOffset: 1, formulaOperand: 1000 }); // 10%

    mockPrisma.recurring.findMany.mockImplementation((args: any) => {
      if (args?.where?.sourceChainId === null && args?.where?.chainId?.in) {
        return Promise.resolve([
          { chainId: ORIGIN_CHAIN, startMonth: '2026-01', deletedFrom: '2026-05', frequency: 1, amountCents: 10000 },
          { chainId: ORIGIN_CHAIN, startMonth: '2026-05', deletedFrom: null, frequency: 1, amountCents: 20000 },
        ]);
      }
      return Promise.resolve([R2, calc]);
    });

    const result = await repo.findFijosByMonth(USER_A, '2026-05');

    const calcItem = result.find((r) => r.id === 'calc-001');
    expect(calcItem).toBeDefined();
    // 10% de 10000 (R1, la fila vigente en R=2026-04) = 1000
    expect(calcItem!.amountCents).toBe(1000);
    expect(calcItem!.calculated?.sourceAmountCents).toBe(10000);
  });

  it('mes SIN origen en R (aunque el origen SÍ aparece en M) → el calculado NO aparece', async () => {
    // El origen arranca en 2026-01. Mes consultado M=2026-02 (el origen SÍ
    // aparece: gate de cadencia OK), pero offset=2 → R=2025-12, ANTES del
    // arranque del origen → no resuelve → el calculado no aparece este mes.
    const origin = makeOriginRow({ startMonth: '2026-01', amountCents: 10000 });
    const calc = makeCalcRow({ sourceMonthOffset: 2 });

    mockPrisma.recurring.findMany.mockImplementation((args: any) => {
      if (args?.where?.sourceChainId === null && args?.where?.chainId?.in) {
        return Promise.resolve([
          { chainId: ORIGIN_CHAIN, startMonth: '2026-01', deletedFrom: null, frequency: 1, amountCents: 10000 },
        ]);
      }
      return Promise.resolve([origin, calc]);
    });

    const result = await repo.findFijosByMonth(USER_A, '2026-02');

    const calcItem = result.find((r) => r.id === 'calc-001');
    expect(calcItem).toBeUndefined();
  });

  it('skip heredado sigue el skip de M, NO el de R', async () => {
    // El origen (fila activa en M) está skippeado en M. Offset=1 apunta a R,
    // una fila SIN concepto de skip propio en esta resolución (la query de R
    // no trae skips) — el resultado debe seguir skippeado=true por M.
    const origin = makeOriginRow({ amountCents: 10000, skips: [{ month: '2026-06' }] });
    const calc = makeCalcRow({ sourceMonthOffset: 1 });

    mockPrisma.recurring.findMany.mockImplementation((args: any) => {
      if (args?.where?.sourceChainId === null && args?.where?.chainId?.in) {
        return Promise.resolve([
          { chainId: ORIGIN_CHAIN, startMonth: '2026-01', deletedFrom: null, frequency: 1, amountCents: 10000 },
        ]);
      }
      return Promise.resolve([origin, calc]);
    });

    const result = await repo.findFijosByMonth(USER_A, '2026-06');

    const calcItem = result.find((r) => r.id === 'calc-001');
    expect(calcItem).toBeDefined();
    expect(calcItem!.skipped).toBe(true);
  });

  it('getFijosTotalsByMonth (call-site espejo) — offset 1 usa el monto de R', async () => {
    const origin = makeOriginRow({ amountCents: 20000, type: MovementType.EXPENSE });
    const calc = makeCalcRow({ sourceMonthOffset: 1, formulaOperand: 1000, formulaSign: 1 }); // 10%

    mockPrisma.recurring.findMany.mockImplementation((args: any) => {
      if (args?.where?.sourceChainId === null && args?.where?.chainId?.in) {
        return Promise.resolve([
          { chainId: ORIGIN_CHAIN, startMonth: '2026-01', deletedFrom: null, frequency: 1, amountCents: 20000 },
        ]);
      }
      return Promise.resolve([origin, calc]);
    });

    const totals = await repo.getFijosTotalsByMonth(USER_A, '2026-06');

    expect(totals.expenseCents).toBe(20000); // el origen
    expect(totals.incomeCents).toBe(2000);   // 10% de 20000 (base en R)
  });
});

// ---------------------------------------------------------------------------
// Suite: MovementsService.getReportsMovements (proyección anual)
// ---------------------------------------------------------------------------

describe('MovementsService.getReportsMovements — mes de referencia (sourceMonthOffset)', () => {
  let service: MovementsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSettingsService.getSettings.mockResolvedValue({
      defaultCurrency: Currency.ARS,
      lastExchangeRate: null,
    });
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
        { provide: SimulationsService, useValue: mockSimulationsService },
      ],
    }).compile();

    service = module.get<MovementsService>(MovementsService);
  });

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
      frequency: 1,
      skippedMonths: new Set<string>(),
      categoryId: CAT_ORIGIN,
      categoryName: 'Ingresos',
      categoryColor: '#4F86C6',
      categoryScope: 'INCOME',
      chainId: ORIGIN_CHAIN,
      sourceChainId: null,
      sourceMovementId: null,
      sourceInstallmentGroupId: null,
      formulaOperator: null,
      formulaOperand: null,
      formulaSign: null,
      sourceMonthOffset: 0,
      ...overrides,
    };
  }

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
      frequency: 1,
      skippedMonths: new Set<string>(),
      categoryId: CAT_CALC,
      categoryName: 'Aguinaldo',
      categoryColor: '#6DBF67',
      categoryScope: 'EXPENSE',
      chainId: CALC_CHAIN,
      sourceChainId: ORIGIN_CHAIN,
      sourceMovementId: null,
      sourceInstallmentGroupId: null,
      formulaOperator: FormulaOperator.PCT,
      formulaOperand: 1000, // 10%
      formulaSign: 1,
      sourceMonthOffset: 0,
      ...overrides,
    };
  }

  it('offset 1: el mes usa el monto del ORIGEN de un mes atrás (R), no el de M', async () => {
    // Origen splitteado: R1 (ene..abr, 10000), R2 (may en adelante, 20000).
    const R1 = makeFijoAnual({ id: 'r1', amountCents: 10000, startMonth: '2026-01', deletedFrom: '2026-05' });
    const R2 = makeFijoAnual({ id: 'r2', amountCents: 20000, startMonth: '2026-05', deletedFrom: null });
    const calc = makeCalcAnual({ sourceMonthOffset: 1 });

    mockRepo.getAllFijosForAnnual.mockResolvedValue([R1, R2, calc]);

    const result = await service.getReportsMovements(USER_A, 2026);

    // Junio (índice 5): M=2026-06, R=2026-05 → R2 (20000) → 10% = 2000 INCOME.
    const junio = result.months[5];
    expect(junio.month).toBe('2026-06');
    expect(junio.incomeCents).toBe(2000);

    // Mayo (índice 4): M=2026-05, R=2026-04 → R1 (10000) → 10% = 1000 INCOME.
    const mayo = result.months[4];
    expect(mayo.month).toBe('2026-05');
    expect(mayo.incomeCents).toBe(1000);
  });

  it('offset 1: mes sin origen en R → el calculado no aporta ese mes', async () => {
    // El origen arranca en 2026-01. Enero (índice 0): el origen SÍ aparece,
    // pero R=2025-12, antes del arranque → no resuelve → el calculado no suma.
    const origin = makeFijoAnual({ startMonth: '2026-01', amountCents: 10000 });
    const calc = makeCalcAnual({ sourceMonthOffset: 1 });

    mockRepo.getAllFijosForAnnual.mockResolvedValue([origin, calc]);

    const result = await service.getReportsMovements(USER_A, 2026);

    const enero = result.months[0];
    expect(enero.month).toBe('2026-01');
    expect(enero.incomeCents).toBe(0); // el calculado no aporta

    const febrero = result.months[1];
    expect(febrero.incomeCents).toBe(1000); // R=enero, sí resuelve
  });
});
