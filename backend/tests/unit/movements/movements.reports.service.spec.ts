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
import { RecurringFrequency } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { MovementsService } from '../../../src/movements/movements.service';
import {
  MovementsRepository,
  RecurringForAnnual,
  InstallmentGroupForAnnual,
} from '../../../src/movements/movements.repository';

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
};

const mockLogger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
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
}) {
  return {
    monthKey: overrides.monthKey,
    categoryId: overrides.categoryId ?? CAT_A,
    categoryName: overrides.categoryName ?? 'Consumibles',
    categoryColor: overrides.categoryColor ?? '#4F86C6',
    categoryScope: overrides.categoryScope ?? 'EXPENSE',
    type: overrides.type ?? 'EXPENSE',
    totalCents: overrides.totalCents ?? BigInt(1000),
  };
}

function makeFijo(overrides: Partial<RecurringForAnnual> = {}): RecurringForAnnual {
  return {
    id: 'fijo-001',
    type: 'EXPENSE' as any,
    amountCents: 5000,
    startMonth: '2026-01',
    deletedFrom: null,
    frequency: RecurringFrequency.MONTHLY,
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
    totalInstallments: 12,
    startMonth: '2026-01',
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
});
