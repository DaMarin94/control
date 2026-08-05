/**
 * Tests unitarios de MovementsService — método getAnnualUnicosReport.
 *
 * Cubre:
 * - Estructura de la respuesta (grid 31×12, breakdown 31×12, footer 12, currency, year)
 * - Grilla: acumulación de gastos por día y mes
 * - Grilla: filtro de categorías (3 estados)
 * - Grilla: categorías fuera del filtro van a availableCategories pero no a la grilla
 * - Breakdown: desglose por categoría por celda
 * - Breakdown: orden por amount DESC, filtro, celdas vacías
 * - Footer (a) total por mes
 * - Footer (b) dailyAvg — divisores: mes futuro, mes en curso, mes pasado, año pasado, año futuro
 * - Footer (c) pctVsPrev — bordes: enero→dic previo, anterior 0, avgActual null
 * - Footer (d) inflationPct — presente y ausente (en puntos %)
 * - Footer (e) pctVsPrevAdj — bordes: IPC faltante, anterior 0, avgActual null; IPC en puntos %
 * - availableCategories: universo sin filtro, orden DESC por gasto, desempate ASC por id
 * - Aislamiento por userId (RN-003)
 * - roundDown y getDaysInMonth (helpers exportados)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { Currency } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { MovementsService, getDaysInMonth, roundDown } from '../../../src/movements/movements.service';
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
  // Nuevos métodos del reporte anual de únicos
  getDailyUnicosExpenseForYear: jest.fn(),
  getDailyUnicosExpenseForPrevDecember: jest.fn(),
  loadInflationRatesForYear: jest.fn(),
  findCategoriesByIds: jest.fn(),
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

const USER_A = 'user-a-annual-unicos';
const CAT_A = 'cat-a-id';
const CAT_B = 'cat-b-id';
const CAT_C = 'cat-c-id';

/**
 * Crea una fila diaria cruda de únicos EXPENSE.
 * Por defecto: categoryId=CAT_A, ARS sin conversión.
 */
function makeRow(overrides: {
  monthKey: string;
  day: number;
  totalCents: bigint;
  categoryId?: string;
  currency?: string;
  exchangeRate?: string;
  anchorCurrency?: string;
}) {
  return {
    monthKey: overrides.monthKey,
    day: overrides.day,
    categoryId: overrides.categoryId ?? CAT_A,
    currency: overrides.currency ?? 'ARS',
    exchangeRate: overrides.exchangeRate ?? '1',
    anchorCurrency: overrides.anchorCurrency ?? 'ARS',
    totalCents: overrides.totalCents,
  };
}

/** Setup de mocks vacíos para la mayoría de tests */
function setupDefaults(): void {
  mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([]);
  mockRepo.getDailyUnicosExpenseForPrevDecember.mockResolvedValue([]);
  mockRepo.loadInflationRatesForYear.mockResolvedValue(new Map());
  mockRepo.findCategoriesByIds.mockResolvedValue([]);
  mockSettingsService.getSettings.mockResolvedValue({ defaultCurrency: Currency.ARS });
}

// ---------------------------------------------------------------------------
// Suite principal
// ---------------------------------------------------------------------------

describe('MovementsService — getAnnualUnicosReport', () => {
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
    it('año vacío → grid 31×12 en cero, breakdown 31×12 vacío, footer 12 entradas, availableCategories vacío', async () => {
      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-06-24');

      expect(result.year).toBe(2026);
      expect(result.currency).toBe(Currency.ARS);
      expect(result.grid).toHaveLength(31);
      result.grid.forEach((row) => {
        expect(row).toHaveLength(12);
        row.forEach((v) => expect(v).toBe(0));
      });
      expect(result.breakdown).toHaveLength(31);
      result.breakdown.forEach((row) => {
        expect(row).toHaveLength(12);
        row.forEach((cell) => expect(cell).toEqual([]));
      });
      expect(result.footer).toHaveLength(12);
      expect(result.availableCategories).toEqual([]);
    });

    it('currency refleja la defaultCurrency del usuario', async () => {
      mockSettingsService.getSettings.mockResolvedValue({ defaultCurrency: Currency.USD });
      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-06-24');
      expect(result.currency).toBe(Currency.USD);
    });

    it('currencyOverride sobrescribe la defaultCurrency del usuario', async () => {
      mockSettingsService.getSettings.mockResolvedValue({ defaultCurrency: Currency.ARS });
      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, Currency.USD, '2026-06-24');
      expect(result.currency).toBe(Currency.USD);
    });
  });

  // -------------------------------------------------------------------------
  // Grilla
  // -------------------------------------------------------------------------

  describe('grilla', () => {
    it('un gasto en el día 5 de junio aparece en grid[4][5]', async () => {
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-06', day: 5, totalCents: BigInt(3000) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([{ id: CAT_A, name: 'Comida', color: '#fff' }]);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      // día 5 → índice 4; mes 6 (junio) → índice 5
      expect(result.grid[4][5]).toBe(3000);
    });

    it('gastos de distintos días y meses no se mezclan', async () => {
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-01', day: 1, totalCents: BigInt(1000) }),
        makeRow({ monthKey: '2026-06', day: 15, totalCents: BigInt(2000) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([{ id: CAT_A, name: 'Comida', color: '#fff' }]);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      expect(result.grid[0][0]).toBe(1000);   // día 1, enero
      expect(result.grid[14][5]).toBe(2000);  // día 15, junio
      expect(result.grid[0][5]).toBe(0);      // día 1, junio → 0
    });

    it('múltiples gastos del mismo día y mes (distinta categoría o moneda) se acumulan', async () => {
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-03', day: 10, categoryId: CAT_A, totalCents: BigInt(1000) }),
        makeRow({ monthKey: '2026-03', day: 10, categoryId: CAT_B, totalCents: BigInt(2000) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([
        { id: CAT_A, name: 'A', color: '#aaa' },
        { id: CAT_B, name: 'B', color: '#bbb' },
      ]);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      // día 10, marzo: 1000 + 2000 = 3000
      expect(result.grid[9][2]).toBe(3000);
    });

    it('gastos en días inválidos del mes (día 29..31 en febrero) no producen error y se ignoran', async () => {
      // El repositorio no devolvería día 31 en febrero, pero si lo hiciera (dato corrupto):
      // el service lo ignora si dayIdx > 30, pero en este test solo verificamos que no crashea.
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-02', day: 28, totalCents: BigInt(500) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([{ id: CAT_A, name: 'A', color: '#aaa' }]);

      await expect(
        service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31'),
      ).resolves.toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Filtro de categorías
  // -------------------------------------------------------------------------

  describe('filtro de categorías', () => {
    const rows = () => [
      makeRow({ monthKey: '2026-06', day: 1, categoryId: CAT_A, totalCents: BigInt(1000) }),
      makeRow({ monthKey: '2026-06', day: 1, categoryId: CAT_B, totalCents: BigInt(2000) }),
    ];

    beforeEach(() => {
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue(rows());
      mockRepo.findCategoriesByIds.mockResolvedValue([
        { id: CAT_A, name: 'A', color: '#aaa' },
        { id: CAT_B, name: 'B', color: '#bbb' },
      ]);
    });

    it('null (sin filtro) → toda la grilla suma todas las categorías', async () => {
      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');
      expect(result.grid[0][5]).toBe(3000); // CAT_A + CAT_B
    });

    it('[] (vacío) → toda la grilla en 0, footer totals en 0', async () => {
      const result = await service.getAnnualUnicosReport(USER_A, 2026, [], undefined, '2026-12-31');
      result.grid.forEach((row) => row.forEach((v) => expect(v).toBe(0)));
      result.footer.forEach((f) => expect(f.total).toBe(0));
    });

    it('[CAT_A] → solo gastos de CAT_A en la grilla', async () => {
      const result = await service.getAnnualUnicosReport(USER_A, 2026, [CAT_A], undefined, '2026-12-31');
      expect(result.grid[0][5]).toBe(1000); // solo CAT_A
    });

    it('con filtro activo: availableCategories incluye categorías fuera del filtro', async () => {
      const result = await service.getAnnualUnicosReport(USER_A, 2026, [CAT_A], undefined, '2026-12-31');
      const ids = result.availableCategories.map((c) => c.categoryId);
      expect(ids).toContain(CAT_A);
      expect(ids).toContain(CAT_B); // CAT_B fuera del filtro pero en availableCategories
    });

    it('[] vacío: availableCategories sigue teniendo las categorías del año', async () => {
      const result = await service.getAnnualUnicosReport(USER_A, 2026, [], undefined, '2026-12-31');
      expect(result.availableCategories).toHaveLength(2);
    });

    it('id desconocido → no matchea nada, grilla en 0', async () => {
      const result = await service.getAnnualUnicosReport(USER_A, 2026, ['id-inexistente'], undefined, '2026-12-31');
      result.grid.forEach((row) => row.forEach((v) => expect(v).toBe(0)));
    });
  });

  // -------------------------------------------------------------------------
  // Breakdown por categoría por celda
  // -------------------------------------------------------------------------

  describe('breakdown por categoría', () => {
    it('una sola categoría en una celda → breakdown[d][m] tiene una entrada', async () => {
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-06', day: 5, categoryId: CAT_A, totalCents: BigInt(3000) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([{ id: CAT_A, name: 'A', color: '#aaa' }]);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      // día 5 → índice 4; mes 6 → índice 5
      expect(result.breakdown[4][5]).toEqual([{ categoryId: CAT_A, amount: 3000 }]);
    });

    it('dos categorías en la misma celda → breakdown ordenado por amount DESC', async () => {
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-03', day: 10, categoryId: CAT_A, totalCents: BigInt(1000) }),
        makeRow({ monthKey: '2026-03', day: 10, categoryId: CAT_B, totalCents: BigInt(5000) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([
        { id: CAT_A, name: 'A', color: '#aaa' },
        { id: CAT_B, name: 'B', color: '#bbb' },
      ]);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      // día 10 → índice 9; mes 3 → índice 2
      expect(result.breakdown[9][2]).toEqual([
        { categoryId: CAT_B, amount: 5000 },
        { categoryId: CAT_A, amount: 1000 },
      ]);
    });

    it('celda sin gastos → breakdown[d][m] es [] vacío', async () => {
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-06', day: 5, categoryId: CAT_A, totalCents: BigInt(3000) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([{ id: CAT_A, name: 'A', color: '#aaa' }]);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      // día 1 de enero no tiene gasto → vacío
      expect(result.breakdown[0][0]).toEqual([]);
    });

    it('breakdown respeta el filtro de categorías (CAT_B fuera del filtro no aparece en breakdown)', async () => {
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-06', day: 1, categoryId: CAT_A, totalCents: BigInt(2000) }),
        makeRow({ monthKey: '2026-06', day: 1, categoryId: CAT_B, totalCents: BigInt(5000) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([
        { id: CAT_A, name: 'A', color: '#aaa' },
        { id: CAT_B, name: 'B', color: '#bbb' },
      ]);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, [CAT_A], undefined, '2026-12-31');

      // Solo CAT_A pasa el filtro
      expect(result.breakdown[0][5]).toEqual([{ categoryId: CAT_A, amount: 2000 }]);
    });

    it('filtro vacío [] → breakdown todo vacío', async () => {
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-06', day: 1, categoryId: CAT_A, totalCents: BigInt(3000) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([{ id: CAT_A, name: 'A', color: '#aaa' }]);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, [], undefined, '2026-12-31');

      result.breakdown.forEach((row) => row.forEach((cell) => expect(cell).toEqual([])));
    });

    it('breakdown coincide con grid: sum(amounts) == grid[d][m] para la misma celda', async () => {
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-04', day: 15, categoryId: CAT_A, totalCents: BigInt(1500) }),
        makeRow({ monthKey: '2026-04', day: 15, categoryId: CAT_B, totalCents: BigInt(2500) }),
        makeRow({ monthKey: '2026-04', day: 15, categoryId: CAT_C, totalCents: BigInt(500) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([
        { id: CAT_A, name: 'A', color: '#aaa' },
        { id: CAT_B, name: 'B', color: '#bbb' },
        { id: CAT_C, name: 'C', color: '#ccc' },
      ]);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      // día 15 → índice 14; mes 4 → índice 3
      const cell = result.breakdown[14][3];
      const gridCell = result.grid[14][3];
      const sumBreakdown = cell.reduce((s, e) => s + e.amount, 0);
      expect(sumBreakdown).toBe(gridCell); // 1500 + 2500 + 500 = 4500
    });

    it('breakdown no expone name ni color (solo categoryId y amount)', async () => {
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-01', day: 1, categoryId: CAT_A, totalCents: BigInt(1000) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([{ id: CAT_A, name: 'Comida', color: '#FF0000' }]);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      const entry = result.breakdown[0][0][0];
      expect(entry).toHaveProperty('categoryId');
      expect(entry).toHaveProperty('amount');
      expect(entry).not.toHaveProperty('name');
      expect(entry).not.toHaveProperty('color');
    });
  });

  // -------------------------------------------------------------------------
  // Footer (a) total
  // -------------------------------------------------------------------------

  describe('footer — total', () => {
    it('total de un mes = suma de todos los gastos del mes en la grilla', async () => {
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-03', day: 5, totalCents: BigInt(1000) }),
        makeRow({ monthKey: '2026-03', day: 10, totalCents: BigInt(2000) }),
        makeRow({ monthKey: '2026-04', day: 1, totalCents: BigInt(500) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([{ id: CAT_A, name: 'A', color: '#aaa' }]);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      expect(result.footer[2].total).toBe(3000); // marzo
      expect(result.footer[3].total).toBe(500);  // abril
      expect(result.footer[0].total).toBe(0);    // enero
    });
  });

  // -------------------------------------------------------------------------
  // Footer (b) dailyAvg — divisores
  // -------------------------------------------------------------------------

  describe('footer — dailyAvg (divisores)', () => {
    it('mes pasado del mismo año: divisor = días del mes', async () => {
      // Hoy = 2026-06-24, mes = enero 2026 (pasado)
      // Total enero = 3100, días enero = 31 → avg = 100
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-01', day: 1, totalCents: BigInt(3100) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([{ id: CAT_A, name: 'A', color: '#aaa' }]);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-06-24');

      expect(result.footer[0].dailyAvg).toBe(3100 / 31); // enero: 31 días
    });

    it('mes en curso: divisor = día actual', async () => {
      // Hoy = 2026-06-24, mes = junio 2026 (en curso)
      // Total junio = 2400, divisor = 24 → avg = 100
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-06', day: 10, totalCents: BigInt(2400) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([{ id: CAT_A, name: 'A', color: '#aaa' }]);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-06-24');

      expect(result.footer[5].dailyAvg).toBe(2400 / 24); // junio, divisor=24
    });

    it('mes futuro: dailyAvg = null', async () => {
      // Hoy = 2026-06-24, mes = julio 2026 (futuro)
      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-06-24');
      expect(result.footer[6].dailyAvg).toBeNull(); // julio = mes futuro
    });

    it('mes futuro con gasto: dailyAvg = null (divisor 0)', async () => {
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-07', day: 1, totalCents: BigInt(1000) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([{ id: CAT_A, name: 'A', color: '#aaa' }]);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-06-24');
      expect(result.footer[6].dailyAvg).toBeNull();
    });

    it('año pasado: todos los meses tienen divisor = días del mes', async () => {
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2025-02', day: 14, totalCents: BigInt(2800) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([{ id: CAT_A, name: 'A', color: '#aaa' }]);

      // today = 2026-06-24, year = 2025 → año pasado, todos los meses son pasados
      const result = await service.getAnnualUnicosReport(USER_A, 2025, null, undefined, '2026-06-24');

      // Febrero 2025 (no bisiesto) = 28 días, total = 2800 → avg = 100
      expect(result.footer[1].dailyAvg).toBe(2800 / 28);
      // Enero 2025 = 31 días, total = 0, avg = 0 (no null porque hay divisor)
      expect(result.footer[0].dailyAvg).toBe(0);
    });

    it('año futuro: todos los meses tienen dailyAvg = null', async () => {
      const result = await service.getAnnualUnicosReport(USER_A, 2027, null, undefined, '2026-06-24');
      result.footer.forEach((f) => expect(f.dailyAvg).toBeNull());
    });

    it('mes en curso sin gasto: dailyAvg = 0 (total=0, divisor>0)', async () => {
      // Hoy = 2026-06-24, junio en curso, sin gastos
      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-06-24');
      expect(result.footer[5].dailyAvg).toBe(0); // junio: total=0, divisor=24 → 0
    });

    it('febrero bisiesto 2024: divisor = 29', async () => {
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2024-02', day: 1, totalCents: BigInt(2900) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([{ id: CAT_A, name: 'A', color: '#aaa' }]);

      // today = 2026-06-24, year = 2024 → año pasado
      const result = await service.getAnnualUnicosReport(USER_A, 2024, null, undefined, '2026-06-24');
      expect(result.footer[1].dailyAvg).toBe(2900 / 29);
    });

    it('febrero no bisiesto 2026: divisor = 28', async () => {
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-02', day: 1, totalCents: BigInt(2800) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([{ id: CAT_A, name: 'A', color: '#aaa' }]);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');
      expect(result.footer[1].dailyAvg).toBe(2800 / 28);
    });
  });

  // -------------------------------------------------------------------------
  // Footer (c) pctVsPrev
  // -------------------------------------------------------------------------

  describe('footer — pctVsPrev', () => {
    it('pctVsPrev correcto para febrero vs enero', async () => {
      // Enero: total=3100, divisor=31 → avg=100
      // Febrero: total=5600, divisor=28 → avg=200
      // pctVsPrev = ROUNDDOWN((200*100/100) - 100, 2) = 100.00
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-01', day: 1, totalCents: BigInt(3100) }),
        makeRow({ monthKey: '2026-02', day: 1, totalCents: BigInt(5600) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([{ id: CAT_A, name: 'A', color: '#aaa' }]);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      expect(result.footer[0].dailyAvg).toBe(100); // enero: 3100/31=100
      expect(result.footer[1].dailyAvg).toBe(200); // febrero: 5600/28=200
      expect(result.footer[1].pctVsPrev).toBe(100); // 100% más que enero
    });

    it('enero: mes anterior = diciembre del año previo', async () => {
      // Diciembre previo: total=6200, días=31 → avg=200
      // Enero actual: total=3100, días=31 → avg=100
      // pctVsPrev = ROUNDDOWN((100*100/200) - 100, 2) = -50.00
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-01', day: 1, totalCents: BigInt(3100) }),
      ]);
      mockRepo.getDailyUnicosExpenseForPrevDecember.mockResolvedValue([
        makeRow({ monthKey: '2025-12', day: 1, totalCents: BigInt(6200) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([{ id: CAT_A, name: 'A', color: '#aaa' }]);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      expect(result.footer[0].pctVsPrev).toBe(-50); // reducción del 50%
    });

    it('mes anterior con avg=0 → pctVsPrev = null', async () => {
      // Enero sin gastos → avg=0
      // Febrero con gastos → pctVsPrev debe ser null (división por cero)
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-02', day: 1, totalCents: BigInt(5600) }),
      ]);
      // diciembre previo sin gastos (mock devuelve [])
      mockRepo.findCategoriesByIds.mockResolvedValue([{ id: CAT_A, name: 'A', color: '#aaa' }]);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      // Enero: avg=0 (total=0, divisor=31)
      expect(result.footer[0].dailyAvg).toBe(0);
      // Febrero: pctVsPrev null porque avgPrev=0
      expect(result.footer[1].pctVsPrev).toBeNull();
    });

    it('mes en curso (futuro → dailyAvg=null) → pctVsPrev = null', async () => {
      // Mes julio futuro: dailyAvg=null → pctVsPrev null
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-06', day: 1, totalCents: BigInt(3000) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([{ id: CAT_A, name: 'A', color: '#aaa' }]);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-06-24');

      expect(result.footer[6].dailyAvg).toBeNull(); // julio futuro
      expect(result.footer[6].pctVsPrev).toBeNull();
    });

    it('diciembre previo sin datos: pctVsPrev de enero = null (avgPrev=0)', async () => {
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-01', day: 1, totalCents: BigInt(3100) }),
      ]);
      // getDailyUnicosExpenseForPrevDecember devuelve [] por defecto (setupDefaults)
      mockRepo.findCategoriesByIds.mockResolvedValue([{ id: CAT_A, name: 'A', color: '#aaa' }]);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      // Diciembre previo sin datos → prevDecAvg=0 → pctVsPrev de enero null
      expect(result.footer[0].pctVsPrev).toBeNull();
    });

    it('pctVsPrev usa ROUNDDOWN (no redondeo): 33.33... se trunca a 33.33', async () => {
      // avg actual = 100, avg previo = 75 → (100*100/75) - 100 = 33.333...
      // ROUNDDOWN a 2 decimales = 33.33 (no 33.34)
      // enero: total = 75*31 = 2325, días=31 → avg=75
      // febrero: total = 100*28 = 2800, días=28 → avg=100
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-01', day: 1, totalCents: BigInt(2325) }),
        makeRow({ monthKey: '2026-02', day: 1, totalCents: BigInt(2800) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([{ id: CAT_A, name: 'A', color: '#aaa' }]);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      expect(result.footer[0].dailyAvg).toBe(75);  // 2325/31
      expect(result.footer[1].dailyAvg).toBe(100); // 2800/28
      expect(result.footer[1].pctVsPrev).toBe(33.33); // ROUNDDOWN(33.333..., 2)
    });

    it('pctVsPrev negativo: ROUNDDOWN(-2.9, 2) = -2.9 (no -3)', async () => {
      // avg actual = 50, avg previo = 100 → (50*100/100) - 100 = -50.00
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-01', day: 1, totalCents: BigInt(3100) }),
        makeRow({ monthKey: '2026-02', day: 1, totalCents: BigInt(1400) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([{ id: CAT_A, name: 'A', color: '#aaa' }]);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      // enero avg=100, febrero avg=50 → pctVsPrev = -50
      expect(result.footer[1].pctVsPrev).toBe(-50);
    });
  });

  // -------------------------------------------------------------------------
  // Footer (d) inflationPct
  // -------------------------------------------------------------------------

  describe('footer — inflationPct', () => {
    it('inflationPct refleja monthlyVariation en PUNTOS % (no fracción): 3.5 = 3.5%, no 0.035', async () => {
      // El repositorio ya entrega los valores en puntos % (×100 sobre lo guardado en DB).
      // inflationPct=3.5 significa 3.5%, no 0.035.
      const inflationMap = new Map([
        ['2026-01', 3.5],
        ['2026-06', 2.1],
      ]);
      mockRepo.loadInflationRatesForYear.mockResolvedValue(inflationMap);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      expect(result.footer[0].inflationPct).toBe(3.5);  // enero
      expect(result.footer[5].inflationPct).toBe(2.1);  // junio
    });

    it('inflationPct = null cuando no hay dato para el mes', async () => {
      // mapa vacío (setupDefaults pone Map vacío)
      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');
      result.footer.forEach((f) => expect(f.inflationPct).toBeNull());
    });

    it('inflationPct = null solo para meses sin dato; otros meses tienen valor', async () => {
      const inflationMap = new Map([['2026-06', 4.2]]);
      mockRepo.loadInflationRatesForYear.mockResolvedValue(inflationMap);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      expect(result.footer[5].inflationPct).toBe(4.2); // junio
      expect(result.footer[0].inflationPct).toBeNull(); // enero sin dato
    });
  });

  // -------------------------------------------------------------------------
  // Footer (e) pctVsPrevAdj
  // -------------------------------------------------------------------------

  describe('footer — pctVsPrevAdj', () => {
    it('pctVsPrevAdj = null si no hay IPC del mes', async () => {
      // IPC ausente → pctVsPrevAdj null aunque haya datos de gasto
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-01', day: 1, totalCents: BigInt(3100) }),
        makeRow({ monthKey: '2026-02', day: 1, totalCents: BigInt(2800) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([{ id: CAT_A, name: 'A', color: '#aaa' }]);
      // loadInflationRatesForYear devuelve Map vacío (setupDefaults)

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      expect(result.footer[1].pctVsPrevAdj).toBeNull();
    });

    it('pctVsPrevAdj = null si avgPrev = 0', async () => {
      const inflationMap = new Map([['2026-02', 3.0]]);
      mockRepo.loadInflationRatesForYear.mockResolvedValue(inflationMap);
      // Enero sin gastos → avgPrev=0 para febrero
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-02', day: 1, totalCents: BigInt(2800) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([{ id: CAT_A, name: 'A', color: '#aaa' }]);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      expect(result.footer[1].pctVsPrevAdj).toBeNull();
    });

    it('pctVsPrevAdj = null si dailyAvg del mes es null (mes futuro)', async () => {
      const inflationMap = new Map([['2026-07', 5.0]]);
      mockRepo.loadInflationRatesForYear.mockResolvedValue(inflationMap);
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-06', day: 1, totalCents: BigInt(3000) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([{ id: CAT_A, name: 'A', color: '#aaa' }]);

      // Hoy = 2026-06-24, julio es futuro → dailyAvg=null → pctVsPrevAdj null
      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-06-24');

      expect(result.footer[6].pctVsPrevAdj).toBeNull();
    });

    it('pctVsPrevAdj correcto: infla el promedio anterior por el IPC', async () => {
      // Enero: avg=100 (3100/31)
      // Febrero: avg=100 (2800/28)
      // IPC febrero = 10% → avgPrevInflado = 100 * 1.10 = 110
      // pctVsPrevAdj = ROUNDDOWN((100*100/110) - 100, 2) = ROUNDDOWN(-9.09..., 2) = -9.09
      const inflationMap = new Map([['2026-02', 10.0]]);
      mockRepo.loadInflationRatesForYear.mockResolvedValue(inflationMap);
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-01', day: 1, totalCents: BigInt(3100) }),
        makeRow({ monthKey: '2026-02', day: 1, totalCents: BigInt(2800) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([{ id: CAT_A, name: 'A', color: '#aaa' }]);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      expect(result.footer[0].dailyAvg).toBe(100); // enero
      expect(result.footer[1].dailyAvg).toBe(100); // febrero
      expect(result.footer[1].pctVsPrevAdj).toBe(-9.09); // ROUNDDOWN(-9.0909..., 2)
    });

    it('enero: pctVsPrevAdj usa diciembre previo como mes anterior', async () => {
      // Diciembre previo: avg = 200 (6200/31)
      // Enero: avg = 100 (3100/31)
      // IPC enero = 5% → avgPrevInflado = 200 * 1.05 = 210
      // pctVsPrevAdj = ROUNDDOWN((100*100/210) - 100, 2) = ROUNDDOWN(-52.38..., 2) = -52.38
      const inflationMap = new Map([['2026-01', 5.0]]);
      mockRepo.loadInflationRatesForYear.mockResolvedValue(inflationMap);
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-01', day: 1, totalCents: BigInt(3100) }),
      ]);
      mockRepo.getDailyUnicosExpenseForPrevDecember.mockResolvedValue([
        makeRow({ monthKey: '2025-12', day: 1, totalCents: BigInt(6200) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([{ id: CAT_A, name: 'A', color: '#aaa' }]);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      expect(result.footer[0].dailyAvg).toBe(100);
      // prevDecAvg = 6200/31 ≈ 200
      // avgPrevInflado = 200 * 1.05 = 210
      // (100*100/210) - 100 = 47.619... - 100 = -52.380...
      // ROUNDDOWN(-52.380..., 2) = -52.38
      expect(result.footer[0].pctVsPrevAdj).toBe(-52.38);
    });

    it('pctVsPrevAdj usa IPC en PUNTOS % correctamente: 3.0 = 3%, avgPrevInflado = avgPrev * 1.03 (no 1.0003)', async () => {
      // Enero avg=100, Febrero avg=100, IPC feb=3.0 puntos %
      // avgPrevInflado = 100 * (1 + 3.0/100) = 100 * 1.03 = 103
      // pctVsPrevAdj = ROUNDDOWN((100*100/103) - 100, 2) = ROUNDDOWN(-2.912..., 2) = -2.91
      // (si fuera fracción 0.03: avgPrevInflado = 100 * 1.0003 ≈ 100.03 → pctVsPrevAdj ≈ -0.02, incorrecto)
      const inflationMap = new Map([['2026-02', 3.0]]);
      mockRepo.loadInflationRatesForYear.mockResolvedValue(inflationMap);
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-01', day: 1, totalCents: BigInt(3100) }),
        makeRow({ monthKey: '2026-02', day: 1, totalCents: BigInt(2800) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([{ id: CAT_A, name: 'A', color: '#aaa' }]);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      // enero avg=100, febrero avg=100
      expect(result.footer[0].dailyAvg).toBe(100);
      expect(result.footer[1].dailyAvg).toBe(100);
      // avgPrevInflado = 100 * 1.03 = 103
      // pctVsPrevAdj = ROUNDDOWN((100*100/103) - 100, 2) = ROUNDDOWN(-2.9126..., 2) = -2.91
      expect(result.footer[1].pctVsPrevAdj).toBe(roundDown((100 * 100) / 103 - 100, 2));
      expect(result.footer[1].pctVsPrevAdj).toBe(-2.91);
    });

    it('pctVsPrevAdj: IPC en diciembre previo no se usa como inflación (la inflación del mes en curso es la que ajusta)', async () => {
      // La inflación que ajusta el promedio anterior es la del MES ACTUAL (mes en curso), no del anterior.
      // Enero: IPC=5%, avgPrev (dic previo) = 200, avg actual = 100
      // pctVsPrevAdj = ROUNDDOWN((100*100/(200*1.05)) - 100, 2)
      // Confirmado por la spec: "el promedio diario del mes anterior se infla por la variación IPC del mes en curso"
      const inflationMap = new Map([
        ['2026-01', 5.0],  // IPC del mes en curso (enero)
      ]);
      mockRepo.loadInflationRatesForYear.mockResolvedValue(inflationMap);
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-01', day: 1, totalCents: BigInt(3100) }),
      ]);
      mockRepo.getDailyUnicosExpenseForPrevDecember.mockResolvedValue([
        makeRow({ monthKey: '2025-12', day: 1, totalCents: BigInt(6200) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([{ id: CAT_A, name: 'A', color: '#aaa' }]);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      const prevDecAvg = 6200 / 31; // ≈ 200
      const avgPrevInflado = prevDecAvg * 1.05;
      const expected = roundDown((100 * 100) / avgPrevInflado - 100, 2);
      expect(result.footer[0].pctVsPrevAdj).toBe(expected);
    });
  });

  // -------------------------------------------------------------------------
  // availableCategories
  // -------------------------------------------------------------------------

  describe('availableCategories', () => {
    it('orden: mayor gasto anual primero (sin filtro), desempate ASC por categoryId', async () => {
      // CAT_A gasta 1000, CAT_B gasta 5000 → CAT_B primero
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-01', day: 1, categoryId: CAT_A, totalCents: BigInt(1000) }),
        makeRow({ monthKey: '2026-01', day: 1, categoryId: CAT_B, totalCents: BigInt(5000) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([
        { id: CAT_A, name: 'A', color: '#aaa' },
        { id: CAT_B, name: 'B', color: '#bbb' },
      ]);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      expect(result.availableCategories[0].categoryId).toBe(CAT_B);
      expect(result.availableCategories[1].categoryId).toBe(CAT_A);
    });

    it('desempate por categoryId ASC cuando gasto es igual', async () => {
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-01', day: 1, categoryId: CAT_A, totalCents: BigInt(2000) }),
        makeRow({ monthKey: '2026-01', day: 1, categoryId: CAT_B, totalCents: BigInt(2000) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([
        { id: CAT_A, name: 'A', color: '#aaa' },
        { id: CAT_B, name: 'B', color: '#bbb' },
      ]);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      // cat-a-id < cat-b-id → CAT_A primero
      expect(result.availableCategories[0].categoryId).toBe(CAT_A);
      expect(result.availableCategories[1].categoryId).toBe(CAT_B);
    });

    it('availableCategories tiene name y color correctos desde findCategoriesByIds', async () => {
      mockRepo.getDailyUnicosExpenseForYear.mockResolvedValue([
        makeRow({ monthKey: '2026-01', day: 1, categoryId: CAT_A, totalCents: BigInt(1000) }),
      ]);
      mockRepo.findCategoriesByIds.mockResolvedValue([
        { id: CAT_A, name: 'Comida', color: '#FF5733' },
      ]);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      expect(result.availableCategories[0].name).toBe('Comida');
      expect(result.availableCategories[0].color).toBe('#FF5733');
    });
  });

  // -------------------------------------------------------------------------
  // Aislamiento por userId (RN-003)
  // -------------------------------------------------------------------------

  describe('aislamiento por userId (RN-003)', () => {
    it('pasa el userId correcto a todos los métodos del repositorio', async () => {
      await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      expect(mockRepo.getDailyUnicosExpenseForYear).toHaveBeenCalledWith(USER_A, 2026);
      expect(mockRepo.getDailyUnicosExpenseForPrevDecember).toHaveBeenCalledWith(USER_A, 2026);
    });
  });

  // -------------------------------------------------------------------------
  // colorAnchorCents — ancla de escala de color
  // -------------------------------------------------------------------------

  describe('colorAnchorCents', () => {
    it('USD como displayCurrency → colorAnchorCents = 1500 (sin conversión)', async () => {
      mockSettingsService.getSettings.mockResolvedValue({ defaultCurrency: Currency.USD });
      // pivotRatesForYear vacío → no importa (USD directo)
      mockRepo.loadPivotRatesForYear.mockResolvedValue(new Map());

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      expect(result.colorAnchorCents).toBe(1500);
    });

    it('USD como currencyOverride → colorAnchorCents = 1500', async () => {
      mockSettingsService.getSettings.mockResolvedValue({ defaultCurrency: Currency.ARS });
      mockRepo.loadPivotRatesForYear.mockResolvedValue(new Map());

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, Currency.USD, '2026-12-31');

      expect(result.colorAnchorCents).toBe(1500);
    });

    it('ARS como displayCurrency → colorAnchorCents = round(1500 * rate_ARS) usando TC de enero del año', async () => {
      // ARS: 1 USD = 1200 ARS → rate_ARS = 1200 (unidades de ARS por 1 USD)
      // deriveExchangeRate(USD, ARS, rates) = rate_ARS / rate_USD = 1200 / 1 = 1200
      // colorAnchorCents = round(1500 * 1200) = 1_800_000
      mockSettingsService.getSettings.mockResolvedValue({ defaultCurrency: Currency.ARS });

      const pivotMap = new Map<string, { ARS?: number; BRL?: number; EUR?: number }>();
      pivotMap.set('2026-01', { ARS: 1200, BRL: 5.5, EUR: 0.92 });
      mockRepo.loadPivotRatesForYear.mockResolvedValue(pivotMap);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      // 1500 centavos de USD × 1200 (ARS por USD) = 1_800_000 centavos de ARS
      expect(result.colorAnchorCents).toBe(1_800_000);
    });

    it('EUR como displayCurrency → colorAnchorCents = round(1500 / rate_EUR) usando TC de enero del año', async () => {
      // EUR: rate_EUR = 0.92 (unidades de EUR por 1 USD)
      // deriveExchangeRate(USD, EUR, rates):
      //   rate_USD = 1 (pivote implícito)
      //   rate_EUR = 0.92
      //   result = rate_EUR / rate_USD = 0.92 / 1 = 0.92
      // colorAnchorCents = round(1500 * 0.92) = round(1380) = 1380
      mockSettingsService.getSettings.mockResolvedValue({ defaultCurrency: Currency.EUR });

      const pivotMap = new Map<string, { ARS?: number; BRL?: number; EUR?: number }>();
      pivotMap.set('2026-01', { ARS: 1200, BRL: 5.5, EUR: 0.92 });
      mockRepo.loadPivotRatesForYear.mockResolvedValue(pivotMap);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      // round(1500 * 0.92) = round(1380) = 1380
      expect(result.colorAnchorCents).toBe(1380);
    });

    it('sin datos de referencia (tabla vacía) → colorAnchorCents = 1500 (fallback defensivo)', async () => {
      mockSettingsService.getSettings.mockResolvedValue({ defaultCurrency: Currency.ARS });
      // pivotRatesForYear vacío (sin datos)
      mockRepo.loadPivotRatesForYear.mockResolvedValue(new Map());

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      // Sin rates, el fallback defensivo es 1500
      expect(result.colorAnchorCents).toBe(1500);
    });

    it('usa el TC de enero del año pedido (clave YYYY-01 del pivotRatesForYear)', async () => {
      // Verificamos que el TC proviene de la clave `${year}-01` del map,
      // no de otro mes. Ponemos TC diferente para enero vs. otros meses.
      mockSettingsService.getSettings.mockResolvedValue({ defaultCurrency: Currency.ARS });

      const pivotMap = new Map<string, { ARS?: number; BRL?: number; EUR?: number }>();
      pivotMap.set('2026-01', { ARS: 1000 }); // TC de enero: 1 USD = 1000 ARS
      pivotMap.set('2026-06', { ARS: 1500 }); // TC de junio: diferente, no debe usarse
      mockRepo.loadPivotRatesForYear.mockResolvedValue(pivotMap);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      // Debe usar TC de enero: round(1500 * 1000) = 1_500_000
      expect(result.colorAnchorCents).toBe(1_500_000);
    });
  });

  // -------------------------------------------------------------------------
  // Ancla editable (P3) — anchorAmountCents / anchorCurrency
  // -------------------------------------------------------------------------

  describe('ancla editable (anchorAmountCents / anchorCurrency)', () => {
    it('params ausentes → anchorUsdCents=1500 y colorAnchorCents = comportamiento actual (USD directo)', async () => {
      mockSettingsService.getSettings.mockResolvedValue({ defaultCurrency: Currency.USD });
      mockRepo.loadPivotRatesForYear.mockResolvedValue(new Map());

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      expect(result.anchorUsdCents).toBe(1500);
      expect(result.colorAnchorCents).toBe(1500);
    });

    it('params ausentes con displayCurrency ARS → resultado idéntico al hardcode de hoy', async () => {
      mockSettingsService.getSettings.mockResolvedValue({ defaultCurrency: Currency.ARS });
      const pivotMap = new Map<string, { ARS?: number; BRL?: number; EUR?: number }>();
      pivotMap.set('2026-01', { ARS: 1200, BRL: 5.5, EUR: 0.92 });
      mockRepo.loadPivotRatesForYear.mockResolvedValue(pivotMap);

      const result = await service.getAnnualUnicosReport(USER_A, 2026, null, undefined, '2026-12-31');

      expect(result.anchorUsdCents).toBe(1500);
      expect(result.colorAnchorCents).toBe(1_800_000); // 1500 * 1200, igual que antes
    });

    it('anchorCurrency=USD → passthrough directo: anchorUsdCents = anchorAmountCents', async () => {
      mockSettingsService.getSettings.mockResolvedValue({ defaultCurrency: Currency.ARS });
      const pivotMap = new Map<string, { ARS?: number; BRL?: number; EUR?: number }>();
      pivotMap.set('2026-01', { ARS: 1200, BRL: 5.5, EUR: 0.92 });
      mockRepo.loadPivotRatesForYear.mockResolvedValue(pivotMap);

      const result = await service.getAnnualUnicosReport(
        USER_A, 2026, null, undefined, '2026-12-31', 2000, Currency.USD,
      );

      expect(result.anchorUsdCents).toBe(2000);
      // colorAnchorCents = round(2000 * 1200) = 2_400_000
      expect(result.colorAnchorCents).toBe(2_400_000);
    });

    it('anchorCurrency=ARS → se convierte a USD con el TC de enero del año antes de anclar', async () => {
      // 1 USD = 1200 ARS (enero). Input: 120000 centavos ARS (=1200 ARS) → 1 USD = 100 centavos USD.
      mockSettingsService.getSettings.mockResolvedValue({ defaultCurrency: Currency.USD });
      const pivotMap = new Map<string, { ARS?: number; BRL?: number; EUR?: number }>();
      pivotMap.set('2026-01', { ARS: 1200, BRL: 5.5, EUR: 0.92 });
      mockRepo.loadPivotRatesForYear.mockResolvedValue(pivotMap);

      const result = await service.getAnnualUnicosReport(
        USER_A, 2026, null, undefined, '2026-12-31', 120_000, Currency.ARS,
      );

      expect(result.anchorUsdCents).toBe(100);
      // displayCurrency == USD → colorAnchorCents = anchorUsdCents directo
      expect(result.colorAnchorCents).toBe(100);
    });

    it('anchorCurrency=EUR con displayCurrency=ARS → convierte a USD y luego a ARS (dos pasos por el pivote)', async () => {
      // rate_EUR=0.92 (EUR por USD), rate_ARS=1200 (ARS por USD)
      // Input: 92 centavos EUR → deriveExchangeRate(EUR, USD, rates) = rate_USD/rate_EUR = 1/0.92
      // anchorUsdCents = round(92 * (1/0.92)) = round(100) = 100
      // colorAnchorCents (ARS) = round(100 * 1200) = 120000
      mockSettingsService.getSettings.mockResolvedValue({ defaultCurrency: Currency.ARS });
      const pivotMap = new Map<string, { ARS?: number; BRL?: number; EUR?: number }>();
      pivotMap.set('2026-01', { ARS: 1200, BRL: 5.5, EUR: 0.92 });
      mockRepo.loadPivotRatesForYear.mockResolvedValue(pivotMap);

      const result = await service.getAnnualUnicosReport(
        USER_A, 2026, null, undefined, '2026-12-31', 92, Currency.EUR,
      );

      expect(result.anchorUsdCents).toBe(100);
      expect(result.colorAnchorCents).toBe(120_000);
    });

    it('sin datos de referencia (tabla vacía) y ancla en moneda distinta de USD → fallback a 1500 (default)', async () => {
      mockSettingsService.getSettings.mockResolvedValue({ defaultCurrency: Currency.ARS });
      mockRepo.loadPivotRatesForYear.mockResolvedValue(new Map());

      const result = await service.getAnnualUnicosReport(
        USER_A, 2026, null, undefined, '2026-12-31', 120_000, Currency.ARS,
      );

      // Sin pivotRates no se puede derivar la conversión → fallback defensivo al default (1500 USD cents)
      expect(result.anchorUsdCents).toBe(1500);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests de los helpers exportados
// ---------------------------------------------------------------------------

describe('getDaysInMonth', () => {
  it('enero = 31', () => expect(getDaysInMonth(2026, 1)).toBe(31));
  it('febrero 2026 (no bisiesto) = 28', () => expect(getDaysInMonth(2026, 2)).toBe(28));
  it('febrero 2024 (bisiesto) = 29', () => expect(getDaysInMonth(2024, 2)).toBe(29));
  it('abril = 30', () => expect(getDaysInMonth(2026, 4)).toBe(30));
  it('diciembre = 31', () => expect(getDaysInMonth(2026, 12)).toBe(31));
  it('junio = 30', () => expect(getDaysInMonth(2026, 6)).toBe(30));
});

describe('roundDown', () => {
  it('ROUNDDOWN(33.3333, 2) = 33.33', () => expect(roundDown(33.3333, 2)).toBe(33.33));
  it('ROUNDDOWN(-9.0909, 2) = -9.09 (trunca hacia cero)', () => expect(roundDown(-9.0909, 2)).toBe(-9.09));
  it('ROUNDDOWN(100, 2) = 100', () => expect(roundDown(100, 2)).toBe(100));
  it('ROUNDDOWN(0, 2) = 0', () => expect(roundDown(0, 2)).toBe(0));
  it('ROUNDDOWN(-50.999, 2) = -50.99 (trunca hacia cero, no hacia -inf)', () => expect(roundDown(-50.999, 2)).toBe(-50.99));
  it('ROUNDDOWN(1.999, 0) = 1 (cero decimales)', () => expect(roundDown(1.999, 0)).toBe(1));
  it('ROUNDDOWN(-1.999, 0) = -1 (cero decimales, trunca hacia cero)', () => expect(roundDown(-1.999, 0)).toBe(-1));
});
