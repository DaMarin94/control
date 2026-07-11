/**
 * Tests unitarios — calculados de único y cuota en su sección de origen (Fase 1.1.7.ext).
 *
 * Decisión cerrada: el calculado se lista en la sección de su origen:
 * - calculado de único  → origin='unico'  → aparece en findUnicosByMonth  (sección "unicos")
 * - calculado de cuota  → origin='cuota'  → aparece en findCuotasByMonth  (sección "cuotas")
 * - calculado de fijo   → origin='fijo'   → aparece en findFijosByMonth   (sección "fijos")
 *
 * Cubre:
 * - [REGRESIÓN] Calculado de único aparece SOLO en findUnicosByMonth, NO en findFijosByMonth
 * - [REGRESIÓN] Calculado de cuota aparece SOLO en findCuotasByMonth, NO en findFijosByMonth
 * - [REGRESIÓN] Calculado de fijo sigue apareciendo en findFijosByMonth
 * - Calculado de único: origin='unico', sourceType='unico', monto derivado correcto
 * - Calculado de único: NO aparece en un mes diferente (rango autolimitado a 1 mes)
 * - Calculado de cuota: origin='cuota', sourceType='cuota', monto derivado correcto
 * - Calculado de cuota: aparece en todos los meses del grupo (rango on-the-fly)
 * - Calculado de cuota: NO aparece después de endMonth del grupo
 * - Inclusión en reportes (getReportsMovements): calculado de único (1 mes) y cuota (rango)
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
} from '../../../src/movements/movements.repository';
import { MovementsService } from '../../../src/movements/movements.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { SettingsService } from '../../../src/settings/settings.service';

// ---------------------------------------------------------------------------
// Tipos y fixtures compartidos
// ---------------------------------------------------------------------------

type RecurringRow = {
  id: string;
  userId: string;
  type: MovementType;
  amountCents: number;
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

const USER_A = 'user-ext-test';
const CAT_TX = 'cat-tx';
const CAT_CUOTA = 'cat-cuota';
const CAT_FIJO = 'cat-fijo';

const TX_ID = 'tx-001';
const GROUP_ID = 'group-001';
const CALC_TX_ID = 'calc-tx-001';
const CALC_CUOTA_ID = 'calc-cuota-001';
const CALC_FIJO_ID = 'calc-fijo-001';
const ORIGIN_CHAIN_ID = 'chain-origin-001';

function makeCalcDeUnico(overrides: Partial<RecurringRow> = {}): RecurringRow {
  return {
    id: CALC_TX_ID,
    userId: USER_A,
    type: MovementType.EXPENSE,
    amountCents: 0,
    description: 'Impuesto sobre gasto',
    startMonth: '2026-06',
    deletedFrom: '2026-07',
    frequency: 1,
    chainId: 'chain-calc-tx-001',
    sourceChainId: null,
    sourceMovementId: TX_ID,
    sourceInstallmentGroupId: null,
    formulaOperator: FormulaOperator.PCT,
    formulaOperand: 1000, // 10%
    formulaSign: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: {
      id: CAT_TX,
      name: 'Impuestos',
      color: '#FF0000',
      scope: CategoryScope.EXPENSE,
    },
    skips: [],
    ...overrides,
  };
}

function makeCalcDeCuota(overrides: Partial<RecurringRow> = {}): RecurringRow {
  return {
    id: CALC_CUOTA_ID,
    userId: USER_A,
    type: MovementType.EXPENSE,
    amountCents: 0,
    description: 'Seguro de cuota',
    startMonth: '2026-01',
    deletedFrom: null,
    frequency: 1,
    chainId: 'chain-calc-cuota-001',
    sourceChainId: null,
    sourceMovementId: null,
    sourceInstallmentGroupId: GROUP_ID,
    formulaOperator: FormulaOperator.PCT,
    formulaOperand: 500, // 5%
    formulaSign: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: {
      id: CAT_CUOTA,
      name: 'Seguros',
      color: '#00FF00',
      scope: CategoryScope.EXPENSE,
    },
    skips: [],
    ...overrides,
  };
}

function makeCalcDeFijo(overrides: Partial<RecurringRow> = {}): RecurringRow {
  return {
    id: CALC_FIJO_ID,
    userId: USER_A,
    type: MovementType.EXPENSE,
    amountCents: 0,
    description: 'Calc de fijo',
    startMonth: '2026-01',
    deletedFrom: null,
    frequency: 1,
    chainId: 'chain-calc-fijo-001',
    sourceChainId: ORIGIN_CHAIN_ID,
    sourceMovementId: null,
    sourceInstallmentGroupId: null,
    formulaOperator: FormulaOperator.PCT,
    formulaOperand: 1000, // 10%
    formulaSign: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: {
      id: CAT_FIJO,
      name: 'Derivados',
      color: '#0000FF',
      scope: CategoryScope.EXPENSE,
    },
    skips: [],
    ...overrides,
  };
}

function makeNormalFijo(overrides: Partial<RecurringRow> = {}): RecurringRow {
  return {
    id: 'normal-fijo-001',
    userId: USER_A,
    type: MovementType.EXPENSE,
    amountCents: 10000,
    description: 'Alquiler',
    startMonth: '2026-01',
    deletedFrom: null,
    frequency: 1,
    chainId: ORIGIN_CHAIN_ID,
    sourceChainId: null,
    sourceMovementId: null,
    sourceInstallmentGroupId: null,
    formulaOperator: null,
    formulaOperand: null,
    formulaSign: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: {
      id: CAT_FIJO,
      name: 'Vivienda',
      color: '#4F86C6',
      scope: CategoryScope.EXPENSE,
    },
    skips: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Datos de origen
// ---------------------------------------------------------------------------

const TX_OCCURRED_AT = new Date('2026-06-15T14:30:00.000Z');
const TX_TIMEZONE = 'America/Argentina/Buenos_Aires';
const TX_DATA = {
  id: TX_ID,
  amountCents: 10000,
  description: 'Viaje',
  occurredAt: TX_OCCURRED_AT,
  timezone: TX_TIMEZONE,
  currency: 'ARS',
  exchangeRate: '1',
  anchorCurrency: 'ARS',
  skipped: false,
};
const GROUP_DATA = {
  id: GROUP_ID,
  amountCents: 5000,
  description: 'Cuota laptop',
  totalInstallments: 6,
  startMonth: '2026-01',
  currency: 'ARS',
  exchangeRate: '1',
  anchorCurrency: 'ARS',
  skips: [],
};

// ---------------------------------------------------------------------------
// Suite de REGRESIÓN — sección correcta de cada tipo de calculado
// ---------------------------------------------------------------------------

describe('[REGRESIÓN] Calculados en su sección de origen — no en fijos', () => {
  let repo: MovementsRepository;

  /**
   * Mock de Prisma que permite controlar qué devuelve cada query según los
   * filtros de where. Las tres tablas (recurring, transaction, installmentGroup)
   * se configuran por test con mockResolvedValueOnce.
   */
  const mockPrisma = {
    recurring: { findMany: jest.fn() },
    transaction: { findMany: jest.fn() },
    installmentGroup: { findMany: jest.fn() },
    recurringSkip: { findMany: jest.fn() },
    referenceRate: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.referenceRate.findMany.mockResolvedValue([]); // sin cotizaciones de referencia (same anchor)

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovementsRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repo = module.get<MovementsRepository>(MovementsRepository);
  });

  // -------------------------------------------------------------------------
  // Calculado de único
  // -------------------------------------------------------------------------

  describe('calculado de único', () => {
    it('[REGRESIÓN] NO aparece en findFijosByMonth (sección fijos)', async () => {
      // findFijosByMonth: recurring devuelve VACÍO porque filtramos sourceMovementId=null
      // (en el repo la query ya excluye sourceMovementId != null)
      mockPrisma.recurring.findMany.mockResolvedValue([]);

      const fijos = await repo.findFijosByMonth(USER_A, '2026-06');

      const calcEnFijos = fijos.find((f) => f.id === CALC_TX_ID);
      expect(calcEnFijos).toBeUndefined();
    });

    it('[REGRESIÓN] SÍ aparece en findUnicosByMonth con origin="unico"', async () => {
      // findUnicosByMonth: $queryRaw (Transaction) devuelve vacío; recurring devuelve el calculado
      mockPrisma.$queryRaw.mockResolvedValue([]);
      // Primera llamada recurring → calculados de único
      mockPrisma.recurring.findMany.mockResolvedValueOnce([makeCalcDeUnico()]);
      // Segunda llamada recurring (transaction.findMany para txIds)
      mockPrisma.transaction.findMany.mockResolvedValue([TX_DATA]);

      const unicos = await repo.findUnicosByMonth(USER_A, '2026-06');

      const calcEnUnicos = unicos.find((u) => u.id === CALC_TX_ID);
      expect(calcEnUnicos).toBeDefined();
      expect(calcEnUnicos!.origin).toBe('unico');
    });

    it('monto derivado correcto en findUnicosByMonth: 10% de 10000 = 1000', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.recurring.findMany.mockResolvedValueOnce([makeCalcDeUnico()]);
      mockPrisma.transaction.findMany.mockResolvedValue([TX_DATA]);

      const unicos = await repo.findUnicosByMonth(USER_A, '2026-06');

      const item = unicos.find((u) => u.id === CALC_TX_ID)!;
      expect(item.amountCents).toBe(1000);
      expect(item.type).toBe(MovementType.INCOME); // +1000 → INCOME
    });

    it('calculated.sourceType = "unico", sourceId = txId, sourceChainId = null', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.recurring.findMany.mockResolvedValueOnce([makeCalcDeUnico()]);
      mockPrisma.transaction.findMany.mockResolvedValue([TX_DATA]);

      const unicos = await repo.findUnicosByMonth(USER_A, '2026-06');
      const item = unicos.find((u) => u.id === CALC_TX_ID)!;

      expect(item.calculated).not.toBeNull();
      expect(item.calculated!.sourceType).toBe('unico');
      expect(item.calculated!.sourceId).toBe(TX_ID);
      expect(item.calculated!.sourceChainId).toBeNull();
      expect(item.calculated!.sourceAmountCents).toBe(10000);
    });

    it('skipped=false, frequency=null (los únicos no tienen skip ni frecuencia)', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.recurring.findMany.mockResolvedValueOnce([makeCalcDeUnico()]);
      mockPrisma.transaction.findMany.mockResolvedValue([TX_DATA]);

      const unicos = await repo.findUnicosByMonth(USER_A, '2026-06');
      const item = unicos.find((u) => u.id === CALC_TX_ID)!;

      expect(item.skipped).toBe(false);
      expect(item.frequency).toBeNull();
    });

    it('hereda occurredAt y timezone del Transaction de origen', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.recurring.findMany.mockResolvedValueOnce([makeCalcDeUnico()]);
      mockPrisma.transaction.findMany.mockResolvedValue([TX_DATA]);

      const unicos = await repo.findUnicosByMonth(USER_A, '2026-06');
      const item = unicos.find((u) => u.id === CALC_TX_ID)!;

      expect(item.occurredAt).toEqual(TX_OCCURRED_AT);
      expect(item.timezone).toBe(TX_TIMEZONE);
    });

    it('NO aparece en un mes diferente al del único (rango autolimitado)', async () => {
      // Para '2026-07': el calculado tiene deletedFrom='2026-07' → no pasa el filtro Prisma
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.recurring.findMany.mockResolvedValueOnce([]); // Prisma lo filtra por el rango

      const unicos = await repo.findUnicosByMonth(USER_A, '2026-07');
      expect(unicos.find((u) => u.id === CALC_TX_ID)).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Calculado de cuota
  // -------------------------------------------------------------------------

  describe('calculado de cuota', () => {
    it('[REGRESIÓN] NO aparece en findFijosByMonth (sección fijos)', async () => {
      // findFijosByMonth excluye sourceInstallmentGroupId != null
      mockPrisma.recurring.findMany.mockResolvedValue([]);

      const fijos = await repo.findFijosByMonth(USER_A, '2026-03');

      expect(fijos.find((f) => f.id === CALC_CUOTA_ID)).toBeUndefined();
    });

    it('[REGRESIÓN] SÍ aparece en findCuotasByMonth con origin="cuota"', async () => {
      // findCuotasByMonth: installmentGroup (grupos) vacío; recurring devuelve calc de cuota
      mockPrisma.installmentGroup.findMany
        .mockResolvedValueOnce([]) // grupos normales
        .mockResolvedValueOnce([GROUP_DATA]); // orígenes de calculados
      mockPrisma.recurring.findMany.mockResolvedValueOnce([makeCalcDeCuota()]);

      const cuotas = await repo.findCuotasByMonth(USER_A, '2026-03');

      const calcEnCuotas = cuotas.find((c) => c.id === CALC_CUOTA_ID);
      expect(calcEnCuotas).toBeDefined();
      expect(calcEnCuotas!.origin).toBe('cuota');
    });

    it('monto derivado correcto en findCuotasByMonth: 5% de 5000 = 250', async () => {
      mockPrisma.installmentGroup.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([GROUP_DATA]);
      mockPrisma.recurring.findMany.mockResolvedValueOnce([makeCalcDeCuota()]);

      const cuotas = await repo.findCuotasByMonth(USER_A, '2026-03');
      const item = cuotas.find((c) => c.id === CALC_CUOTA_ID)!;

      expect(item.amountCents).toBe(250);
      expect(item.type).toBe(MovementType.INCOME); // +250 → INCOME
    });

    it('calculated.sourceType = "cuota", sourceId = groupId', async () => {
      mockPrisma.installmentGroup.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([GROUP_DATA]);
      mockPrisma.recurring.findMany.mockResolvedValueOnce([makeCalcDeCuota()]);

      const cuotas = await repo.findCuotasByMonth(USER_A, '2026-03');
      const item = cuotas.find((c) => c.id === CALC_CUOTA_ID)!;

      expect(item.calculated!.sourceType).toBe('cuota');
      expect(item.calculated!.sourceId).toBe(GROUP_ID);
      expect(item.calculated!.sourceChainId).toBeNull();
    });

    it('aparece en el último mes del grupo (mes 6 de 6)', async () => {
      // endMonth = addMonths('2026-01', 6) = '2026-07'; mes 6 es '2026-06' (< endMonth)
      mockPrisma.installmentGroup.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([GROUP_DATA]);
      mockPrisma.recurring.findMany.mockResolvedValueOnce([makeCalcDeCuota()]);

      const cuotas = await repo.findCuotasByMonth(USER_A, '2026-06');
      expect(cuotas.find((c) => c.id === CALC_CUOTA_ID)).toBeDefined();
    });

    it('NO aparece en el mes siguiente al fin del grupo (>= endMonth)', async () => {
      // endMonth = '2026-07'; mes '2026-07' >= endMonth → se excluye
      mockPrisma.installmentGroup.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([GROUP_DATA]);
      mockPrisma.recurring.findMany.mockResolvedValueOnce([makeCalcDeCuota()]);

      const cuotas = await repo.findCuotasByMonth(USER_A, '2026-07');
      expect(cuotas.find((c) => c.id === CALC_CUOTA_ID)).toBeUndefined();
    });

    it('skipped=false, frequency=null (las cuotas no tienen skip ni frecuencia propia)', async () => {
      mockPrisma.installmentGroup.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([GROUP_DATA]);
      mockPrisma.recurring.findMany.mockResolvedValueOnce([makeCalcDeCuota()]);

      const cuotas = await repo.findCuotasByMonth(USER_A, '2026-03');
      const item = cuotas.find((c) => c.id === CALC_CUOTA_ID)!;

      expect(item.skipped).toBe(false);
      expect(item.frequency).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Calculado de fijo — sigue en fijos
  // -------------------------------------------------------------------------

  describe('calculado de fijo', () => {
    it('[REGRESIÓN] SÍ aparece en findFijosByMonth con origin="fijo"', async () => {
      // findFijosByMonth recibe el fijo normal + el calculado de fijo
      mockPrisma.recurring.findMany.mockResolvedValue([makeNormalFijo(), makeCalcDeFijo()]);

      const fijos = await repo.findFijosByMonth(USER_A, '2026-06');

      const calcItem = fijos.find((f) => f.id === CALC_FIJO_ID);
      expect(calcItem).toBeDefined();
      expect(calcItem!.origin).toBe('fijo');
      // 10% de 10000 = 1000
      expect(calcItem!.amountCents).toBe(1000);
      expect(calcItem!.calculated!.sourceType).toBe('fijo');
    });

    it('[REGRESIÓN] El fijo de origen tiene hasCalculated=true cuando su calculado está activo', async () => {
      mockPrisma.recurring.findMany.mockResolvedValue([makeNormalFijo(), makeCalcDeFijo()]);

      const fijos = await repo.findFijosByMonth(USER_A, '2026-06');

      const origenItem = fijos.find((f) => f.id === 'normal-fijo-001');
      expect(origenItem).toBeDefined();
      expect(origenItem!.hasCalculated).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // calculatedChildren (Fase 1.1.9 — "calculados en el origen")
  // -------------------------------------------------------------------------

  describe('campo calculatedChildren (Fase 1.1.9)', () => {
    it('fijo origen: calculatedChildren trae el derivado del mes con sus datos', async () => {
      mockPrisma.recurring.findMany.mockResolvedValue([makeNormalFijo(), makeCalcDeFijo()]);

      const fijos = await repo.findFijosByMonth(USER_A, '2026-06');

      const origenItem = fijos.find((f) => f.id === 'normal-fijo-001')!;
      expect(origenItem.hasCalculated).toBe(true);
      expect(origenItem.calculatedChildren).toHaveLength(1);
      expect(origenItem.calculatedChildren[0]).toEqual({
        id: CALC_FIJO_ID,
        description: 'Calc de fijo',
        type: MovementType.INCOME, // 10% de 10000 = +1000 → INCOME
        convertedAmountCents: 1000,
        formulaOperator: FormulaOperator.PCT,
        formulaOperand: 1000,
        formulaSign: 1,
      });
    });

    it('el calculado de fijo (hijo) nunca es padre: su propio calculatedChildren es []', async () => {
      mockPrisma.recurring.findMany.mockResolvedValue([makeNormalFijo(), makeCalcDeFijo()]);

      const fijos = await repo.findFijosByMonth(USER_A, '2026-06');

      const calcItem = fijos.find((f) => f.id === CALC_FIJO_ID)!;
      expect(calcItem.calculatedChildren).toEqual([]);
      expect(calcItem.hasCalculated).toBe(false);
    });

    it('único origen: calculatedChildren trae el derivado del mes con sus datos', async () => {
      // $queryRaw devuelve la fila del único origen (para que aparezca como ítem padre)
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          id: TX_ID,
          userId: USER_A,
          type: 'EXPENSE',
          amountCents: TX_DATA.amountCents,
          description: TX_DATA.description,
          occurredAt: TX_OCCURRED_AT,
          timezone: TX_TIMEZONE,
          currency: 'ARS',
          exchangeRate: '1',
          anchorCurrency: 'ARS',
          skipped: false,
          categoryId: CAT_TX,
          categoryName: 'Viajes',
          categoryColor: '#123456',
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
      mockPrisma.recurring.findMany.mockResolvedValueOnce([makeCalcDeUnico()]);
      mockPrisma.transaction.findMany.mockResolvedValue([TX_DATA]);

      const unicos = await repo.findUnicosByMonth(USER_A, '2026-06');

      const origenItem = unicos.find((u) => u.id === TX_ID)!;
      expect(origenItem).toBeDefined();
      expect(origenItem.hasCalculated).toBe(true);
      expect(origenItem.calculatedChildren).toHaveLength(1);
      expect(origenItem.calculatedChildren[0]).toEqual({
        id: CALC_TX_ID,
        description: 'Impuesto sobre gasto',
        type: MovementType.INCOME, // 10% de 10000 = +1000 → INCOME
        convertedAmountCents: 1000,
        formulaOperator: FormulaOperator.PCT,
        formulaOperand: 1000,
        formulaSign: 1,
      });

      const calcItem = unicos.find((u) => u.id === CALC_TX_ID)!;
      expect(calcItem.calculatedChildren).toEqual([]);
    });

    it('cuota origen: calculatedChildren trae el derivado del mes con sus datos', async () => {
      const groupRow = {
        id: GROUP_ID,
        type: MovementType.EXPENSE,
        amountCents: GROUP_DATA.amountCents,
        description: GROUP_DATA.description,
        totalInstallments: GROUP_DATA.totalInstallments,
        startMonth: GROUP_DATA.startMonth,
        currency: 'ARS',
        exchangeRate: '1',
        anchorCurrency: 'ARS',
        category: { id: CAT_CUOTA, name: 'Tecnología', color: '#654321', scope: CategoryScope.EXPENSE },
        paymentMethod: null,
        autoDebit: null,
        skips: [],
      };
      mockPrisma.installmentGroup.findMany
        .mockResolvedValueOnce([groupRow]) // grupos normales (aparece como ítem padre)
        .mockResolvedValueOnce([GROUP_DATA]); // orígenes de calculados
      mockPrisma.recurring.findMany.mockResolvedValueOnce([makeCalcDeCuota()]);

      const cuotas = await repo.findCuotasByMonth(USER_A, '2026-03');

      const origenItem = cuotas.find((c) => c.id === GROUP_ID)!;
      expect(origenItem).toBeDefined();
      expect(origenItem.hasCalculated).toBe(true);
      expect(origenItem.calculatedChildren).toHaveLength(1);
      expect(origenItem.calculatedChildren[0]).toEqual({
        id: CALC_CUOTA_ID,
        description: 'Seguro de cuota',
        type: MovementType.INCOME, // 5% de 5000 = +250 → INCOME
        convertedAmountCents: 250,
        formulaOperator: FormulaOperator.PCT,
        formulaOperand: 500,
        formulaSign: 1,
      });

      const calcItem = cuotas.find((c) => c.id === CALC_CUOTA_ID)!;
      expect(calcItem.calculatedChildren).toEqual([]);
    });

    it('origen con múltiples calculados derivados: calculatedChildren lista los N correctamente', async () => {
      const segundoCalc = makeCalcDeFijo({
        id: 'calc-fijo-002',
        chainId: 'chain-calc-fijo-002',
        description: 'Segundo derivado',
        formulaOperator: FormulaOperator.SUB,
        formulaOperand: 2000, // 10000 - 2000 = 8000 → INCOME
        formulaSign: 1,
      });
      mockPrisma.recurring.findMany.mockResolvedValue([
        makeNormalFijo(),
        makeCalcDeFijo(),
        segundoCalc,
      ]);

      const fijos = await repo.findFijosByMonth(USER_A, '2026-06');

      const origenItem = fijos.find((f) => f.id === 'normal-fijo-001')!;
      expect(origenItem.calculatedChildren).toHaveLength(2);
      const ids = origenItem.calculatedChildren.map((c) => c.id).sort();
      expect(ids).toEqual([CALC_FIJO_ID, 'calc-fijo-002'].sort());
    });

    it('fijo origen sin calculados en el mes: calculatedChildren es []', async () => {
      mockPrisma.recurring.findMany.mockResolvedValue([makeNormalFijo()]);

      const fijos = await repo.findFijosByMonth(USER_A, '2026-06');

      const origenItem = fijos.find((f) => f.id === 'normal-fijo-001')!;
      expect(origenItem.calculatedChildren).toEqual([]);
      expect(origenItem.hasCalculated).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Separación estricta: los tres tipos van a secciones distintas
  // -------------------------------------------------------------------------

  describe('separación estricta de secciones', () => {
    it('calculado de único en unicos, calculado de cuota en cuotas, calculado de fijo en fijos — nunca mezclados', async () => {
      // findFijosByMonth: solo ve el fijo normal y el calculado de fijo
      mockPrisma.recurring.findMany.mockResolvedValue([makeNormalFijo(), makeCalcDeFijo()]);
      const fijos = await repo.findFijosByMonth(USER_A, '2026-06');

      expect(fijos.find((f) => f.id === CALC_FIJO_ID)).toBeDefined();  // calc de fijo SÍ
      expect(fijos.find((f) => f.id === CALC_TX_ID)).toBeUndefined();   // calc de único NO
      expect(fijos.find((f) => f.id === CALC_CUOTA_ID)).toBeUndefined(); // calc de cuota NO

      // findUnicosByMonth: $queryRaw vacío, recurring devuelve el calc de único
      jest.resetAllMocks();
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.referenceRate.findMany.mockResolvedValue([]);
      mockPrisma.recurring.findMany.mockResolvedValueOnce([makeCalcDeUnico()]);
      mockPrisma.transaction.findMany.mockResolvedValue([TX_DATA]);
      const unicos = await repo.findUnicosByMonth(USER_A, '2026-06');

      expect(unicos.find((u) => u.id === CALC_TX_ID)).toBeDefined();   // calc de único SÍ
      expect(unicos.find((u) => u.id === CALC_FIJO_ID)).toBeUndefined(); // calc de fijo NO

      // findCuotasByMonth: installmentGroup vacío, recurring devuelve calc de cuota
      jest.resetAllMocks();
      mockPrisma.referenceRate.findMany.mockResolvedValue([]);
      mockPrisma.installmentGroup.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([GROUP_DATA]);
      mockPrisma.recurring.findMany.mockResolvedValueOnce([makeCalcDeCuota()]);
      const cuotas = await repo.findCuotasByMonth(USER_A, '2026-03');

      expect(cuotas.find((c) => c.id === CALC_CUOTA_ID)).toBeDefined(); // calc de cuota SÍ
      expect(cuotas.find((c) => c.id === CALC_FIJO_ID)).toBeUndefined(); // calc de fijo NO
      expect(cuotas.find((c) => c.id === CALC_TX_ID)).toBeUndefined();   // calc de único NO
    });
  });
});

// ---------------------------------------------------------------------------
// Suite para getReportsMovements — calculados de único y cuota
// (no cambia: estos tests van sobre el Service que usa getAllFijosForAnnual,
//  y la lógica de reportes es correcta — los calculados de único/cuota van al
//  total del año correctamente independientemente de la sección mensual)
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
  findTransactionsByIds: jest.fn(),
  findInstallmentGroupsByIds: jest.fn(),
  loadPivotRatesForYear: jest.fn().mockResolvedValue(new Map()),
};

const mockLogger = {
  log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), verbose: jest.fn(),
};

const mockSettingsServiceExt = {
  getSettings: jest.fn(),
  updateLastExchangeRate: jest.fn(),
};

function makeCalcDeUnicoAnual(overrides: Partial<RecurringForAnnual> = {}): RecurringForAnnual {
  return {
    id: CALC_TX_ID,
    type: MovementType.EXPENSE,
    amountCents: 0,
    currency: Currency.ARS,
    exchangeRate: 1,
    anchorCurrency: Currency.ARS,
    startMonth: '2026-06',
    deletedFrom: '2026-07',
    frequency: 1,
    skippedMonths: new Set(),
    categoryId: CAT_TX,
    categoryName: 'Impuestos',
    categoryColor: '#FF0000',
    categoryScope: 'EXPENSE',
    chainId: 'chain-calc-tx-001',
    sourceChainId: null,
    sourceMovementId: TX_ID,
    sourceInstallmentGroupId: null,
    formulaOperator: FormulaOperator.PCT,
    formulaOperand: 1000, // 10%
    formulaSign: 1,
    ...overrides,
  };
}

function makeCalcDeCuotaAnual(overrides: Partial<RecurringForAnnual> = {}): RecurringForAnnual {
  return {
    id: CALC_CUOTA_ID,
    type: MovementType.EXPENSE,
    amountCents: 0,
    currency: Currency.ARS,
    exchangeRate: 1,
    anchorCurrency: Currency.ARS,
    startMonth: '2026-01',
    deletedFrom: null,
    frequency: 1,
    skippedMonths: new Set(),
    categoryId: CAT_CUOTA,
    categoryName: 'Seguros',
    categoryColor: '#00FF00',
    categoryScope: 'EXPENSE',
    chainId: 'chain-calc-cuota-001',
    sourceChainId: null,
    sourceMovementId: null,
    sourceInstallmentGroupId: GROUP_ID,
    formulaOperator: FormulaOperator.PCT,
    formulaOperand: 500, // 5%
    formulaSign: 1,
    ...overrides,
  };
}

describe('MovementsService.getReportsMovements — calculados de único y cuota (Fase 1.1.7.ext)', () => {
  let service: MovementsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSettingsServiceExt.getSettings.mockResolvedValue({ defaultCurrency: Currency.ARS, lastExchangeRate: null });
    mockRepo.getAnnualUnicosAggregated.mockResolvedValue([]);
    mockRepo.getAllCuotasForAnnual.mockResolvedValue([]);
    mockRepo.getEarliestYear.mockResolvedValue(null);
    mockRepo.findTransactionsByIds.mockResolvedValue([]);
    mockRepo.findInstallmentGroupsByIds.mockResolvedValue([]);
    mockRepo.loadPivotRatesForYear.mockResolvedValue(new Map());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovementsService,
        { provide: MovementsRepository, useValue: mockRepo },
        { provide: Logger, useValue: mockLogger },
        { provide: SettingsService, useValue: mockSettingsServiceExt },
      ],
    }).compile();

    service = module.get<MovementsService>(MovementsService);
  });

  it('calculado de único aparece solo en el mes del Transaction (junio 2026)', async () => {
    const calc = makeCalcDeUnicoAnual({ startMonth: '2026-06', deletedFrom: '2026-07' });
    mockRepo.getAllFijosForAnnual.mockResolvedValue([calc]);
    mockRepo.findTransactionsByIds.mockResolvedValue([{ id: TX_ID, amountCents: 10000, description: 'Viaje', currency: Currency.ARS, exchangeRate: 1, anchorCurrency: Currency.ARS, skipped: false }]);

    const result = await service.getReportsMovements(USER_A, 2026);

    for (let i = 0; i < 12; i++) {
      if (i === 5) {
        // 10% de 10000 = 1000, sign=+1 → INCOME
        expect(result.months[i].incomeCents).toBe(1000);
        expect(result.months[i].expenseCents).toBe(0);
      } else {
        expect(result.months[i].incomeCents).toBe(0);
        expect(result.months[i].expenseCents).toBe(0);
      }
    }
  });

  it('calculado de cuota aparece en los 6 meses del grupo (ene-jun 2026)', async () => {
    const calc = makeCalcDeCuotaAnual({ startMonth: '2026-01', deletedFrom: null });
    mockRepo.getAllFijosForAnnual.mockResolvedValue([calc]);
    mockRepo.findInstallmentGroupsByIds.mockResolvedValue([{
      id: GROUP_ID,
      amountCents: 5000,
      totalInstallments: 6,
      startMonth: '2026-01',
      currency: Currency.ARS,
      exchangeRate: 1,
      anchorCurrency: Currency.ARS,
      skippedMonths: new Set<string>(),
    }]);

    const result = await service.getReportsMovements(USER_A, 2026);

    // Meses ene-jun (índices 0..5): 5% de 5000 = 250, sign=+1 → INCOME
    for (let i = 0; i < 6; i++) {
      expect(result.months[i].incomeCents).toBe(250);
      expect(result.months[i].expenseCents).toBe(0);
    }
    // Meses jul-dic (índices 6..11): fuera del rango del grupo → 0
    for (let i = 6; i < 12; i++) {
      expect(result.months[i].incomeCents).toBe(0);
      expect(result.months[i].expenseCents).toBe(0);
    }
  });

  it('calculado de cuota con sign=-1 suma magnitud a expenseCents (RN-019)', async () => {
    const calc = makeCalcDeCuotaAnual({ formulaSign: -1 });
    mockRepo.getAllFijosForAnnual.mockResolvedValue([calc]);
    mockRepo.findInstallmentGroupsByIds.mockResolvedValue([{
      id: GROUP_ID,
      amountCents: 5000,
      totalInstallments: 6,
      startMonth: '2026-01',
      currency: Currency.ARS,
      exchangeRate: 1,
      anchorCurrency: Currency.ARS,
      skippedMonths: new Set<string>(),
    }]);

    const result = await service.getReportsMovements(USER_A, 2026);

    for (let i = 0; i < 6; i++) {
      expect(result.months[i].expenseCents).toBe(250);
      expect(result.months[i].incomeCents).toBe(0);
    }
  });

  it('calculados de único y cuota con Transaction y grupo ausentes → no aparecen', async () => {
    const calcTx = makeCalcDeUnicoAnual();
    const calcCuota = makeCalcDeCuotaAnual();
    mockRepo.getAllFijosForAnnual.mockResolvedValue([calcTx, calcCuota]);
    mockRepo.findTransactionsByIds.mockResolvedValue([]);
    mockRepo.findInstallmentGroupsByIds.mockResolvedValue([]);

    const result = await service.getReportsMovements(USER_A, 2026);

    for (const m of result.months) {
      expect(m.incomeCents).toBe(0);
      expect(m.expenseCents).toBe(0);
    }
  });
});
