/**
 * Tests unitarios de MovementsService — método getAnnualCuotasReport.
 *
 * Cubre:
 * - Estructura de la respuesta (bars, rowCount, currency, year, availableCategories)
 * - Intersección con el año: cuotas que empiezan antes, terminan después, solo en el año
 * - Cuotas EXPENSE únicamente (no INCOME — ya filtrado en el repo)
 * - Filtro de categorías (3 estados: null/[]/[ids])
 * - Packing: renglón 0 pegado al eje, reuso con ≥1 mes de descanso, nuevo renglón si no entra
 * - Packing: ejemplo canónico del roadmap (a=mar–may, b=abr–sep, c=ene–feb → row0:c+b, row1:a)
 * - Packing: barras que cruzan el año (continuesBefore/continuesAfter)
 * - installmentFrom/installmentTo: cálculo de número de cuota visible
 * - startMonthIndex/endMonthIndex: recortados al año
 * - realStartMonth/realEndMonth: rango real de la cuota (no recortado al año)
 * - amountCents: convertido a displayCurrency (coherente con P3 — TC del primer mes visible)
 * - availableCategories: universo sin filtro, orden por gasto DESC, desempate ASC por id
 * - rowCount: total de renglones usados
 * - Aislamiento por userId (RN-003)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { Currency, MovementType } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { MovementsService } from '../../../src/movements/movements.service';
import { MovementsRepository } from '../../../src/movements/movements.repository';
import { SettingsService } from '../../../src/settings/settings.service';

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
  // Método del gantt
  getAllCuotasForGantt: jest.fn(),
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

// ---------------------------------------------------------------------------
// Constantes y helpers de fixture
// ---------------------------------------------------------------------------

const USER_A = 'user-a-annual-cuotas';
const CAT_A = 'cat-a-id';
const CAT_B = 'cat-b-id';
const CAT_C = 'cat-c-id';

/** Crea un InstallmentGroupForGantt de prueba. */
function makeGroup(overrides: {
  id: string;
  startMonth: string;
  totalInstallments: number;
  categoryId?: string;
  categoryName?: string;
  categoryColor?: string;
  amountCents?: number;
  createdAt?: Date;
  currency?: string;
  exchangeRate?: number;
  anchorCurrency?: string;
  description?: string | null;
  type?: string;
}) {
  return {
    id: overrides.id,
    type: (overrides.type ?? 'EXPENSE') as MovementType,
    amountCents: overrides.amountCents ?? 10000,
    description: overrides.description ?? null,
    currency: (overrides.currency ?? 'ARS') as Currency,
    exchangeRate: overrides.exchangeRate ?? 1,
    anchorCurrency: (overrides.anchorCurrency ?? 'ARS') as Currency,
    totalInstallments: overrides.totalInstallments,
    startMonth: overrides.startMonth,
    categoryId: overrides.categoryId ?? CAT_A,
    categoryName: overrides.categoryName ?? 'Cat A',
    categoryColor: overrides.categoryColor ?? '#aaa',
    createdAt: overrides.createdAt ?? new Date('2026-01-01T00:00:00Z'),
  };
}

/** Setup de mocks básicos (sin cuotas por defecto). */
function setupDefaults(): void {
  mockRepo.getAllCuotasForGantt.mockResolvedValue([]);
  mockSettingsService.getSettings.mockResolvedValue({ defaultCurrency: Currency.ARS });
  mockRepo.loadPivotRatesForYear.mockResolvedValue(new Map());
}

// ---------------------------------------------------------------------------
// Suite principal
// ---------------------------------------------------------------------------

describe('MovementsService — getAnnualCuotasReport', () => {
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
      ],
    }).compile();

    service = module.get<MovementsService>(MovementsService);
  });

  // -------------------------------------------------------------------------
  // Estructura de la respuesta
  // -------------------------------------------------------------------------

  describe('estructura de la respuesta', () => {
    it('año vacío → bars=[], rowCount=0, availableCategories=[]', async () => {
      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      expect(result.year).toBe(2026);
      expect(result.currency).toBe(Currency.ARS);
      expect(result.bars).toEqual([]);
      expect(result.rowCount).toBe(0);
      expect(result.availableCategories).toEqual([]);
    });

    it('currency refleja la defaultCurrency del usuario', async () => {
      mockSettingsService.getSettings.mockResolvedValue({ defaultCurrency: Currency.USD });
      const result = await service.getAnnualCuotasReport(USER_A, 2026);
      expect(result.currency).toBe(Currency.USD);
    });

    it('currencyOverride sobrescribe la defaultCurrency', async () => {
      mockSettingsService.getSettings.mockResolvedValue({ defaultCurrency: Currency.ARS });
      const result = await service.getAnnualCuotasReport(USER_A, 2026, null, Currency.USD);
      expect(result.currency).toBe(Currency.USD);
    });
  });

  // -------------------------------------------------------------------------
  // Intersección con el año
  // -------------------------------------------------------------------------

  describe('intersección con el año', () => {
    it('cuota que empieza y termina dentro del año → aparece', async () => {
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2026-03', totalInstallments: 3 }), // mar–may
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      expect(result.bars).toHaveLength(1);
      expect(result.bars[0].id).toBe('g1');
    });

    it('cuota que empieza antes del año y sigue dentro → aparece con continuesBefore=true', async () => {
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2025-11', totalInstallments: 6 }), // nov25–abr26
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      expect(result.bars).toHaveLength(1);
      expect(result.bars[0].continuesBefore).toBe(true);
      expect(result.bars[0].continuesAfter).toBe(false);
    });

    it('cuota que empieza dentro del año y termina después → aparece con continuesAfter=true', async () => {
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2026-10', totalInstallments: 6 }), // oct26–mar27
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      expect(result.bars).toHaveLength(1);
      expect(result.bars[0].continuesBefore).toBe(false);
      expect(result.bars[0].continuesAfter).toBe(true);
    });

    it('cuota que abarca todo el año con exceso en ambos extremos → continuesBefore=true y continuesAfter=true', async () => {
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2025-06', totalInstallments: 24 }), // jun25–may27
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      expect(result.bars[0].continuesBefore).toBe(true);
      expect(result.bars[0].continuesAfter).toBe(true);
      expect(result.bars[0].startMonthIndex).toBe(0);
      expect(result.bars[0].endMonthIndex).toBe(11);
    });

    it('cuota que termina exactamente en diciembre del año → continuesAfter=false', async () => {
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2026-10', totalInstallments: 3 }), // oct–dic26
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      expect(result.bars[0].continuesAfter).toBe(false);
      expect(result.bars[0].endMonthIndex).toBe(11);
    });

    it('cuota que termina justo ANTES del año (no intersecta) → no aparece', async () => {
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2025-10', totalInstallments: 3 }), // oct–dic25; endMonth=2026-01 exclusivo = 2026-01 NO, termina en dic25
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);
      // startMonth='2025-10', totalInstallments=3 → endMonth=2026-01 (exclusivo).
      // visibleStartMonth ≥ yearStart? No: 2025-10 < 2026-01.
      // endMonth=2026-01 > yearStart=2026-01? No (no es estrictamente mayor).
      // Por tanto NO intersecta → no aparece.
      expect(result.bars).toHaveLength(0);
    });

    it('cuota que empieza exactamente en enero del año → startMonthIndex=0, continuesBefore=false', async () => {
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2026-01', totalInstallments: 3 }), // ene–mar26
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      expect(result.bars[0].continuesBefore).toBe(false);
      expect(result.bars[0].startMonthIndex).toBe(0);
    });

    it('cuota del año siguiente (no intersecta) → no aparece', async () => {
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2027-01', totalInstallments: 3 }),
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);
      expect(result.bars).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // startMonthIndex / endMonthIndex
  // -------------------------------------------------------------------------

  describe('startMonthIndex / endMonthIndex', () => {
    it('cuota mar–may 2026 → startMonthIndex=2, endMonthIndex=4', async () => {
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2026-03', totalInstallments: 3 }),
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      expect(result.bars[0].startMonthIndex).toBe(2); // marzo = índice 2
      expect(result.bars[0].endMonthIndex).toBe(4);   // mayo = índice 4
    });

    it('cuota ene–dic 2026 (12 cuotas) → startMonthIndex=0, endMonthIndex=11', async () => {
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2026-01', totalInstallments: 12 }),
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      expect(result.bars[0].startMonthIndex).toBe(0);
      expect(result.bars[0].endMonthIndex).toBe(11);
    });

    it('cuota que empieza en nov25 por 6 meses → visible ene26–abr26, startIdx=0, endIdx=3', async () => {
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2025-11', totalInstallments: 6 }), // nov25–abr26
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      expect(result.bars[0].startMonthIndex).toBe(0); // enero
      expect(result.bars[0].endMonthIndex).toBe(3);   // abril
    });
  });

  // -------------------------------------------------------------------------
  // installmentFrom / installmentTo
  // -------------------------------------------------------------------------

  describe('installmentFrom / installmentTo', () => {
    it('cuota que empieza en marzo → installmentFrom=1, installmentTo=3 para 3 cuotas', async () => {
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2026-03', totalInstallments: 3 }),
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      // La primera cuota visible es la cuota 1 (la del mes de startMonth)
      expect(result.bars[0].installmentFrom).toBe(1);
      expect(result.bars[0].installmentTo).toBe(3);
      expect(result.bars[0].totalInstallments).toBe(3);
    });

    it('cuota que empieza en nov25 (cuota 1=nov, 2=dic, 3=ene, 4=feb, 5=mar, 6=abr) → installmentFrom=3, installmentTo=6', async () => {
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2025-11', totalInstallments: 6 }), // nov25–abr26
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      // Cuotas visibles en 2026: ene(3), feb(4), mar(5), abr(6)
      expect(result.bars[0].installmentFrom).toBe(3);
      expect(result.bars[0].installmentTo).toBe(6);
    });

    it('cuota que empieza en oct26 por 6 meses → visible oct–dic26, installmentFrom=1, installmentTo=3', async () => {
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2026-10', totalInstallments: 6 }), // oct26–mar27
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      expect(result.bars[0].installmentFrom).toBe(1);
      expect(result.bars[0].installmentTo).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // Filtro de categorías (3 estados)
  // -------------------------------------------------------------------------

  describe('filtro de categorías', () => {
    const setupTwoGroups = () => {
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2026-01', totalInstallments: 3, categoryId: CAT_A }),
        makeGroup({ id: 'g2', startMonth: '2026-06', totalInstallments: 3, categoryId: CAT_B }),
      ]);
    };

    it('null (sin filtro) → todas las barras aparecen', async () => {
      setupTwoGroups();
      const result = await service.getAnnualCuotasReport(USER_A, 2026, null);
      expect(result.bars).toHaveLength(2);
    });

    it('[] (vacío) → bars vacío, rowCount=0', async () => {
      setupTwoGroups();
      const result = await service.getAnnualCuotasReport(USER_A, 2026, []);
      expect(result.bars).toHaveLength(0);
      expect(result.rowCount).toBe(0);
    });

    it('[CAT_A] → solo la barra de CAT_A', async () => {
      setupTwoGroups();
      const result = await service.getAnnualCuotasReport(USER_A, 2026, [CAT_A]);
      expect(result.bars).toHaveLength(1);
      expect(result.bars[0].id).toBe('g1');
    });

    it('filtro no afecta availableCategories (universo sin filtro)', async () => {
      setupTwoGroups();
      const result = await service.getAnnualCuotasReport(USER_A, 2026, [CAT_A]);
      const ids = result.availableCategories.map((c) => c.categoryId);
      expect(ids).toContain(CAT_A);
      expect(ids).toContain(CAT_B); // CAT_B fuera del filtro pero en availableCategories
    });

    it('filtro vacío: availableCategories sigue teniendo las categorías del año', async () => {
      setupTwoGroups();
      const result = await service.getAnnualCuotasReport(USER_A, 2026, []);
      expect(result.availableCategories).toHaveLength(2);
    });

    it('el packing se recalcula con el subconjunto filtrado (filtrar CAT_A puede compactar renglones)', async () => {
      // c=CAT_A ene–feb (startMonth=2026-01), a=CAT_A mar–may (startMonth=2026-03), b=CAT_B abr–sep (startMonth=2026-04)
      // Orden de packing por startMonth ASC: c, a, b
      //   - c (ene–feb, idx 0–1) → row0
      //   - a (mar–may, idx 2–4) → contra [0,1]: 2 >= 3? NO → row1
      //   - b (abr–sep, idx 3–8) → contra [0,1]: 3 >= 3 ✓ → reusa row0
      // Packing sin filtro: c→row0, b→row0, a→row1 → rowCount=2 (ejemplo canónico del roadmap)
      const groups = [
        makeGroup({ id: 'c', startMonth: '2026-01', totalInstallments: 2, categoryId: CAT_A, createdAt: new Date('2026-01-01T00:00:00Z') }), // c
        makeGroup({ id: 'b', startMonth: '2026-04', totalInstallments: 6, categoryId: CAT_B, createdAt: new Date('2026-01-02T00:00:00Z') }), // b
        makeGroup({ id: 'a', startMonth: '2026-03', totalInstallments: 3, categoryId: CAT_A, createdAt: new Date('2026-01-03T00:00:00Z') }), // a
      ];
      mockRepo.getAllCuotasForGantt.mockResolvedValue(groups);

      // Sin filtro: 3 barras en 2 renglones
      const resultAll = await service.getAnnualCuotasReport(USER_A, 2026, null);
      expect(resultAll.rowCount).toBe(2);

      // Filtrar solo CAT_B: solo b queda → 1 renglón
      mockRepo.getAllCuotasForGantt.mockResolvedValue(groups);
      const resultFiltered = await service.getAnnualCuotasReport(USER_A, 2026, [CAT_B]);
      expect(resultFiltered.bars).toHaveLength(1);
      expect(resultFiltered.rowCount).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Packing — algoritmo
  // -------------------------------------------------------------------------

  describe('packing', () => {
    it('una sola barra → rowIndex=0, rowCount=1', async () => {
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2026-03', totalInstallments: 3 }),
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      expect(result.bars[0].rowIndex).toBe(0);
      expect(result.rowCount).toBe(1);
    });

    it('dos barras que no se solapan con descanso suficiente (≥1 mes) → mismo renglón (row0)', async () => {
      // g1: ene–feb (endIdx=1), g2: abr–jun (startIdx=3)
      // Descanso: startIdx(g2)=3 >= endIdx(g1)+2=3 → cumple, reusa row0
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2026-01', totalInstallments: 2, createdAt: new Date('2026-01-01T00:00:00Z') }), // ene–feb (endIdx=1)
        makeGroup({ id: 'g2', startMonth: '2026-04', totalInstallments: 3, createdAt: new Date('2026-01-02T00:00:00Z') }), // abr–jun (startIdx=3)
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      expect(result.bars.find(b => b.id === 'g1')!.rowIndex).toBe(0);
      expect(result.bars.find(b => b.id === 'g2')!.rowIndex).toBe(0);
      expect(result.rowCount).toBe(1);
    });

    it('dos barras con exactamente 1 mes de descanso → mismo renglón (row0)', async () => {
      // g1: ene–feb (endIdx=1), g2: abr (startIdx=3)
      // 3 >= 1+2=3 → exactamente el mínimo de descanso, entra en row0
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2026-01', totalInstallments: 2, createdAt: new Date('2026-01-01T00:00:00Z') }),
        makeGroup({ id: 'g2', startMonth: '2026-04', totalInstallments: 1, createdAt: new Date('2026-01-02T00:00:00Z') }),
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      expect(result.bars.find(b => b.id === 'g1')!.rowIndex).toBe(0);
      expect(result.bars.find(b => b.id === 'g2')!.rowIndex).toBe(0);
    });

    it('dos barras con 0 meses de descanso (solapadas) → renglones distintos (row0 y row1)', async () => {
      // g1: ene–feb (endIdx=1), g2: mar–abr (startIdx=2)
      // 2 >= 1+2=3? NO → nuevo renglón
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2026-01', totalInstallments: 2, createdAt: new Date('2026-01-01T00:00:00Z') }),
        makeGroup({ id: 'g2', startMonth: '2026-03', totalInstallments: 2, createdAt: new Date('2026-01-02T00:00:00Z') }),
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      expect(result.bars.find(b => b.id === 'g1')!.rowIndex).toBe(0);
      expect(result.bars.find(b => b.id === 'g2')!.rowIndex).toBe(1);
      expect(result.rowCount).toBe(2);
    });

    it('descanso insuficiente (mar adyacente a feb sin gap) → renglón nuevo', async () => {
      // g1: ene–feb (endIdx=1), g2: mar (startIdx=2)
      // 2 >= 1+2=3? NO → row1
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2026-01', totalInstallments: 2, createdAt: new Date('2026-01-01T00:00:00Z') }),
        makeGroup({ id: 'g2', startMonth: '2026-03', totalInstallments: 1, createdAt: new Date('2026-01-02T00:00:00Z') }),
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      expect(result.bars.find(b => b.id === 'g2')!.rowIndex).toBe(1);
    });

    /**
     * Ejemplo canónico del roadmap (docs/roadmap.md §Ola 3 / P2):
     * c = ene–feb (startMonth=2026-01), a = mar–may (startMonth=2026-03), b = abr–sep (startMonth=2026-04)
     * Orden de packing por startMonth ASC: c, a, b
     *   - c (ene–feb, startIdx=0, endIdx=1) → row0; intervals=[[0,1]]
     *   - a (mar–may, startIdx=2, endIdx=4) → contra [0,1]: 2 >= 1+2=3? NO → conflicto → row1
     *   - b (abr–sep, startIdx=3, endIdx=8) → contra [0,1]: 3 >= 1+2=3 ✓ → reusa row0; intervals=[[0,1],[3,8]]
     * Resultado: row0 tiene [c, b]; row1 tiene [a] → rowCount=2
     * Nota: el repo puede entregar los grupos en cualquier orden (aquí createdAt varía),
     * el servicio los reordena por startMonth ASC antes del packing.
     */
    it('ejemplo canónico del roadmap: a=mar–may, b=abr–sep, c=ene–feb → row0:[c,b], row1:[a]', async () => {
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        // El repo entrega en orden createdAt ASC (c, b, a); el servicio reordena por startMonth (c, a, b)
        makeGroup({ id: 'c', startMonth: '2026-01', totalInstallments: 2, createdAt: new Date('2026-01-01T00:00:00Z') }), // ene–feb
        makeGroup({ id: 'b', startMonth: '2026-04', totalInstallments: 6, createdAt: new Date('2026-01-02T00:00:00Z') }), // abr–sep
        makeGroup({ id: 'a', startMonth: '2026-03', totalInstallments: 3, createdAt: new Date('2026-01-03T00:00:00Z') }), // mar–may
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      const barC = result.bars.find(b => b.id === 'c')!;
      const barB = result.bars.find(b => b.id === 'b')!;
      const barA = result.bars.find(b => b.id === 'a')!;

      // Verificar índices de mes
      expect(barC.startMonthIndex).toBe(0); // ene
      expect(barC.endMonthIndex).toBe(1);   // feb
      expect(barB.startMonthIndex).toBe(3); // abr
      expect(barB.endMonthIndex).toBe(8);   // sep
      expect(barA.startMonthIndex).toBe(2); // mar
      expect(barA.endMonthIndex).toBe(4);   // may

      // Verificar packing
      expect(barC.rowIndex).toBe(0); // c va en row0
      expect(barB.rowIndex).toBe(0); // b también cabe en row0 (descanso=1 mes entre feb y abr)
      expect(barA.rowIndex).toBe(1); // a no cabe en row0 (empieza en mar, antes de que b termine en sep+descanso)

      expect(result.rowCount).toBe(2);
    });

    it('reuso de renglón: la segunda barra en row0 actualiza los intervalos del renglón correctamente para la tercera', async () => {
      // g1: ene–feb (row0, endIdx=1); intervals=[[0,1]]
      // g2: abr–jun (row0, endIdx=5); intervals=[[0,1],[3,5]]
      // g3: ago–sep (startIdx=7): contra [0,1]: 7>=3 ✓; contra [3,5]: 7>=7 ✓ → cabe en row0
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2026-01', totalInstallments: 2, createdAt: new Date('2026-01-01T00:00:00Z') }),
        makeGroup({ id: 'g2', startMonth: '2026-04', totalInstallments: 3, createdAt: new Date('2026-01-02T00:00:00Z') }),
        makeGroup({ id: 'g3', startMonth: '2026-08', totalInstallments: 2, createdAt: new Date('2026-01-03T00:00:00Z') }),
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      expect(result.bars.find(b => b.id === 'g1')!.rowIndex).toBe(0);
      expect(result.bars.find(b => b.id === 'g2')!.rowIndex).toBe(0);
      expect(result.bars.find(b => b.id === 'g3')!.rowIndex).toBe(0);
      expect(result.rowCount).toBe(1);
    });

    it('tres barras todas solapadas entre sí → 3 renglones distintos', async () => {
      // g1: ene–dic (todo el año)
      // g2: mar–sep
      // g3: jun (un mes)
      // Todas en row0: no, g2 no puede (solapada con g1 que termina en dic).
      // g2 en row1, g3 en row2 (solapada con ambas anteriores).
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2026-01', totalInstallments: 12, createdAt: new Date('2026-01-01T00:00:00Z') }),
        makeGroup({ id: 'g2', startMonth: '2026-03', totalInstallments: 7, createdAt: new Date('2026-01-02T00:00:00Z') }),
        makeGroup({ id: 'g3', startMonth: '2026-06', totalInstallments: 1, createdAt: new Date('2026-01-03T00:00:00Z') }),
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      expect(result.bars.find(b => b.id === 'g1')!.rowIndex).toBe(0);
      expect(result.bars.find(b => b.id === 'g2')!.rowIndex).toBe(1);
      expect(result.bars.find(b => b.id === 'g3')!.rowIndex).toBe(2);
      expect(result.rowCount).toBe(3);
    });

    /**
     * Caso de hueco intermedio (bug corregido):
     * El algoritmo anterior solo comparaba contra el ÚLTIMO end del renglón,
     * ignorando huecos entre barras ya asignadas. El nuevo algoritmo verifica
     * contra TODOS los intervalos del renglón y aprovecha los huecos.
     *
     * Ejemplo del bug report:
     *   X = ene–feb (idx 0–1, startMonth=2026-01)
     *   Z = abr–may (idx 3–4, startMonth=2026-04)
     *   Y = nov–dic (idx 10–11, startMonth=2026-11)
     *
     * Orden de packing por startMonth ASC: X, Z, Y
     *   - X (0–1) → row0: intervals=[[0,1]]
     *   - Z (3–4) → row0: contra [0,1]: 3 >= 1+2=3 ✓ → cabe; intervals=[[0,1],[3,4]]
     *   - Y (10–11) → row0: contra [0,1]: 10 >= 3 ✓; contra [3,4]: 10 >= 4+2=6 ✓ → CABE (hueco)
     * Resultado: 1 renglón con X, Z, Y (el algoritmo anterior abría 2 renglones).
     */
    it('hueco intermedio (bug fix): X=ene–feb, Y=nov–dic, Z=abr–may → todos en row0 (1 renglón)', async () => {
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'X', startMonth: '2026-01', totalInstallments: 2, createdAt: new Date('2026-01-01T00:00:00Z') }), // ene–feb, idx 0–1
        makeGroup({ id: 'Y', startMonth: '2026-11', totalInstallments: 2, createdAt: new Date('2026-01-02T00:00:00Z') }), // nov–dic, idx 10–11
        makeGroup({ id: 'Z', startMonth: '2026-04', totalInstallments: 2, createdAt: new Date('2026-01-03T00:00:00Z') }), // abr–may, idx 3–4
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      const barX = result.bars.find(b => b.id === 'X')!;
      const barY = result.bars.find(b => b.id === 'Y')!;
      const barZ = result.bars.find(b => b.id === 'Z')!;

      // Z cabe en el hueco de row0 entre X (termina feb=1) e Y (empieza nov=10)
      // Verificación: s(Z)=3 >= e(X)+2=3 ✓ y e(Z)=4 <= s(Y)-2=8 ✓ → no conflicto con ninguno
      expect(barX.rowIndex).toBe(0);
      expect(barY.rowIndex).toBe(0);
      expect(barZ.rowIndex).toBe(0);
      expect(result.rowCount).toBe(1);
    });

    it('hueco intermedio: barra que no cabe en el hueco (muy grande) va a renglón nuevo', async () => {
      // Orden por startMonth ASC: X(ene,01) → Z(abr,04) → Y(jun,06)
      //   - X (ene–feb, idx 0–1) → row0: intervals=[[0,1]]
      //   - Z (abr–ago, idx 3–7) → contra [0,1]: 3>=1+2=3 ✓ → cabe en row0; intervals=[[0,1],[3,7]]
      //   - Y (jun–dic, idx 5–11) → contra [0,1]: 5>=3 ✓; contra [3,7]: 5<=3-2=1? NO → conflicto → row1
      // Resultado: row0=[X,Z], row1=[Y]
      // Nota: con el viejo orden createdAt (X,Y,Z) el resultado era row0=[X,Y], row1=[Z].
      // El nuevo criterio (startMonth) produce el resultado correcto según la spec.
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'X', startMonth: '2026-01', totalInstallments: 2, createdAt: new Date('2026-01-01T00:00:00Z') }), // ene–feb, idx 0–1
        makeGroup({ id: 'Y', startMonth: '2026-06', totalInstallments: 7, createdAt: new Date('2026-01-02T00:00:00Z') }), // jun–dic, idx 5–11
        makeGroup({ id: 'Z', startMonth: '2026-04', totalInstallments: 5, createdAt: new Date('2026-01-03T00:00:00Z') }), // abr–ago, idx 3–7
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      const barX = result.bars.find(b => b.id === 'X')!;
      const barY = result.bars.find(b => b.id === 'Y')!;
      const barZ = result.bars.find(b => b.id === 'Z')!;

      expect(barX.rowIndex).toBe(0);
      expect(barZ.rowIndex).toBe(0); // Z entra antes que Y (startMonth abr < jun) → cabe en row0
      expect(barY.rowIndex).toBe(1); // Y no cabe en el hueco: se solapa con Z
      expect(result.rowCount).toBe(2);
    });

    it('hueco intermedio: orden de creación fuera de orden temporal explota huecos correctamente', async () => {
      // Barras entregadas por el repo en orden createdAt ASC (no startMonth ASC).
      // El servicio las reordena por startMonth ASC: B (ene–feb, idx 0–1), C (abr–may, idx 3–4), A (sep–oct, idx 8–9)
      // Packing por startMonth ASC:
      //   - B (0–1) → row0: intervals=[[0,1]]
      //   - C (3–4) → row0: contra [0,1]: 3 >= 1+2=3 ✓ → cabe; intervals=[[0,1],[3,4]]
      //   - A (8–9) → row0: contra [0,1]: 8 >= 3 ✓; contra [3,4]: 8 >= 4+2=6 ✓ → cabe
      // Resultado: todos en row0 → rowCount=1
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'A', startMonth: '2026-09', totalInstallments: 2, createdAt: new Date('2026-01-01T00:00:00Z') }), // sep–oct, idx 8–9
        makeGroup({ id: 'B', startMonth: '2026-01', totalInstallments: 2, createdAt: new Date('2026-01-02T00:00:00Z') }), // ene–feb, idx 0–1
        makeGroup({ id: 'C', startMonth: '2026-04', totalInstallments: 2, createdAt: new Date('2026-01-03T00:00:00Z') }), // abr–may, idx 3–4
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      const barA = result.bars.find(b => b.id === 'A')!;
      const barB = result.bars.find(b => b.id === 'B')!;
      const barC = result.bars.find(b => b.id === 'C')!;

      expect(barA.rowIndex).toBe(0);
      expect(barB.rowIndex).toBe(0);
      expect(barC.rowIndex).toBe(0);
      expect(result.rowCount).toBe(1);
    });

    it('descanso exacto al límite del hueco: 1 mes de descanso a ambos lados del hueco → cabe', async () => {
      // X = ene (idx 0–0), Y = may–dic (idx 4–11)
      // Z = mar (idx 2–2):
      //   contra X: s(Z)=2 >= e(X)+2=0+2=2 ✓ (descanso exacto de 1 mes: feb libre)
      //   contra Y: e(Z)=2 <= s(Y)-2=4-2=2 ✓ (descanso exacto de 1 mes: abr libre)
      // Z cabe en el hueco de row0.
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'X', startMonth: '2026-01', totalInstallments: 1, createdAt: new Date('2026-01-01T00:00:00Z') }), // ene, idx 0
        makeGroup({ id: 'Y', startMonth: '2026-05', totalInstallments: 8, createdAt: new Date('2026-01-02T00:00:00Z') }), // may–dic, idx 4–11
        makeGroup({ id: 'Z', startMonth: '2026-03', totalInstallments: 1, createdAt: new Date('2026-01-03T00:00:00Z') }), // mar, idx 2
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      const barX = result.bars.find(b => b.id === 'X')!;
      const barY = result.bars.find(b => b.id === 'Y')!;
      const barZ = result.bars.find(b => b.id === 'Z')!;

      expect(barX.rowIndex).toBe(0);
      expect(barY.rowIndex).toBe(0);
      expect(barZ.rowIndex).toBe(0); // cabe con descanso exacto de 1 mes a ambos lados
      expect(result.rowCount).toBe(1);
    });

    it('hueco demasiado estrecho (0 meses de descanso a un lado) → no cabe, va a renglón nuevo', async () => {
      // Orden por startMonth ASC: X(ene,01) → Z(abr,04) → Y(may,05)
      //   - X (ene–feb, idx 0–1) → row0: intervals=[[0,1]]
      //   - Z (abr, idx 3–3) → contra [0,1]: 3>=1+2=3 ✓ → cabe en row0; intervals=[[0,1],[3,3]]
      //   - Y (may–dic, idx 4–11) → contra [0,1]: 4>=3 ✓; contra [3,3]: 4<=3-2=1? NO → conflicto → row1
      // Z cabe en row0; Y no cabe porque queda adyacente a Z (abr=3, may=4, gap=0 meses).
      // Nota: con el viejo orden createdAt (X,Y,Z) el resultado era Z→row1; ahora es Y→row1.
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'X', startMonth: '2026-01', totalInstallments: 2, createdAt: new Date('2026-01-01T00:00:00Z') }), // ene–feb, idx 0–1
        makeGroup({ id: 'Y', startMonth: '2026-05', totalInstallments: 8, createdAt: new Date('2026-01-02T00:00:00Z') }), // may–dic, idx 4–11
        makeGroup({ id: 'Z', startMonth: '2026-04', totalInstallments: 1, createdAt: new Date('2026-01-03T00:00:00Z') }), // abr, idx 3
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      const barX = result.bars.find(b => b.id === 'X')!;
      const barY = result.bars.find(b => b.id === 'Y')!;
      const barZ = result.bars.find(b => b.id === 'Z')!;

      // Z (abr, startMonth anterior a Y) entra primero y cabe en row0
      expect(barX.rowIndex).toBe(0);
      expect(barZ.rowIndex).toBe(0); // Z entra antes (startMonth abr < may)
      // Y está adyacente a Z (abr=3, may=4, gap=0 meses) → no cabe en row0
      expect(barY.rowIndex).toBe(1);
      expect(result.rowCount).toBe(2);
    });

    /**
     * Fija que el criterio de packing es startMonth (origen), NO createdAt.
     * Caso donde el orden createdAt ASC y el orden startMonth ASC difieren:
     *   - P createdAt=1er, startMonth=2026-06 (jun)
     *   - Q createdAt=2do, startMonth=2026-01 (ene)
     * Orden por createdAt ASC: P, Q → P (jun, idx 5) → row0; Q (ene–feb, idx 0–1) → row0? 1 <= 5-2=3 ✓ → row0.
     * Orden por startMonth ASC: Q, P → Q (ene–feb, idx 0–1) → row0; P (jun, idx 5) → 5 >= 1+2=3 ✓ → row0.
     * Ambos dan row0 para las dos barras (rowCount=1), pero el orden de procesamiento
     * cambia: con startMonth, Q se procesa primero (row0 más cercano al eje).
     * Este caso valida el orden procesando primero el que empieza antes.
     */
    it('orden por startMonth manda sobre createdAt: la cuota con startMonth anterior va a row0 primero', async () => {
      // P creada 1er, empieza más tarde (jun). Q creada 2da, empieza antes (ene).
      // Con orden por startMonth: Q procesa primero, P después. Ambas en row0.
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'P', startMonth: '2026-06', totalInstallments: 2, createdAt: new Date('2026-01-01T00:00:00Z') }), // jun–jul, idx 5–6
        makeGroup({ id: 'Q', startMonth: '2026-01', totalInstallments: 2, createdAt: new Date('2026-01-02T00:00:00Z') }), // ene–feb, idx 0–1
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      const barP = result.bars.find(b => b.id === 'P')!;
      const barQ = result.bars.find(b => b.id === 'Q')!;

      // Ambas en row0 (no se solapan, hay descanso: mar–may libre entre feb y jun)
      expect(barQ.rowIndex).toBe(0); // Q empieza antes → row0 (más cercano al eje)
      expect(barP.rowIndex).toBe(0); // P también cabe en row0 (empieza después de Q con descanso)
      expect(result.rowCount).toBe(1);
    });

    it('orden por startMonth manda: cuando createdAt diría row1 pero startMonth diría row0, manda startMonth', async () => {
      // Escenario donde el orden createdAt daría un resultado distinto al orden startMonth.
      // Con orden createdAt ASC: R(jul), S(ene), T(abr) → R→row0, S→row0 (1 <= 5-2=3 ✓), T→row0 (3>=3 ✓ vs S, 5<=5-2=3? NO vs R → conflicto con R → row1)
      // Con orden startMonth ASC: S(ene), T(abr), R(jul) → S→row0, T→row0 (3>=0+2=2 ✓), R→row0 (6>=3+2=5 ✓ vs T, también ✓ vs S) → todos en row0.
      // El nuevo criterio (startMonth ASC) produce rowCount=1; el viejo (createdAt) produciría rowCount=2.
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'R', startMonth: '2026-07', totalInstallments: 2, createdAt: new Date('2026-01-01T00:00:00Z') }), // jul–ago, idx 6–7
        makeGroup({ id: 'S', startMonth: '2026-01', totalInstallments: 2, createdAt: new Date('2026-01-02T00:00:00Z') }), // ene–feb, idx 0–1
        makeGroup({ id: 'T', startMonth: '2026-04', totalInstallments: 2, createdAt: new Date('2026-01-03T00:00:00Z') }), // abr–may, idx 3–4
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      const barR = result.bars.find(b => b.id === 'R')!;
      const barS = result.bars.find(b => b.id === 'S')!;
      const barT = result.bars.find(b => b.id === 'T')!;

      // Orden startMonth: S(ene)→row0, T(abr, 3>=1+2=3 ✓)→row0, R(jul, 6>=4+2=6 ✓)→row0
      expect(barS.rowIndex).toBe(0);
      expect(barT.rowIndex).toBe(0);
      expect(barR.rowIndex).toBe(0);
      // Si el orden fuera createdAt el resultado sería rowCount=2 (T iría a row1)
      expect(result.rowCount).toBe(1);
    });

    /**
     * Cuota que arranca el año anterior debe quedar más abajo (row0 más cercano al eje)
     * que una que arranca dentro del año pedido.
     * prev = nov 2025 (startMonth='2025-11', año anterior), curr = feb 2026 (startMonth='2026-02').
     * Orden por startMonth ASC: prev primero (más antigua), curr después (más reciente).
     * prev ocupa ene–abr 2026 (visible, startIdx=0, endIdx=3). curr empieza en jun → no solapa.
     * Ambas caben en row0 (descanso ≥1 mes entre abr=3 y jun=5: 5 >= 3+2=5 ✓).
     */
    it('cuota que arranca el año anterior queda en row0 (más cercana al eje) que una que arranca dentro del año', async () => {
      // prev: startMonth=2025-11 (noviembre del año anterior), visible en 2026: ene–abr (startIdx=0, endIdx=3)
      // curr: startMonth=2026-06 (dentro del año), visible: jun–jul (startIdx=5, endIdx=6)
      // Orden por startMonth ASC: prev (2025-11) < curr (2026-06) → prev primero.
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'curr', startMonth: '2026-06', totalInstallments: 2, createdAt: new Date('2026-01-01T00:00:00Z') }), // curr creada antes en createdAt
        makeGroup({ id: 'prev', startMonth: '2025-11', totalInstallments: 6, createdAt: new Date('2026-01-02T00:00:00Z') }), // prev: nov25–abr26
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      const barPrev = result.bars.find(b => b.id === 'prev')!;
      const barCurr = result.bars.find(b => b.id === 'curr')!;

      // prev arranca antes en el tiempo → se procesa primero → row0 (más cercano al eje)
      // curr arranca después pero cabe en row0 también (hay descanso entre abr=3 y jun=5: 5>=5 ✓)
      expect(barPrev.rowIndex).toBe(0);
      expect(barCurr.rowIndex).toBe(0);
      expect(result.rowCount).toBe(1);
      // Verificar que prev fue procesado primero (arranca en año anterior)
      expect(barPrev.continuesBefore).toBe(true);
      expect(barPrev.startMonthIndex).toBe(0); // visible desde ene
    });
  });

  // -------------------------------------------------------------------------
  // Barras que cruzan el año (continuesBefore / continuesAfter)
  // -------------------------------------------------------------------------

  describe('continuesBefore / continuesAfter y packing con barras recortadas', () => {
    it('barra que empieza antes del año: startMonthIndex=0 y packing considera el endMonthIndex recortado', async () => {
      // Cuota desde nov25 por 12 cuotas → nov25–oct26 (termina en oct26)
      // Visible en 2026: ene–oct → startIdx=0, endIdx=9
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2025-11', totalInstallments: 12 }),
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      expect(result.bars[0].startMonthIndex).toBe(0);
      expect(result.bars[0].endMonthIndex).toBe(9); // octubre
      expect(result.bars[0].continuesBefore).toBe(true);
      expect(result.bars[0].continuesAfter).toBe(false);
    });

    it('barra que empieza antes y termina después: ocupa 0–11, continuesBefore=true, continuesAfter=true', async () => {
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2025-01', totalInstallments: 36 }), // ene25–dic27
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      expect(result.bars[0].startMonthIndex).toBe(0);
      expect(result.bars[0].endMonthIndex).toBe(11);
      expect(result.bars[0].continuesBefore).toBe(true);
      expect(result.bars[0].continuesAfter).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // amountCents: conversión usando TC del primer mes visible
  // -------------------------------------------------------------------------

  describe('amountCents — conversión', () => {
    it('ARS sin conversión: amountCents == amountCents del grupo', async () => {
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2026-03', totalInstallments: 3, amountCents: 50000 }),
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      expect(result.bars[0].amountCents).toBe(50000);
    });

    it('USD a ARS: usa el TC del startMonth si cae en el año', async () => {
      // amountCents=100 USD, TC de marzo 2026 = 1 USD = 1200 ARS → 100*1200=120000 ARS
      const pivotMap = new Map<string, { ARS?: number; BRL?: number; EUR?: number }>();
      pivotMap.set('2026-03', { ARS: 1200 });
      pivotMap.set('2026-04', { ARS: 1500 }); // diferente, no debe usarse
      pivotMap.set('2026-05', { ARS: 1500 });
      mockRepo.loadPivotRatesForYear.mockResolvedValue(pivotMap);

      mockSettingsService.getSettings.mockResolvedValue({ defaultCurrency: Currency.ARS });
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({
          id: 'g1',
          startMonth: '2026-03',
          totalInstallments: 3,
          amountCents: 100,
          currency: 'USD',
          exchangeRate: 1,
          anchorCurrency: 'USD',
        }),
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      // convertToDisplayCurrencyByMonth(100, USD, ARS, rates_03, 1, USD)
      // anchorCurrency=USD, displayCurrency=ARS, rate_ARS=1200
      // amount_display = 100 * 1 * (1200 / 1) = 120000 (pivote USD, rate_USD=1)
      expect(result.bars[0].amountCents).toBe(120000);
    });

    it('cuota que empieza antes del año: usa TC de enero del año (no startMonth anterior)', async () => {
      // Cuota desde nov25, startMonth visible = ene26
      // TC de enero 2026 = 1 USD = 1000 ARS → amountCents = 200 USD * 1000 = 200000 ARS
      const pivotMap = new Map<string, { ARS?: number; BRL?: number; EUR?: number }>();
      pivotMap.set('2026-01', { ARS: 1000 }); // TC de enero → debe usarse
      pivotMap.set('2025-11', { ARS: 500 });  // TC de nov25 → no debe usarse (no en el map del año)
      mockRepo.loadPivotRatesForYear.mockResolvedValue(pivotMap);

      mockSettingsService.getSettings.mockResolvedValue({ defaultCurrency: Currency.ARS });
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({
          id: 'g1',
          startMonth: '2025-11',
          totalInstallments: 6, // nov25–abr26
          amountCents: 200,
          currency: 'USD',
          exchangeRate: 1,
          anchorCurrency: 'USD',
        }),
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      // Primer mes visible = ene26, TC ARS = 1000
      expect(result.bars[0].amountCents).toBe(200000);
    });
  });

  // -------------------------------------------------------------------------
  // availableCategories
  // -------------------------------------------------------------------------

  describe('availableCategories', () => {
    it('orden por suma de meses visibles (amountCents × meses) DESC, desempate ASC por categoryId', async () => {
      // CAT_A: 1 cuota, 1 mes visible → 10000 × 1 = 10000
      // CAT_B: 1 cuota, 6 meses visibles → 5000 × 6 = 30000
      // → CAT_B primero
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2026-06', totalInstallments: 1, categoryId: CAT_A, amountCents: 10000, categoryName: 'A', categoryColor: '#aaa' }),
        makeGroup({ id: 'g2', startMonth: '2026-01', totalInstallments: 6, categoryId: CAT_B, amountCents: 5000, categoryName: 'B', categoryColor: '#bbb' }),
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      expect(result.availableCategories[0].categoryId).toBe(CAT_B);
      expect(result.availableCategories[1].categoryId).toBe(CAT_A);
    });

    it('availableCategories tiene name y color correctos', async () => {
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2026-01', totalInstallments: 3, categoryId: CAT_A, categoryName: 'Comida', categoryColor: '#FF5733' }),
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      expect(result.availableCategories[0].name).toBe('Comida');
      expect(result.availableCategories[0].color).toBe('#FF5733');
    });

    it('una categoría con múltiples grupos en el año suma todos sus montos visibles', async () => {
      // 2 grupos de CAT_A (3 meses cada uno) vs 1 grupo CAT_B (12 meses)
      // CAT_A: (10000 × 3) + (10000 × 3) = 60000
      // CAT_B: 10000 × 12 = 120000
      // → CAT_B primero
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2026-01', totalInstallments: 3, categoryId: CAT_A, amountCents: 10000 }),
        makeGroup({ id: 'g2', startMonth: '2026-06', totalInstallments: 3, categoryId: CAT_A, amountCents: 10000 }),
        makeGroup({ id: 'g3', startMonth: '2026-01', totalInstallments: 12, categoryId: CAT_B, amountCents: 10000 }),
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      expect(result.availableCategories[0].categoryId).toBe(CAT_B);
      expect(result.availableCategories[1].categoryId).toBe(CAT_A);
    });
  });

  // -------------------------------------------------------------------------
  // rowCount
  // -------------------------------------------------------------------------

  describe('rowCount', () => {
    it('sin barras → rowCount=0', async () => {
      const result = await service.getAnnualCuotasReport(USER_A, 2026);
      expect(result.rowCount).toBe(0);
    });

    it('todas en un renglón → rowCount=1', async () => {
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2026-01', totalInstallments: 2, createdAt: new Date('2026-01-01T00:00:00Z') }),
        makeGroup({ id: 'g2', startMonth: '2026-05', totalInstallments: 2, createdAt: new Date('2026-01-02T00:00:00Z') }),
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);
      expect(result.rowCount).toBe(1);
    });

    it('barras solapadas → rowCount = número de renglones necesarios', async () => {
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2026-01', totalInstallments: 12, createdAt: new Date('2026-01-01T00:00:00Z') }),
        makeGroup({ id: 'g2', startMonth: '2026-01', totalInstallments: 12, createdAt: new Date('2026-01-02T00:00:00Z') }),
        makeGroup({ id: 'g3', startMonth: '2026-01', totalInstallments: 12, createdAt: new Date('2026-01-03T00:00:00Z') }),
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);
      expect(result.rowCount).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // Orden de salida de bars
  // -------------------------------------------------------------------------

  describe('orden de salida de bars', () => {
    it('bars ordenados por rowIndex ASC luego startMonthIndex ASC', async () => {
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'c', startMonth: '2026-01', totalInstallments: 2, createdAt: new Date('2026-01-01T00:00:00Z') }),
        makeGroup({ id: 'b', startMonth: '2026-04', totalInstallments: 6, createdAt: new Date('2026-01-02T00:00:00Z') }),
        makeGroup({ id: 'a', startMonth: '2026-03', totalInstallments: 3, createdAt: new Date('2026-01-03T00:00:00Z') }),
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      // Packing canónico: row0=[c,b], row1=[a]
      // Orden: row0/startIdx0(c), row0/startIdx3(b), row1/startIdx2(a)
      expect(result.bars[0].id).toBe('c');
      expect(result.bars[1].id).toBe('b');
      expect(result.bars[2].id).toBe('a');
    });
  });

  // -------------------------------------------------------------------------
  // realStartMonth / realEndMonth — rango real de la cuota (no recortado al año)
  // -------------------------------------------------------------------------

  describe('realStartMonth / realEndMonth', () => {
    it('cuota que empieza y termina dentro del año → realStartMonth/realEndMonth iguales al rango real', async () => {
      // mar–may 2026 (3 cuotas): real = '2026-03' a '2026-05'
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2026-03', totalInstallments: 3 }),
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);
      const bar = result.bars[0];

      expect(bar.realStartMonth).toBe('2026-03');
      expect(bar.realEndMonth).toBe('2026-05');
    });

    it('cuota que empieza en año anterior y termina en año posterior → realStartMonth/realEndMonth con años reales, startMonthIndex/endMonthIndex recortados a 0–11', async () => {
      // Cuota nov 2025, 18 cuotas → nov2025–abr2027
      // En el año 2026: visible ene–dic (cruza todo el año)
      // realStartMonth debe ser '2025-11' y realEndMonth '2027-04'
      // startMonthIndex=0 (ene), endMonthIndex=11 (dic)
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2025-11', totalInstallments: 18 }), // nov25–abr27
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);
      const bar = result.bars[0];

      // Rango real NO recortado
      expect(bar.realStartMonth).toBe('2025-11');
      expect(bar.realEndMonth).toBe('2027-04');
      // Índices de mes recortados al año pedido
      expect(bar.startMonthIndex).toBe(0);   // ene
      expect(bar.endMonthIndex).toBe(11);    // dic
      // Flags de cruce
      expect(bar.continuesBefore).toBe(true);
      expect(bar.continuesAfter).toBe(true);
    });

    it('cuota que empieza en año anterior y termina en el año pedido → realStartMonth con año anterior', async () => {
      // nov 2025, 6 cuotas → nov2025–abr2026
      // realStartMonth='2025-11', realEndMonth='2026-04'
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2025-11', totalInstallments: 6 }),
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);
      const bar = result.bars[0];

      expect(bar.realStartMonth).toBe('2025-11');
      expect(bar.realEndMonth).toBe('2026-04');
      expect(bar.continuesBefore).toBe(true);
      expect(bar.continuesAfter).toBe(false);
    });

    it('cuota que empieza en el año pedido y termina en año posterior → realEndMonth con año siguiente', async () => {
      // oct 2026, 6 cuotas → oct2026–mar2027
      // realStartMonth='2026-10', realEndMonth='2027-03'
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2026-10', totalInstallments: 6 }),
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);
      const bar = result.bars[0];

      expect(bar.realStartMonth).toBe('2026-10');
      expect(bar.realEndMonth).toBe('2027-03');
      expect(bar.continuesBefore).toBe(false);
      expect(bar.continuesAfter).toBe(true);
    });

    it('cuota de 1 cuota → realStartMonth == realEndMonth', async () => {
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2026-06', totalInstallments: 1 }),
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);
      const bar = result.bars[0];

      expect(bar.realStartMonth).toBe('2026-06');
      expect(bar.realEndMonth).toBe('2026-06');
    });
  });

  // -------------------------------------------------------------------------
  // Aislamiento por userId (RN-003)
  // -------------------------------------------------------------------------

  describe('aislamiento por userId (RN-003)', () => {
    it('pasa el userId correcto a getAllCuotasForGantt y loadPivotRatesForYear', async () => {
      await service.getAnnualCuotasReport(USER_A, 2026);

      expect(mockRepo.getAllCuotasForGantt).toHaveBeenCalledWith(USER_A);
      expect(mockRepo.loadPivotRatesForYear).toHaveBeenCalledWith(2026);
    });
  });

  // -------------------------------------------------------------------------
  // Shape de cada barra: no debe incluir name/color (el front los resuelve)
  // -------------------------------------------------------------------------

  describe('shape de cada barra', () => {
    it('bar no incluye categoryName ni categoryColor (solo categoryId)', async () => {
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2026-01', totalInstallments: 3, categoryId: CAT_A, categoryName: 'Comida', categoryColor: '#FF0000' }),
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      const bar = result.bars[0];
      expect(bar).toHaveProperty('id');
      expect(bar).toHaveProperty('description');
      expect(bar).toHaveProperty('categoryId');
      expect(bar).toHaveProperty('amountCents');
      expect(bar).toHaveProperty('startMonthIndex');
      expect(bar).toHaveProperty('endMonthIndex');
      expect(bar).toHaveProperty('continuesBefore');
      expect(bar).toHaveProperty('continuesAfter');
      expect(bar).toHaveProperty('installmentFrom');
      expect(bar).toHaveProperty('installmentTo');
      expect(bar).toHaveProperty('totalInstallments');
      expect(bar).toHaveProperty('rowIndex');
      expect(bar).toHaveProperty('realStartMonth');
      expect(bar).toHaveProperty('realEndMonth');
      // No debe exponer name/color (el front los resuelve desde availableCategories)
      expect(bar).not.toHaveProperty('categoryName');
      expect(bar).not.toHaveProperty('categoryColor');
    });

    it('description se expone en la barra (puede ser null)', async () => {
      mockRepo.getAllCuotasForGantt.mockResolvedValue([
        makeGroup({ id: 'g1', startMonth: '2026-01', totalInstallments: 1, description: 'Notebook cuotas' }),
        makeGroup({ id: 'g2', startMonth: '2026-05', totalInstallments: 1, description: null, createdAt: new Date('2026-01-02T00:00:00Z') }),
      ]);

      const result = await service.getAnnualCuotasReport(USER_A, 2026);

      const b1 = result.bars.find(b => b.id === 'g1')!;
      const b2 = result.bars.find(b => b.id === 'g2')!;
      expect(b1.description).toBe('Notebook cuotas');
      expect(b2.description).toBeNull();
    });
  });
});
