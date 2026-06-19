/**
 * Tests para BUG B/C/D en la proyección anual (getReportsMovements).
 * Verifica que calculados sobre orígenes con split se muestran correctamente en reportes.
 *
 * Actualizado Fase 1.1.7 (RF-MCALC-003, RN-018, RN-019):
 * - El type del calculado se DERIVA on-the-fly del signo del monto (monto>0→INCOME, monto≤0→EXPENSE).
 * - Los totales suman la MAGNITUD (|amountCents|) al bucket del type DERIVADO.
 * - El `type` guardado en DB es un placeholder EXPENSE y no se usa.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { FormulaOperator, RecurringFrequency } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { MovementsService } from '../../../src/movements/movements.service';
import {
  MovementsRepository,
  RecurringForAnnual,
} from '../../../src/movements/movements.repository';

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
  // Fase 1.1.7.ext — lookups de origen para calculados de único y cuota
  findTransactionsByIds: jest.fn().mockResolvedValue([]),
  findInstallmentGroupsByIds: jest.fn().mockResolvedValue([]),
};

const mockLogger = {
  log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), verbose: jest.fn(),
};

const USER_A = 'user-calc-reports';
const CAT_ORIGIN = 'cat-origin';
const CAT_CALC = 'cat-calc';
const ORIGIN_CHAIN_ID = 'chain-origin-001';
const CALC_CHAIN_ID = 'chain-calc-001';

function makeOriginFijo(overrides: Partial<RecurringForAnnual> = {}): RecurringForAnnual {
  return {
    id: 'r1',
    type: 'EXPENSE' as any,
    amountCents: 10000,
    startMonth: '2026-01',
    deletedFrom: null,
    frequency: RecurringFrequency.MONTHLY,
    skippedMonths: new Set(),
    categoryId: CAT_ORIGIN,
    categoryName: 'Alquiler',
    categoryColor: '#4F86C6',
    categoryScope: 'EXPENSE',
    chainId: ORIGIN_CHAIN_ID,
    sourceChainId: null,
    sourceMovementId: null,
    sourceInstallmentGroupId: null,
    formulaOperator: null,
    formulaOperand: null,
    formulaSign: null,
    ...overrides,
  };
}

function makeCalcFijo(overrides: Partial<RecurringForAnnual> = {}): RecurringForAnnual {
  return {
    id: 'calc-001',
    type: 'EXPENSE' as any, // placeholder en DB — no se usa para totales (RF-MCALC-003)
    amountCents: 0, // placeholder
    startMonth: '2026-01',
    deletedFrom: null,
    frequency: RecurringFrequency.MONTHLY,
    skippedMonths: new Set(),
    categoryId: CAT_CALC,
    categoryName: 'Expensas',
    categoryColor: '#6DBF67',
    categoryScope: 'EXPENSE',
    chainId: CALC_CHAIN_ID,
    sourceChainId: ORIGIN_CHAIN_ID,
    sourceMovementId: null,
    sourceInstallmentGroupId: null,
    formulaOperator: FormulaOperator.PCT,
    formulaOperand: 1000, // 10%
    formulaSign: 1,
    ...overrides,
  };
}

describe('MovementsService getReportsMovements — calculados (Fase 1.1.7)', () => {
  let service: MovementsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRepo.getAnnualUnicosAggregated.mockResolvedValue([]);
    mockRepo.getAllCuotasForAnnual.mockResolvedValue([]);
    mockRepo.getEarliestYear.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovementsService,
        { provide: MovementsRepository, useValue: mockRepo },
        { provide: Logger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<MovementsService>(MovementsService);
  });

  // -------------------------------------------------------------------------
  // BUG B en reportes: calculado sobre origen con split
  // -------------------------------------------------------------------------

  describe('BUG B en reportes: calculado sobre origen con cadena de split', () => {
    it('calculado sign=+1 (INCOME derivado) usa el monto del origen en cada fila de la cadena', async () => {
      // R1: startMonth='2026-01', deletedFrom='2026-07', amountCents=10000
      // R2: startMonth='2026-07', deletedFrom=null, amountCents=15000 (misma cadena)
      // Calculado: 10% sign=+1 → monto positivo → INCOME derivado
      //   Antes de julio: +1000; desde julio: +1500
      const R1 = makeOriginFijo({
        id: 'r1',
        amountCents: 10000,
        startMonth: '2026-01',
        deletedFrom: '2026-07',
        chainId: ORIGIN_CHAIN_ID,
      });
      const R2 = makeOriginFijo({
        id: 'r2',
        amountCents: 15000,
        startMonth: '2026-07',
        deletedFrom: null,
        chainId: ORIGIN_CHAIN_ID, // mismo chainId (split preservó la cadena)
      });
      const calc = makeCalcFijo({ formulaSign: 1 }); // sign=+1 → derived positivo → INCOME

      mockRepo.getAllFijosForAnnual.mockResolvedValue([R1, R2, calc]);

      const result = await service.getReportsMovements(USER_A, 2026);

      // Enero a junio (índice 0..5):
      // origin EXPENSE 10000 → expenseCents=10000; calc derived +1000 → INCOME → incomeCents=1000
      for (let i = 0; i < 6; i++) {
        expect(result.months[i].expenseCents).toBe(10000);
        expect(result.months[i].incomeCents).toBe(1000);
      }
      // Julio a diciembre (índice 6..11):
      // origin EXPENSE 15000 → expenseCents=15000; calc derived +1500 → INCOME → incomeCents=1500
      for (let i = 6; i < 12; i++) {
        expect(result.months[i].expenseCents).toBe(15000);
        expect(result.months[i].incomeCents).toBe(1500);
      }
    });

    it('calculado sign=-1 (EXPENSE derivado) sobre cadena con split: suma magnitud a expenseCents', async () => {
      // R1 y R2 como arriba. Calculado sign=-1 → monto negativo → EXPENSE, magnitud suma a expense.
      const R1 = makeOriginFijo({
        id: 'r1', amountCents: 10000, startMonth: '2026-01', deletedFrom: '2026-07',
      });
      const R2 = makeOriginFijo({
        id: 'r2', amountCents: 15000, startMonth: '2026-07', deletedFrom: null,
      });
      const calc = makeCalcFijo({ formulaSign: -1 }); // derived negativo → EXPENSE

      mockRepo.getAllFijosForAnnual.mockResolvedValue([R1, R2, calc]);

      const result = await service.getReportsMovements(USER_A, 2026);

      // Ene-Jun: origin 10000 EXPENSE + calc magnitud 1000 EXPENSE = 11000
      for (let i = 0; i < 6; i++) {
        expect(result.months[i].expenseCents).toBe(11000);
        expect(result.months[i].incomeCents).toBe(0);
      }
      // Jul-Dic: origin 15000 EXPENSE + calc magnitud 1500 EXPENSE = 16500
      for (let i = 6; i < 12; i++) {
        expect(result.months[i].expenseCents).toBe(16500);
        expect(result.months[i].incomeCents).toBe(0);
      }
    });

    it('calculado NO aparece si el origen no está activo en ese mes', async () => {
      // Origen solo activo en enero (deletedFrom='2026-02')
      const R1 = makeOriginFijo({
        startMonth: '2026-01',
        deletedFrom: '2026-02',
        amountCents: 10000,
      });
      const calc = makeCalcFijo({ formulaSign: -1 }); // sign=-1 → EXPENSE derivado

      mockRepo.getAllFijosForAnnual.mockResolvedValue([R1, calc]);

      const result = await service.getReportsMovements(USER_A, 2026);

      // Enero: origin 10000 EXPENSE + calc 1000 EXPENSE magnitud = 11000
      expect(result.months[0].expenseCents).toBe(11000);
      // Febrero en adelante: solo 0 (ni origin ni calculado activos)
      for (let i = 1; i < 12; i++) {
        expect(result.months[i].expenseCents).toBe(0);
        expect(result.months[i].incomeCents).toBe(0);
      }
    });
  });

  // -------------------------------------------------------------------------
  // BUG C en reportes: calculado suma a los totales del año (RN-019)
  // -------------------------------------------------------------------------

  describe('BUG C en reportes: calculado suma a totales anuales (RN-019)', () => {
    it('calculado sign=+1 → derived positivo → INCOME derivado → suma MAGNITUD a incomeCents', async () => {
      // Origen EXPENSE 10000. Calculado 10% sign=+1 → +1000 → INCOME.
      // RN-019: magnitud (1000) suma a incomeCents, NO a expenseCents.
      const origin = makeOriginFijo({ amountCents: 10000 });
      const calc = makeCalcFijo({
        formulaOperator: FormulaOperator.PCT,
        formulaOperand: 1000, // 10%
        formulaSign: 1,       // derived = +1000 → INCOME
      });
      mockRepo.getAllFijosForAnnual.mockResolvedValue([origin, calc]);

      const result = await service.getReportsMovements(USER_A, 2026);

      // Cada mes: origin EXPENSE 10000; calc INCOME 1000
      result.months.forEach((m) => {
        expect(m.expenseCents).toBe(10000);
        expect(m.incomeCents).toBe(1000);
      });
    });

    it('calculado sign=-1 → derived negativo → EXPENSE derivado → suma MAGNITUD a expenseCents', async () => {
      // Origen EXPENSE 10000. Calculado 10% sign=-1 → -1000 → EXPENSE, magnitud=1000.
      // RN-019: magnitud (1000) suma a expenseCents.
      const origin = makeOriginFijo({ amountCents: 10000 });
      const calc = makeCalcFijo({
        formulaOperator: FormulaOperator.PCT,
        formulaOperand: 1000, // 10%
        formulaSign: -1,      // derived = -1000 → EXPENSE
      });
      mockRepo.getAllFijosForAnnual.mockResolvedValue([origin, calc]);

      const result = await service.getReportsMovements(USER_A, 2026);

      // Cada mes: origin EXPENSE 10000 + calc EXPENSE magnitud 1000 = 11000
      result.months.forEach((m) => {
        expect(m.expenseCents).toBe(11000);
        expect(m.incomeCents).toBe(0);
      });
    });

    it('calculado skippeado (origen skippeado) NO suma a los totales', async () => {
      const origin = makeOriginFijo({
        amountCents: 10000,
        skippedMonths: new Set(['2026-06']),
      });
      const calc = makeCalcFijo({ formulaSign: -1 }); // EXPENSE derivado

      mockRepo.getAllFijosForAnnual.mockResolvedValue([origin, calc]);

      const result = await service.getReportsMovements(USER_A, 2026);

      // Junio: origen y calculado skippeados → 0
      expect(result.months[5].expenseCents).toBe(0);
      expect(result.months[5].incomeCents).toBe(0);
      // Otros meses: origin 10000 + calc magnitud 1000 = 11000
      for (let i = 0; i < 12; i++) {
        if (i === 5) continue;
        expect(result.months[i].expenseCents).toBe(11000);
      }
    });

    it('calculado EXPENSE derivado aparece en desglose de categories', async () => {
      // calc sign=-1 → EXPENSE → debe aparecer en categories con su magnitud
      const origin = makeOriginFijo({ amountCents: 10000, categoryId: CAT_ORIGIN });
      const calc = makeCalcFijo({
        formulaSign: -1, // EXPENSE derivado
        categoryId: CAT_CALC,
      });
      mockRepo.getAllFijosForAnnual.mockResolvedValue([origin, calc]);

      const result = await service.getReportsMovements(USER_A, 2026);

      // CAT_CALC debe aparecer en categories (es EXPENSE derivado con magnitud > 0)
      const calcCat = result.categories.find((c) => c.categoryId === CAT_CALC);
      expect(calcCat).toBeDefined();
      // Todos los meses con magnitud 1000
      calcCat!.monthlyExpenseCents.forEach((v) => expect(v).toBe(1000));
    });

    it('calculado INCOME derivado (sign=+1) NO aparece en desglose de categories', async () => {
      // calc sign=+1 → INCOME derivado → no va en categories (solo EXPENSE se desglosa)
      const origin = makeOriginFijo({ amountCents: 10000, categoryId: CAT_ORIGIN });
      const calc = makeCalcFijo({
        formulaSign: 1, // INCOME derivado
        categoryId: CAT_CALC,
      });
      mockRepo.getAllFijosForAnnual.mockResolvedValue([origin, calc]);

      const result = await service.getReportsMovements(USER_A, 2026);

      // CAT_CALC es INCOME derivado → no aparece en categories
      const calcCat = result.categories.find((c) => c.categoryId === CAT_CALC);
      expect(calcCat).toBeUndefined();

      // CAT_ORIGIN es EXPENSE → sí aparece
      const originCat = result.categories.find((c) => c.categoryId === CAT_ORIGIN);
      expect(originCat).toBeDefined();
    });
  });
});
