/**
 * Tests unitarios de MovementsService — método getAnnualInflationIncomeReport.
 *
 * Cubre:
 * - Estructura de la respuesta (months 12, currency, year, earliestYear, availableCategories)
 * - inflationPct: tomado de InflationRate; null si no hay dato
 * - incomePct: variación MoM del ingreso total, truncada ROUNDDOWN 2 dec
 * - incomePct: enero usa diciembre del año previo como referencia
 * - incomePct: null si mes futuro del año en curso
 * - incomePct: null si ingreso anterior == 0
 * - incomePctAdj: ajustado por IPC; null si falta IPC, mes futuro o anterior == 0
 * - filtro de categorías (3 estados: null/[]/[ids])
 * - availableCategories: universo de categorías con INCOME en el año, sin filtro
 * - availableCategories: ignora el filtro, orden por ingreso anual DESC
 * - earliestYear: ignorado por el filtro (siempre de todos los movimientos)
 * - Tendencias lineales (incomeTrend / incomeAdjTrend):
 *   slope, intercept, points (12 valores) / null si < 2 puntos
 * - currency override
 * - Aislamiento por userId (RN-003)
 * - computeLinearTrend exportado: OLS con 2 puntos perfectos, < 2 puntos → null
 */
import { Test, TestingModule } from '@nestjs/testing';
import { Currency } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import {
  MovementsService,
  roundDown,
  computeLinearTrend,
} from '../../../src/movements/movements.service';
import { MovementsRepository } from '../../../src/movements/movements.repository';
import { SettingsService } from '../../../src/settings/settings.service';
import { SimulationsService } from '../../../src/simulations/simulations.service';

// ---------------------------------------------------------------------------
// Mocks
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
  getDailyUnicosExpenseForYear: jest.fn(),
  getDailyUnicosExpenseForPrevDecember: jest.fn(),
  loadInflationRatesForYear: jest.fn(),
  findCategoriesByIds: jest.fn(),
  getAllCuotasForGantt: jest.fn(),
  // Nuevo método del reporte inflación-ingresos
  getUnicosIncomeForMonth: jest.fn(),
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
  updateLastExchangeRate: jest.fn(),
};

const mockSimulationsService = {
  getSimulatedItemsForMonth: jest.fn().mockResolvedValue([]),
};

// ---------------------------------------------------------------------------
// Constantes y helpers de fixture
// ---------------------------------------------------------------------------

const USER_A = 'user-a-inflation-income';
const CAT_A = 'cat-a-id';
const CAT_B = 'cat-b-id';

/** Crea una fila raw de únicos (type INCOME o EXPENSE) */
function makeUnicoRow(overrides: {
  monthKey: string;
  categoryId?: string;
  categoryName?: string;
  categoryColor?: string;
  type?: string;
  totalCents: number;
  currency?: string;
  exchangeRate?: string;
  anchorCurrency?: string;
}) {
  return {
    monthKey: overrides.monthKey,
    categoryId: overrides.categoryId ?? CAT_A,
    categoryName: overrides.categoryName ?? 'Test',
    categoryColor: overrides.categoryColor ?? '#fff',
    categoryScope: 'INCOME',
    type: overrides.type ?? 'INCOME',
    currency: overrides.currency ?? 'ARS',
    exchangeRate: overrides.exchangeRate ?? '1',
    anchorCurrency: overrides.anchorCurrency ?? 'ARS',
    totalCents: BigInt(overrides.totalCents),
  };
}

/** Crea una fila de ingreso único para el mes previo (getUnicosIncomeForMonth) */
function makePrevIncomeRow(overrides: {
  categoryId?: string;
  categoryName?: string;
  categoryColor?: string;
  totalCents: number;
  currency?: string;
  exchangeRate?: string;
  anchorCurrency?: string;
}) {
  return {
    categoryId: overrides.categoryId ?? CAT_A,
    categoryName: overrides.categoryName ?? 'Test',
    categoryColor: overrides.categoryColor ?? '#fff',
    currency: overrides.currency ?? 'ARS',
    exchangeRate: overrides.exchangeRate ?? '1',
    anchorCurrency: overrides.anchorCurrency ?? 'ARS',
    totalCents: BigInt(overrides.totalCents),
  };
}

/** Setup de defaults para todos los tests */
function setupDefaults(): void {
  mockRepo.getAnnualUnicosAggregated.mockResolvedValue([]);
  mockRepo.getUnicosIncomeForMonth.mockResolvedValue([]);
  mockRepo.getAllFijosForAnnual.mockResolvedValue([]);
  mockRepo.getAllCuotasForAnnual.mockResolvedValue([]);
  mockRepo.loadInflationRatesForYear.mockResolvedValue(new Map());
  mockRepo.getEarliestYear.mockResolvedValue(null);
  mockRepo.findCategoriesByIds.mockResolvedValue([]);
  mockRepo.loadPivotRatesForYear.mockResolvedValue(new Map());
  mockSettingsService.getSettings.mockResolvedValue({ defaultCurrency: Currency.ARS });
}

// ---------------------------------------------------------------------------
// Suite principal
// ---------------------------------------------------------------------------

describe('MovementsService — getAnnualInflationIncomeReport', () => {
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
    it('año vacío → months 12 entradas, todo null/0, earliestYear null, availableCategories []', async () => {
      const result = await service.getAnnualInflationIncomeReport(
        USER_A, 2026, null, undefined, '2026-06-25',
      );

      expect(result.year).toBe(2026);
      expect(result.currency).toBe(Currency.ARS);
      expect(result.months).toHaveLength(12);
      result.months.forEach((m) => {
        expect(m.inflationPct).toBeNull();
        expect(m.incomePct).toBeNull();
        expect(m.incomePctAdj).toBeNull();
      });
      expect(result.earliestYear).toBeNull();
      expect(result.availableCategories).toEqual([]);
    });

    it('currency refleja la defaultCurrency del usuario', async () => {
      mockSettingsService.getSettings.mockResolvedValue({ defaultCurrency: Currency.USD });
      const result = await service.getAnnualInflationIncomeReport(USER_A, 2026);
      expect(result.currency).toBe(Currency.USD);
    });

    it('currencyOverride sobrescribe la defaultCurrency del usuario', async () => {
      mockSettingsService.getSettings.mockResolvedValue({ defaultCurrency: Currency.ARS });
      const result = await service.getAnnualInflationIncomeReport(USER_A, 2026, null, Currency.USD);
      expect(result.currency).toBe(Currency.USD);
    });

    it('response tiene incomeTrend e incomeAdjTrend con slope, intercept, points', async () => {
      const result = await service.getAnnualInflationIncomeReport(USER_A, 2026);
      expect(result.incomeTrend).toHaveProperty('slope');
      expect(result.incomeTrend).toHaveProperty('intercept');
      expect(result.incomeTrend).toHaveProperty('points');
      expect(result.incomeAdjTrend).toHaveProperty('slope');
    });
  });

  // -------------------------------------------------------------------------
  // inflationPct
  // -------------------------------------------------------------------------

  describe('inflationPct', () => {
    it('toma el valor de InflationRate.monthlyVariation para cada mes', async () => {
      const inflationMap = new Map([
        ['2026-01', 3.5],
        ['2026-06', 7.2],
      ]);
      mockRepo.loadInflationRatesForYear.mockResolvedValue(inflationMap);

      const result = await service.getAnnualInflationIncomeReport(
        USER_A, 2026, null, undefined, '2026-12-31',
      );

      expect(result.months[0].inflationPct).toBe(3.5);  // enero
      expect(result.months[5].inflationPct).toBe(7.2);  // junio
      expect(result.months[1].inflationPct).toBeNull(); // febrero sin dato
    });

    it('null si no hay dato de IPC para el mes', async () => {
      mockRepo.loadInflationRatesForYear.mockResolvedValue(new Map());
      const result = await service.getAnnualInflationIncomeReport(USER_A, 2026);
      result.months.forEach((m) => expect(m.inflationPct).toBeNull());
    });
  });

  // -------------------------------------------------------------------------
  // incomePct — variación MoM del ingreso total
  // -------------------------------------------------------------------------

  describe('incomePct', () => {
    it('variación positiva: ingreso actual > previo → pct positivo', async () => {
      // Enero con ingreso 12000; dic previo con ingreso 10000
      // incomePct = ROUNDDOWN((12000*100/10000) - 100, 2) = 20.00
      mockRepo.getUnicosIncomeForMonth.mockResolvedValue([
        makePrevIncomeRow({ totalCents: 10000 }),
      ]);
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', totalCents: 12000 }),
      ]);

      const result = await service.getAnnualInflationIncomeReport(
        USER_A, 2026, null, undefined, '2026-12-31',
      );

      expect(result.months[0].incomePct).toBe(20.00);
    });

    it('variación negativa: ingreso actual < previo → pct negativo', async () => {
      // Enero 8000, dic previo 10000
      // incomePct = ROUNDDOWN((8000*100/10000) - 100, 2) = -20.00
      mockRepo.getUnicosIncomeForMonth.mockResolvedValue([
        makePrevIncomeRow({ totalCents: 10000 }),
      ]);
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', totalCents: 8000 }),
      ]);

      const result = await service.getAnnualInflationIncomeReport(
        USER_A, 2026, null, undefined, '2026-12-31',
      );

      expect(result.months[0].incomePct).toBe(-20.00);
    });

    it('ROUNDDOWN trunca hacia cero (no redondea): 33.333... → 33.33', async () => {
      // Ingreso actual 10000; ingreso previo 7500
      // (10000*100/7500) - 100 = 33.3333...
      // ROUNDDOWN(33.333..., 2) = 33.33
      mockRepo.getUnicosIncomeForMonth.mockResolvedValue([
        makePrevIncomeRow({ totalCents: 7500 }),
      ]);
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', totalCents: 10000 }),
      ]);

      const result = await service.getAnnualInflationIncomeReport(
        USER_A, 2026, null, undefined, '2026-12-31',
      );

      expect(result.months[0].incomePct).toBe(33.33);
    });

    it('enero usa diciembre del año previo como referencia (getUnicosIncomeForMonth llamado con YYYY-12)', async () => {
      await service.getAnnualInflationIncomeReport(USER_A, 2026, null, undefined, '2026-12-31');
      // El repo debe ser llamado con "2025-12"
      expect(mockRepo.getUnicosIncomeForMonth).toHaveBeenCalledWith(USER_A, '2025-12');
    });

    it('null si previo == 0 (sin ingreso en el mes anterior)', async () => {
      // Dic previo: 0 (no hay filas)
      // Enero: 5000
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', totalCents: 5000 }),
      ]);

      const result = await service.getAnnualInflationIncomeReport(
        USER_A, 2026, null, undefined, '2026-12-31',
      );

      expect(result.months[0].incomePct).toBeNull(); // previo = 0
    });

    it('null para meses futuros del año en curso', async () => {
      // Today = 2026-06-25 → julio (mes 7) en adelante son futuros.
      // Inyectamos ingreso en TODOS los meses para que previo != 0 en cada mes;
      // así la única razón por la que julio..diciembre son null es que son futuros.
      mockRepo.getUnicosIncomeForMonth.mockResolvedValue([
        makePrevIncomeRow({ totalCents: 5000 }),
      ]);
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue(
        Array.from({ length: 12 }, (_, i) =>
          makeUnicoRow({ monthKey: `2026-${String(i + 1).padStart(2, '0')}`, totalCents: 6000 }),
        ),
      );

      const result = await service.getAnnualInflationIncomeReport(
        USER_A, 2026, null, undefined, '2026-06-25',
      );

      // Enero (mes 1) es pasado → tiene pct
      expect(result.months[0].incomePct).not.toBeNull();
      // Junio (mes 6) es el mes en curso (2026-06-25) → tiene pct
      expect(result.months[5].incomePct).not.toBeNull();
      // Julio (mes 7) en adelante → null (son futuros)
      expect(result.months[6].incomePct).toBeNull();
      expect(result.months[11].incomePct).toBeNull();
    });

    it('para un año pasado completo, todos los meses tienen pct (no hay futuros)', async () => {
      mockRepo.getUnicosIncomeForMonth.mockResolvedValue([
        makePrevIncomeRow({ totalCents: 5000 }),
      ]);
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue(
        Array.from({ length: 12 }, (_, i) =>
          makeUnicoRow({ monthKey: `2024-${String(i + 1).padStart(2, '0')}`, totalCents: 6000 }),
        ),
      );

      const result = await service.getAnnualInflationIncomeReport(
        USER_A, 2024, null, undefined, '2026-06-25', // 2024 < 2026
      );

      // Todos los meses de 2024 son pasados
      result.months.forEach((m) => expect(m.incomePct).not.toBeNull());
    });

    it('para un año futuro completo, todos los meses tienen pct null', async () => {
      mockRepo.getUnicosIncomeForMonth.mockResolvedValue([
        makePrevIncomeRow({ totalCents: 5000 }),
      ]);
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue(
        Array.from({ length: 12 }, (_, i) =>
          makeUnicoRow({ monthKey: `2027-${String(i + 1).padStart(2, '0')}`, totalCents: 6000 }),
        ),
      );

      const result = await service.getAnnualInflationIncomeReport(
        USER_A, 2027, null, undefined, '2026-06-25', // 2027 > 2026
      );

      result.months.forEach((m) => expect(m.incomePct).toBeNull());
    });

    it('MoM encadenado: el ingreso de febrero compara con enero, no con dic previo', async () => {
      // Dic previo: 5000
      // Enero: 10000 → incomePct = 100%
      // Febrero: 12000 → incomePct vs enero (10000): ROUNDDOWN((12000*100/10000)-100, 2) = 20.00
      mockRepo.getUnicosIncomeForMonth.mockResolvedValue([
        makePrevIncomeRow({ totalCents: 5000 }),
      ]);
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', totalCents: 10000 }),
        makeUnicoRow({ monthKey: '2026-02', totalCents: 12000 }),
      ]);

      const result = await service.getAnnualInflationIncomeReport(
        USER_A, 2026, null, undefined, '2026-12-31',
      );

      expect(result.months[0].incomePct).toBe(100.00); // enero vs dic-previo
      expect(result.months[1].incomePct).toBe(20.00);  // feb vs enero
    });
  });

  // -------------------------------------------------------------------------
  // incomePctAdj — ajustado por IPC
  // -------------------------------------------------------------------------

  describe('incomePctAdj', () => {
    it('ajusta el previo por IPC del mes en curso', async () => {
      // Dic previo: 10000; Enero: 11000; IPC enero: 5.0%
      // prevInflated = 10000 * (1 + 5/100) = 10500
      // incomePctAdj = ROUNDDOWN((11000*100/10500) - 100, 2)
      //              = ROUNDDOWN(104.7619... - 100, 2) = 4.76
      mockRepo.getUnicosIncomeForMonth.mockResolvedValue([
        makePrevIncomeRow({ totalCents: 10000 }),
      ]);
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', totalCents: 11000 }),
      ]);
      mockRepo.loadInflationRatesForYear.mockResolvedValue(
        new Map([['2026-01', 5.0]]),
      );

      const result = await service.getAnnualInflationIncomeReport(
        USER_A, 2026, null, undefined, '2026-12-31',
      );

      expect(result.months[0].incomePctAdj).toBe(4.76);
    });

    it('null si falta IPC del mes', async () => {
      mockRepo.getUnicosIncomeForMonth.mockResolvedValue([
        makePrevIncomeRow({ totalCents: 10000 }),
      ]);
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', totalCents: 11000 }),
      ]);
      // Sin IPC
      mockRepo.loadInflationRatesForYear.mockResolvedValue(new Map());

      const result = await service.getAnnualInflationIncomeReport(
        USER_A, 2026, null, undefined, '2026-12-31',
      );

      expect(result.months[0].incomePctAdj).toBeNull();
    });

    it('null si previo == 0 (aunque haya IPC)', async () => {
      // Dic previo: 0; Enero: 5000; IPC enero: 3.5%
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', totalCents: 5000 }),
      ]);
      mockRepo.loadInflationRatesForYear.mockResolvedValue(
        new Map([['2026-01', 3.5]]),
      );

      const result = await service.getAnnualInflationIncomeReport(
        USER_A, 2026, null, undefined, '2026-12-31',
      );

      expect(result.months[0].incomePctAdj).toBeNull();
    });

    it('null para meses futuros del año en curso (aunque haya IPC y previo != 0)', async () => {
      mockRepo.getUnicosIncomeForMonth.mockResolvedValue([
        makePrevIncomeRow({ totalCents: 5000 }),
      ]);
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-08', totalCents: 6000 }),
      ]);
      mockRepo.loadInflationRatesForYear.mockResolvedValue(
        new Map([['2026-08', 3.5]]),
      );

      const result = await service.getAnnualInflationIncomeReport(
        USER_A, 2026, null, undefined, '2026-06-25', // agosto es futuro
      );

      expect(result.months[7].incomePctAdj).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Filtro de categorías (3 estados)
  // -------------------------------------------------------------------------

  describe('filtro de categorías', () => {
    beforeEach(() => {
      // Dic previo: 5000 en CAT_A + 3000 en CAT_B
      mockRepo.getUnicosIncomeForMonth.mockResolvedValue([
        makePrevIncomeRow({ categoryId: CAT_A, totalCents: 5000 }),
        makePrevIncomeRow({ categoryId: CAT_B, totalCents: 3000 }),
      ]);
      // Enero: 6000 en CAT_A + 2000 en CAT_B
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', categoryId: CAT_A, totalCents: 6000 }),
        makeUnicoRow({ monthKey: '2026-01', categoryId: CAT_B, totalCents: 2000 }),
      ]);
    });

    it('null (todas las categorías) → usa todos los ingresos', async () => {
      // Dic previo total: 8000; Enero total: 8000 → incomePct = 0
      const result = await service.getAnnualInflationIncomeReport(
        USER_A, 2026, null, undefined, '2026-12-31',
      );
      // (8000*100/8000) - 100 = 0
      expect(result.months[0].incomePct).toBe(0);
    });

    it('[] (ninguna categoría) → ingresos en 0, incomePct null (previo=0)', async () => {
      const result = await service.getAnnualInflationIncomeReport(
        USER_A, 2026, [], undefined, '2026-12-31',
      );
      // Con filtro vacío, previo=0 → incomePct null
      expect(result.months[0].incomePct).toBeNull();
    });

    it('[CAT_A] → usa solo los ingresos de CAT_A', async () => {
      // Dic previo CAT_A: 5000; Enero CAT_A: 6000 → pct = 20.00
      const result = await service.getAnnualInflationIncomeReport(
        USER_A, 2026, [CAT_A], undefined, '2026-12-31',
      );
      expect(result.months[0].incomePct).toBe(20.00);
    });

    it('availableCategories NO está afectado por el filtro', async () => {
      const resultFiltered = await service.getAnnualInflationIncomeReport(
        USER_A, 2026, [CAT_A], undefined, '2026-12-31',
      );
      const resultAll = await service.getAnnualInflationIncomeReport(
        USER_A, 2026, null, undefined, '2026-12-31',
      );

      // availableCategories siempre tiene el universo completo
      const idsFiltered = resultFiltered.availableCategories.map((c) => c.categoryId);
      const idsAll = resultAll.availableCategories.map((c) => c.categoryId);
      expect(idsFiltered).toContain(CAT_A);
      expect(idsFiltered).toContain(CAT_B); // CAT_B está fuera del filtro pero sí en el universo
      expect(idsFiltered.length).toBe(idsAll.length);
    });
  });

  // -------------------------------------------------------------------------
  // availableCategories
  // -------------------------------------------------------------------------

  describe('availableCategories', () => {
    it('universo de categorías con INCOME en el año, ordenado por ingreso DESC', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', categoryId: CAT_A, categoryName: 'A', totalCents: 3000 }),
        makeUnicoRow({ monthKey: '2026-01', categoryId: CAT_B, categoryName: 'B', totalCents: 5000 }),
      ]);

      const result = await service.getAnnualInflationIncomeReport(
        USER_A, 2026, null, undefined, '2026-12-31',
      );

      expect(result.availableCategories).toHaveLength(2);
      // CAT_B tiene más ingreso anual → va primero
      expect(result.availableCategories[0].categoryId).toBe(CAT_B);
      expect(result.availableCategories[1].categoryId).toBe(CAT_A);
    });

    it('solo incluye INCOME (no EXPENSE)', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', categoryId: CAT_A, type: 'INCOME', totalCents: 5000 }),
        makeUnicoRow({ monthKey: '2026-01', categoryId: CAT_B, type: 'EXPENSE', totalCents: 3000 }),
      ]);

      const result = await service.getAnnualInflationIncomeReport(
        USER_A, 2026, null, undefined, '2026-12-31',
      );

      // Solo CAT_A (INCOME) en availableCategories
      expect(result.availableCategories).toHaveLength(1);
      expect(result.availableCategories[0].categoryId).toBe(CAT_A);
    });

    it('desempate por categoryId ASC cuando ingresos anuales son iguales', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', categoryId: 'zzz-cat', totalCents: 5000 }),
        makeUnicoRow({ monthKey: '2026-01', categoryId: 'aaa-cat', totalCents: 5000 }),
      ]);

      const result = await service.getAnnualInflationIncomeReport(
        USER_A, 2026, null, undefined, '2026-12-31',
      );

      // Mismo ingreso → orden por categoryId ASC
      expect(result.availableCategories[0].categoryId).toBe('aaa-cat');
      expect(result.availableCategories[1].categoryId).toBe('zzz-cat');
    });
  });

  // -------------------------------------------------------------------------
  // earliestYear
  // -------------------------------------------------------------------------

  describe('earliestYear', () => {
    it('refleja el valor del repo (ignorando el filtro)', async () => {
      mockRepo.getEarliestYear.mockResolvedValue(2023);
      const result = await service.getAnnualInflationIncomeReport(USER_A, 2026);
      expect(result.earliestYear).toBe(2023);
    });

    it('null si no hay movimientos', async () => {
      mockRepo.getEarliestYear.mockResolvedValue(null);
      const result = await service.getAnnualInflationIncomeReport(USER_A, 2026);
      expect(result.earliestYear).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Tendencias lineales (computeLinearTrend)
  // -------------------------------------------------------------------------

  describe('tendencias lineales', () => {
    it('con < 2 puntos no nulos → points null, slope 0', async () => {
      // Año sin ingresos → todos incomePct null → < 2 puntos
      const result = await service.getAnnualInflationIncomeReport(
        USER_A, 2026, null, undefined, '2026-12-31',
      );
      expect(result.incomeTrend.points).toBeNull();
      expect(result.incomeTrend.slope).toBe(0);
    });

    it('con ≥ 2 puntos no nulos → points array de 12 valores', async () => {
      // Inyectamos ingreso en varios meses para que haya múltiples pcts
      mockRepo.getUnicosIncomeForMonth.mockResolvedValue([
        makePrevIncomeRow({ totalCents: 5000 }),
      ]);
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', totalCents: 6000 }),
        makeUnicoRow({ monthKey: '2026-02', totalCents: 7000 }),
        makeUnicoRow({ monthKey: '2026-03', totalCents: 8000 }),
      ]);

      const result = await service.getAnnualInflationIncomeReport(
        USER_A, 2026, null, undefined, '2026-12-31',
      );

      expect(Array.isArray(result.incomeTrend.points)).toBe(true);
      expect(result.incomeTrend.points).toHaveLength(12);
    });

    it('con exactamente 1 punto no nulo → points null', async () => {
      mockRepo.getUnicosIncomeForMonth.mockResolvedValue([
        makePrevIncomeRow({ totalCents: 5000 }),
      ]);
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        // Solo enero tiene ingreso; el resto son futuros del año en curso → null
        makeUnicoRow({ monthKey: '2026-01', totalCents: 6000 }),
      ]);

      const result = await service.getAnnualInflationIncomeReport(
        USER_A, 2026, null, undefined, '2026-01-31', // hoy = ene 31, feb+ es futuro
      );

      // Solo hay 1 punto de incomePct (enero) → points null
      expect(result.incomeTrend.points).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Helper computeLinearTrend (unit)
  // -------------------------------------------------------------------------

  describe('computeLinearTrend (unit)', () => {
    it('sin puntos → slope 0, intercept 0, points null', () => {
      const result = computeLinearTrend([null, null, null, null, null, null, null, null, null, null, null, null]);
      expect(result.slope).toBe(0);
      expect(result.intercept).toBe(0);
      expect(result.points).toBeNull();
    });

    it('1 solo punto → points null', () => {
      const vals: (number | null)[] = [10, null, null, null, null, null, null, null, null, null, null, null];
      const result = computeLinearTrend(vals);
      expect(result.points).toBeNull();
    });

    it('2 puntos en x=0 e x=11 → recta perfecta slope correcto', () => {
      // y(0)=0, y(11)=11 → slope=1, intercept=0
      const vals: (number | null)[] = [0, null, null, null, null, null, null, null, null, null, null, 11];
      const result = computeLinearTrend(vals);
      expect(result.slope).toBeCloseTo(1, 5);
      expect(result.intercept).toBeCloseTo(0, 5);
      expect(result.points).toHaveLength(12);
      expect(result.points![0]).toBeCloseTo(0, 5);
      expect(result.points![11]).toBeCloseTo(11, 5);
    });

    it('todos los puntos iguales → slope 0, intercept = ese valor, points todos iguales', () => {
      const vals: (number | null)[] = Array(12).fill(5);
      const result = computeLinearTrend(vals);
      expect(result.slope).toBeCloseTo(0, 5);
      expect(result.intercept).toBeCloseTo(5, 5);
      result.points!.forEach((p) => expect(p).toBeCloseTo(5, 5));
    });
  });

  // -------------------------------------------------------------------------
  // roundDown (helper re-usado del service)
  // -------------------------------------------------------------------------

  describe('roundDown', () => {
    it('ROUNDDOWN(33.333..., 2) = 33.33 (trunca, no redondea)', () => {
      expect(roundDown(33.3333, 2)).toBe(33.33);
    });

    it('ROUNDDOWN(-20.9, 0) = -20 (trunca hacia cero, no hacia -∞)', () => {
      expect(roundDown(-20.9, 0)).toBe(-20);
    });
  });
});
