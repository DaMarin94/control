/**
 * Tests unitarios de MovementsService — método getAnnualFijosReport (RF-REP-013,
 * card "fixed-evolution" / Detalle histórico de gastos fijos).
 *
 * Migración de año calendario a RANGO DE MESES CORRIDOS anclado al presente
 * (ver docs/requirements.md RF-REP-013 reescrito). El endpoint deja de aceptar
 * `year`; ahora acepta `rangeMonths` (3|6|9|12|24|36|48|60, default 36) y el
 * borde derecho SIEMPRE es el mes en curso (resuelto con `today`).
 *
 * Estrategia de la mayoría de los tests de dominio: usar rangeMonths=12 y
 * today='2026-12-25', que reproduce EXACTAMENTE el rango "año 2026" del
 * contrato anterior (startMonth efectivo '2026-01', endMonth '2026-12', mes
 * ancla '2025-12') — así la casuística de dominio (splits, huecos, calculados,
 * moneda, variación) se reutiliza sin cambiar los datos de los fixtures.
 *
 * Cobertura:
 * - Estructura de la respuesta (rangeMonths, startMonth, endMonth, currency,
 *   lines, excluded) y default de rangeMonths (36) cuando no se pide.
 * - Fijo mensual vigente en todo el rango → un punto por mes, con `month` YYYY-MM.
 * - Alcance: solo Fijo + EXPENSE (fijos INCOME no entran)
 * - frequency > 1 → mes sin aparición, reason 'frequency', no parte la línea
 * - Mes anulado (RecurringSkip) → reason 'skipped'
 * - Fijo que arranca a mitad del rango → reason 'beforeStart' antes del alta
 * - Fijo dado de baja (deletedFrom) → reason 'afterEnd' después de la baja
 * - Recomposición de cadena con splits: una sola línea, cambio de monto = escalón
 * - Calculado de fijo: línea propia, solo meses EXPENSE, 'resultedIncome' si INCOME
 * - Calculado con monto derivado 0 → punto presente con amountCents=0 (no hueco)
 * - Moneda: TC oficial del mes de la instancia (no el exchangeRate guardado)
 * - Variación nominal y ajustada por IPC, incluido el mes ancla (anterior al
 *   primer mes del rango efectivo)
 * - Rango efectivo: recorte a la izquierda contra el primer mes con historia,
 *   sin recorte cuando hay más historia que la pedida, sin historia en absoluto,
 *   borde derecho siempre el mes en curso (nunca futuro).
 * - Universo de `excluded` (opción B): TODA cadena de gasto fijo del usuario
 *   (mismo alcance que `lines`) con 0 o 1 apariciones graficables en el rango
 *   efectivo viaja a `excluded` con su startMonth — incluye 0 apariciones
 *   (fijo con vigencia terminada hace años, alta futura, origen de calculado
 *   sin resolver); con ≥2 → `lines`. Casos: fijo anual con rango corto,
 *   calculado que resulta INCOME casi siempre, mes anulado.
 * - Orden de `lines`: gasto TOTAL del rango efectivo DESC.
 * - ordinal: estable, independiente del rango pedido.
 * - Aislamiento: no filtra por categorías (no expone ese parámetro).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { Currency, FormulaOperator, MovementType } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import {
  MovementsService,
  FixedEvolutionLine,
  FixedEvolutionExcludedLine,
} from '../../../src/movements/movements.service';
import {
  MovementsRepository,
  RecurringForAnnual,
} from '../../../src/movements/movements.repository';
import { SettingsService } from '../../../src/settings/settings.service';
import { SimulationsService } from '../../../src/simulations/simulations.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRepo = {
  getAllFijosForAnnual: jest.fn(),
  loadPivotRatesForMonths: jest.fn(),
  loadInflationRatesForMonths: jest.fn(),
};

const mockLogger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
};

const mockSettingsService = {
  getSettings: jest.fn(),
};

const mockSimulationsService = {
  getSimulatedItemsForMonth: jest.fn().mockResolvedValue([]),
};

const USER_A = 'user-a-fijos-evolution';
const CAT_A = 'cat-a-id';

// Setup "estándar" para la mayoría de los tests de dominio: rangeMonths=12 +
// today='2026-12-25' reproduce el rango "año 2026" del contrato viejo.
const STANDARD_RANGE = 12;
const STANDARD_TODAY = '2026-12-25';

/** Crea una fila RecurringForAnnual de fijo NORMAL con defaults razonables. */
function makeFijo(overrides: Partial<RecurringForAnnual> = {}): RecurringForAnnual {
  return {
    id: overrides.id ?? 'row-1',
    type: MovementType.EXPENSE,
    description: 'Alquiler',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    amountCents: 100000,
    currency: Currency.ARS,
    exchangeRate: 1,
    anchorCurrency: Currency.ARS,
    startMonth: '2026-01',
    deletedFrom: null,
    frequency: 1,
    skippedMonths: new Set<string>(),
    categoryId: CAT_A,
    categoryName: 'Vivienda',
    categoryColor: '#4F86C6',
    categoryScope: 'EXPENSE',
    chainId: 'chain-1',
    sourceChainId: null,
    sourceMovementId: null,
    sourceInstallmentGroupId: null,
    formulaOperator: null,
    formulaOperand: null,
    formulaSign: null,
    ...overrides,
  };
}

/** Crea una fila RecurringForAnnual de CALCULADO de fijo. */
function makeCalc(overrides: Partial<RecurringForAnnual> = {}): RecurringForAnnual {
  return {
    id: overrides.id ?? 'calc-1',
    type: MovementType.EXPENSE, // placeholder; el type real se deriva on-the-fly
    description: 'Comisión',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    amountCents: 0,
    currency: Currency.ARS,
    exchangeRate: 1,
    anchorCurrency: Currency.ARS,
    startMonth: '2026-01',
    deletedFrom: null,
    frequency: 1,
    skippedMonths: new Set<string>(),
    categoryId: CAT_A,
    categoryName: 'Servicios',
    categoryColor: '#C64F4F',
    categoryScope: 'EXPENSE',
    chainId: 'calc-chain-1',
    sourceChainId: 'chain-1',
    sourceMovementId: null,
    sourceInstallmentGroupId: null,
    formulaOperator: FormulaOperator.PCT,
    formulaOperand: 1000, // 10%
    formulaSign: 1,
    ...overrides,
  };
}

function setupDefaults(): void {
  mockRepo.getAllFijosForAnnual.mockResolvedValue([]);
  mockRepo.loadPivotRatesForMonths.mockResolvedValue(new Map());
  mockRepo.loadInflationRatesForMonths.mockResolvedValue(new Map());
  mockSettingsService.getSettings.mockResolvedValue({ defaultCurrency: Currency.ARS });
}

function findLine(lines: FixedEvolutionLine[], chainId: string): FixedEvolutionLine {
  const line = lines.find((l) => l.chainId === chainId);
  if (!line) throw new Error(`Línea no encontrada para chainId=${chainId}`);
  return line;
}

function findExcluded(
  excluded: FixedEvolutionExcludedLine[],
  chainId: string,
): FixedEvolutionExcludedLine {
  const line = excluded.find((l) => l.chainId === chainId);
  if (!line) throw new Error(`Excluido no encontrado para chainId=${chainId}`);
  return line;
}

describe('MovementsService — getAnnualFijosReport (RF-REP-013, rango de meses corridos)', () => {
  let service: MovementsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    setupDefaults();

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

  // -------------------------------------------------------------------------
  // Estructura de la respuesta
  // -------------------------------------------------------------------------

  describe('estructura de la respuesta', () => {
    it('sin fijos → lines/excluded vacíos, rango efectivo = el pedido (sin historia que recorte)', async () => {
      const result = await service.getAnnualFijosReport(
        USER_A,
        STANDARD_RANGE,
        undefined,
        STANDARD_TODAY,
      );
      expect(result.currency).toBe(Currency.ARS);
      expect(result.lines).toEqual([]);
      expect(result.excluded).toEqual([]);
      expect(result.rangeMonths).toBe(12);
      expect(result.startMonth).toBe('2026-01');
      expect(result.endMonth).toBe('2026-12');
    });

    it('default de rangeMonths es 36 cuando no se pasa', async () => {
      const result = await service.getAnnualFijosReport(
        USER_A,
        36,
        undefined,
        STANDARD_TODAY,
      );
      expect(result.rangeMonths).toBe(36);
      // 36 meses hacia atrás desde diciembre 2026 → arranca en enero 2024
      expect(result.startMonth).toBe('2024-01');
      expect(result.endMonth).toBe('2026-12');
    });

    it('currency refleja la defaultCurrency del usuario; override la sobrescribe', async () => {
      mockSettingsService.getSettings.mockResolvedValue({ defaultCurrency: Currency.USD });
      const result = await service.getAnnualFijosReport(USER_A, STANDARD_RANGE);
      expect(result.currency).toBe(Currency.USD);

      const result2 = await service.getAnnualFijosReport(USER_A, STANDARD_RANGE, Currency.EUR);
      expect(result2.currency).toBe(Currency.EUR);
    });
  });

  // -------------------------------------------------------------------------
  // Alcance: solo Fijo + EXPENSE
  // -------------------------------------------------------------------------

  describe('alcance', () => {
    it('fijo INCOME no entra en las líneas', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ chainId: 'chain-income', type: MovementType.INCOME }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, STANDARD_RANGE, undefined, STANDARD_TODAY);
      expect(result.lines).toEqual([]);
      expect(result.excluded).toEqual([]);
    });

    it('fijo mensual vigente todo el rango → un punto por mes, todos presentes, con `month` YYYY-MM', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([makeFijo()]);
      const result = await service.getAnnualFijosReport(USER_A, STANDARD_RANGE, undefined, STANDARD_TODAY);
      const line = findLine(result.lines, 'chain-1');
      expect(line.months).toHaveLength(12);
      line.months.forEach((m) => {
        expect(m.amountCents).toBe(100000);
        expect(m.reason).toBeNull();
      });
      expect(line.months[0].month).toBe('2026-01');
      expect(line.months[11].month).toBe('2026-12');
      expect(line.isCalculated).toBe(false);
      expect(line.description).toBe('Alquiler');
      expect(line.categoryId).toBe(CAT_A);
      expect(line.startMonth).toBe('2026-01');
      expect(line.endMonth).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Casos de dominio — huecos con motivo
  // -------------------------------------------------------------------------

  describe('huecos con motivo', () => {
    it('frequency > 1 → mes sin aparición reason=frequency; la línea no se parte (huecos internos)', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ frequency: 3, startMonth: '2026-01' }), // aparece en ene, abr, jul, oct
      ]);
      const result = await service.getAnnualFijosReport(USER_A, STANDARD_RANGE, undefined, STANDARD_TODAY);
      const line = findLine(result.lines, 'chain-1');

      [0, 3, 6, 9].forEach((idx) => {
        expect(line.months[idx].amountCents).toBe(100000);
        expect(line.months[idx].reason).toBeNull();
      });
      [1, 2, 4, 5, 7, 8, 10, 11].forEach((idx) => {
        expect(line.months[idx].amountCents).toBeNull();
        expect(line.months[idx].reason).toBe('frequency');
      });
    });

    it('mes anulado (RecurringSkip) → reason=skipped', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ skippedMonths: new Set(['2026-03']) }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, STANDARD_RANGE, undefined, STANDARD_TODAY);
      const line = findLine(result.lines, 'chain-1');
      expect(line.months[2].amountCents).toBeNull();
      expect(line.months[2].reason).toBe('skipped');
      expect(line.months[0].amountCents).toBe(100000);
      expect(line.months[3].amountCents).toBe(100000);
    });

    it('fijo que arranca a mitad del rango → reason=beforeStart antes del alta', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        // Otro fijo mucho más viejo para que el universo del usuario tenga
        // historia de sobra y el rango NO se recorte contra el alta de julio
        // (si fuera el único fijo del usuario, el propio recorte a la
        // izquierda arrancaría el rango en julio y no habría "antes del alta"
        // que mostrar).
        makeFijo({ chainId: 'chain-old-anchor', startMonth: '2020-01' }),
        makeFijo({ startMonth: '2026-07' }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, STANDARD_RANGE, undefined, STANDARD_TODAY);
      expect(result.startMonth).toBe('2026-01');
      const line = findLine(result.lines, 'chain-1');
      for (let i = 0; i < 6; i++) {
        expect(line.months[i].amountCents).toBeNull();
        expect(line.months[i].reason).toBe('beforeStart');
      }
      for (let i = 6; i < 12; i++) {
        expect(line.months[i].amountCents).toBe(100000);
      }
      expect(line.startMonth).toBe('2026-07');
    });

    it('fijo dado de baja (deletedFrom) → reason=afterEnd después de la baja; no continúa en cero', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ deletedFrom: '2026-09' }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, STANDARD_RANGE, undefined, STANDARD_TODAY);
      const line = findLine(result.lines, 'chain-1');
      for (let i = 0; i < 8; i++) {
        expect(line.months[i].amountCents).toBe(100000);
      }
      for (let i = 8; i < 12; i++) {
        expect(line.months[i].amountCents).toBeNull();
        expect(line.months[i].reason).toBe('afterEnd');
      }
      expect(line.endMonth).toBe('2026-09');
    });
  });

  // -------------------------------------------------------------------------
  // Recomposición de cadena (splits)
  // -------------------------------------------------------------------------

  describe('recomposición de cadena con splits', () => {
    it('dos splits del mismo chainId → una sola línea, cambio de monto = escalón', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({
          id: 'row-1',
          startMonth: '2026-01',
          deletedFrom: '2026-06',
          amountCents: 100000,
        }),
        makeFijo({
          id: 'row-2',
          startMonth: '2026-06',
          deletedFrom: null,
          amountCents: 150000,
        }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, STANDARD_RANGE, undefined, STANDARD_TODAY);
      expect(result.lines).toHaveLength(1);
      const line = findLine(result.lines, 'chain-1');
      for (let i = 0; i < 5; i++) {
        expect(line.months[i].amountCents).toBe(100000);
      }
      for (let i = 5; i < 12; i++) {
        expect(line.months[i].amountCents).toBe(150000);
      }
      expect(line.startMonth).toBe('2026-01');
      expect(line.endMonth).toBeNull();
      expect(line.months[5].nominalPct).toBe(50); // (150000/100000 - 1) * 100
    });
  });

  // -------------------------------------------------------------------------
  // Calculados de fijo
  // -------------------------------------------------------------------------

  describe('calculados de fijo', () => {
    it('calculado con fórmula que da EXPENSE todos los meses → línea propia, isCalculated=true', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ chainId: 'chain-1', amountCents: 100000 }),
        makeCalc({
          chainId: 'calc-chain-1',
          sourceChainId: 'chain-1',
          formulaOperator: FormulaOperator.PCT,
          formulaOperand: 1000,
          formulaSign: -1,
        }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, STANDARD_RANGE, undefined, STANDARD_TODAY);
      const calcLine = findLine(result.lines, 'calc-chain-1');
      expect(calcLine.isCalculated).toBe(true);
      calcLine.months.forEach((m) => {
        expect(m.amountCents).toBe(10000);
        expect(m.reason).toBeNull();
      });
    });

    it('calculado que cambia de dirección: EXPENSE en un tramo, INCOME (resultedIncome) en otro', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ id: 'row-1', chainId: 'chain-1', startMonth: '2026-01', deletedFrom: '2026-07', amountCents: 50000 }),
        makeFijo({ id: 'row-2', chainId: 'chain-1', startMonth: '2026-07', deletedFrom: null, amountCents: 150000 }),
        makeCalc({
          chainId: 'calc-chain-1',
          sourceChainId: 'chain-1',
          formulaOperator: FormulaOperator.SUB,
          formulaOperand: 100000,
          formulaSign: 1,
        }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, STANDARD_RANGE, undefined, STANDARD_TODAY);
      const calcLine = findLine(result.lines, 'calc-chain-1');
      // ene..jun: origen=50000 → -50000 → EXPENSE, magnitud 50000 (6 apariciones ⇒ entra a lines)
      for (let i = 0; i < 6; i++) {
        expect(calcLine.months[i].amountCents).toBe(50000);
        expect(calcLine.months[i].reason).toBeNull();
      }
      // jul..dic: origen=150000 → 50000 → INCOME → hueco
      for (let i = 6; i < 12; i++) {
        expect(calcLine.months[i].amountCents).toBeNull();
        expect(calcLine.months[i].reason).toBe('resultedIncome');
      }
    });

    it('calculado con monto derivado 0 → punto presente con amountCents=0 (no hueco, RN-018)', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ chainId: 'chain-1', amountCents: 100000 }),
        makeCalc({
          chainId: 'calc-chain-1',
          sourceChainId: 'chain-1',
          formulaOperator: FormulaOperator.SUB,
          formulaOperand: 100000,
          formulaSign: 1,
        }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, STANDARD_RANGE, undefined, STANDARD_TODAY);
      const calcLine = findLine(result.lines, 'calc-chain-1');
      expect(calcLine.months[0].amountCents).toBe(0);
      expect(calcLine.months[0].reason).toBeNull();
    });

    it('calculado de único/cuota no entra (solo calculados de fijo)', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeCalc({ chainId: 'calc-unico', sourceChainId: null, sourceMovementId: 'tx-1' }),
        makeCalc({ chainId: 'calc-cuota', sourceChainId: null, sourceInstallmentGroupId: 'group-1' }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, STANDARD_RANGE, undefined, STANDARD_TODAY);
      expect(result.lines).toEqual([]);
      expect(result.excluded).toEqual([]);
    });

    it('origen anulado (skip) → el calculado hereda reason=skipped', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ chainId: 'chain-1', skippedMonths: new Set(['2026-04']) }),
        makeCalc({ chainId: 'calc-chain-1', sourceChainId: 'chain-1', formulaSign: -1 }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, STANDARD_RANGE, undefined, STANDARD_TODAY);
      const calcLine = findLine(result.lines, 'calc-chain-1');
      expect(calcLine.months[3].amountCents).toBeNull();
      expect(calcLine.months[3].reason).toBe('skipped');
    });
  });

  // -------------------------------------------------------------------------
  // frequency y origen de calculados
  // -------------------------------------------------------------------------

  describe('frequency y origen de calculados', () => {
    it('frequency: se toma de la cadena (inmutable, RF-MF-006); persiste igual tras un split', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ id: 'row-1', startMonth: '2026-01', deletedFrom: '2026-06', amountCents: 100000, frequency: 3 }),
        makeFijo({ id: 'row-2', startMonth: '2026-06', deletedFrom: null, amountCents: 150000, frequency: 3 }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, STANDARD_RANGE, undefined, STANDARD_TODAY);
      const line = findLine(result.lines, 'chain-1');
      expect(line.frequency).toBe(3);
    });

    it('línea normal (no calculada): originDescription y originChainId son null', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([makeFijo()]);
      const result = await service.getAnnualFijosReport(USER_A, STANDARD_RANGE, undefined, STANDARD_TODAY);
      const line = findLine(result.lines, 'chain-1');
      expect(line.isCalculated).toBe(false);
      expect(line.originDescription).toBeNull();
      expect(line.originChainId).toBeNull();
    });

    it('calculado con origen INCOME: originDescription/originChainId se resuelven aunque el origen (INCOME) no genere línea propia', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ chainId: 'chain-income', type: MovementType.INCOME, description: 'Sueldo', amountCents: 500000 }),
        makeCalc({
          chainId: 'calc-chain-1',
          sourceChainId: 'chain-income',
          formulaOperator: FormulaOperator.PCT,
          formulaOperand: 1000,
          formulaSign: -1,
        }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, STANDARD_RANGE, undefined, STANDARD_TODAY);
      expect(result.lines.find((l) => l.chainId === 'chain-income')).toBeUndefined();

      const calcLine = findLine(result.lines, 'calc-chain-1');
      expect(calcLine.isCalculated).toBe(true);
      expect(calcLine.originDescription).toBe('Sueldo');
      expect(calcLine.originChainId).toBe('chain-income');
    });

    it('calculado cuyo origen no se puede resolver (cadena de origen eliminada / inexistente): 0 apariciones → viaja a `excluded` (fallback defensivo + opción B)', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeCalc({ chainId: 'calc-orphan', sourceChainId: 'chain-does-not-exist' }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, STANDARD_RANGE, undefined, STANDARD_TODAY);
      expect(result.lines.find((l) => l.chainId === 'calc-orphan')).toBeUndefined();
      const excludedLine = findExcluded(result.excluded, 'calc-orphan');
      expect(excludedLine.isCalculated).toBe(true);
      expect(excludedLine.startMonth).toBe('2026-01');
    });
  });

  // -------------------------------------------------------------------------
  // Moneda — TC oficial del mes de la instancia
  // -------------------------------------------------------------------------

  describe('moneda', () => {
    it('usa el TC del mes de la instancia, no el exchangeRate guardado en la fila', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({
          currency: Currency.USD,
          exchangeRate: 1000,
          anchorCurrency: Currency.ARS,
          amountCents: 10000,
        }),
      ]);
      const pivotMap = new Map<string, { ARS: number }>();
      for (let m = 1; m <= 12; m++) {
        pivotMap.set(`2026-${String(m).padStart(2, '0')}`, { ARS: m === 1 ? 1200 : 1500 });
      }
      mockRepo.loadPivotRatesForMonths.mockResolvedValue(pivotMap);

      const result = await service.getAnnualFijosReport(USER_A, STANDARD_RANGE, undefined, STANDARD_TODAY);
      const line = findLine(result.lines, 'chain-1');
      expect(line.months[0].amountCents).toBe(10000 * 1200);
      expect(line.months[1].amountCents).toBe(10000 * 1500);
    });
  });

  // -------------------------------------------------------------------------
  // Variación (nominal / ajustada por IPC)
  // -------------------------------------------------------------------------

  describe('variación', () => {
    it('sin cambio de monto → nominalPct = 0 en todos los meses con mes anterior', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([makeFijo({ amountCents: 50000 })]);
      const result = await service.getAnnualFijosReport(USER_A, STANDARD_RANGE, undefined, STANDARD_TODAY);
      const line = findLine(result.lines, 'chain-1');
      // Sin dato del mes ancla (2025-12, fuera del rango pedido y sin historia) → primer mes null
      expect(line.months[0].nominalPct).toBeNull();
      for (let i = 1; i < 12; i++) {
        expect(line.months[i].nominalPct).toBe(0);
      }
    });

    it('el primer mes del rango efectivo usa el mes anterior (mes ancla) como base de la variación', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ startMonth: '2025-01', amountCents: 40000 }), // activo desde antes del rango, incluye el mes ancla
      ]);
      const result = await service.getAnnualFijosReport(USER_A, STANDARD_RANGE, undefined, STANDARD_TODAY);
      const line = findLine(result.lines, 'chain-1');
      expect(line.months[0].nominalPct).toBe(0);
    });

    it('ajustada por IPC: descuenta la inflación del mes; null si falta el IPC', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ id: 'row-1', startMonth: '2026-01', deletedFrom: '2026-03', amountCents: 100000 }),
        makeFijo({ id: 'row-2', chainId: 'chain-1', startMonth: '2026-03', deletedFrom: null, amountCents: 110000 }),
      ]);
      const ipcMap = new Map<string, number>([['2026-03', 10]]);
      mockRepo.loadInflationRatesForMonths.mockResolvedValue(ipcMap);

      const result = await service.getAnnualFijosReport(USER_A, STANDARD_RANGE, undefined, STANDARD_TODAY);
      const line = findLine(result.lines, 'chain-1');
      expect(line.months[2].nominalPct).toBe(10);
      expect(line.months[2].adjustedPct).toBeCloseTo(0, 2);
      expect(line.months[1].adjustedPct).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Rango efectivo — recorte a la izquierda, sin historia, borde derecho fijo
  // -------------------------------------------------------------------------

  describe('rango efectivo (recorte a la izquierda / borde derecho fijo)', () => {
    it('se pide más rango del que hay historia → el rango sale MÁS CORTO, arranca en el primer mes con historia', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ chainId: 'chain-1', startMonth: '2026-10' }), // solo 3 meses de historia (oct/nov/dic)
      ]);
      const result = await service.getAnnualFijosReport(USER_A, 36, undefined, STANDARD_TODAY);
      // Pedido: 36 meses (arrancaría en 2024-01). Recortado a partir de 2026-10.
      expect(result.startMonth).toBe('2026-10');
      expect(result.endMonth).toBe('2026-12');
      expect(result.rangeMonths).toBe(3);
      const line = findLine(result.lines, 'chain-1');
      expect(line.months).toHaveLength(3);
    });

    it('hay más historia que la pedida → NO se recorta, el rango efectivo = el pedido', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ chainId: 'chain-1', startMonth: '2020-01' }), // mucha historia
      ]);
      const result = await service.getAnnualFijosReport(USER_A, 6, undefined, STANDARD_TODAY);
      expect(result.rangeMonths).toBe(6);
      expect(result.startMonth).toBe('2026-07');
      expect(result.endMonth).toBe('2026-12');
    });

    it('sin ningún fijo (sin historia) → el rango efectivo es el pedido (nada que recortar)', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([]);
      const result = await service.getAnnualFijosReport(USER_A, 9, undefined, STANDARD_TODAY);
      expect(result.rangeMonths).toBe(9);
      expect(result.startMonth).toBe('2026-04');
      expect(result.endMonth).toBe('2026-12');
    });

    it('un fijo con alta futura (startMonth > hoy) no cuenta para el recorte, pero viaja a `excluded` (opción B: 0 apariciones)', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ chainId: 'chain-future', startMonth: '2027-05' }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, 6, undefined, STANDARD_TODAY);
      // Sin historia pasada → sin recorte, rango efectivo = el pedido.
      expect(result.rangeMonths).toBe(6);
      expect(result.startMonth).toBe('2026-07');
      // El fijo futuro no aparece en el gráfico (0 apariciones en el rango),
      // pero sí en `excluded` — el usuario debe saber que existe y desde cuándo.
      expect(result.lines).toEqual([]);
      const excludedLine = findExcluded(result.excluded, 'chain-future');
      expect(excludedLine.startMonth).toBe('2027-05');
    });

    it('el borde derecho es siempre el mes en curso: ningún punto posterior, aunque el fijo siga activo indefinidamente', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([makeFijo({ deletedFrom: null })]);
      const result = await service.getAnnualFijosReport(USER_A, STANDARD_RANGE, undefined, STANDARD_TODAY);
      expect(result.endMonth).toBe('2026-12');
      const line = findLine(result.lines, 'chain-1');
      expect(line.months[line.months.length - 1].month).toBe('2026-12');
    });
  });

  // -------------------------------------------------------------------------
  // Universo de ≥2 apariciones graficables
  // -------------------------------------------------------------------------

  describe('universo de `excluded` (opción B: 0 o 1 apariciones)', () => {
    it('0 apariciones en el rango efectivo → viaja a `excluded` con su startMonth (vigencia terminada hace años)', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ startMonth: '2024-01', deletedFrom: '2024-06' }), // vivió y murió mucho antes del rango
      ]);
      const result = await service.getAnnualFijosReport(USER_A, STANDARD_RANGE, undefined, STANDARD_TODAY);
      expect(result.lines).toEqual([]);
      const excludedLine = findExcluded(result.excluded, 'chain-1');
      expect(excludedLine.startMonth).toBe('2024-01');
      expect(excludedLine.description).toBe('Alquiler');
    });

    it('fijo anual pagado FUERA del rango pedido (mes de pago no cae en el rango efectivo) → 0 apariciones, viaja a `excluded` (caso motivador de la opción B)', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        // Fijo anual que se paga en marzo; rango de 6 meses pedido desde
        // '2026-09-25' cubre abril..septiembre → marzo queda afuera.
        makeFijo({ chainId: 'chain-annual-march', startMonth: '2020-03', frequency: 12 }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, 6, undefined, '2026-09-25');
      expect(result.startMonth).toBe('2026-04');
      expect(result.endMonth).toBe('2026-09');
      expect(result.lines).toEqual([]);
      const excludedLine = findExcluded(result.excluded, 'chain-annual-march');
      expect(excludedLine.startMonth).toBe('2020-03');
    });

    it('exactamente 1 aparición en el rango efectivo → va a `excluded`, con su startMonth (no a `lines`)', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ chainId: 'chain-single', startMonth: '2026-12', description: 'Seguro anual' }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, STANDARD_RANGE, undefined, STANDARD_TODAY);
      expect(result.lines.find((l) => l.chainId === 'chain-single')).toBeUndefined();
      const excludedLine = findExcluded(result.excluded, 'chain-single');
      expect(excludedLine.startMonth).toBe('2026-12');
      expect(excludedLine.description).toBe('Seguro anual');
      expect(excludedLine.isCalculated).toBe(false);
      expect(excludedLine.categoryId).toBe(CAT_A);
    });

    it('fijo anual (frequency 12) → dentro de un rango de 12 meses solo cae UNA aparición → excluded', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ chainId: 'chain-annual', startMonth: '2025-06', frequency: 12 }), // aparece cada junio
      ]);
      // Rango efectivo 2026-01..2026-12 (12 meses): la única aparición dentro
      // de ese tramo es junio 2026 (monthDiff('2025-06','2026-06')=12, 12%12=0).
      const result = await service.getAnnualFijosReport(USER_A, 12, undefined, STANDARD_TODAY);
      expect(result.lines.find((l) => l.chainId === 'chain-annual')).toBeUndefined();
      const excludedLine = findExcluded(result.excluded, 'chain-annual');
      expect(excludedLine.startMonth).toBe('2025-06');
    });

    it('calculado con solo 1 mes EXPENSE (el resto INCOME) → excluded', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({
          id: 'row-1',
          chainId: 'chain-1',
          startMonth: '2026-01',
          deletedFrom: '2026-12',
          amountCents: 150000, // origen alto → calculado da INCOME (hueco) ene..nov
        }),
        makeFijo({
          id: 'row-2',
          chainId: 'chain-1',
          startMonth: '2026-12',
          deletedFrom: null,
          amountCents: 50000, // origen bajo en diciembre → calculado da EXPENSE (única aparición)
        }),
        makeCalc({
          chainId: 'calc-chain-1',
          sourceChainId: 'chain-1',
          formulaOperator: FormulaOperator.SUB,
          formulaOperand: 100000,
          formulaSign: 1,
        }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, STANDARD_RANGE, undefined, STANDARD_TODAY);
      expect(result.lines.find((l) => l.chainId === 'calc-chain-1')).toBeUndefined();
      const excludedLine = findExcluded(result.excluded, 'calc-chain-1');
      expect(excludedLine.isCalculated).toBe(true);
      expect(excludedLine.startMonth).toBe('2026-01');
    });

    it('exactamente 2 apariciones → ya alcanza el umbral, entra en lines (no en excluded)', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ chainId: 'chain-two', startMonth: '2026-11' }), // nov + dic = 2 apariciones
      ]);
      const result = await service.getAnnualFijosReport(USER_A, STANDARD_RANGE, undefined, STANDARD_TODAY);
      const line = findLine(result.lines, 'chain-two');
      expect(line.months.filter((m) => m.amountCents !== null)).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // Orden de `lines` — gasto TOTAL del rango efectivo DESC
  // -------------------------------------------------------------------------

  describe('orden de lines', () => {
    it('orden: gasto TOTAL del rango efectivo DESC', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ chainId: 'chain-small', amountCents: 10000, categoryId: CAT_A }),
        makeFijo({ chainId: 'chain-big', amountCents: 90000, categoryId: CAT_A }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, STANDARD_RANGE, undefined, STANDARD_TODAY);
      expect(result.lines.map((l) => l.chainId)).toEqual(['chain-big', 'chain-small']);
    });
  });

  // -------------------------------------------------------------------------
  // Ordinal estable (independiente del rango pedido)
  // -------------------------------------------------------------------------

  describe('ordinal estable', () => {
    it('el ordinal por chainId no cambia al cambiar el rango pedido (mismo universo, distinto rangeMonths/today)', async () => {
      const fijos = [
        makeFijo({ chainId: 'chain-old', startMonth: '2024-01', createdAt: new Date('2024-01-01T00:00:00Z') }),
        makeFijo({
          id: 'row-new',
          chainId: 'chain-new',
          startMonth: '2025-01',
          createdAt: new Date('2025-01-01T00:00:00Z'),
        }),
      ];
      mockRepo.getAllFijosForAnnual.mockResolvedValue(fijos);

      const resultA = await service.getAnnualFijosReport(USER_A, 12, undefined, '2025-12-25');
      const resultB = await service.getAnnualFijosReport(USER_A, 24, undefined, STANDARD_TODAY);

      const ordinalOldA = findLine(resultA.lines, 'chain-old').ordinal;
      const ordinalNewA = findLine(resultA.lines, 'chain-new').ordinal;
      const ordinalOldB = findLine(resultB.lines, 'chain-old').ordinal;
      const ordinalNewB = findLine(resultB.lines, 'chain-new').ordinal;

      expect(ordinalOldA).toBe(ordinalOldB);
      expect(ordinalNewA).toBe(ordinalNewB);
      expect(ordinalOldA).toBeLessThan(ordinalNewA);
    });
  });
});
