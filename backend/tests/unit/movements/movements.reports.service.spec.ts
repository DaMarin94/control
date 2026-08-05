/**
 * Tests unitarios de MovementsService — método getReportsMovements.
 * (antes getAnnualMovements; renombrado en Fase 1.1.5)
 *
 * Cubre:
 * - Respuesta tiene siempre 12 entradas en months (ene→dic), con cero donde no hay datos
 * - Totales correctos: únicos + fijos activos + cuotas del año
 * - Desglose por categoría (categories): solo EXPENSE, con 12 valores
 * - Invariante: SUM(categories[i].monthlyExpenseCents[m]) == months[m].expenseCents
 * - Orden de categories: gasto anual total DESC; desempate por categoryId ASC
 * - Categoría soft-deleted sigue en el desglose (RF-CAT-004)
 * - earliestYear correcto
 * - Aislamiento por userId (RN-003)
 * - Validación de year: faltante, formato inválido, fuera de rango → controller valida;
 *   el service recibe el año ya como número
 * - Fijos: condición de actividad correcta (startMonth/deletedFrom)
 * - Cuotas: cálculo on-the-fly correcto
 * - Filtro de categorías (Fase 1.1.5/1.1.6 — semántica de 3 estados):
 *   - null/undefined (ausente) = todas las categorías
 *   - [] (vacío explícito) = NINGUNA categoría → resultado vacío/cero
 *   - ["id1","id2",...] = solo esas categorías
 *   - earliestYear SIEMPRE ignora el filtro (límites de navegación estables)
 *   - Ids desconocidos/no existentes → simplemente no matchean (no es error)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { Currency } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { MovementsService } from '../../../src/movements/movements.service';
import {
  MovementsRepository,
  RecurringForAnnual,
  InstallmentGroupForAnnual,
} from '../../../src/movements/movements.repository';
import { SettingsService } from '../../../src/settings/settings.service';
import { SimulationsService } from '../../../src/simulations/simulations.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRepo = {
  // Métodos existentes del mes (necesitan estar en el mock aunque no se usen en este test)
  findUnicosByMonth: jest.fn(),
  findFijosByMonth: jest.fn(),
  findCuotasByMonth: jest.fn(),
  getTotalsByMonth: jest.fn(),
  getFijosTotalsByMonth: jest.fn(),
  getCuotasTotalsByMonth: jest.fn(),
  // Métodos de reportes
  getAnnualUnicosAggregated: jest.fn(),
  getAllFijosForAnnual: jest.fn(),
  getAllCuotasForAnnual: jest.fn(),
  getEarliestYear: jest.fn(),
  // Fase 1.1.7.ext — lookups de origen para calculados de único y cuota
  findTransactionsByIds: jest.fn().mockResolvedValue([]),
  findInstallmentGroupsByIds: jest.fn().mockResolvedValue([]),
  loadPivotRatesForYear: jest.fn().mockResolvedValue(new Map()),
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
// Helpers de fixtures
// ---------------------------------------------------------------------------

const USER_A = 'user-a-reports';
const USER_B = 'user-b-reports';

const CAT_A = 'cat-a-id';
const CAT_B = 'cat-b-id';

/** Fila agregada de único sin datos (año sin movimientos únicos). */
function setupEmptyUnicosMock(): void {
  mockRepo.getAnnualUnicosAggregated.mockResolvedValue([]);
}

function setupEmptyFijosMock(): void {
  mockRepo.getAllFijosForAnnual.mockResolvedValue([]);
}

function setupEmptyCuotasMock(): void {
  mockRepo.getAllCuotasForAnnual.mockResolvedValue([]);
}

function setupEmptyMocks(): void {
  setupEmptyUnicosMock();
  setupEmptyFijosMock();
  setupEmptyCuotasMock();
  mockRepo.getEarliestYear.mockResolvedValue(null);
}

/** Crea una fila agregada de único para un mes determinado. */
function makeUnicoRow(overrides: {
  monthKey: string;
  categoryId?: string;
  categoryName?: string;
  categoryColor?: string;
  categoryScope?: string;
  type?: string;
  totalCents?: bigint;
  currency?: string;
  exchangeRate?: string;
  anchorCurrency?: string;
}) {
  return {
    monthKey: overrides.monthKey,
    categoryId: overrides.categoryId ?? CAT_A,
    categoryName: overrides.categoryName ?? 'Consumibles',
    categoryColor: overrides.categoryColor ?? '#4F86C6',
    categoryScope: overrides.categoryScope ?? 'EXPENSE',
    type: overrides.type ?? 'EXPENSE',
    totalCents: overrides.totalCents ?? BigInt(1000),
    currency: overrides.currency ?? 'ARS',
    exchangeRate: overrides.exchangeRate ?? '1',
    anchorCurrency: overrides.anchorCurrency ?? 'ARS',
  };
}

function makeFijo(overrides: Partial<RecurringForAnnual> = {}): RecurringForAnnual {
  return {
    id: 'fijo-001',
    type: 'EXPENSE' as any,
    amountCents: 5000,
    currency: Currency.ARS,
    exchangeRate: 1,
    anchorCurrency: Currency.ARS,
    startMonth: '2026-01',
    deletedFrom: null,
    frequency: 1,
    skippedMonths: new Set<string>(),
    categoryId: CAT_A,
    categoryName: 'Servicios',
    categoryColor: '#6DBF67',
    categoryScope: 'EXPENSE',
    chainId: 'chain-fijo-001',
    sourceChainId: null,
    sourceMovementId: null,
    sourceInstallmentGroupId: null,
    formulaOperator: null,
    formulaOperand: null,
    formulaSign: null,
    ...overrides,
  };
}

function makeCuota(overrides: Partial<InstallmentGroupForAnnual> = {}): InstallmentGroupForAnnual {
  return {
    id: 'grupo-001',
    type: 'EXPENSE' as any,
    amountCents: 2000,
    currency: Currency.ARS,
    exchangeRate: 1,
    anchorCurrency: Currency.ARS,
    totalInstallments: 12,
    startMonth: '2026-01',
    skippedMonths: new Set<string>(),
    categoryId: CAT_B,
    categoryName: 'Tecnología',
    categoryColor: '#A98BD6',
    categoryScope: 'EXPENSE',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('MovementsService — getReportsMovements', () => {
  let service: MovementsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSettingsService.getSettings.mockResolvedValue({ defaultCurrency: Currency.ARS, lastExchangeRate: null });

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
  // Estructura básica de la respuesta
  // -------------------------------------------------------------------------

  describe('estructura de la respuesta', () => {
    it('año vacío → 12 meses en cero, categories vacío, earliestYear null', async () => {
      setupEmptyMocks();

      const result = await service.getReportsMovements(USER_A, 2026);

      expect(result.year).toBe(2026);
      expect(result.months).toHaveLength(12);
      result.months.forEach((m) => {
        expect(m.incomeCents).toBe(0);
        expect(m.expenseCents).toBe(0);
      });
      expect(result.categories).toEqual([]);
      expect(result.earliestYear).toBeNull();
    });

    it('months siempre tiene 12 entradas de enero a diciembre con formato YYYY-MM', async () => {
      setupEmptyMocks();

      const result = await service.getReportsMovements(USER_A, 2026);

      expect(result.months[0].month).toBe('2026-01');
      expect(result.months[6].month).toBe('2026-07');
      expect(result.months[11].month).toBe('2026-12');
    });

    it('devuelve el year correcto en la respuesta', async () => {
      setupEmptyMocks();

      const result = await service.getReportsMovements(USER_A, 2025);
      expect(result.year).toBe(2025);
    });
  });

  // -------------------------------------------------------------------------
  // Únicos
  // -------------------------------------------------------------------------

  describe('únicos', () => {
    it('suma EXPENSE de únicos en el mes correcto', async () => {
      // Un único de EXPENSE 1000 en junio 2026
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-06', type: 'EXPENSE', totalCents: BigInt(1000) }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026);

      const jun = result.months[5]; // índice 5 = junio
      expect(jun.month).toBe('2026-06');
      expect(jun.expenseCents).toBe(1000);
      expect(jun.incomeCents).toBe(0);
    });

    it('suma INCOME de únicos en el mes correcto', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-03', type: 'INCOME', totalCents: BigInt(50000) }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026);

      const mar = result.months[2]; // índice 2 = marzo
      expect(mar.incomeCents).toBe(50000);
      expect(mar.expenseCents).toBe(0);
    });

    it('castea BigInt a Number correctamente (gotcha BigInt → Number)', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', totalCents: BigInt(999999999) }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026);

      expect(typeof result.months[0].expenseCents).toBe('number');
      expect(result.months[0].expenseCents).toBe(999999999);
    });

    it('únicos de categoría soft-deleted sigue contando (RF-CAT-004)', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({
          monthKey: '2026-06',
          categoryId: 'cat-deleted',
          categoryName: 'Categoría Eliminada',
          type: 'EXPENSE',
          totalCents: BigInt(3000),
        }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026);

      expect(result.months[5].expenseCents).toBe(3000);
      // Debe aparecer en categories
      const cat = result.categories.find((c) => c.categoryId === 'cat-deleted');
      expect(cat).toBeDefined();
      expect(cat!.name).toBe('Categoría Eliminada');
    });

    it('acumula correctamente múltiples únicos en el mismo mes', async () => {
      // Dos categorías distintas en junio
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-06', categoryId: CAT_A, totalCents: BigInt(1000) }),
        makeUnicoRow({ monthKey: '2026-06', categoryId: CAT_B, categoryName: 'Tecnología', categoryColor: '#A98BD6', totalCents: BigInt(2000) }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026);

      expect(result.months[5].expenseCents).toBe(3000); // 1000 + 2000
    });
  });

  // -------------------------------------------------------------------------
  // Fijos
  // -------------------------------------------------------------------------

  describe('fijos', () => {
    it('fijo activo todo el año suma en los 12 meses', async () => {
      setupEmptyUnicosMock();
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ amountCents: 1000, startMonth: '2026-01', deletedFrom: null, type: 'EXPENSE' as any }),
      ]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026);

      result.months.forEach((m) => {
        expect(m.expenseCents).toBe(1000);
      });
    });

    it('fijo que empieza en julio solo cuenta desde julio', async () => {
      setupEmptyUnicosMock();
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ amountCents: 2000, startMonth: '2026-07', deletedFrom: null, type: 'EXPENSE' as any }),
      ]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026);

      // Enero a junio (índice 0..5): 0
      result.months.slice(0, 6).forEach((m) => {
        expect(m.expenseCents).toBe(0);
      });
      // Julio a diciembre (índice 6..11): 2000
      result.months.slice(6).forEach((m) => {
        expect(m.expenseCents).toBe(2000);
      });
    });

    it('fijo con deletedFrom=2026-07 no aparece desde julio en adelante', async () => {
      setupEmptyUnicosMock();
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ amountCents: 3000, startMonth: '2026-01', deletedFrom: '2026-07', type: 'EXPENSE' as any }),
      ]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026);

      // Enero a junio (índice 0..5): 3000 (activo porque deletedFrom='2026-07' > mes)
      result.months.slice(0, 6).forEach((m) => {
        expect(m.expenseCents).toBe(3000);
      });
      // Julio en adelante (índice 6..11): 0 (deletedFrom <= mes)
      result.months.slice(6).forEach((m) => {
        expect(m.expenseCents).toBe(0);
      });
    });

    it('fijo INCOME suma en incomeCents, no en expenseCents', async () => {
      setupEmptyUnicosMock();
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ amountCents: 80000, type: 'INCOME' as any, startMonth: '2026-01', deletedFrom: null }),
      ]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026);

      result.months.forEach((m) => {
        expect(m.incomeCents).toBe(80000);
        expect(m.expenseCents).toBe(0);
      });
    });

    it('fijo INCOME no aparece en categories (solo EXPENSE en desglose)', async () => {
      setupEmptyUnicosMock();
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ amountCents: 80000, type: 'INCOME' as any }),
      ]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026);

      expect(result.categories).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Cuotas
  // -------------------------------------------------------------------------

  describe('cuotas', () => {
    it('cuota de 12 cuotas desde enero cubre todos los meses del año', async () => {
      setupEmptyUnicosMock();
      setupEmptyFijosMock();
      mockRepo.getAllCuotasForAnnual.mockResolvedValue([
        makeCuota({ amountCents: 1500, totalInstallments: 12, startMonth: '2026-01', type: 'EXPENSE' as any }),
      ]);
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026);

      result.months.forEach((m) => {
        expect(m.expenseCents).toBe(1500);
      });
    });

    it('cuota de 3 cuotas desde junio cubre solo junio, julio, agosto', async () => {
      setupEmptyUnicosMock();
      setupEmptyFijosMock();
      mockRepo.getAllCuotasForAnnual.mockResolvedValue([
        makeCuota({ amountCents: 2000, totalInstallments: 3, startMonth: '2026-06', type: 'EXPENSE' as any }),
      ]);
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026);

      // Enero a mayo (índice 0..4): 0
      result.months.slice(0, 5).forEach((m) => {
        expect(m.expenseCents).toBe(0);
      });
      // Junio, julio, agosto (índice 5..7): 2000
      [5, 6, 7].forEach((i) => {
        expect(result.months[i].expenseCents).toBe(2000);
      });
      // Septiembre en adelante (índice 8..11): 0
      result.months.slice(8).forEach((m) => {
        expect(m.expenseCents).toBe(0);
      });
    });

    it('cuota que empezó en 2025 y sigue activa en 2026 cuenta en el año pedido', async () => {
      setupEmptyUnicosMock();
      setupEmptyFijosMock();
      // Cuota de 18 cuotas desde julio 2025 → termina en diciembre 2026 (2025-07 + 18 meses = 2027-01)
      mockRepo.getAllCuotasForAnnual.mockResolvedValue([
        makeCuota({ amountCents: 3000, totalInstallments: 18, startMonth: '2025-07', type: 'EXPENSE' as any }),
      ]);
      mockRepo.getEarliestYear.mockResolvedValue(2025);

      const result = await service.getReportsMovements(USER_A, 2026);

      // Todos los 12 meses de 2026 están dentro del rango (2025-07 .. 2027-01 exclusivo)
      result.months.forEach((m) => {
        expect(m.expenseCents).toBe(3000);
      });
    });

    it('cuota que termina en el año anterior no aparece', async () => {
      setupEmptyUnicosMock();
      setupEmptyFijosMock();
      // Cuota de 3 cuotas desde octubre 2025 → termina en enero 2026 (2025-10 + 3 = 2026-01, exclusivo)
      // Por tanto el último mes activo es diciembre 2025; en 2026 no aparece.
      mockRepo.getAllCuotasForAnnual.mockResolvedValue([
        makeCuota({ amountCents: 999, totalInstallments: 3, startMonth: '2025-10', type: 'EXPENSE' as any }),
      ]);
      mockRepo.getEarliestYear.mockResolvedValue(2025);

      const result = await service.getReportsMovements(USER_A, 2026);

      result.months.forEach((m) => {
        expect(m.expenseCents).toBe(0);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Categories (desglose de gastos por categoría)
  // -------------------------------------------------------------------------

  describe('categories', () => {
    it('una categoría con gasto aparece en categories con 12 valores', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-06', categoryId: CAT_A, totalCents: BigInt(5000) }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026);

      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].categoryId).toBe(CAT_A);
      expect(result.categories[0].monthlyExpenseCents).toHaveLength(12);
      expect(result.categories[0].monthlyExpenseCents[5]).toBe(5000); // junio = índice 5
      // El resto en cero
      result.categories[0].monthlyExpenseCents.forEach((v, i) => {
        if (i !== 5) expect(v).toBe(0);
      });
    });

    it('categoría sin gasto en el año NO aparece en categories', async () => {
      // Solo INCOME de únicos
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-06', type: 'INCOME', totalCents: BigInt(5000) }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026);

      expect(result.categories).toHaveLength(0);
    });

    it('invariante: SUM(monthlyExpenseCents[m]) == months[m].expenseCents para todo m', async () => {
      // CAT_A gasta 1000 en enero, CAT_B gasta 2000 en enero y 500 en marzo
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', categoryId: CAT_A, totalCents: BigInt(1000) }),
        makeUnicoRow({ monthKey: '2026-01', categoryId: CAT_B, categoryName: 'Tecnología', categoryColor: '#A98BD6', totalCents: BigInt(2000) }),
        makeUnicoRow({ monthKey: '2026-03', categoryId: CAT_B, categoryName: 'Tecnología', categoryColor: '#A98BD6', totalCents: BigInt(500) }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026);

      // Verificar invariante para cada mes
      result.months.forEach((monthEntry, i) => {
        const sumFromCategories = result.categories.reduce(
          (sum, cat) => sum + cat.monthlyExpenseCents[i],
          0,
        );
        expect(sumFromCategories).toBe(monthEntry.expenseCents);
      });
    });

    it('orden categories: mayor gasto anual primero; desempate por categoryId ASC', async () => {
      // CAT_B gasta más que CAT_A
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', categoryId: CAT_A, totalCents: BigInt(1000) }),
        makeUnicoRow({ monthKey: '2026-01', categoryId: CAT_B, categoryName: 'Tecnología', categoryColor: '#A98BD6', totalCents: BigInt(5000) }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026);

      expect(result.categories[0].categoryId).toBe(CAT_B); // 5000 > 1000
      expect(result.categories[1].categoryId).toBe(CAT_A);
    });

    it('desempate de orden por categoryId ASC cuando el gasto anual es igual', async () => {
      // Ambas categorías gastan lo mismo
      // CAT_A = 'cat-a-id', CAT_B = 'cat-b-id' → 'cat-a-id' < 'cat-b-id' léxicamente
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', categoryId: CAT_A, totalCents: BigInt(2000) }),
        makeUnicoRow({ monthKey: '2026-01', categoryId: CAT_B, categoryName: 'Tecnología', categoryColor: '#A98BD6', totalCents: BigInt(2000) }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026);

      // Mismo gasto total → ordenar por categoryId ASC
      expect(result.categories[0].categoryId).toBe(CAT_A);
      expect(result.categories[1].categoryId).toBe(CAT_B);
    });

    it('fijos EXPENSE contribuyen al desglose por categoría', async () => {
      setupEmptyUnicosMock();
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({
          amountCents: 1000,
          startMonth: '2026-06',
          deletedFrom: null,
          type: 'EXPENSE' as any,
          categoryId: CAT_A,
        }),
      ]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026);

      // Fijo activo desde junio (6 meses: jun..dic = 7 meses)
      const cat = result.categories.find((c) => c.categoryId === CAT_A);
      expect(cat).toBeDefined();
      // Meses 0..4 (ene..may): 0
      cat!.monthlyExpenseCents.slice(0, 5).forEach((v) => expect(v).toBe(0));
      // Meses 5..11 (jun..dic): 1000
      cat!.monthlyExpenseCents.slice(5).forEach((v) => expect(v).toBe(1000));
    });

    it('cuotas EXPENSE contribuyen al desglose por categoría', async () => {
      setupEmptyUnicosMock();
      setupEmptyFijosMock();
      mockRepo.getAllCuotasForAnnual.mockResolvedValue([
        makeCuota({
          amountCents: 500,
          totalInstallments: 3,
          startMonth: '2026-01',
          type: 'EXPENSE' as any,
          categoryId: CAT_B,
        }),
      ]);
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026);

      const cat = result.categories.find((c) => c.categoryId === CAT_B);
      expect(cat).toBeDefined();
      // Meses 0..2 (ene..mar): 500
      [0, 1, 2].forEach((i) => expect(cat!.monthlyExpenseCents[i]).toBe(500));
      // Resto: 0
      cat!.monthlyExpenseCents.slice(3).forEach((v) => expect(v).toBe(0));
    });

    it('múltiples tipos de movimiento de la misma categoría se acumulan correctamente', async () => {
      // CAT_A: único 1000 + fijo 2000 en enero
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', categoryId: CAT_A, totalCents: BigInt(1000) }),
      ]);
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ amountCents: 2000, startMonth: '2026-01', deletedFrom: '2026-02', categoryId: CAT_A, type: 'EXPENSE' as any }),
      ]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026);

      const cat = result.categories.find((c) => c.categoryId === CAT_A);
      expect(cat).toBeDefined();
      // Enero: único 1000 + fijo 2000 = 3000
      expect(cat!.monthlyExpenseCents[0]).toBe(3000);
      // Febrero+: solo el único si hubiera, pero en este caso no hay (solo fijo que empieza en feb)
      // El fijo tiene deletedFrom='2026-02' → en febrero no está activo (deletedFrom=2026-02 no > 2026-02)
      expect(cat!.monthlyExpenseCents[1]).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // earliestYear
  // -------------------------------------------------------------------------

  describe('earliestYear', () => {
    it('devuelve el año más antiguo cuando lo retorna el repositorio', async () => {
      setupEmptyMocks();
      mockRepo.getEarliestYear.mockResolvedValue(2024);

      const result = await service.getReportsMovements(USER_A, 2026);

      expect(result.earliestYear).toBe(2024);
    });

    it('devuelve null si el usuario no tiene movimientos', async () => {
      setupEmptyMocks();
      mockRepo.getEarliestYear.mockResolvedValue(null);

      const result = await service.getReportsMovements(USER_A, 2026);

      expect(result.earliestYear).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Aislamiento por usuario (RN-003)
  // -------------------------------------------------------------------------

  describe('aislamiento por userId (RN-003)', () => {
    it('pasa el userId correcto a todos los métodos del repositorio', async () => {
      setupEmptyMocks();

      await service.getReportsMovements(USER_B, 2026);

      expect(mockRepo.getAnnualUnicosAggregated).toHaveBeenCalledWith(USER_B, 2026);
      expect(mockRepo.getAllFijosForAnnual).toHaveBeenCalledWith(USER_B);
      expect(mockRepo.getAllCuotasForAnnual).toHaveBeenCalledWith(USER_B);
      expect(mockRepo.getEarliestYear).toHaveBeenCalledWith(USER_B);
    });

    it('no mezcla datos de usuarios distintos (cada llamada usa el userId propio)', async () => {
      setupEmptyMocks();

      await service.getReportsMovements(USER_A, 2026);
      // Verificar que USER_B nunca fue llamado
      expect(mockRepo.getAnnualUnicosAggregated).not.toHaveBeenCalledWith(
        USER_B,
        expect.anything(),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Combinación de los tres tipos
  // -------------------------------------------------------------------------

  describe('combinación de tipos', () => {
    it('los totales suman únicos + fijos + cuotas del mes', async () => {
      // Enero: único EXPENSE 1000, fijo EXPENSE 3000, cuota EXPENSE 2000
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', type: 'EXPENSE', totalCents: BigInt(1000) }),
      ]);
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ amountCents: 3000, startMonth: '2026-01', deletedFrom: '2026-02', type: 'EXPENSE' as any }),
      ]);
      mockRepo.getAllCuotasForAnnual.mockResolvedValue([
        makeCuota({ amountCents: 2000, totalInstallments: 1, startMonth: '2026-01', type: 'EXPENSE' as any }),
      ]);
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026);

      expect(result.months[0].expenseCents).toBe(6000); // 1000 + 3000 + 2000
    });

    it('income total es la suma de únicos INCOME + fijos INCOME del mes', async () => {
      // Fijo INCOME 80000 + único INCOME 20000 en enero
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', type: 'INCOME', totalCents: BigInt(20000) }),
      ]);
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ amountCents: 80000, type: 'INCOME' as any, startMonth: '2026-01', deletedFrom: null }),
      ]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026);

      expect(result.months[0].incomeCents).toBe(100000);
      expect(result.months[0].expenseCents).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Filtro de categorías (Fase 1.1.5, RF-REP-005)
  // -------------------------------------------------------------------------

  describe('filtro de categorías', () => {
    it('sin filtro (null) → misma respuesta que antes, todas las categorías', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-06', categoryId: CAT_A, totalCents: BigInt(1000) }),
        makeUnicoRow({ monthKey: '2026-06', categoryId: CAT_B, categoryName: 'Tecnología', categoryColor: '#A98BD6', totalCents: BigInt(2000) }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, null);

      expect(result.months[5].expenseCents).toBe(3000); // CAT_A + CAT_B
      expect(result.categories).toHaveLength(2);
    });

    it('sin filtro (undefined) → misma respuesta que antes, todas las categorías', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-06', categoryId: CAT_A, totalCents: BigInt(1000) }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, undefined);

      expect(result.months[5].expenseCents).toBe(1000);
    });

    it('categoryIds vacío ([]) → NINGUNA categoría: resultado vacío/cero (Fase 1.1.6)', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-06', categoryId: CAT_A, totalCents: BigInt(1000) }),
        makeUnicoRow({ monthKey: '2026-06', categoryId: CAT_B, categoryName: 'Tecnología', categoryColor: '#A98BD6', totalCents: BigInt(2000) }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, []);

      // [] = ninguna → todos los totales en cero, categories vacío
      result.months.forEach((m) => {
        expect(m.expenseCents).toBe(0);
        expect(m.incomeCents).toBe(0);
      });
      expect(result.categories).toHaveLength(0);
    });

    it('categoryIds vacío ([]) → earliestYear NO se ve afectado (igual que cualquier filtro)', async () => {
      setupEmptyUnicosMock();
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2023);

      const result = await service.getReportsMovements(USER_A, 2026, []);

      // earliestYear se calcula sobre TODOS los movimientos sin importar el filtro
      expect(result.earliestYear).toBe(2023);
      expect(mockRepo.getEarliestYear).toHaveBeenCalledWith(USER_A);
    });

    it('filtro con solo CAT_A → solo movimientos de CAT_A cuentan en totales y desglose', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-06', categoryId: CAT_A, totalCents: BigInt(1000) }),
        makeUnicoRow({ monthKey: '2026-06', categoryId: CAT_B, categoryName: 'Tecnología', categoryColor: '#A98BD6', totalCents: BigInt(2000) }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, [CAT_A]);

      // Solo CAT_A (1000); CAT_B queda fuera
      expect(result.months[5].expenseCents).toBe(1000);
      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].categoryId).toBe(CAT_A);
    });

    it('filtro afecta fijos: fijo de CAT_B queda fuera cuando se filtra por CAT_A', async () => {
      setupEmptyUnicosMock();
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ amountCents: 3000, startMonth: '2026-01', deletedFrom: null, categoryId: CAT_A, type: 'EXPENSE' as any }),
        makeFijo({ id: 'fijo-002', amountCents: 5000, startMonth: '2026-01', deletedFrom: null, categoryId: CAT_B, categoryName: 'Tecnología', categoryColor: '#A98BD6', type: 'EXPENSE' as any }),
      ]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, [CAT_A]);

      // Solo CAT_A (3000 por mes); CAT_B queda fuera
      result.months.forEach((m) => {
        expect(m.expenseCents).toBe(3000);
      });
      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].categoryId).toBe(CAT_A);
    });

    it('filtro afecta cuotas: cuota de CAT_B queda fuera cuando se filtra por CAT_A', async () => {
      setupEmptyUnicosMock();
      setupEmptyFijosMock();
      mockRepo.getAllCuotasForAnnual.mockResolvedValue([
        makeCuota({ amountCents: 1000, totalInstallments: 6, startMonth: '2026-01', categoryId: CAT_A, type: 'EXPENSE' as any }),
        makeCuota({ id: 'grupo-002', amountCents: 4000, totalInstallments: 6, startMonth: '2026-01', categoryId: CAT_B, type: 'EXPENSE' as any }),
      ]);
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, [CAT_A]);

      // Solo cuotas de CAT_A (1000) en los primeros 6 meses
      result.months.slice(0, 6).forEach((m) => {
        expect(m.expenseCents).toBe(1000);
      });
      result.months.slice(6).forEach((m) => {
        expect(m.expenseCents).toBe(0);
      });
    });

    it('invariante se mantiene con filtro activo: SUM(categories[i].monthlyExpenseCents[m]) == months[m].expenseCents', async () => {
      // Tres categorías; se filtra solo CAT_A y CAT_B (no CAT_C)
      const CAT_C = 'cat-c-id';
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', categoryId: CAT_A, totalCents: BigInt(1000) }),
        makeUnicoRow({ monthKey: '2026-01', categoryId: CAT_B, categoryName: 'Tecnología', categoryColor: '#A98BD6', totalCents: BigInt(2000) }),
        makeUnicoRow({ monthKey: '2026-01', categoryId: CAT_C, categoryName: 'Otro', categoryColor: '#FF0000', totalCents: BigInt(9999) }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, [CAT_A, CAT_B]);

      // CAT_C no debe aparecer en categories ni en totales
      expect(result.categories.find((c) => c.categoryId === CAT_C)).toBeUndefined();
      expect(result.months[0].expenseCents).toBe(3000); // solo CAT_A + CAT_B

      // Invariante: para cada mes, suma de categories == expenseCents del mes
      result.months.forEach((monthEntry, i) => {
        const sumFromCategories = result.categories.reduce(
          (sum, cat) => sum + cat.monthlyExpenseCents[i],
          0,
        );
        expect(sumFromCategories).toBe(monthEntry.expenseCents);
      });
    });

    it('id desconocido en el filtro → no matchea nada, totales en cero (no es error)', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-06', categoryId: CAT_A, totalCents: BigInt(5000) }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, ['id-inexistente']);

      // El id no existe → ningún movimiento matchea → todo en cero
      result.months.forEach((m) => {
        expect(m.expenseCents).toBe(0);
        expect(m.incomeCents).toBe(0);
      });
      expect(result.categories).toHaveLength(0);
    });

    // -------------------------------------------------------------------------
    // CRÍTICO: earliestYear IGNORA el filtro
    // -------------------------------------------------------------------------

    it('earliestYear NO se ve afectado por el filtro de categorías (límites estables)', async () => {
      // Solo hay movimientos de CAT_A en el año 2026.
      // Con filtro de CAT_B (sin datos), earliestYear debe seguir siendo 2024
      // porque se calcula sobre TODOS los movimientos, no solo los filtrados.
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-06', categoryId: CAT_A, totalCents: BigInt(1000) }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      // getEarliestYear retorna 2024 (ignorando el filtro — se lo pregunta al repositorio directamente)
      mockRepo.getEarliestYear.mockResolvedValue(2024);

      // Filtrar solo por CAT_B (que no tiene datos)
      const result = await service.getReportsMovements(USER_A, 2026, [CAT_B]);

      // Los totales del mes filtrado son 0 (CAT_B no tiene datos)
      expect(result.months[5].expenseCents).toBe(0);
      // Pero earliestYear es 2024 (calculado sobre todos los movimientos)
      expect(result.earliestYear).toBe(2024);
      // Verificar que getEarliestYear fue llamado con el userId correcto
      expect(mockRepo.getEarliestYear).toHaveBeenCalledWith(USER_A);
    });

    it('earliestYear: el repositorio siempre recibe el userId, independiente del filtro', async () => {
      setupEmptyMocks();
      mockRepo.getEarliestYear.mockResolvedValue(null);

      await service.getReportsMovements(USER_A, 2026, [CAT_A]);

      // getEarliestYear debe llamarse con userId, no con categoryIds
      expect(mockRepo.getEarliestYear).toHaveBeenCalledWith(USER_A);
      expect(mockRepo.getEarliestYear).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // availableCategories (universo estable, sin filtro)
  // -------------------------------------------------------------------------

  describe('availableCategories', () => {
    it('sin filtro: availableCategories == categories (mismas entradas, solo shape liviano)', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-06', categoryId: CAT_A, totalCents: BigInt(1000) }),
        makeUnicoRow({ monthKey: '2026-06', categoryId: CAT_B, categoryName: 'Tecnología', categoryColor: '#A98BD6', totalCents: BigInt(2000) }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, null);

      expect(result.availableCategories).toHaveLength(2);
      // Shape liviano: solo categoryId, name, color (sin monthlyExpenseCents)
      expect(result.availableCategories[0]).toEqual(
        expect.objectContaining({ categoryId: expect.any(String), name: expect.any(String), color: expect.any(String) }),
      );
      expect((result.availableCategories[0] as any).monthlyExpenseCents).toBeUndefined();
    });

    it('con filtro activo: availableCategories NO se achica (incluye categorías fuera del filtro)', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-06', categoryId: CAT_A, totalCents: BigInt(1000) }),
        makeUnicoRow({ monthKey: '2026-06', categoryId: CAT_B, categoryName: 'Tecnología', categoryColor: '#A98BD6', totalCents: BigInt(2000) }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, [CAT_A]);

      // categories se achica al filtro (solo CAT_A)
      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].categoryId).toBe(CAT_A);

      // availableCategories sigue teniendo ambas
      expect(result.availableCategories).toHaveLength(2);
      const ids = result.availableCategories.map((c) => c.categoryId);
      expect(ids).toContain(CAT_A);
      expect(ids).toContain(CAT_B);
    });

    it('filtro vacío []: categories vacío pero availableCategories tiene las del año', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-06', categoryId: CAT_A, totalCents: BigInt(1000) }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, []);

      expect(result.categories).toHaveLength(0);
      expect(result.availableCategories).toHaveLength(1);
      expect(result.availableCategories[0].categoryId).toBe(CAT_A);
    });

    it('availableCategories orden: mayor gasto anual (sin filtro) DESC, desempate categoryId ASC', async () => {
      // CAT_B gasta más que CAT_A sin filtro
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-06', categoryId: CAT_A, totalCents: BigInt(1000) }),
        makeUnicoRow({ monthKey: '2026-06', categoryId: CAT_B, categoryName: 'Tecnología', categoryColor: '#A98BD6', totalCents: BigInt(5000) }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      // Filtrar solo CAT_A → categories tiene 1, pero availableCategories ordena por gasto real
      const result = await service.getReportsMovements(USER_A, 2026, [CAT_A]);

      expect(result.availableCategories[0].categoryId).toBe(CAT_B); // 5000 > 1000
      expect(result.availableCategories[1].categoryId).toBe(CAT_A);
    });

    it('availableCategories desempate por categoryId ASC cuando gasto es igual', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', categoryId: CAT_A, totalCents: BigInt(2000) }),
        makeUnicoRow({ monthKey: '2026-01', categoryId: CAT_B, categoryName: 'Tecnología', categoryColor: '#A98BD6', totalCents: BigInt(2000) }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, null);

      // cat-a-id < cat-b-id léxicamente → CAT_A primero
      expect(result.availableCategories[0].categoryId).toBe(CAT_A);
      expect(result.availableCategories[1].categoryId).toBe(CAT_B);
    });

    it('availableCategories: fijos EXPENSE del año sin filtro suman al universo', async () => {
      setupEmptyUnicosMock();
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ amountCents: 3000, startMonth: '2026-01', deletedFrom: null, categoryId: CAT_A, type: 'EXPENSE' as any }),
        makeFijo({ id: 'fijo-002', amountCents: 9000, startMonth: '2026-01', deletedFrom: null, categoryId: CAT_B, categoryName: 'Tecnología', categoryColor: '#A98BD6', type: 'EXPENSE' as any }),
      ]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      // Filtrar solo CAT_A
      const result = await service.getReportsMovements(USER_A, 2026, [CAT_A]);

      // availableCategories debe tener ambas, ordenadas por gasto anual sin filtro
      expect(result.availableCategories).toHaveLength(2);
      // CAT_B gasta 9000*12=108000, CAT_A gasta 3000*12=36000 → CAT_B primero
      expect(result.availableCategories[0].categoryId).toBe(CAT_B);
      expect(result.availableCategories[1].categoryId).toBe(CAT_A);
    });

    it('availableCategories: cuotas EXPENSE del año sin filtro suman al universo', async () => {
      setupEmptyUnicosMock();
      setupEmptyFijosMock();
      mockRepo.getAllCuotasForAnnual.mockResolvedValue([
        makeCuota({ amountCents: 500, totalInstallments: 6, startMonth: '2026-01', categoryId: CAT_A, type: 'EXPENSE' as any }),
        makeCuota({ id: 'grupo-002', amountCents: 2000, totalInstallments: 6, startMonth: '2026-01', categoryId: CAT_B, type: 'EXPENSE' as any }),
      ]);
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      // Filtrar solo CAT_A
      const result = await service.getReportsMovements(USER_A, 2026, [CAT_A]);

      // availableCategories tiene ambas
      expect(result.availableCategories).toHaveLength(2);
      // CAT_B gasta 2000*6=12000, CAT_A gasta 500*6=3000 → CAT_B primero
      expect(result.availableCategories[0].categoryId).toBe(CAT_B);
      expect(result.availableCategories[1].categoryId).toBe(CAT_A);
    });

    it('sin movimientos en el año: availableCategories vacío', async () => {
      setupEmptyMocks();

      const result = await service.getReportsMovements(USER_A, 2026, null);

      expect(result.availableCategories).toEqual([]);
    });

    // E2: una categoría NO es de gasto o de ingreso — puede tener movimientos de
    // ambos tipos. availableCategories debe incluir categorías income-only (antes
    // el universo se armaba SOLO desde filas EXPENSE, lo que hacía que la línea de
    // Ingresos cayera a 0 al aplicar cualquier filtro de categorías del front).
    it('categoría INCOME-only aparece en availableCategories con hasIncome:true, hasExpense:false', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-06', categoryId: CAT_A, type: 'INCOME', totalCents: BigInt(5000) }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, null);

      expect(result.availableCategories).toHaveLength(1);
      expect(result.availableCategories[0]).toEqual(
        expect.objectContaining({ categoryId: CAT_A, hasIncome: true, hasExpense: false }),
      );
    });

    it('categoría con movimientos EXPENSE e INCOME → hasExpense:true, hasIncome:true', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-06', categoryId: CAT_A, type: 'EXPENSE', totalCents: BigInt(1000) }),
        makeUnicoRow({ monthKey: '2026-07', categoryId: CAT_A, type: 'INCOME', totalCents: BigInt(3000) }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, null);

      expect(result.availableCategories).toHaveLength(1);
      expect(result.availableCategories[0]).toEqual(
        expect.objectContaining({ categoryId: CAT_A, hasExpense: true, hasIncome: true }),
      );
    });

    it('categoría solo EXPENSE → hasExpense:true, hasIncome:false', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-06', categoryId: CAT_A, type: 'EXPENSE', totalCents: BigInt(1000) }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, null);

      expect(result.availableCategories[0]).toEqual(
        expect.objectContaining({ categoryId: CAT_A, hasExpense: true, hasIncome: false }),
      );
    });

    it('con filtro de categorías activo, la línea de Ingresos se mantiene completa (bug E2)', async () => {
      // CAT_A es income-only (nunca es de gasto); CAT_B es expense-only.
      // El front, al destildar CAT_B (categoría de gasto), envía categoryIds=[CAT_A]
      // (CAT_A ya venía tildada en la leyenda porque ahora está en availableCategories).
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', categoryId: CAT_A, type: 'INCOME', totalCents: BigInt(5000) }),
        makeUnicoRow({ monthKey: '2026-01', categoryId: CAT_B, categoryName: 'Tecnología', categoryColor: '#A98BD6', type: 'EXPENSE', totalCents: BigInt(2000) }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, [CAT_A]);

      // Ingresos completos (CAT_A pasa el filtro); Gastos en 0 (CAT_B filtrada afuera)
      expect(result.months[0].incomeCents).toBe(5000);
      expect(result.months[0].expenseCents).toBe(0);
    });

    it('destildar una categoría compartida (ambos tipos) baja en ambas líneas', async () => {
      // CAT_A tiene movimientos EXPENSE e INCOME. Se filtra dejando afuera a CAT_A.
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', categoryId: CAT_A, type: 'EXPENSE', totalCents: BigInt(1000) }),
        makeUnicoRow({ monthKey: '2026-01', categoryId: CAT_A, type: 'INCOME', totalCents: BigInt(4000) }),
        makeUnicoRow({ monthKey: '2026-01', categoryId: CAT_B, categoryName: 'Tecnología', categoryColor: '#A98BD6', type: 'EXPENSE', totalCents: BigInt(700) }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, [CAT_B]);

      // CAT_A queda afuera del filtro → baja tanto en Gastos (queda solo CAT_B=700) como en Ingresos (0)
      expect(result.months[0].expenseCents).toBe(700);
      expect(result.months[0].incomeCents).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Override de currency (P3 — currencyOverride)
  // -------------------------------------------------------------------------

  describe('override de currency (currencyOverride)', () => {
    /**
     * currencyOverride ausente/undefined → displayCurrency = defaultCurrency del usuario.
     * El beforeEach mockea getSettings con defaultCurrency=ARS.
     * Un único en ARS de 1000 centavos: currency===displayCurrency → devuelve sin cambio.
     */
    it('sin currencyOverride → usa defaultCurrency del usuario (ARS)', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-06', type: 'EXPENSE', totalCents: BigInt(1000), currency: 'ARS', exchangeRate: '1', anchorCurrency: 'ARS' }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);
      // defaultCurrency=ARS ya está configurado en beforeEach
      // loadPivotRatesForYear retorna Map vacío (mock global)

      const result = await service.getReportsMovements(USER_A, 2026);

      // ARS único en ARS → sin conversión → 1000 centavos
      expect(result.months[5].expenseCents).toBe(1000);
    });

    /**
     * currencyOverride=ARS con movimiento en ARS:
     * convertToDisplayCurrency: currency===displayCurrency → devuelve amountCents sin cambio.
     */
    it('currencyOverride=ARS con único en ARS → sin conversión, amount intacto', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', type: 'EXPENSE', totalCents: BigInt(5000), currency: 'ARS', exchangeRate: '1', anchorCurrency: 'ARS' }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, null, Currency.ARS);

      expect(result.months[0].expenseCents).toBe(5000);
    });

    /**
     * currencyOverride=USD con único en ARS (currency=ARS, anchorCurrency=ARS, exchangeRate=1):
     * - currency !== displayCurrency (ARS !== USD)
     * - anchorCurrency !== displayCurrency (ARS !== USD)
     * - pivotRates = Map vacío → pivotRates[ARS] === undefined → rateAnchor===null → no re-ruteo
     * - Fallback: currency===anchorCurrency → devuelve amountCents sin cambio (degradado defensivo)
     * El test verifica que el override activa la ruta USD y no lanza error.
     */
    it('currencyOverride=USD con único en ARS y sin pivot rates → fallback defensivo, amount intacto', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-03', type: 'EXPENSE', totalCents: BigInt(2000), currency: 'ARS', exchangeRate: '1', anchorCurrency: 'ARS' }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);
      // loadPivotRatesForYear retorna Map vacío → sin rates para re-ruteo

      const result = await service.getReportsMovements(USER_A, 2026, null, Currency.USD);

      // Fallback: currency===anchorCurrency → retorna amountCents sin cambio
      expect(result.months[2].expenseCents).toBe(2000);
    });

    /**
     * currencyOverride=USD con pivot rates disponibles:
     * Movimiento en ARS (currency=ARS, anchorCurrency=ARS, exchangeRate=1).
     * pivotRates: { ARS: 1500 } (1 USD = 1500 ARS).
     * convertToDisplayCurrency:
     *   - currency===ARS, displayCurrency===USD → no corto circuito.
     *   - anchorCurrency===ARS !== USD → no caso simple.
     *   - pivotRates.get('2026-01') = { ARS: 1500 }.
     *   - rateAnchor = pivotRates.ARS = 1500, rateDisplay = USD → 1 (pivote implícito).
     *   - valueInAnchor = 1500000 (currency===anchorCurrency).
     *   - resultado = round(1500000 * (1 / 1500)) = 1000.
     */
    it('currencyOverride=USD con pivot rates → convierte ARS→USD correctamente', async () => {
      // pivotRatesForYear: Map<monthKey, Partial<PivotRates>>
      // El movimiento está en '2026-01', así que esa key debe tener el rate de ARS.
      const pivotMap = new Map<string, { ARS: number }>([['2026-01', { ARS: 1500 }]]);
      mockRepo.loadPivotRatesForYear.mockResolvedValueOnce(pivotMap);

      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', type: 'EXPENSE', totalCents: BigInt(1500000), currency: 'ARS', exchangeRate: '1', anchorCurrency: 'ARS' }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, null, Currency.USD);

      // 1500000 ARS / 1500 (rate ARS/USD) = 1000 USD
      expect(result.months[0].expenseCents).toBe(1000);
    });

    /**
     * currencyOverride no cambia el defaultCurrency del usuario (no persiste).
     * Dos llamadas sucesivas con distintos overrides deben dar resultados independientes.
     */
    it('currencyOverride no afecta la defaultCurrency del usuario (no persiste entre llamadas)', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-06', type: 'EXPENSE', totalCents: BigInt(1000), currency: 'ARS', exchangeRate: '1', anchorCurrency: 'ARS' }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      // Primera llamada con override USD
      await service.getReportsMovements(USER_A, 2026, null, Currency.USD);
      // getSettings no debe haber cambiado
      expect(mockSettingsService.getSettings).toHaveBeenCalledWith(USER_A);
      // updateLastExchangeRate nunca debe llamarse desde getReportsMovements
      expect(mockSettingsService.updateLastExchangeRate).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // RF-REP-014 — Filtro por tipo de movimiento (typesFilter)
  // -------------------------------------------------------------------------

  describe('filtro por tipo de movimiento (RF-REP-014 — typesFilter)', () => {
    // -----------------------------------------------------------------------
    // Back-compat: sin typesFilter = comportamiento actual idéntico
    // -----------------------------------------------------------------------

    it('back-compat: sin typesFilter (undefined) → misma respuesta que antes (todos los tipos)', async () => {
      // Único EXPENSE 1000 en enero
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', type: 'EXPENSE', totalCents: BigInt(1000) }),
      ]);
      // Fijo EXPENSE 2000 activo en enero
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ amountCents: 2000, startMonth: '2026-01', deletedFrom: '2026-02', type: 'EXPENSE' as any }),
      ]);
      // Cuota EXPENSE 500 en enero
      mockRepo.getAllCuotasForAnnual.mockResolvedValue([
        makeCuota({ amountCents: 500, totalInstallments: 1, startMonth: '2026-01', type: 'EXPENSE' as any }),
      ]);
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      // Sin typesFilter → todos los tipos suman
      const result = await service.getReportsMovements(USER_A, 2026);

      expect(result.months[0].expenseCents).toBe(3500); // 1000 + 2000 + 500
    });

    it('back-compat: typesFilter=null → mismo que ausente (todos los tipos)', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', type: 'EXPENSE', totalCents: BigInt(1000) }),
      ]);
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ amountCents: 2000, startMonth: '2026-01', deletedFrom: '2026-02', type: 'EXPENSE' as any }),
      ]);
      mockRepo.getAllCuotasForAnnual.mockResolvedValue([
        makeCuota({ amountCents: 500, totalInstallments: 1, startMonth: '2026-01', type: 'EXPENSE' as any }),
      ]);
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, null, undefined, null);

      expect(result.months[0].expenseCents).toBe(3500);
    });

    // -----------------------------------------------------------------------
    // Tipos vacíos → resultado en cero
    // -----------------------------------------------------------------------

    it('typesFilter=[] → NINGÚN tipo: todos los totales en cero', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-06', type: 'EXPENSE', totalCents: BigInt(5000) }),
      ]);
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ amountCents: 3000, startMonth: '2026-01', deletedFrom: null, type: 'EXPENSE' as any }),
      ]);
      mockRepo.getAllCuotasForAnnual.mockResolvedValue([
        makeCuota({ amountCents: 2000, totalInstallments: 6, startMonth: '2026-01', type: 'EXPENSE' as any }),
      ]);
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, null, undefined, []);

      result.months.forEach((m) => {
        expect(m.expenseCents).toBe(0);
        expect(m.incomeCents).toBe(0);
      });
      expect(result.categories).toHaveLength(0);
    });

    it('typesFilter=[] → availableCategories NO se achica (universo estable)', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-06', categoryId: CAT_A, type: 'EXPENSE', totalCents: BigInt(1000) }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, null, undefined, []);

      expect(result.categories).toHaveLength(0);
      expect(result.availableCategories).toHaveLength(1);
    });

    // -----------------------------------------------------------------------
    // Solo únicos
    // -----------------------------------------------------------------------

    it('typesFilter=["unico"] → solo únicos suman; fijos y cuotas excluidos', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', type: 'EXPENSE', totalCents: BigInt(1000) }),
      ]);
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ amountCents: 9000, startMonth: '2026-01', deletedFrom: null, type: 'EXPENSE' as any }),
      ]);
      mockRepo.getAllCuotasForAnnual.mockResolvedValue([
        makeCuota({ amountCents: 5000, totalInstallments: 12, startMonth: '2026-01', type: 'EXPENSE' as any }),
      ]);
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, null, undefined, ['unico']);

      expect(result.months[0].expenseCents).toBe(1000); // solo el único
    });

    it('typesFilter=["unico"] → fijos INCOME excluidos de incomeCents', async () => {
      setupEmptyUnicosMock();
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ amountCents: 80000, startMonth: '2026-01', deletedFrom: null, type: 'INCOME' as any }),
      ]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, null, undefined, ['unico']);

      result.months.forEach((m) => {
        expect(m.incomeCents).toBe(0);
      });
    });

    // -----------------------------------------------------------------------
    // Solo fijos
    // -----------------------------------------------------------------------

    it('typesFilter=["fijo"] → solo fijos suman; únicos y cuotas excluidos', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', type: 'EXPENSE', totalCents: BigInt(999) }),
      ]);
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ amountCents: 3000, startMonth: '2026-01', deletedFrom: '2026-02', type: 'EXPENSE' as any }),
      ]);
      mockRepo.getAllCuotasForAnnual.mockResolvedValue([
        makeCuota({ amountCents: 888, totalInstallments: 1, startMonth: '2026-01', type: 'EXPENSE' as any }),
      ]);
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, null, undefined, ['fijo']);

      expect(result.months[0].expenseCents).toBe(3000); // solo el fijo
    });

    // -----------------------------------------------------------------------
    // Solo cuotas
    // -----------------------------------------------------------------------

    it('typesFilter=["cuota"] → solo cuotas suman; únicos y fijos excluidos', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', type: 'EXPENSE', totalCents: BigInt(999) }),
      ]);
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ amountCents: 3000, startMonth: '2026-01', deletedFrom: null, type: 'EXPENSE' as any }),
      ]);
      mockRepo.getAllCuotasForAnnual.mockResolvedValue([
        makeCuota({ amountCents: 2500, totalInstallments: 12, startMonth: '2026-01', type: 'EXPENSE' as any }),
      ]);
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, null, undefined, ['cuota']);

      result.months.forEach((m) => {
        expect(m.expenseCents).toBe(2500);
      });
    });

    // -----------------------------------------------------------------------
    // Multi-selección (ej: fijo + cuota, excluyendo único)
    // -----------------------------------------------------------------------

    it('typesFilter=["fijo","cuota"] → fijos y cuotas suman; únicos excluidos', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', type: 'EXPENSE', totalCents: BigInt(999) }),
      ]);
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ amountCents: 1000, startMonth: '2026-01', deletedFrom: '2026-02', type: 'EXPENSE' as any }),
      ]);
      mockRepo.getAllCuotasForAnnual.mockResolvedValue([
        makeCuota({ amountCents: 2000, totalInstallments: 1, startMonth: '2026-01', type: 'EXPENSE' as any }),
      ]);
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, null, undefined, ['fijo', 'cuota']);

      expect(result.months[0].expenseCents).toBe(3000); // fijo 1000 + cuota 2000
    });

    // -----------------------------------------------------------------------
    // earliestYear y availableCategories no se ven afectados por typesFilter
    // -----------------------------------------------------------------------

    it('typesFilter: earliestYear NO se ve afectado (se calcula sin filtro)', async () => {
      setupEmptyMocks();
      mockRepo.getEarliestYear.mockResolvedValue(2022);

      const result = await service.getReportsMovements(USER_A, 2026, null, undefined, ['unico']);

      expect(result.earliestYear).toBe(2022);
      expect(mockRepo.getEarliestYear).toHaveBeenCalledWith(USER_A);
    });

    it('typesFilter: availableCategories refleja el universo sin filtro de tipo', async () => {
      // Único (unico) de CAT_A, fijo (fijo) de CAT_B
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', categoryId: CAT_A, type: 'EXPENSE', totalCents: BigInt(1000) }),
      ]);
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ amountCents: 5000, startMonth: '2026-01', deletedFrom: null, type: 'EXPENSE' as any, categoryId: CAT_B, categoryName: 'Tecnología', categoryColor: '#A98BD6' }),
      ]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      // typesFilter solo unico → solo CAT_A suma en agg
      const result = await service.getReportsMovements(USER_A, 2026, null, undefined, ['unico']);

      // categories solo tiene CAT_A (el filtrado por tipo)
      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].categoryId).toBe(CAT_A);

      // availableCategories tiene ambas (universo sin filtro de tipo)
      expect(result.availableCategories).toHaveLength(2);
      const ids = result.availableCategories.map((c) => c.categoryId);
      expect(ids).toContain(CAT_A);
      expect(ids).toContain(CAT_B);
    });
  });

  // -------------------------------------------------------------------------
  // RF-REP-014 — Filtro por dirección (direction)
  // -------------------------------------------------------------------------

  describe('filtro por dirección (RF-REP-014 — direction)', () => {
    // -----------------------------------------------------------------------
    // Back-compat: sin direction = comportamiento histórico (ambos)
    // -----------------------------------------------------------------------

    it('back-compat: sin direction (undefined) → both (ingresos y gastos)', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', type: 'EXPENSE', totalCents: BigInt(1000) }),
        makeUnicoRow({ monthKey: '2026-01', type: 'INCOME', totalCents: BigInt(2000), categoryId: CAT_B }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026);

      expect(result.months[0].expenseCents).toBe(1000);
      expect(result.months[0].incomeCents).toBe(2000);
    });

    it('back-compat: direction="both" → comportamiento idéntico al actual', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', type: 'EXPENSE', totalCents: BigInt(500) }),
      ]);
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ amountCents: 300, startMonth: '2026-01', deletedFrom: '2026-02', type: 'INCOME' as any }),
      ]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, null, undefined, null, 'both');

      expect(result.months[0].expenseCents).toBe(500);
      expect(result.months[0].incomeCents).toBe(300);
    });

    // -----------------------------------------------------------------------
    // Solo gastos (expense)
    // -----------------------------------------------------------------------

    it('direction="expense" → solo movimientos EXPENSE suman; INCOME ignorado', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', type: 'EXPENSE', totalCents: BigInt(1000), categoryId: CAT_A }),
        makeUnicoRow({ monthKey: '2026-01', type: 'INCOME', totalCents: BigInt(5000), categoryId: CAT_B }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, null, undefined, null, 'expense');

      expect(result.months[0].expenseCents).toBe(1000);
      expect(result.months[0].incomeCents).toBe(0);
    });

    it('direction="expense" con fijo INCOME → incomeCents=0', async () => {
      setupEmptyUnicosMock();
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ amountCents: 80000, startMonth: '2026-01', deletedFrom: null, type: 'INCOME' as any }),
      ]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, null, undefined, null, 'expense');

      result.months.forEach((m) => {
        expect(m.incomeCents).toBe(0);
        expect(m.expenseCents).toBe(0);
      });
    });

    it('direction="expense" con cuota EXPENSE → expenseCents correcto', async () => {
      setupEmptyUnicosMock();
      setupEmptyFijosMock();
      mockRepo.getAllCuotasForAnnual.mockResolvedValue([
        makeCuota({ amountCents: 700, totalInstallments: 3, startMonth: '2026-01', type: 'EXPENSE' as any }),
      ]);
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, null, undefined, null, 'expense');

      [0, 1, 2].forEach((i) => expect(result.months[i].expenseCents).toBe(700));
      result.months.slice(3).forEach((m) => expect(m.expenseCents).toBe(0));
    });

    // -----------------------------------------------------------------------
    // Solo ingresos (income)
    // -----------------------------------------------------------------------

    it('direction="income" → solo movimientos INCOME suman; EXPENSE ignorado', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-06', type: 'EXPENSE', totalCents: BigInt(3000), categoryId: CAT_A }),
        makeUnicoRow({ monthKey: '2026-06', type: 'INCOME', totalCents: BigInt(8000), categoryId: CAT_B }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, null, undefined, null, 'income');

      expect(result.months[5].expenseCents).toBe(0);
      expect(result.months[5].incomeCents).toBe(8000);
    });

    it('direction="income" → categories (EXPENSE breakdown) vacío aunque haya gastos', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', type: 'EXPENSE', totalCents: BigInt(9000), categoryId: CAT_A }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, null, undefined, null, 'income');

      // No hay EXPENSE que sume → categories vacío
      expect(result.categories).toHaveLength(0);
      // Pero availableCategories sí tiene la categoría (universo sin filtro de dirección)
      expect(result.availableCategories).toHaveLength(1);
    });

    it('direction="income" con fijo INCOME → incomeCents correcto', async () => {
      setupEmptyUnicosMock();
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ amountCents: 50000, startMonth: '2026-01', deletedFrom: null, type: 'INCOME' as any }),
      ]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, null, undefined, null, 'income');

      result.months.forEach((m) => {
        expect(m.incomeCents).toBe(50000);
        expect(m.expenseCents).toBe(0);
      });
    });

    // -----------------------------------------------------------------------
    // Combinación: types + direction
    // -----------------------------------------------------------------------

    it('types=["fijo"] + direction="expense" → solo gastos fijos', async () => {
      // Único EXPENSE 999 + Fijo EXPENSE 3000 + Fijo INCOME 8000 + Cuota EXPENSE 500
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', type: 'EXPENSE', totalCents: BigInt(999) }),
      ]);
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ id: 'fijo-exp', amountCents: 3000, startMonth: '2026-01', deletedFrom: '2026-02', type: 'EXPENSE' as any, chainId: 'chain-exp' }),
        makeFijo({ id: 'fijo-inc', amountCents: 8000, startMonth: '2026-01', deletedFrom: null, type: 'INCOME' as any, chainId: 'chain-inc' }),
      ]);
      mockRepo.getAllCuotasForAnnual.mockResolvedValue([
        makeCuota({ amountCents: 500, totalInstallments: 1, startMonth: '2026-01', type: 'EXPENSE' as any }),
      ]);
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, null, undefined, ['fijo'], 'expense');

      // Solo el fijo EXPENSE 3000 en enero
      expect(result.months[0].expenseCents).toBe(3000);
      expect(result.months[0].incomeCents).toBe(0);
    });

    it('types=["unico"] + direction="income" → solo ingresos únicos', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-03', type: 'EXPENSE', totalCents: BigInt(9000), categoryId: CAT_A }),
        makeUnicoRow({ monthKey: '2026-03', type: 'INCOME', totalCents: BigInt(4000), categoryId: CAT_B }),
      ]);
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ amountCents: 100, startMonth: '2026-01', deletedFrom: null, type: 'INCOME' as any }),
      ]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(USER_A, 2026, null, undefined, ['unico'], 'income');

      // Solo el único INCOME de 4000 en marzo
      expect(result.months[2].incomeCents).toBe(4000);
      expect(result.months[2].expenseCents).toBe(0);
      // Fijo INCOME excluido (types=unico excluye fijos)
      result.months.forEach((m, i) => {
        if (i !== 2) {
          expect(m.incomeCents).toBe(0);
          expect(m.expenseCents).toBe(0);
        }
      });
    });

    // -----------------------------------------------------------------------
    // Combinación: types + direction + categories
    // -----------------------------------------------------------------------

    it('types + direction + categories se combinan (AND): solo gastos únicos de CAT_A', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', categoryId: CAT_A, type: 'EXPENSE', totalCents: BigInt(1000) }),
        makeUnicoRow({ monthKey: '2026-01', categoryId: CAT_B, categoryName: 'Tecnología', categoryColor: '#A98BD6', type: 'EXPENSE', totalCents: BigInt(2000) }),
        makeUnicoRow({ monthKey: '2026-01', categoryId: CAT_A, type: 'INCOME', totalCents: BigInt(5000) }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(
        USER_A,
        2026,
        [CAT_A],          // categories: solo CAT_A
        undefined,
        ['unico'],        // types: solo únicos
        'expense',        // direction: solo gastos
      );

      // Solo único EXPENSE de CAT_A = 1000
      expect(result.months[0].expenseCents).toBe(1000);
      expect(result.months[0].incomeCents).toBe(0);
      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].categoryId).toBe(CAT_A);
    });

    // -----------------------------------------------------------------------
    // direction no afecta earliestYear
    // -----------------------------------------------------------------------

    it('direction: earliestYear NO se ve afectado', async () => {
      setupEmptyMocks();
      mockRepo.getEarliestYear.mockResolvedValue(2020);

      const result = await service.getReportsMovements(USER_A, 2026, null, undefined, null, 'expense');

      expect(result.earliestYear).toBe(2020);
      expect(mockRepo.getEarliestYear).toHaveBeenCalledWith(USER_A);
    });
  });

  // -------------------------------------------------------------------------
  // RF-REP-015 — Proyección de fijos a futuro (projectFixed / today)
  // -------------------------------------------------------------------------

  describe('RF-REP-015 — proyección de fijos (projectFixed)', () => {
    // -----------------------------------------------------------------------
    // Back-compat: sin projectFixed (o ≠ true) → projected:false en todos
    // -----------------------------------------------------------------------

    it('back-compat: sin projectFixed → todos los meses projected:false, comportamiento idéntico', async () => {
      setupEmptyUnicosMock();
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ amountCents: 1000, startMonth: '2026-01', deletedFrom: null, type: 'EXPENSE' as any }),
      ]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      // Sin pasar projectFixed → undefined → false por defecto
      const result = await service.getReportsMovements(USER_A, 2026);

      // Todos los meses projected:false (back-compat dura)
      result.months.forEach((m) => {
        expect(m.projected).toBe(false);
      });
      // Comportamiento normal: fijo en todos los meses
      result.months.forEach((m) => {
        expect(m.expenseCents).toBe(1000);
      });
    });

    it('back-compat: projectFixed=false → todos los meses projected:false', async () => {
      setupEmptyUnicosMock();
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ amountCents: 2000, startMonth: '2026-01', deletedFrom: null, type: 'EXPENSE' as any }),
      ]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(
        USER_A, 2026, null, undefined, null, undefined, false, '2026-03-15',
      );

      result.months.forEach((m) => {
        expect(m.projected).toBe(false);
      });
    });

    // -----------------------------------------------------------------------
    // Placement de projected: true solo en meses futuros respecto de today
    // -----------------------------------------------------------------------

    it('projected:true solo en meses futuros respecto de today; pasados/presente projected:false', async () => {
      setupEmptyUnicosMock();
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({ amountCents: 500, startMonth: '2026-01', deletedFrom: null, type: 'EXPENSE' as any }),
      ]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      // today = '2026-03-15' → todayMonthKey = '2026-03'
      // Meses pasados/presente: ene(01), feb(02), mar(03) → projected:false
      // Meses futuros: abr(04)..dic(12) → projected:true
      const result = await service.getReportsMovements(
        USER_A, 2026, null, undefined, null, undefined, true, '2026-03-15',
      );

      // Índices 0..2 (ene-mar): projected:false
      result.months.slice(0, 3).forEach((m) => {
        expect(m.projected).toBe(false);
      });
      // Índices 3..11 (abr-dic): projected:true
      result.months.slice(3).forEach((m) => {
        expect(m.projected).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    // Método: valor_línea(m) = canasta_conocida(m) × (1+tasa_precio)^m.
    // Con UNA sola cadena de fijo en alcance, canasta_conocida(m) es constante
    // (el último monto conocido de esa cadena) y la tasa same-basket coincide
    // con la fórmula clásica (dos puntas, compuesto). Estos tests fijan ese
    // caso degenerado con valores verificados a mano / con node.
    // -----------------------------------------------------------------------

    it('cadena común que subió de precio (edición real): tasa>0 y la canasta constante crece compuesta — 2 meses futuros, distintos entre sí', async () => {
      // today='2026-03-15' → todayMonthKey='2026-03'
      // Ventana backward [today-12..today-1] = ['2025-03'..'2026-02']:
      //   '2025-03'..'2026-01': seg0 activo (1000) — deletedFrom='2026-02' > todos
      //   '2026-02':            seg1 activo (1200)
      //   (today '2026-03' NO está en la ventana; monto_hoy=1440 por seg2.)
      //
      // Punta vieja = '2025-03' (primer mes de la ventana, ya con la cadena
      // presente), N = monthDiff('2025-03','2026-03') = 12
      // monto_viejo = 1000, monto_hoy = 1440
      // tasa = (1440/1000)^(1/12) − 1 ≈ 0.030853
      //
      // canasta_conocida(m futuro) = 1440 (única cadena, sin más segmentos)
      // Abr (n=1): round(1440 * 1.030853^1) = round(1484.43) = 1484
      // May (n=2): round(1440 * 1.030853^2) = round(1530.23) = 1530
      const seg0 = makeFijo({
        id: 'seg-old', chainId: 'chain-proj',
        startMonth: '2025-01', amountCents: 1000,
        deletedFrom: '2026-02', type: 'EXPENSE' as any,
      });
      const seg1 = makeFijo({
        id: 'seg-mid', chainId: 'chain-proj',
        startMonth: '2026-02', amountCents: 1200,
        deletedFrom: '2026-03', type: 'EXPENSE' as any,
      });
      const seg2 = makeFijo({
        id: 'seg-new', chainId: 'chain-proj',
        startMonth: '2026-03', amountCents: 1440,
        deletedFrom: null, type: 'EXPENSE' as any,
      });

      setupEmptyUnicosMock();
      mockRepo.getAllFijosForAnnual.mockResolvedValue([seg0, seg1, seg2]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2025);

      const result = await service.getReportsMovements(
        USER_A, 2026, null, undefined, null, undefined, true, '2026-03-15',
      );

      // Meses pasados/presente: importe real del segmento activo en cada mes
      expect(result.months[0].expenseCents).toBe(1000); // ene: seg0 activo, projected:false
      expect(result.months[0].projected).toBe(false);
      expect(result.months[1].expenseCents).toBe(1200); // feb: seg1 activo, projected:false
      expect(result.months[1].projected).toBe(false);
      expect(result.months[2].expenseCents).toBe(1440); // mar: seg2 activo (presente), projected:false
      expect(result.months[2].projected).toBe(false);

      // Meses futuros: canasta constante (1440) × tasa same-basket
      expect(result.months[3].expenseCents).toBe(1484);
      expect(result.months[3].projected).toBe(true);
      expect(result.months[4].expenseCents).toBe(1530);
      expect(result.months[4].projected).toBe(true);
    });

    it('robustez de fase: el mismo salto neto de precio, gradual o de una vez, da la misma tasa (la tasa solo mira las dos puntas)', async () => {
      // Mismo escenario que el anterior pero el salto ocurre hoy de golpe (no
      // escalonado). La tasa solo compara monto_hoy vs. monto en la punta
      // vieja → misma tasa, mismos futuros, sin importar la fase intermedia.
      const oldSeg = makeFijo({
        id: 'seg-old-2w', chainId: 'chain-2w',
        startMonth: '2025-01', amountCents: 1000,
        deletedFrom: '2026-03', type: 'EXPENSE' as any,
      });
      const newSeg = makeFijo({
        id: 'seg-new-2w', chainId: 'chain-2w',
        startMonth: '2026-03', amountCents: 1440,
        deletedFrom: null, type: 'EXPENSE' as any,
      });

      setupEmptyUnicosMock();
      mockRepo.getAllFijosForAnnual.mockResolvedValue([oldSeg, newSeg]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2025);

      const result = await service.getReportsMovements(
        USER_A, 2026, null, undefined, null, undefined, true, '2026-03-15',
      );

      expect(result.months[0].expenseCents).toBe(1000); // ene: old_seg
      expect(result.months[1].expenseCents).toBe(1000); // feb: old_seg
      expect(result.months[2].expenseCents).toBe(1440); // mar: new_seg (presente)

      // Misma tasa que el escenario escalonado → mismos futuros
      expect(result.months[3].expenseCents).toBe(1484);
      expect(result.months[4].expenseCents).toBe(1530);
    });

    it('la tasa usa el monto activo HOY, no el de un segmento futuro pre-planificado (canasta_conocida tampoco lo usa hasta su mes)', async () => {
      // Segmentos: old_seg (2025-01..2026-03, 1000) — punta vieja
      //            cur_seg (2026-03..2026-07, 1440) — activo hoy, base de la tasa
      //            fut_seg (2026-07..null, 9999) — pre-planificado, muy distinto
      // Punta vieja='2025-03'(1000), N=12, monto_hoy=1440 → tasa≈0.030853
      // Jun (n=3, canasta=1440 aún, fut_seg no empezó): round(1440*1.030853^3)=1577
      // Jul (n=4, canasta_conocida('2026-07')=9999 porque fut_seg YA está activo
      //      ese mes futuro): round(9999*1.030853320886...^4) = 11291
      const oldSeg = makeFijo({
        id: 'base-old', chainId: 'chain-base',
        startMonth: '2025-01', amountCents: 1000,
        deletedFrom: '2026-03', type: 'EXPENSE' as any,
      });
      const curSeg = makeFijo({
        id: 'base-cur', chainId: 'chain-base',
        startMonth: '2026-03', amountCents: 1440,
        deletedFrom: '2026-07', type: 'EXPENSE' as any,
      });
      const futSeg = makeFijo({
        id: 'base-fut', chainId: 'chain-base',
        startMonth: '2026-07', amountCents: 9999,
        deletedFrom: null, type: 'EXPENSE' as any,
      });

      setupEmptyUnicosMock();
      mockRepo.getAllFijosForAnnual.mockResolvedValue([oldSeg, curSeg, futSeg]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2025);

      const result = await service.getReportsMovements(
        USER_A, 2026, null, undefined, null, undefined, true, '2026-03-15',
      );

      expect(result.months[0].expenseCents).toBe(1000); // ene: old_seg
      expect(result.months[2].expenseCents).toBe(1440); // mar: cur_seg (presente)
      // Jun (n=3): la canasta sigue en 1440 (fut_seg todavía no arrancó)
      expect(result.months[5].expenseCents).toBe(1577);
      expect(result.months[5].projected).toBe(true);
      // Jul (n=4): la canasta pasa a 9999 (fut_seg activo ese mes) — la tasa
      // sigue siendo la misma (≈0.030853, calculada sobre chain-base hoy/vieja),
      // pero ahora se aplica sobre el monto conocido correcto del mes futuro.
      expect(result.months[6].expenseCents).toBe(11291);
      expect(result.months[6].projected).toBe(true);
    });

    it('proyección compuesta correcta en 9 meses futuros (n=1..9, fórmula directa sobre canasta constante)', async () => {
      // Verifica que la fórmula canasta*(1+rate)^n se aplica correctamente para n=1..9.
      // Mismo setup que el primer test: tasa≈0.030853, canasta_conocida constante=1440.
      const seg0 = makeFijo({ id:'sc-old', chainId:'chain-sc', startMonth:'2025-01', amountCents:1000, deletedFrom:'2026-02', type:'EXPENSE' as any });
      const seg1 = makeFijo({ id:'sc-mid', chainId:'chain-sc', startMonth:'2026-02', amountCents:1200, deletedFrom:'2026-03', type:'EXPENSE' as any });
      const seg2 = makeFijo({ id:'sc-new', chainId:'chain-sc', startMonth:'2026-03', amountCents:1440, deletedFrom:null, type:'EXPENSE' as any });

      setupEmptyUnicosMock();
      mockRepo.getAllFijosForAnnual.mockResolvedValue([seg0, seg1, seg2]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2025);

      const result = await service.getReportsMovements(
        USER_A, 2026, null, undefined, null, undefined, true, '2026-03-15',
      );

      // Verifica los 9 meses futuros (abr=idx3 … dic=idx11)
      const expectedFuture = [1484, 1530, 1577, 1626, 1676, 1728, 1781, 1836, 1893];
      for (let i = 0; i < expectedFuture.length; i++) {
        expect(result.months[3 + i].expenseCents).toBe(expectedFuture[i]);
        expect(result.months[3 + i].projected).toBe(true);
      }
    });

    it('2 meses de vida (N=1): tasa = variación directa entre las dos puntas, futuros compuestos y distintos entre sí', async () => {
      // today='2026-03-15' → todayMonthKey='2026-03'
      // Ventana backward ['2025-03'..'2026-02']: solo '2026-02' tiene presencia
      // de la cadena (seg0, startMonth='2026-02') → punta vieja='2026-02'
      // N = monthDiff('2026-02','2026-03') = 1
      // monto_viejo=1000, monto_hoy=1200 (seg1) → tasa = (1200/1000)^(1/1)−1 = 0.2
      // canasta_conocida(m futuro) = 1200 constante
      // Abr (n=1): round(1200 * 1.2^1) = 1440
      // May (n=2): round(1200 * 1.2^2) = 1728
      const seg0 = makeFijo({
        id: 'seg-2m-a', chainId: 'chain-2m',
        startMonth: '2026-02', amountCents: 1000,
        deletedFrom: '2026-03', type: 'EXPENSE' as any,
      });
      const seg1 = makeFijo({
        id: 'seg-2m-b', chainId: 'chain-2m',
        startMonth: '2026-03', amountCents: 1200,
        deletedFrom: null, type: 'EXPENSE' as any,
      });

      setupEmptyUnicosMock();
      mockRepo.getAllFijosForAnnual.mockResolvedValue([seg0, seg1]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(
        USER_A, 2026, null, undefined, null, undefined, true, '2026-03-15',
      );

      expect(result.months[1].expenseCents).toBe(1000); // feb
      expect(result.months[1].projected).toBe(false);
      expect(result.months[2].expenseCents).toBe(1200); // mar (presente)
      expect(result.months[2].projected).toBe(false);
      expect(result.months[0].expenseCents).toBe(0); // ene: sin segmento activo

      expect(result.months[3].expenseCents).toBe(1440); // abr (n=1)
      expect(result.months[3].projected).toBe(true);
      expect(result.months[4].expenseCents).toBe(1728); // may (n=2) — distinto de abr
      expect(result.months[4].projected).toBe(true);
    });

    // -----------------------------------------------------------------------
    // Sin canasta comparable / fijos nunca editados → tasa 0, plano
    // -----------------------------------------------------------------------

    it('fijo sin historial de cambios (1 segmento constante) → sin variación en la canasta comparable → proyección plana al monto conocido', async () => {
      setupEmptyUnicosMock();
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({
          id: 'fijo-flat', chainId: 'chain-flat',
          startMonth: '2026-01', amountCents: 3000, deletedFrom: null,
          type: 'EXPENSE' as any,
        }),
      ]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(
        USER_A, 2026, null, undefined, null, undefined, true, '2026-03-15',
      );

      result.months.forEach((m) => {
        expect(m.expenseCents).toBe(3000);
      });
      result.months.slice(3).forEach((m) => {
        expect(m.projected).toBe(true);
        expect(m.expenseCents).toBe(3000);
      });
    });

    it('1 mes de vida (startMonth=todayMonth) → sin presencia en la ventana backward → sin punta vieja → tasa=0, plano', async () => {
      setupEmptyUnicosMock();
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({
          id: 'new-this-month', chainId: 'chain-new-month',
          startMonth: '2026-03', amountCents: 5000,
          deletedFrom: null, type: 'EXPENSE' as any,
        }),
      ]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(
        USER_A, 2026, null, undefined, null, undefined, true, '2026-03-15',
      );

      expect(result.months[0].expenseCents).toBe(0);
      expect(result.months[1].expenseCents).toBe(0);
      expect(result.months[2].expenseCents).toBe(5000);
      expect(result.months[2].projected).toBe(false);
      result.months.slice(3).forEach((m) => {
        expect(m.expenseCents).toBe(5000);
        expect(m.projected).toBe(true);
      });
    });

    it('cambio ANTERIOR a la ventana de 12 meses no afecta la tasa (la punta vieja ya cae con el monto actualizado)', async () => {
      // old_seg: 500, deletedFrom='2025-02' → termina antes del inicio de la
      // ventana ('2025-03') → no entra en la ventana.
      // new_seg: 1000 desde '2025-02' → activo en TODA la ventana → punta
      // vieja='2025-03'(1000), monto_hoy=1000 → tasa=0. El salto histórico
      // 500→1000 no afecta la tasa.
      const oldSeg = makeFijo({
        id: 'hist-old', chainId: 'chain-hist',
        startMonth: '2020-01', amountCents: 500,
        deletedFrom: '2025-02', type: 'EXPENSE' as any,
      });
      const newSeg = makeFijo({
        id: 'hist-new', chainId: 'chain-hist',
        startMonth: '2025-02', amountCents: 1000,
        deletedFrom: null, type: 'EXPENSE' as any,
      });

      setupEmptyUnicosMock();
      mockRepo.getAllFijosForAnnual.mockResolvedValue([oldSeg, newSeg]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2020);

      const result = await service.getReportsMovements(
        USER_A, 2026, null, undefined, null, undefined, true, '2026-03-15',
      );

      result.months.forEach((m) => {
        expect(m.expenseCents).toBe(1000);
      });
      result.months.slice(3).forEach((m) => {
        expect(m.projected).toBe(true);
        expect(m.expenseCents).toBe(1000);
      });
    });

    // -----------------------------------------------------------------------
    // Piso en 0: canasta comparable que bajó → tasa 0 (nunca negativa) → plano
    // -----------------------------------------------------------------------

    it('piso en 0: cadena común que BAJÓ de precio → tasa=0 (no negativa) → línea plana al monto conocido, no decreciente', async () => {
      // today='2026-03-15' → todayMonthKey='2026-03'
      // seg0: 2020-01..2026-03 (2000) — punta vieja
      // seg1: 2026-03..null (1000) — activo hoy
      // Punta vieja='2025-03'(2000), N=12, monto_hoy=1000
      // ratio=1000/2000=0.5 → (0.5)^(1/12)-1 ≈ −0.056 → PISO EN 0 → tasa=0
      // canasta_conocida(m futuro) = 1000 constante → futuros PLANOS en 1000,
      // no decrecientes (a diferencia del método CAGR anterior, sin piso).
      const seg0 = makeFijo({
        id: 'neg-seg0', chainId: 'chain-neg',
        startMonth: '2020-01', amountCents: 2000,
        deletedFrom: '2026-03', type: 'EXPENSE' as any,
      });
      const seg1 = makeFijo({
        id: 'neg-seg1', chainId: 'chain-neg',
        startMonth: '2026-03', amountCents: 1000,
        deletedFrom: null, type: 'EXPENSE' as any,
      });

      setupEmptyUnicosMock();
      mockRepo.getAllFijosForAnnual.mockResolvedValue([seg0, seg1]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2020);

      const result = await service.getReportsMovements(
        USER_A, 2026, null, undefined, null, undefined, true, '2026-03-15',
      );

      expect(result.months[2].expenseCents).toBe(1000); // presente (mar)
      expect(result.months[2].projected).toBe(false);

      // Futuros: planos en 1000 (piso en 0, sin decrecer)
      expect(result.months[3].expenseCents).toBe(1000);
      expect(result.months[3].projected).toBe(true);
      expect(result.months[4].expenseCents).toBe(1000);
      expect(result.months[4].projected).toBe(true);
      expect(result.months[11].expenseCents).toBe(1000);
    });

    // -----------------------------------------------------------------------
    // Composición determinista de la canasta (altas/bajas/fijo anual) vs.
    // tasa same-basket: las altas/bajas NO entran en la tasa, se resuelven
    // directamente en canasta_conocida(m). Esto es lo que reemplaza al método
    // CAGR anterior (que contaba las altas como "aumento" y explotaba).
    // -----------------------------------------------------------------------

    describe('composición determinista vs. tasa same-basket (no explota con altas)', () => {
      it('se agrega un fijo nuevo (alta) a mitad de ventana: la cadena nueva NO entra en la tasa → futuro plano al total compuesto, sin explotar', async () => {
        // today='2026-06-15' → todayMonthKey='2026-06'.
        // Fijo A (CAT_A): activo desde '2025-01', SIEMPRE 100000 (flat, nunca editado).
        // Fijo B (CAT_B): arranca '2026-03' (mitad de la ventana backward),
        //   SIEMPRE 50000 (flat, nunca editado).
        //
        // Cadenas comunes hoy vs. punta vieja ('2025-06', primer mes de la
        // ventana): solo chain-a (chain-b no existía en '2025-06'). chain-a
        // nunca varió → tasa=0. La alta de B NO contamina la tasa.
        //
        // canasta_conocida(mes futuro) = A(100000) + B(50000) = 150000
        // constante (ninguna de las dos cadenas vuelve a cambiar) → los
        // futuros son PLANOS en 150000 (con el método CAGR anterior, que
        // contaba la alta como "crecimiento", este mismo escenario daba una
        // curva creciente artificial — el bug que motiva este método).
        const fijoA = makeFijo({
          id: 'agg-a', chainId: 'chain-agg-a',
          startMonth: '2025-01', amountCents: 100000, deletedFrom: null,
          categoryId: CAT_A, type: 'EXPENSE' as any,
        });
        const fijoB = makeFijo({
          id: 'agg-b', chainId: 'chain-agg-b',
          startMonth: '2026-03', amountCents: 50000, deletedFrom: null,
          categoryId: CAT_B, categoryName: 'Tecnología', categoryColor: '#A98BD6',
          type: 'EXPENSE' as any,
        });

        setupEmptyUnicosMock();
        mockRepo.getAllFijosForAnnual.mockResolvedValue([fijoA, fijoB]);
        setupEmptyCuotasMock();
        mockRepo.getEarliestYear.mockResolvedValue(2025);

        const result = await service.getReportsMovements(
          USER_A, 2026, null, undefined, null, undefined, true, '2026-06-15',
        );

        // Presente (jun, idx5): 100000 + 50000 = 150000
        expect(result.months[5].expenseCents).toBe(150000);
        expect(result.months[5].projected).toBe(false);

        // Futuros (jul, ago, sep = idx 6,7,8): PLANOS en 150000, sin explotar
        expect(result.months[6].expenseCents).toBe(150000);
        expect(result.months[6].projected).toBe(true);
        expect(result.months[7].expenseCents).toBe(150000);
        expect(result.months[8].expenseCents).toBe(150000);
      });

      it('la misma alta, ocurra a mitad de ventana o exactamente hoy, da la misma tasa (0) y el mismo futuro plano', async () => {
        // Escenario B: mismo Fijo A (flat, chain-agg-a2), pero el fijo nuevo
        // arranca EXACTAMENTE hoy ('2026-06', sin presencia en la ventana) en
        // vez de a mitad de camino. La tasa depende solo de la cadena común
        // (chain-a), nunca de cuándo se sumó la cadena nueva.
        const fijoA = makeFijo({
          id: 'agg-a2', chainId: 'chain-agg-a2',
          startMonth: '2025-01', amountCents: 100000, deletedFrom: null,
          categoryId: CAT_A, type: 'EXPENSE' as any,
        });
        const fijoC = makeFijo({
          id: 'agg-c2', chainId: 'chain-agg-c2',
          startMonth: '2026-06', amountCents: 50000, deletedFrom: null,
          categoryId: CAT_B, categoryName: 'Tecnología', categoryColor: '#A98BD6',
          type: 'EXPENSE' as any,
        });

        setupEmptyUnicosMock();
        mockRepo.getAllFijosForAnnual.mockResolvedValue([fijoA, fijoC]);
        setupEmptyCuotasMock();
        mockRepo.getEarliestYear.mockResolvedValue(2025);

        const result = await service.getReportsMovements(
          USER_A, 2026, null, undefined, null, undefined, true, '2026-06-15',
        );

        expect(result.months[5].expenseCents).toBe(150000); // presente

        // Mismo resultado plano que el escenario gradual
        expect(result.months[6].expenseCents).toBe(150000);
        expect(result.months[7].expenseCents).toBe(150000);
        expect(result.months[8].expenseCents).toBe(150000);
      });

      it('altas + una cadena común que SÍ subió de precio: la tasa refleja SOLO el encarecimiento del subconjunto estable, moderada, no el salto por la alta (valor verificado a mano)', async () => {
        // today='2026-06-15' → todayMonthKey='2026-06'.
        // chain-a: 100000 (desde antes de la ventana) → 105000 desde hoy
        //   (+5% neto en 12 meses, N=12 → tasa=(105000/100000)^(1/12)-1≈0.4074%/mes)
        // chain-b: fijo NUEVO de 900000 que arranca exactamente hoy (una alta
        //   enorme, 9x el resto). NO tiene presencia en la ventana → excluida
        //   de la tasa por completo.
        //
        // Bajo el método CAGR total anterior, base=1005000/oldest=100000 daría
        // una tasa disparatada (~22%/mes). Bajo este método, la tasa solo
        // refleja el 5% real de chain-a → moderada (~0.41%/mes).
        //
        // canasta_conocida(mes futuro) = 105000 + 900000 = 1005000 constante.
        // Jul (n=1): round(1005000 * 1.05^(1/12))       = 1009094
        // Ago (n=2): round(1005000 * 1.05^(2/12))       = 1013206
        // Sep (n=3): round(1005000 * 1.05^(3/12))       = 1017334
        const chainAOld = makeFijo({
          id: 'mod-a-old', chainId: 'chain-mod-a',
          startMonth: '2020-01', amountCents: 100000,
          deletedFrom: '2026-06', categoryId: CAT_A, type: 'EXPENSE' as any,
        });
        const chainANew = makeFijo({
          id: 'mod-a-new', chainId: 'chain-mod-a',
          startMonth: '2026-06', amountCents: 105000,
          deletedFrom: null, categoryId: CAT_A, type: 'EXPENSE' as any,
        });
        const chainB = makeFijo({
          id: 'mod-b', chainId: 'chain-mod-b',
          startMonth: '2026-06', amountCents: 900000,
          deletedFrom: null, categoryId: CAT_B,
          categoryName: 'Tecnología', categoryColor: '#A98BD6',
          type: 'EXPENSE' as any,
        });

        setupEmptyUnicosMock();
        mockRepo.getAllFijosForAnnual.mockResolvedValue([chainAOld, chainANew, chainB]);
        setupEmptyCuotasMock();
        mockRepo.getEarliestYear.mockResolvedValue(2020);

        const result = await service.getReportsMovements(
          USER_A, 2026, null, undefined, null, undefined, true, '2026-06-15',
        );

        // Presente (jun): 105000 + 900000 = 1005000
        expect(result.months[5].expenseCents).toBe(1005000);
        expect(result.months[5].projected).toBe(false);

        // Futuros: moderados y compuestos, NO una explosión por la alta de 900000
        expect(result.months[6].expenseCents).toBe(1009094);
        expect(result.months[6].projected).toBe(true);
        expect(result.months[7].expenseCents).toBe(1013206);
        expect(result.months[8].expenseCents).toBe(1017334);

        // Sanity: el crecimiento es moderado (~0.4%/mes), muy lejos de una
        // tasa del ~22%/mes que hubiese dado el método CAGR total anterior.
        const growthRatio = result.months[6].expenseCents / result.months[5].expenseCents;
        expect(growthRatio).toBeLessThan(1.01); // <1%/mes, no ~22%/mes
        expect(growthRatio).toBeGreaterThan(1);
      });

      it('baja de un fijo (deletedFrom) se refleja directamente en la canasta futura, no como tasa negativa: cadena restante flat → futuro plano al remanente', async () => {
        // Fijo A (CAT_A): 50000, flat, siempre activo.
        // Fijo B (CAT_B): 150000, activo desde antes de la ventana, eliminado
        //   ANTES de hoy ('2026-03', hoy es '2026-06').
        //
        // Hoy, B ya no está activo → no entra en todayChains → nunca es
        // "cadena común" → la tasa se calcula solo con A (flat) → tasa=0.
        // canasta_conocida(futuro) = solo A = 50000 → plano (la baja de B ya
        // quedó reflejada por la composición, no hace falta una tasa negativa).
        const fijoA = makeFijo({
          id: 'baja-a', chainId: 'chain-baja-a',
          startMonth: '2025-01', amountCents: 50000, deletedFrom: null,
          categoryId: CAT_A, type: 'EXPENSE' as any,
        });
        const fijoB = makeFijo({
          id: 'baja-b', chainId: 'chain-baja-b',
          startMonth: '2025-01', amountCents: 150000, deletedFrom: '2026-03',
          categoryId: CAT_B, categoryName: 'Tecnología', categoryColor: '#A98BD6',
          type: 'EXPENSE' as any,
        });

        setupEmptyUnicosMock();
        mockRepo.getAllFijosForAnnual.mockResolvedValue([fijoA, fijoB]);
        setupEmptyCuotasMock();
        mockRepo.getEarliestYear.mockResolvedValue(2025);

        const result = await service.getReportsMovements(
          USER_A, 2026, null, undefined, null, undefined, true, '2026-06-15',
        );

        // Presente (jun): solo Fijo A (B fue eliminado en marzo)
        expect(result.months[5].expenseCents).toBe(50000);
        expect(result.months[5].projected).toBe(false);

        // Futuros: planos en 50000 (la baja ya está reflejada en la canasta,
        // no se proyecta una caída adicional)
        expect(result.months[6].expenseCents).toBe(50000);
        expect(result.months[6].projected).toBe(true);
        expect(result.months[7].expenseCents).toBe(50000);
      });

      it('varios fijos que arrancan exactamente hoy (altas simultáneas) → ninguno tiene presencia en la ventana → sin punta vieja → plano al total de hoy', async () => {
        const fijoA = makeFijo({
          id: 'new-a', chainId: 'chain-new-a',
          startMonth: '2026-06', amountCents: 60000, deletedFrom: null,
          categoryId: CAT_A, type: 'EXPENSE' as any,
        });
        const fijoB = makeFijo({
          id: 'new-b', chainId: 'chain-new-b',
          startMonth: '2026-06', amountCents: 30000, deletedFrom: null,
          categoryId: CAT_B, categoryName: 'Tecnología', categoryColor: '#A98BD6',
          type: 'EXPENSE' as any,
        });

        setupEmptyUnicosMock();
        mockRepo.getAllFijosForAnnual.mockResolvedValue([fijoA, fijoB]);
        setupEmptyCuotasMock();
        mockRepo.getEarliestYear.mockResolvedValue(2026);

        const result = await service.getReportsMovements(
          USER_A, 2026, null, undefined, null, undefined, true, '2026-06-15',
        );

        expect(result.months[5].expenseCents).toBe(90000); // presente
        expect(result.months[5].projected).toBe(false);

        // Futuros: plano en 90000 (tasa=0, sin punta anterior en la ventana)
        result.months.slice(6).forEach((m) => {
          expect(m.projected).toBe(true);
          expect(m.expenseCents).toBe(90000);
        });
      });

      it('alta con startMonth futuro ya cargada: aparece en la canasta recién desde su mes de inicio, sin afectar la tasa (trivialmente 0, sin cadenas activas hoy)', async () => {
        // today='2026-01-15' → todayMonthKey='2026-01'. Fijo cargado con
        // startMonth='2026-07' (alta pre-planificada, todavía no arrancó).
        // Hoy no hay ninguna cadena activa en la línea → tasa=0 (trivial).
        // canasta_conocida(mes) = 0 hasta jun-2026 inclusive; 3000 desde jul.
        setupEmptyUnicosMock();
        mockRepo.getAllFijosForAnnual.mockResolvedValue([
          makeFijo({
            id: 'future-alta', chainId: 'chain-future-alta',
            startMonth: '2026-07', amountCents: 3000, deletedFrom: null,
            type: 'EXPENSE' as any,
          }),
        ]);
        setupEmptyCuotasMock();
        mockRepo.getEarliestYear.mockResolvedValue(2026);

        const result = await service.getReportsMovements(
          USER_A, 2026, null, undefined, null, undefined, true, '2026-01-15',
        );

        // Ene (presente, idx0): sin actividad
        expect(result.months[0].expenseCents).toBe(0);
        expect(result.months[0].projected).toBe(false);

        // Feb-jun (futuros, antes del alta): en cero, la cadena todavía no arrancó
        for (let i = 1; i <= 5; i++) {
          expect(result.months[i].projected).toBe(true);
          expect(result.months[i].expenseCents).toBe(0);
        }

        // Jul en adelante (futuros, desde el alta): 3000, plano (tasa=0)
        for (let i = 6; i <= 11; i++) {
          expect(result.months[i].projected).toBe(true);
          expect(result.months[i].expenseCents).toBe(3000);
        }
      });

      it('baja con deletedFrom futuro: desaparece de la canasta desde ese mes en adelante', async () => {
        // today='2026-01-15' → todayMonthKey='2026-01'. Fijo activo desde
        // antes, con baja programada en '2026-07' (deletedFrom futuro).
        setupEmptyUnicosMock();
        mockRepo.getAllFijosForAnnual.mockResolvedValue([
          makeFijo({
            id: 'future-baja', chainId: 'chain-future-baja',
            startMonth: '2025-01', amountCents: 4000, deletedFrom: '2026-07',
            type: 'EXPENSE' as any,
          }),
        ]);
        setupEmptyCuotasMock();
        mockRepo.getEarliestYear.mockResolvedValue(2025);

        const result = await service.getReportsMovements(
          USER_A, 2026, null, undefined, null, undefined, true, '2026-01-15',
        );

        // Ene (presente): activo, 4000
        expect(result.months[0].expenseCents).toBe(4000);
        expect(result.months[0].projected).toBe(false);

        // Feb-jun (futuros, antes de la baja): sigue activo, 4000 (tasa=0, flat)
        for (let i = 1; i <= 5; i++) {
          expect(result.months[i].projected).toBe(true);
          expect(result.months[i].expenseCents).toBe(4000);
        }

        // Jul en adelante (futuros, desde la baja): desaparece de la canasta
        for (let i = 6; i <= 11; i++) {
          expect(result.months[i].projected).toBe(true);
          expect(result.months[i].expenseCents).toBe(0);
        }
      });

      it('fijo ANNUAL: solo aparece en la canasta el mes en que le toca según su frecuencia', async () => {
        // today='2026-01-15' → todayMonthKey='2026-01'. Fijo ANNUAL con
        // startMonth='2025-06' → ocurre en jun-2025, jun-2026, jun-2027, ...
        setupEmptyUnicosMock();
        mockRepo.getAllFijosForAnnual.mockResolvedValue([
          makeFijo({
            id: 'annual-fijo', chainId: 'chain-annual',
            startMonth: '2025-06', amountCents: 12000, deletedFrom: null,
            frequency: 12, type: 'EXPENSE' as any,
          }),
        ]);
        setupEmptyCuotasMock();
        mockRepo.getEarliestYear.mockResolvedValue(2025);

        const result = await service.getReportsMovements(
          USER_A, 2026, null, undefined, null, undefined, true, '2026-01-15',
        );

        // Ene (presente): no le toca este mes
        expect(result.months[0].expenseCents).toBe(0);

        // Feb-may (futuros): no le toca
        for (let i = 1; i <= 4; i++) {
          expect(result.months[i].projected).toBe(true);
          expect(result.months[i].expenseCents).toBe(0);
        }
        // Jun (futuro, idx5): le toca → 12000
        expect(result.months[5].projected).toBe(true);
        expect(result.months[5].expenseCents).toBe(12000);
        // Jul-dic (futuros): no le toca de nuevo
        for (let i = 6; i <= 11; i++) {
          expect(result.months[i].expenseCents).toBe(0);
        }
      });
    });

    // -----------------------------------------------------------------------
    // Fix: tasa_precio = crecimiento ponderado por tamaño, por cadena, sobre
    // SU PROPIA historia disponible en la ventana — reemplaza al método de
    // "ancla en la punta vieja común" (que, con datos reales, anclaba en la
    // única cadena con 12 meses de historia —flat— y dejaba la tasa en 0,
    // ignorando cadenas con historia parcial que sí variaban fuerte).
    // -----------------------------------------------------------------------

    describe('tasa ponderada por tamaño, por cadena (fix: el ancla plana con historia completa ya no opaca a las cadenas con historia parcial)', () => {
      it('cadena ancla flat con 12 meses de historia + cadena con historia parcial (6 meses) que subió: la tasa refleja el crecimiento ponderado, no queda en 0 (bug real reproducido)', async () => {
        // today='2026-07-15' → todayMonthKey='2026-07'. Ventana=[2025-07..2026-06].
        // "Tidal": chain-tidal, activa desde 2020, SIEMPRE 50000 (flat) → tiene
        //   presencia en TODA la ventana (sería la "punta vieja" bajo el
        //   método viejo) pero su propio growth es 0.
        // "Telecentro": chain-tele, solo tiene historia desde '2026-01' (6
        //   meses dentro de la ventana): 8000 → 12000 (+50% en 6 meses).
        //   Bajo el método viejo, al no estar presente en la punta vieja
        //   ('2025-07'), quedaba excluida de la tasa por completo, y la tasa
        //   quedaba en 0 (arrastrada por Tidal). Bajo el nuevo método, cada
        //   cadena usa SU propia ventana disponible → Telecentro sí aporta.
        //
        // growthTele = (12000/8000)^(1/6) − 1 ≈ 0.06991319 (CAGR mensual propio)
        // rate = (50000·0 + 12000·growthTele) / (50000+12000) ≈ 0.01353159
        // canasta_conocida(futuro) = 50000 + 12000 = 62000 constante
        // Ago (n=1): round(62000 * 1.01353159^1) = 62839
        // Sep (n=2): round(62000 * 1.01353159^2) = 63689
        // Oct (n=3): round(62000 * 1.01353159^3) = 64551
        const tidal = makeFijo({
          id: 'tidal', chainId: 'chain-tidal',
          startMonth: '2020-01', amountCents: 50000, deletedFrom: null,
          type: 'EXPENSE' as any,
        });
        const teleOld = makeFijo({
          id: 'tele-old', chainId: 'chain-tele',
          startMonth: '2026-01', amountCents: 8000, deletedFrom: '2026-07',
          categoryId: CAT_B, categoryName: 'Tecnología', categoryColor: '#A98BD6',
          type: 'EXPENSE' as any,
        });
        const teleNew = makeFijo({
          id: 'tele-new', chainId: 'chain-tele',
          startMonth: '2026-07', amountCents: 12000, deletedFrom: null,
          categoryId: CAT_B, categoryName: 'Tecnología', categoryColor: '#A98BD6',
          type: 'EXPENSE' as any,
        });

        setupEmptyUnicosMock();
        mockRepo.getAllFijosForAnnual.mockResolvedValue([tidal, teleOld, teleNew]);
        setupEmptyCuotasMock();
        mockRepo.getEarliestYear.mockResolvedValue(2020);

        const result = await service.getReportsMovements(
          USER_A, 2026, null, undefined, null, undefined, true, '2026-07-15',
        );

        // Presente (jul, idx6): 50000 + 12000 = 62000
        expect(result.months[6].expenseCents).toBe(62000);
        expect(result.months[6].projected).toBe(false);

        // Futuros: crece (ya NO queda plano en 62000 como con el método viejo)
        expect(result.months[7].expenseCents).toBe(62839); // ago (n=1)
        expect(result.months[7].projected).toBe(true);
        expect(result.months[8].expenseCents).toBe(63689); // sep (n=2)
        expect(result.months[9].expenseCents).toBe(64551); // oct (n=3)
        // sep ≠ oct ≠ nov (creciente, con pendiente, no plano)
        expect(result.months[8].expenseCents).not.toBe(result.months[9].expenseCents);
        expect(result.months[9].expenseCents).not.toBe(result.months[10].expenseCents);
      });

      it('piso en 0 sobre el promedio ponderado FINAL (no por cadena): una cadena que bajó fuerte y pesa más que arrastra el promedio a negativo → tasa=0, no un promedio "pre-flooreado" por cadena', async () => {
        // today='2026-07-15' → todayMonthKey='2026-07'. Ventana=[2025-07..2026-06].
        // "Down" (peso grande, bajó fuerte): 20000 (desde '2026-01') → 10000 hoy.
        //   growthDown = (10000/20000)^(1/6) − 1 ≈ −0.10910128
        // "Up" (peso chico, subió poco): 1000 (desde '2026-01') → 1100 hoy.
        //   growthUp = (1100/1000)^(1/6) − 1 ≈ 0.01601187
        //
        // Promedio ponderado CRUDO (sin flooreo por cadena):
        //   (10000·growthDown + 1100·growthUp) / 11100 ≈ −0.0967 (negativo)
        //   → piso en 0 SOLO al final → tasa=0 → futuros PLANOS en 11100.
        //
        // Si el piso se aplicara por cadena ANTES de ponderar (growthDown
        // flooreado a 0 antes de la suma), el resultado sería ≈+0.1587%
        // mensual (positivo) — un futuro CRECIENTE, distinto del esperado
        // (plano). Este test distingue ambas implementaciones.
        const down1 = makeFijo({
          id: 'down-old', chainId: 'chain-down',
          startMonth: '2026-01', amountCents: 20000, deletedFrom: '2026-07',
          type: 'EXPENSE' as any,
        });
        const down2 = makeFijo({
          id: 'down-new', chainId: 'chain-down',
          startMonth: '2026-07', amountCents: 10000, deletedFrom: null,
          type: 'EXPENSE' as any,
        });
        const up1 = makeFijo({
          id: 'up-old', chainId: 'chain-up',
          startMonth: '2026-01', amountCents: 1000, deletedFrom: '2026-07',
          categoryId: CAT_B, categoryName: 'Tecnología', categoryColor: '#A98BD6',
          type: 'EXPENSE' as any,
        });
        const up2 = makeFijo({
          id: 'up-new', chainId: 'chain-up',
          startMonth: '2026-07', amountCents: 1100, deletedFrom: null,
          categoryId: CAT_B, categoryName: 'Tecnología', categoryColor: '#A98BD6',
          type: 'EXPENSE' as any,
        });

        setupEmptyUnicosMock();
        mockRepo.getAllFijosForAnnual.mockResolvedValue([down1, down2, up1, up2]);
        setupEmptyCuotasMock();
        mockRepo.getEarliestYear.mockResolvedValue(2026);

        const result = await service.getReportsMovements(
          USER_A, 2026, null, undefined, null, undefined, true, '2026-07-15',
        );

        // Presente (jul, idx6): 10000 + 1100 = 11100
        expect(result.months[6].expenseCents).toBe(11100);
        expect(result.months[6].projected).toBe(false);

        // Futuros: planos en 11100 (piso en 0 sobre el agregado, NO creciente)
        expect(result.months[7].expenseCents).toBe(11100);
        expect(result.months[7].projected).toBe(true);
        expect(result.months[8].expenseCents).toBe(11100);
        expect(result.months[11].expenseCents).toBe(11100);
      });

      it('fijo sin ningún monto previo en la ventana (alta reciente) se excluye del cálculo de la tasa pero SÍ participa en canasta_conocida', async () => {
        // today='2026-07-15' → todayMonthKey='2026-07'.
        // "Base" (con historia, sube +50000 total plano — sin variación): flat
        //   desde antes de la ventana → growth=0.
        // "Alta" (chain-alta): arranca EXACTAMENTE hoy, monto GRANDE (500000,
        //   10x Base) → sin ningún monto previo en la ventana → EXCLUIDA del
        //   cálculo de la tasa (no la infla ni la diluye), pero SÍ suma en
        //   canasta_conocida desde hoy en adelante.
        const base = makeFijo({
          id: 'base-flat', chainId: 'chain-base-flat',
          startMonth: '2020-01', amountCents: 50000, deletedFrom: null,
          type: 'EXPENSE' as any,
        });
        const alta = makeFijo({
          id: 'alta-grande', chainId: 'chain-alta-grande',
          startMonth: '2026-07', amountCents: 500000, deletedFrom: null,
          categoryId: CAT_B, categoryName: 'Tecnología', categoryColor: '#A98BD6',
          type: 'EXPENSE' as any,
        });

        setupEmptyUnicosMock();
        mockRepo.getAllFijosForAnnual.mockResolvedValue([base, alta]);
        setupEmptyCuotasMock();
        mockRepo.getEarliestYear.mockResolvedValue(2020);

        const result = await service.getReportsMovements(
          USER_A, 2026, null, undefined, null, undefined, true, '2026-07-15',
        );

        // Presente (jul, idx6): 50000 + 500000 = 550000
        expect(result.months[6].expenseCents).toBe(550000);
        expect(result.months[6].projected).toBe(false);

        // Futuros: la tasa es 0 (única cadena con historia, "base", es flat;
        // "alta" quedó excluida por no tener monto previo) → canasta
        // constante en 550000 (alta SÍ está en la canasta, plana)
        expect(result.months[7].expenseCents).toBe(550000);
        expect(result.months[7].projected).toBe(true);
        expect(result.months[11].expenseCents).toBe(550000);
      });
    });

    // -----------------------------------------------------------------------
    // Skips no cuentan para la tasa (sí para la canasta_conocida del mes real)
    // -----------------------------------------------------------------------

    it('skip del mes de hoy no corrompe la tasa (usa el monto conocido de la cadena), aunque sí deje en 0 el total real de ese mes', async () => {
      // today='2026-03-15' → todayMonthKey='2026-03'.
      // seg_old: 1000, activo en toda la ventana (deletedFrom='2026-03').
      // seg_new: 1200, activo desde hoy, pero SKIPPEADO en '2026-03' (no se
      // cobra este mes puntual, pero el precio conocido sigue siendo 1200).
      //
      // Real (mar, presente): el loop normal respeta el skip → 0.
      // Tasa: punta vieja='2025-03'(1000), N=12, monto_hoy=1200 (NO
      //   zero-eado por el skip) → tasa=(1200/1000)^(1/12)-1≈0.015309
      // canasta_conocida(abr) = 1200 (abril no está skippeado) →
      //   Abr (n=1): round(1200*1.015309^1) = 1218
      //   May (n=2): round(1200*1.015309^2) = 1237
      const segOld = makeFijo({
        id: 'skip-old', chainId: 'chain-skip',
        startMonth: '2025-01', amountCents: 1000,
        deletedFrom: '2026-03', type: 'EXPENSE' as any,
      });
      const segNew = makeFijo({
        id: 'skip-new', chainId: 'chain-skip',
        startMonth: '2026-03', amountCents: 1200,
        deletedFrom: null, type: 'EXPENSE' as any,
        skippedMonths: new Set(['2026-03']),
      });

      setupEmptyUnicosMock();
      mockRepo.getAllFijosForAnnual.mockResolvedValue([segOld, segNew]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2025);

      const result = await service.getReportsMovements(
        USER_A, 2026, null, undefined, null, undefined, true, '2026-03-15',
      );

      // Presente (mar): skippeado → 0 en el total real
      expect(result.months[2].expenseCents).toBe(0);
      expect(result.months[2].projected).toBe(false);

      // Futuros: la tasa usó 1200 (no 0) como monto_hoy → futuros crecientes,
      // no un salto artificial de "0 a 1200"
      expect(result.months[3].expenseCents).toBe(1218);
      expect(result.months[3].projected).toBe(true);
      expect(result.months[4].expenseCents).toBe(1237);
      expect(result.months[4].projected).toBe(true);
    });

    // -----------------------------------------------------------------------
    // Cuotas NO se proyectan: excluidas de meses futuros cuando projectFixed=true
    // -----------------------------------------------------------------------

    it('cuotas NO se proyectan: sus aportes son 0 en meses futuros cuando projectFixed=true', async () => {
      setupEmptyUnicosMock();
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({
          chainId: 'chain-fijo-cuota-test',
          amountCents: 1000,
          startMonth: '2026-01',
          deletedFrom: null,
          type: 'EXPENSE' as any,
        }),
      ]);
      mockRepo.getAllCuotasForAnnual.mockResolvedValue([
        makeCuota({ amountCents: 5000, totalInstallments: 12, startMonth: '2026-01', type: 'EXPENSE' as any }),
      ]);
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(
        USER_A, 2026, null, undefined, null, undefined, true, '2026-03-15',
      );

      result.months.slice(0, 3).forEach((m) => {
        expect(m.expenseCents).toBe(6000);
        expect(m.projected).toBe(false);
      });

      result.months.slice(3).forEach((m) => {
        expect(m.expenseCents).toBe(1000);
        expect(m.projected).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    // Únicos NO se proyectan: sin extrapolación a meses donde no tienen datos
    // -----------------------------------------------------------------------

    it('únicos NO se proyectan: un único en enero no aparece en meses futuros', async () => {
      mockRepo.getAnnualUnicosAggregated.mockResolvedValue([
        makeUnicoRow({ monthKey: '2026-01', type: 'EXPENSE', totalCents: BigInt(7000) }),
      ]);
      setupEmptyFijosMock();
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(
        USER_A, 2026, null, undefined, null, undefined, true, '2026-03-15',
      );

      expect(result.months[0].expenseCents).toBe(7000);
      expect(result.months[0].projected).toBe(false);

      result.months.slice(3).forEach((m) => {
        expect(m.expenseCents).toBe(0);
        expect(m.projected).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    // Dirección: EXPENSE extiende expenseCents, INCOME extiende incomeCents
    // -----------------------------------------------------------------------

    it('fijo EXPENSE proyectado extiende expenseCents; fijo INCOME proyectado extiende incomeCents', async () => {
      setupEmptyUnicosMock();
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({
          id: 'fijo-exp', chainId: 'chain-exp',
          amountCents: 5000, startMonth: '2026-01', deletedFrom: null,
          type: 'EXPENSE' as any,
        }),
        makeFijo({
          id: 'fijo-inc', chainId: 'chain-inc',
          amountCents: 8000, startMonth: '2026-01', deletedFrom: null,
          type: 'INCOME' as any,
        }),
      ]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(
        USER_A, 2026, null, undefined, null, undefined, true, '2026-03-15',
      );

      result.months.slice(3).forEach((m) => {
        expect(m.projected).toBe(true);
        expect(m.expenseCents).toBe(5000); // fijo EXPENSE
        expect(m.incomeCents).toBe(8000);  // fijo INCOME
      });
    });

    // -----------------------------------------------------------------------
    // Horizonte ilimitado: año completamente futuro
    // -----------------------------------------------------------------------

    it('horizonte ilimitado: fijo ya activo hoy → año completamente futuro sigue mostrando la canasta conocida (plana)', async () => {
      // today='2025-12-15' → todayMonthKey='2025-12'. Todo 2026 es futuro.
      // El fijo arranca en 2025-01 (ya activo hoy y en toda la ventana
      // backward, mismo monto siempre) → tasa=0 (plano) → el horizonte
      // ilimitado se sigue mostrando aunque el usuario navegue a un año
      // completamente futuro (2026).
      setupEmptyUnicosMock();
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({
          chainId: 'chain-future-active',
          amountCents: 2000,
          startMonth: '2025-01',
          deletedFrom: null,
          type: 'EXPENSE' as any,
        }),
      ]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2025);

      const result = await service.getReportsMovements(
        USER_A, 2026, null, undefined, null, undefined, true, '2025-12-15',
      );

      result.months.forEach((m) => {
        expect(m.projected).toBe(true);
      });
      result.months.forEach((m) => {
        expect(m.expenseCents).toBe(2000);
      });
    });

    // -----------------------------------------------------------------------
    // Combinación con filtros de RF-REP-014
    // -----------------------------------------------------------------------

    it('combinación con direction=expense: fijo INCOME no se proyecta en incomeCents de meses futuros', async () => {
      setupEmptyUnicosMock();
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({
          id: 'fijo-e', chainId: 'chain-e',
          amountCents: 4000, startMonth: '2026-01', deletedFrom: null,
          type: 'EXPENSE' as any,
        }),
        makeFijo({
          id: 'fijo-i', chainId: 'chain-i',
          amountCents: 9000, startMonth: '2026-01', deletedFrom: null,
          type: 'INCOME' as any,
        }),
      ]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(
        USER_A, 2026, null, undefined, null, 'expense', true, '2026-03-15',
      );

      result.months.slice(3).forEach((m) => {
        expect(m.projected).toBe(true);
        expect(m.expenseCents).toBe(4000); // EXPENSE fijo
        expect(m.incomeCents).toBe(0);     // INCOME fijo excluido por direction=expense
      });
    });

    it('combinación con filtro de categorías: solo fijos de la categoría filtrada entran en la canasta y en la tasa', async () => {
      setupEmptyUnicosMock();
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({
          id: 'fijo-cat-a', chainId: 'chain-cat-a',
          amountCents: 1500, startMonth: '2026-01', deletedFrom: null,
          categoryId: CAT_A, type: 'EXPENSE' as any,
        }),
        makeFijo({
          id: 'fijo-cat-b', chainId: 'chain-cat-b',
          amountCents: 6000, startMonth: '2026-01', deletedFrom: null,
          categoryId: CAT_B, categoryName: 'Tecnología', categoryColor: '#A98BD6',
          type: 'EXPENSE' as any,
        }),
      ]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      // Filtro: solo CAT_A
      const result = await service.getReportsMovements(
        USER_A, 2026, [CAT_A], undefined, null, undefined, true, '2026-03-15',
      );

      // Meses futuros: solo fijo de CAT_A (1500), plano; CAT_B excluida por filtro
      result.months.slice(3).forEach((m) => {
        expect(m.projected).toBe(true);
        expect(m.expenseCents).toBe(1500);
      });
    });

    it('combinación con typesFilter=["cuota"]: fijos excluidos, meses futuros en cero', async () => {
      setupEmptyUnicosMock();
      mockRepo.getAllFijosForAnnual.mockResolvedValue([
        makeFijo({
          chainId: 'chain-no-proj',
          amountCents: 9999, startMonth: '2026-01', deletedFrom: null,
          type: 'EXPENSE' as any,
        }),
      ]);
      mockRepo.getAllCuotasForAnnual.mockResolvedValue([
        makeCuota({ amountCents: 3000, totalInstallments: 12, startMonth: '2026-01', type: 'EXPENSE' as any }),
      ]);
      mockRepo.getEarliestYear.mockResolvedValue(2026);

      const result = await service.getReportsMovements(
        USER_A, 2026, null, undefined, ['cuota'], undefined, true, '2026-03-15',
      );

      result.months.slice(3).forEach((m) => {
        expect(m.projected).toBe(true);
        expect(m.expenseCents).toBe(0);
      });

      result.months.slice(0, 3).forEach((m) => {
        expect(m.projected).toBe(false);
        expect(m.expenseCents).toBe(3000);
      });
    });

    it('filtro de categorías (RF-REP-014) que reduce el alcance a una sola cadena flat: filtro deja fuera la cadena que aportaba composición, plano al remanente', async () => {
      // Mismo setup que "no explota con altas" (A: 100000 flat desde siempre,
      // B: 50000 desde '2026-03'), pero filtrado a [CAT_A] → CAT_B queda
      // fuera del alcance por completo: canasta_conocida=100000 constante,
      // única cadena en alcance (A) nunca varió → tasa=0 → plano en 100000.
      const fijoA = makeFijo({
        id: 'filt-a', chainId: 'chain-filt-a',
        startMonth: '2025-01', amountCents: 100000, deletedFrom: null,
        categoryId: CAT_A, type: 'EXPENSE' as any,
      });
      const fijoB = makeFijo({
        id: 'filt-b', chainId: 'chain-filt-b',
        startMonth: '2026-03', amountCents: 50000, deletedFrom: null,
        categoryId: CAT_B, categoryName: 'Tecnología', categoryColor: '#A98BD6',
        type: 'EXPENSE' as any,
      });

      setupEmptyUnicosMock();
      mockRepo.getAllFijosForAnnual.mockResolvedValue([fijoA, fijoB]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2025);

      const result = await service.getReportsMovements(
        USER_A, 2026, [CAT_A], undefined, null, undefined, true, '2026-06-15',
      );

      expect(result.months[5].expenseCents).toBe(100000);

      result.months.slice(6).forEach((m) => {
        expect(m.projected).toBe(true);
        expect(m.expenseCents).toBe(100000);
      });
    });

    it('direction=expense proyecta SOLO la línea de gasto: incomeCents queda en 0 aunque su propia canasta también existiera', async () => {
      // Fijo EXPENSE (dos cadenas, una flat desde antes + una alta mid-window,
      // mismo patrón que "no explota con altas" → plano en 150000).
      // Fijo INCOME: direction=expense excluye la línea de ingreso por completo.
      const fijoExpA = makeFijo({
        id: 'dir-exp-a', chainId: 'chain-dir-exp-a',
        startMonth: '2025-01', amountCents: 100000, deletedFrom: null,
        categoryId: CAT_A, type: 'EXPENSE' as any,
      });
      const fijoExpB = makeFijo({
        id: 'dir-exp-b', chainId: 'chain-dir-exp-b',
        startMonth: '2026-03', amountCents: 50000, deletedFrom: null,
        categoryId: CAT_A, type: 'EXPENSE' as any,
      });
      const fijoInc = makeFijo({
        id: 'dir-inc-a', chainId: 'chain-dir-inc-a',
        startMonth: '2026-03', amountCents: 80000, deletedFrom: null,
        categoryId: CAT_B, categoryName: 'Tecnología', categoryColor: '#A98BD6',
        type: 'INCOME' as any,
      });

      setupEmptyUnicosMock();
      mockRepo.getAllFijosForAnnual.mockResolvedValue([fijoExpA, fijoExpB, fijoInc]);
      setupEmptyCuotasMock();
      mockRepo.getEarliestYear.mockResolvedValue(2025);

      const result = await service.getReportsMovements(
        USER_A, 2026, null, undefined, null, 'expense', true, '2026-06-15',
      );

      // Futuros: expenseCents plano en 150000 (composición, sin explotar);
      // incomeCents en 0 pese a que la línea de ingreso también tenía canasta.
      expect(result.months[6].expenseCents).toBe(150000);
      expect(result.months[6].incomeCents).toBe(0);
      expect(result.months[7].expenseCents).toBe(150000);
      expect(result.months[7].incomeCents).toBe(0);
    });
  });
});
