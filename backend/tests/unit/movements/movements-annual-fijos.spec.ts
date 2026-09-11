/**
 * Tests unitarios de MovementsService — método getAnnualFijosReport (RF-REP-013,
 * card "fixed-evolution" / Detalle histórico de gastos fijos).
 *
 * Cubre:
 * - Estructura de la respuesta (lines, currency, year, earliestYear, latestYear)
 * - Fijo mensual vigente todo el año → 12 puntos
 * - Alcance: solo Fijo + EXPENSE (fijos INCOME no entran)
 * - frequency > 1 → mes sin aparición, reason 'frequency', no parte la línea
 * - Mes anulado (RecurringSkip) → reason 'skipped'
 * - Fijo que arranca a mitad de año → reason 'beforeStart' antes del alta
 * - Fijo dado de baja (deletedFrom) → reason 'afterEnd' después de la baja
 * - Recomposición de cadena con splits: una sola línea, cambio de monto = escalón
 * - Calculado de fijo: línea propia, solo meses EXPENSE, 'resultedIncome' si INCOME
 * - Calculado con monto derivado 0 → punto presente con amountCents=0 (no hueco)
 * - Moneda: TC oficial del mes de la instancia (no el exchangeRate guardado)
 * - Variación nominal y ajustada por IPC, incluida enero contra diciembre del año previo
 * - Universo del año: solo cadenas con aparición en el año pedido
 * - frequency: se toma de la cadena, inmutable tras split (RF-MF-006)
 * - originDescription / originChainId: resueltos contra el universo completo del
 *   usuario (no solo `lines`) — origen INCOME, origen sin aparición ese año, origen
 *   no resoluble (línea excluida), línea normal (ambos null)
 * - Orden de líneas: gasto anual DESC
 * - ordinal: estable, independiente del año pedido
 * - earliestYear / latestYear (topes de navegación propios de la card)
 * - Aislamiento: no filtra por categorías (no expone ese parámetro)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { Currency, FormulaOperator, MovementType } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import {
  MovementsService,
  FixedEvolutionLine,
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
  loadPivotRatesForYear: jest.fn(),
  loadInflationRatesForYear: jest.fn(),
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
  mockRepo.loadPivotRatesForYear.mockResolvedValue(new Map());
  mockRepo.loadInflationRatesForYear.mockResolvedValue(new Map());
  mockSettingsService.getSettings.mockResolvedValue({ defaultCurrency: Currency.ARS });
}

function findLine(lines: FixedEvolutionLine[], chainId: string): FixedEvolutionLine {
  const line = lines.find((l) => l.chainId === chainId);
  if (!line) throw new Error(`Línea no encontrada para chainId=${chainId}`);
  return line;
}

describe('MovementsService — getAnnualFijosReport (RF-REP-013)', () => {
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
    it('sin fijos → lines vacío, earliestYear null, latestYear = año en curso', async () => {
      const result = await service.getAnnualFijosReport(USER_A, 2026, undefined, '2026-06-25');
      expect(result.year).toBe(2026);
      expect(result.currency).toBe(Currency.ARS);
      expect(result.lines).toEqual([]);
      expect(result.earliestYear).toBeNull();
      expect(result.latestYear).toBe(2026);
    });

    it('currency refleja la defaultCurrency del usuario; override la sobrescribe', async () => {
      mockSettingsService.getSettings.mockResolvedValue({ defaultCurrency: Currency.USD });
      const result = await service.getAnnualFijosReport(USER_A, 2026);
      expect(result.currency).toBe(Currency.USD);

      const result2 = await service.getAnnualFijosReport(USER_A, 2026, Currency.EUR);
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
      const result = await service.getAnnualFijosReport(USER_A, 2026);
      expect(result.lines).toEqual([]);
    });

    it('fijo mensual vigente todo el año → 12 puntos, todos presentes', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([makeFijo()]);
      const result = await service.getAnnualFijosReport(USER_A, 2026);
      const line = findLine(result.lines, 'chain-1');
      expect(line.months).toHaveLength(12);
      line.months.forEach((m) => {
        expect(m.amountCents).toBe(100000);
        expect(m.reason).toBeNull();
      });
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
      const result = await service.getAnnualFijosReport(USER_A, 2026);
      const line = findLine(result.lines, 'chain-1');

      // enero (idx0), abril (idx3), julio (idx6), octubre (idx9) presentes
      [0, 3, 6, 9].forEach((idx) => {
        expect(line.months[idx].amountCents).toBe(100000);
        expect(line.months[idx].reason).toBeNull();
      });
      // el resto ausente por frecuencia
      [1, 2, 4, 5, 7, 8, 10, 11].forEach((idx) => {
        expect(line.months[idx].amountCents).toBeNull();
        expect(line.months[idx].reason).toBe('frequency');
      });
    });

    it('mes anulado (RecurringSkip) → reason=skipped', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ skippedMonths: new Set(['2026-03']) }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, 2026);
      const line = findLine(result.lines, 'chain-1');
      expect(line.months[2].amountCents).toBeNull();
      expect(line.months[2].reason).toBe('skipped');
      // el resto del año sigue presente (hueco interno, no parte la línea)
      expect(line.months[0].amountCents).toBe(100000);
      expect(line.months[3].amountCents).toBe(100000);
    });

    it('fijo que arranca a mitad de año → reason=beforeStart antes del alta', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ startMonth: '2026-07' }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, 2026);
      const line = findLine(result.lines, 'chain-1');
      // ene..jun ausentes por beforeStart
      for (let i = 0; i < 6; i++) {
        expect(line.months[i].amountCents).toBeNull();
        expect(line.months[i].reason).toBe('beforeStart');
      }
      // jul..dic presentes
      for (let i = 6; i < 12; i++) {
        expect(line.months[i].amountCents).toBe(100000);
      }
      expect(line.startMonth).toBe('2026-07');
    });

    it('fijo dado de baja (deletedFrom) → reason=afterEnd después de la baja; no continúa en cero', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ deletedFrom: '2026-09' }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, 2026);
      const line = findLine(result.lines, 'chain-1');
      // ene..ago presentes
      for (let i = 0; i < 8; i++) {
        expect(line.months[i].amountCents).toBe(100000);
      }
      // sep..dic ausentes por afterEnd (NO cero)
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
      const result = await service.getAnnualFijosReport(USER_A, 2026);
      // Una sola línea para el chainId, no dos
      expect(result.lines).toHaveLength(1);
      const line = findLine(result.lines, 'chain-1');
      for (let i = 0; i < 5; i++) {
        expect(line.months[i].amountCents).toBe(100000);
      }
      for (let i = 5; i < 12; i++) {
        expect(line.months[i].amountCents).toBe(150000);
      }
      // startMonth de la cadena = primera fila (no la vigente)
      expect(line.startMonth).toBe('2026-01');
      expect(line.endMonth).toBeNull();
      // El escalón se ve como variación nominal en el mes del cambio (junio, idx5)
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
          formulaOperand: 1000, // 10% → positivo → deriva INCOME (por RN-018, signo define el tipo)
          formulaSign: -1, // negativo → EXPENSE
        }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, 2026);
      const calcLine = findLine(result.lines, 'calc-chain-1');
      expect(calcLine.isCalculated).toBe(true);
      calcLine.months.forEach((m) => {
        expect(m.amountCents).toBe(10000); // 10% de 100000
        expect(m.reason).toBeNull();
      });
    });

    it('calculado que cambia de dirección: EXPENSE en un tramo, INCOME (resultedIncome) en otro', async () => {
      // SUB con operando fijo: origen bajo → resultado negativo (EXPENSE);
      // origen alto → resultado positivo (INCOME). El monto del origen cambia
      // por split (misma cadena), el calculado "cambia de dirección" mes a mes.
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
      const result = await service.getAnnualFijosReport(USER_A, 2026);
      const calcLine = findLine(result.lines, 'calc-chain-1');
      // ene..jun: origen=50000 → 50000-100000=-50000 → EXPENSE, magnitud 50000
      for (let i = 0; i < 6; i++) {
        expect(calcLine.months[i].amountCents).toBe(50000);
        expect(calcLine.months[i].reason).toBeNull();
      }
      // jul..dic: origen=150000 → 150000-100000=50000 → INCOME → hueco, no cero
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
          formulaOperand: 100000, // origen - 100000 = 0
          formulaSign: 1,
        }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, 2026);
      const calcLine = findLine(result.lines, 'calc-chain-1');
      expect(calcLine.months[0].amountCents).toBe(0);
      expect(calcLine.months[0].reason).toBeNull();
    });

    it('calculado de único/cuota no entra (solo calculados de fijo)', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeCalc({
          chainId: 'calc-unico',
          sourceChainId: null,
          sourceMovementId: 'tx-1',
        }),
        makeCalc({
          chainId: 'calc-cuota',
          sourceChainId: null,
          sourceInstallmentGroupId: 'group-1',
        }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, 2026);
      expect(result.lines).toEqual([]);
    });

    it('origen anulado (skip) → el calculado hereda reason=skipped', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ chainId: 'chain-1', skippedMonths: new Set(['2026-04']) }),
        makeCalc({ chainId: 'calc-chain-1', sourceChainId: 'chain-1', formulaSign: -1 }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, 2026);
      const calcLine = findLine(result.lines, 'calc-chain-1');
      expect(calcLine.months[3].amountCents).toBeNull();
      expect(calcLine.months[3].reason).toBe('skipped');
    });
  });

  // -------------------------------------------------------------------------
  // frequency y origen de calculados (contrato de front — tooltip "Frecuencia"
  // y "↳ desde {Origen}")
  // -------------------------------------------------------------------------

  describe('frequency y origen de calculados', () => {
    it('frequency: se toma de la cadena (inmutable, RF-MF-006); persiste igual tras un split', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({
          id: 'row-1',
          startMonth: '2026-01',
          deletedFrom: '2026-06',
          amountCents: 100000,
          frequency: 3,
        }),
        makeFijo({
          id: 'row-2',
          startMonth: '2026-06',
          deletedFrom: null,
          amountCents: 150000,
          frequency: 3,
        }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, 2026);
      const line = findLine(result.lines, 'chain-1');
      expect(line.frequency).toBe(3);
    });

    it('línea normal (no calculada): originDescription y originChainId son null', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([makeFijo()]);
      const result = await service.getAnnualFijosReport(USER_A, 2026);
      const line = findLine(result.lines, 'chain-1');
      expect(line.isCalculated).toBe(false);
      expect(line.originDescription).toBeNull();
      expect(line.originChainId).toBeNull();
    });

    it('calculado con origen INCOME: originDescription/originChainId se resuelven aunque el origen (INCOME) no genere línea propia', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({
          chainId: 'chain-income',
          type: MovementType.INCOME,
          description: 'Sueldo',
          amountCents: 500000,
        }),
        makeCalc({
          chainId: 'calc-chain-1',
          sourceChainId: 'chain-income',
          formulaOperator: FormulaOperator.PCT,
          formulaOperand: 1000, // 10%
          formulaSign: -1, // negativo → EXPENSE
        }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, 2026);
      // El origen (INCOME) no aparece como línea propia (alcance EXPENSE-only)
      expect(result.lines.find((l) => l.chainId === 'chain-income')).toBeUndefined();

      const calcLine = findLine(result.lines, 'calc-chain-1');
      expect(calcLine.isCalculated).toBe(true);
      expect(calcLine.originDescription).toBe('Sueldo');
      expect(calcLine.originChainId).toBe('chain-income');
    });

    it('calculado cuyo origen no tiene ninguna aparición en el año pedido: la línea no aparece ese año; el origen se resuelve igual cuando el calculado sí tiene puntos (universo completo, no restringido a `lines`)', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({
          chainId: 'chain-future',
          startMonth: '2027-01',
          description: 'Seguro nuevo',
          amountCents: 80000,
        }),
        makeCalc({
          chainId: 'calc-chain-1',
          sourceChainId: 'chain-future',
          startMonth: '2027-01',
          formulaSign: -1,
        }),
      ]);

      // 2026: el origen todavía no arrancó (alta en 2027) → sin aparición ese
      // año → el calculado tampoco puede derivar ningún monto → línea ausente.
      const result2026 = await service.getAnnualFijosReport(USER_A, 2026);
      expect(result2026.lines.find((l) => l.chainId === 'calc-chain-1')).toBeUndefined();

      // 2027: origen y calculado coinciden → la línea aparece y el origen se
      // resuelve contra el universo completo (`getAllFijosForAnnual`, sin
      // filtro de año), no contra las líneas ya armadas para este año.
      const result2027 = await service.getAnnualFijosReport(USER_A, 2027);
      const calcLine = findLine(result2027.lines, 'calc-chain-1');
      expect(calcLine.originDescription).toBe('Seguro nuevo');
      expect(calcLine.originChainId).toBe('chain-future');
    });

    it('calculado cuyo origen no se puede resolver (cadena de origen eliminada / inexistente): la línea completa queda excluida (fallback defensivo — el origen debería existir siempre por FK lógica)', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeCalc({ chainId: 'calc-orphan', sourceChainId: 'chain-does-not-exist' }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, 2026);
      expect(result.lines.find((l) => l.chainId === 'calc-orphan')).toBeUndefined();
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
          exchangeRate: 1000, // guardado: irrelevante para fijos (P3)
          anchorCurrency: Currency.ARS,
          amountCents: 10000, // 100.00 USD
        }),
      ]);
      // TC oficial: enero=1200, resto=1500 (varía dentro del año)
      const pivotMap = new Map<string, { ARS: number }>();
      for (let m = 1; m <= 12; m++) {
        pivotMap.set(`2026-${String(m).padStart(2, '0')}`, { ARS: m === 1 ? 1200 : 1500 });
      }
      mockRepo.loadPivotRatesForYear.mockImplementation((year: number) =>
        Promise.resolve(year === 2026 ? pivotMap : new Map()),
      );

      const result = await service.getAnnualFijosReport(USER_A, 2026);
      const line = findLine(result.lines, 'chain-1');
      // enero: 10000 centavos USD * 1200 (rate ARS/USD) = 12,000,000 centavos ARS
      expect(line.months[0].amountCents).toBe(10000 * 1200);
      // febrero: TC distinto → monto distinto pese a mismo monto en USD
      expect(line.months[1].amountCents).toBe(10000 * 1500);
    });
  });

  // -------------------------------------------------------------------------
  // Variación (nominal / ajustada por IPC)
  // -------------------------------------------------------------------------

  describe('variación', () => {
    it('sin cambio de monto → nominalPct = 0 en todos los meses con mes anterior', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([makeFijo({ amountCents: 50000 })]);
      const result = await service.getAnnualFijosReport(USER_A, 2026);
      const line = findLine(result.lines, 'chain-1');
      // Sin dato de diciembre del año previo → enero no tiene mes anterior → null
      expect(line.months[0].nominalPct).toBeNull();
      for (let i = 1; i < 12; i++) {
        expect(line.months[i].nominalPct).toBe(0);
      }
    });

    it('enero usa diciembre del año previo como mes anterior de la línea', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ startMonth: '2025-01', amountCents: 40000 }), // activo desde 2025, incluye dic-2025
      ]);
      const result = await service.getAnnualFijosReport(USER_A, 2026);
      const line = findLine(result.lines, 'chain-1');
      // Mismo monto todo el tiempo → variación 0% en enero también
      expect(line.months[0].nominalPct).toBe(0);
    });

    it('ajustada por IPC: descuenta la inflación del mes; null si falta el IPC', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({
          id: 'row-1',
          startMonth: '2026-01',
          deletedFrom: '2026-03',
          amountCents: 100000,
        }),
        makeFijo({
          id: 'row-2',
          chainId: 'chain-1',
          startMonth: '2026-03',
          deletedFrom: null,
          amountCents: 110000, // +10% nominal en marzo
        }),
      ]);
      const ipcMap = new Map<string, number>([
        ['2026-03', 10], // IPC de marzo = 10% → variación ajustada = 0%
      ]);
      mockRepo.loadInflationRatesForYear.mockResolvedValue(ipcMap);

      const result = await service.getAnnualFijosReport(USER_A, 2026);
      const line = findLine(result.lines, 'chain-1');
      expect(line.months[2].nominalPct).toBe(10); // (110000/100000 - 1) * 100
      // 110000 / (100000 * 1.10) - 1 = 0 (toBeCloseTo por el artefacto de punto flotante de 1.10)
      expect(line.months[2].adjustedPct).toBeCloseTo(0, 2);
      // Febrero no tiene IPC cargado → adjustedPct null (aunque nominalPct sea 0)
      expect(line.months[1].adjustedPct).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Universo del año y orden
  // -------------------------------------------------------------------------

  describe('universo del año pedido', () => {
    it('cadena sin ninguna aparición en el año pedido → excluida de lines', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ startMonth: '2024-01', deletedFrom: '2024-06' }), // vivió y murió en 2024
      ]);
      const result = await service.getAnnualFijosReport(USER_A, 2026);
      expect(result.lines).toEqual([]);
      // Pero sigue contando para earliestYear (universo propio de la card)
      expect(result.earliestYear).toBe(2024);
    });

    it('orden de líneas: gasto anual DESC', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ chainId: 'chain-small', amountCents: 10000, categoryId: CAT_A }),
        makeFijo({ chainId: 'chain-big', amountCents: 90000, categoryId: CAT_A }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, 2026);
      expect(result.lines.map((l) => l.chainId)).toEqual(['chain-big', 'chain-small']);
    });
  });

  // -------------------------------------------------------------------------
  // Ordinal estable (independiente del año)
  // -------------------------------------------------------------------------

  describe('ordinal estable', () => {
    it('el ordinal por chainId no cambia al navegar de año (mismo universo, distinto year pedido)', async () => {
      const fijos = [
        makeFijo({
          chainId: 'chain-old',
          startMonth: '2024-01',
          createdAt: new Date('2024-01-01T00:00:00Z'),
        }),
        makeFijo({
          id: 'row-new',
          chainId: 'chain-new',
          startMonth: '2025-01',
          createdAt: new Date('2025-01-01T00:00:00Z'),
        }),
      ];
      mockRepo.getAllFijosForAnnual.mockResolvedValue(fijos);

      const result2025 = await service.getAnnualFijosReport(USER_A, 2025);
      const result2026 = await service.getAnnualFijosReport(USER_A, 2026);

      const ordinalOldIn2025 = findLine(result2025.lines, 'chain-old').ordinal;
      const ordinalNewIn2025 = findLine(result2025.lines, 'chain-new').ordinal;
      const ordinalOldIn2026 = findLine(result2026.lines, 'chain-old').ordinal;
      const ordinalNewIn2026 = findLine(result2026.lines, 'chain-new').ordinal;

      expect(ordinalOldIn2025).toBe(ordinalOldIn2026);
      expect(ordinalNewIn2025).toBe(ordinalNewIn2026);
      expect(ordinalOldIn2025).toBeLessThan(ordinalNewIn2025);
    });
  });

  // -------------------------------------------------------------------------
  // Topes de navegación de año (earliestYear / latestYear)
  // -------------------------------------------------------------------------

  describe('topes de navegación', () => {
    it('earliestYear = año del startMonth de la cadena más antigua', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ chainId: 'chain-a', startMonth: '2023-05' }),
        makeFijo({ chainId: 'chain-b', startMonth: '2025-01' }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, 2026);
      expect(result.earliestYear).toBe(2023);
    });

    it('latestYear = año en curso si no hay hechos futuros datados', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([makeFijo()]);
      const result = await service.getAnnualFijosReport(USER_A, 2026, undefined, '2026-06-25');
      expect(result.latestYear).toBe(2026);
    });

    it('fijo sin fin programado (deletedFrom null) NO corre el tope hacia adelante', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ deletedFrom: null }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, 2026, undefined, '2026-06-25');
      expect(result.latestYear).toBe(2026);
    });

    it('baja programada futura (deletedFrom > hoy) corre el tope hasta su año', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ deletedFrom: '2029-03' }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, 2026, undefined, '2026-06-25');
      expect(result.latestYear).toBe(2029);
    });

    it('alta futura (chain startMonth > hoy) corre el tope hasta su año', async () => {
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ chainId: 'chain-future', startMonth: '2028-11' }),
      ]);
      const result = await service.getAnnualFijosReport(USER_A, 2028, undefined, '2026-06-25');
      expect(result.latestYear).toBe(2028);
    });
  });
});
