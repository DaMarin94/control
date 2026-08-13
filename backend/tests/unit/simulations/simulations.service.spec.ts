/**
 * Tests unitarios de SimulationsService (Módulo 3.15, RF-SIM-001..004, RN-028/029).
 *
 * Cubre:
 * - create(): éxito, categoría inválida (propaga 400 del validador), ya
 *   simulada (409), datos insuficientes (<3 meses, 400), carrera contra el
 *   índice único parcial de la DB (P2002 → 409).
 * - remove(): éxito (borrado físico, sin historial), no encontrada / ajena (404).
 * - findAll(): monthsWithData + paused (RF-SIM-002) por simulación.
 * - findCandidates(): monthsWithData + alreadySimulated por categoría del catálogo activo.
 * - getSimulatedItemsForMonth(): mes en curso/pasado (nunca simula), fuera de
 *   horizonte (nunca simula), categoría con exactamente 3 meses (simula),
 *   categoría con 2 meses (no simula, pausada), valor que redondea a 0
 *   centavos (no genera fila aunque haya 3+ meses con datos), signo que da
 *   ingreso, id sintético estable.
 */
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Currency, MovementType, Prisma } from '@prisma/client';
import { SimulationsService } from '../../../src/simulations/simulations.service';
import { SimulationsRepository, RawSimulationUnicoRow } from '../../../src/simulations/simulations.repository';

const mockLogger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
};

function makeRepoMock(): jest.Mocked<SimulationsRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findByCategory: jest.fn().mockResolvedValue(null),
    findAllForUser: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue(undefined),
    findCategoriesByIds: jest.fn().mockResolvedValue([]),
    getUnicosMonthlyTotalsByCategory: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<SimulationsRepository>;
}

const USER_ID = 'user-sim-1';
const CAT_ID = 'cat-sim-1';

function makeSettingsService() {
  return {
    getSettings: jest.fn().mockResolvedValue({ defaultCurrency: Currency.ARS, lastExchangeRate: null }),
  };
}

function makeCategoryValidator() {
  return { validateCategory: jest.fn().mockResolvedValue(undefined) };
}

function makeCategoriesService() {
  return { findAll: jest.fn().mockResolvedValue([]) };
}

function makeReferenceRatesService() {
  return { getPivotRatesForMonth: jest.fn().mockResolvedValue(null) };
}

/** Fila cruda de único agregado, en ARS (currency === anchorCurrency === displayCurrency por default). */
function row(
  monthKey: string,
  totalCents: number,
  type: 'EXPENSE' | 'INCOME' = 'EXPENSE',
  categoryId = CAT_ID,
): RawSimulationUnicoRow {
  return {
    categoryId,
    monthKey,
    type,
    currency: 'ARS',
    exchangeRate: '1',
    anchorCurrency: 'ARS',
    totalCents: BigInt(totalCents),
  };
}

function buildService(overrides: {
  repo?: jest.Mocked<SimulationsRepository>;
  categoryValidator?: ReturnType<typeof makeCategoryValidator>;
  categoriesService?: ReturnType<typeof makeCategoriesService>;
  settingsService?: ReturnType<typeof makeSettingsService>;
  referenceRatesService?: ReturnType<typeof makeReferenceRatesService>;
} = {}) {
  const repo = overrides.repo ?? makeRepoMock();
  const categoryValidator = overrides.categoryValidator ?? makeCategoryValidator();
  const categoriesService = overrides.categoriesService ?? makeCategoriesService();
  const settingsService = overrides.settingsService ?? makeSettingsService();
  const referenceRatesService = overrides.referenceRatesService ?? makeReferenceRatesService();

  const service = new SimulationsService(
    repo,
    categoryValidator as never,
    categoriesService as never,
    settingsService as never,
    referenceRatesService as never,
    mockLogger as never,
  );

  return { service, repo, categoryValidator, categoriesService, settingsService, referenceRatesService };
}

describe('SimulationsService', () => {
  beforeEach(() => jest.clearAllMocks());

  // ---------------------------------------------------------------------------
  // create() — RF-SIM-001
  // ---------------------------------------------------------------------------

  describe('create()', () => {
    it('crea la simulación cuando la categoría tiene ≥3 meses con únicos en la ventana', async () => {
      const { service, repo } = buildService();
      // 3 meses con dato dentro de la ventana [A-12..A-1] (A = 2026-07 → ventana 2025-07..2026-06).
      repo.getUnicosMonthlyTotalsByCategory.mockResolvedValue([
        row('2026-04', 10000),
        row('2026-05', 10000),
        row('2026-06', 10000),
      ]);
      repo.create.mockResolvedValue({
        id: 'sim-1',
        userId: USER_ID,
        categoryId: CAT_ID,
        createdAt: new Date('2026-07-01T00:00:00Z'),
        updatedAt: new Date('2026-07-01T00:00:00Z'),
      });
      repo.findCategoriesByIds.mockResolvedValue([
        { id: CAT_ID, name: 'Salidas', color: '#FF0000', scope: 'BOTH' as never },
      ]);

      const result = await service.create(USER_ID, CAT_ID, '2026-07-15');

      expect(result.id).toBe('sim-1');
      expect(result.monthsWithData).toBe(3);
      expect(result.paused).toBe(false);
      expect(repo.create).toHaveBeenCalledWith(USER_ID, CAT_ID);
    });

    it('propaga el 400 del validador de categoría (inexistente/ajena/eliminada) sin crear nada', async () => {
      const categoryValidator = makeCategoryValidator();
      categoryValidator.validateCategory.mockRejectedValue(
        new BadRequestException('La categoría no existe o no pertenece al usuario'),
      );
      const { service, repo } = buildService({ categoryValidator });

      await expect(service.create(USER_ID, 'cat-ajena')).rejects.toThrow(BadRequestException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('409 si ya existe una simulación sobre la categoría', async () => {
      const { service, repo } = buildService();
      repo.findByCategory.mockResolvedValue({
        id: 'sim-existing',
        userId: USER_ID,
        categoryId: CAT_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(service.create(USER_ID, CAT_ID)).rejects.toThrow(ConflictException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('400 si la categoría tiene menos de 3 meses con únicos en la ventana (2 meses)', async () => {
      const { service, repo } = buildService();
      repo.getUnicosMonthlyTotalsByCategory.mockResolvedValue([
        row('2026-05', 10000),
        row('2026-06', 10000),
      ]);

      await expect(service.create(USER_ID, CAT_ID, '2026-07-15')).rejects.toThrow(BadRequestException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('409 si la creación choca contra el índice único parcial de la DB (carrera concurrente)', async () => {
      const { service, repo } = buildService();
      repo.getUnicosMonthlyTotalsByCategory.mockResolvedValue([
        row('2026-04', 10000),
        row('2026-05', 10000),
        row('2026-06', 10000),
      ]);
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: 'test',
      });
      repo.create.mockRejectedValue(p2002);

      await expect(service.create(USER_ID, CAT_ID, '2026-07-15')).rejects.toThrow(ConflictException);
    });
  });

  // ---------------------------------------------------------------------------
  // remove() — RF-SIM-004
  // ---------------------------------------------------------------------------

  describe('remove()', () => {
    it('elimina físicamente la simulación (sin historial, RF-SIM-004)', async () => {
      const { service, repo } = buildService();
      repo.findById.mockResolvedValue({
        id: 'sim-1',
        userId: USER_ID,
        categoryId: CAT_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.remove(USER_ID, 'sim-1');

      expect(repo.delete).toHaveBeenCalledWith('sim-1');
    });

    it('404 si no existe', async () => {
      const { service, repo } = buildService();
      repo.findById.mockResolvedValue(null);
      await expect(service.remove(USER_ID, 'no-existe')).rejects.toThrow(NotFoundException);
    });

    it('404 si es de otro usuario', async () => {
      const { service, repo } = buildService();
      repo.findById.mockResolvedValue({
        id: 'sim-1',
        userId: 'otro-user',
        categoryId: CAT_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await expect(service.remove(USER_ID, 'sim-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // findAll() — contrato adicional de control-design
  // ---------------------------------------------------------------------------

  describe('findAll()', () => {
    it('paused=false y monthsWithData correcto para una simulación con datos suficientes', async () => {
      const { service, repo } = buildService();
      repo.findAllForUser.mockResolvedValue([
        { id: 'sim-1', userId: USER_ID, categoryId: CAT_ID, createdAt: new Date('2026-01-01'), updatedAt: new Date() },
      ]);
      repo.getUnicosMonthlyTotalsByCategory.mockResolvedValue([
        row('2026-04', 10000),
        row('2026-05', 10000),
        row('2026-06', 10000),
      ]);
      repo.findCategoriesByIds.mockResolvedValue([
        { id: CAT_ID, name: 'Salidas', color: '#FF0000', scope: 'BOTH' as never },
      ]);

      const result = await service.findAll(USER_ID, '2026-07-15');

      expect(result.horizonEndMonth).toBe('2027-01'); // julio → extendido a 6 meses
      expect(result.simulations).toHaveLength(1);
      expect(result.simulations[0].monthsWithData).toBe(3);
      expect(result.simulations[0].paused).toBe(false);
    });

    it('paused=true (RN-028) cuando la simulación cayó por debajo de 3 meses, sin eliminarse', async () => {
      const { service, repo } = buildService();
      repo.findAllForUser.mockResolvedValue([
        { id: 'sim-1', userId: USER_ID, categoryId: CAT_ID, createdAt: new Date('2026-01-01'), updatedAt: new Date() },
      ]);
      repo.getUnicosMonthlyTotalsByCategory.mockResolvedValue([
        row('2026-05', 10000),
        row('2026-06', 10000),
      ]);
      repo.findCategoriesByIds.mockResolvedValue([
        { id: CAT_ID, name: 'Salidas', color: '#FF0000', scope: 'BOTH' as never },
      ]);

      const result = await service.findAll(USER_ID, '2026-07-15');

      expect(result.simulations[0].monthsWithData).toBe(2);
      expect(result.simulations[0].paused).toBe(true);
    });

    it('sin simulaciones devuelve lista vacía y horizonEndMonth igual', async () => {
      const { service } = buildService();
      const result = await service.findAll(USER_ID, '2026-06-15');
      expect(result.simulations).toEqual([]);
      expect(result.horizonEndMonth).toBe('2026-12'); // junio → no extiende
    });
  });

  // ---------------------------------------------------------------------------
  // findCandidates() — contrato adicional de control-design
  // ---------------------------------------------------------------------------

  describe('findCandidates()', () => {
    it('monthsWithData y alreadySimulated por categoría del catálogo activo', async () => {
      const categoriesService = makeCategoriesService();
      categoriesService.findAll.mockResolvedValue([
        { id: 'cat-a', name: 'Salidas', color: '#FF0000' },
        { id: 'cat-b', name: 'Super', color: '#00FF00' },
      ]);
      const { service, repo } = buildService({ categoriesService });
      repo.findAllForUser.mockResolvedValue([
        { id: 'sim-a', userId: USER_ID, categoryId: 'cat-a', createdAt: new Date(), updatedAt: new Date() },
      ]);
      repo.getUnicosMonthlyTotalsByCategory.mockResolvedValue([
        row('2026-04', 10000, 'EXPENSE', 'cat-a'),
        row('2026-05', 10000, 'EXPENSE', 'cat-a'),
        row('2026-06', 10000, 'EXPENSE', 'cat-a'),
        row('2026-06', 5000, 'EXPENSE', 'cat-b'),
      ]);

      const result = await service.findCandidates(USER_ID, '2026-07-15');

      expect(result.categories).toEqual([
        { categoryId: 'cat-a', name: 'Salidas', color: '#FF0000', monthsWithData: 3, alreadySimulated: true },
        { categoryId: 'cat-b', name: 'Super', color: '#00FF00', monthsWithData: 1, alreadySimulated: false },
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // getSimulatedItemsForMonth() — RF-SIM-002/003, consumido por MovementsService
  // ---------------------------------------------------------------------------

  describe('getSimulatedItemsForMonth()', () => {
    it('el mes en curso nunca lleva simulados', async () => {
      const { service, repo } = buildService();
      repo.findAllForUser.mockResolvedValue([
        { id: 'sim-1', userId: USER_ID, categoryId: CAT_ID, createdAt: new Date(), updatedAt: new Date() },
      ]);
      const items = await service.getSimulatedItemsForMonth(USER_ID, '2026-07', '2026-07-15');
      expect(items).toEqual([]);
    });

    it('un mes pasado nunca lleva simulados', async () => {
      const { service } = buildService();
      const items = await service.getSimulatedItemsForMonth(USER_ID, '2026-05', '2026-07-15');
      expect(items).toEqual([]);
    });

    it('un mes fuera del horizonte (más allá de A+6 extendido) no lleva simulados', async () => {
      const { service, repo } = buildService();
      repo.findAllForUser.mockResolvedValue([
        { id: 'sim-1', userId: USER_ID, categoryId: CAT_ID, createdAt: new Date(), updatedAt: new Date() },
      ]);
      // Horizonte de julio: ago..ene (2027-01 último). Febrero 2027 queda afuera.
      const items = await service.getSimulatedItemsForMonth(USER_ID, '2027-02', '2026-07-15');
      expect(items).toEqual([]);
      // Ni siquiera se llega a cargar la agregación mensual (corte temprano).
      expect(repo.getUnicosMonthlyTotalsByCategory).not.toHaveBeenCalled();
    });

    it('categoría con exactamente 3 meses con datos: simula (no está pausada)', async () => {
      const { service, repo } = buildService();
      repo.findAllForUser.mockResolvedValue([
        { id: 'sim-1', userId: USER_ID, categoryId: CAT_ID, createdAt: new Date(), updatedAt: new Date() },
      ]);
      repo.getUnicosMonthlyTotalsByCategory.mockResolvedValue([
        row('2026-04', 300000), // gasto $3000
        row('2026-05', 300000),
        row('2026-06', 300000),
      ]);
      repo.findCategoriesByIds.mockResolvedValue([
        { id: CAT_ID, name: 'Salidas', color: '#FF0000', scope: 'BOTH' as never },
      ]);

      const items = await service.getSimulatedItemsForMonth(USER_ID, '2026-08', '2026-07-15');

      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('simulated:sim-1:2026-08');
      expect(items[0].simulated).toBe(true);
      expect(items[0].origin).toBe('unico');
      expect(items[0].type).toBe(MovementType.EXPENSE);
      expect(items[0].amountCents).toBeGreaterThan(0);
      expect(items[0].category.id).toBe(CAT_ID);
    });

    it('categoría con 2 meses con datos: NO simula (pausada, RN-028) aunque exista la simulación', async () => {
      const { service, repo } = buildService();
      repo.findAllForUser.mockResolvedValue([
        { id: 'sim-1', userId: USER_ID, categoryId: CAT_ID, createdAt: new Date(), updatedAt: new Date() },
      ]);
      repo.getUnicosMonthlyTotalsByCategory.mockResolvedValue([
        row('2026-05', 300000),
        row('2026-06', 300000),
      ]);

      const items = await service.getSimulatedItemsForMonth(USER_ID, '2026-08', '2026-07-15');
      expect(items).toEqual([]);
    });

    it('valor que redondea a 0 centavos no genera fila, aunque monthsWithData ≥ 3', async () => {
      const { service, repo } = buildService();
      repo.findAllForUser.mockResolvedValue([
        { id: 'sim-1', userId: USER_ID, categoryId: CAT_ID, createdAt: new Date(), updatedAt: new Date() },
      ]);
      // 3 meses CON datos (presencia) pero cuyo neto es 0 (gasto y reembolso del mismo
      // monto en el mismo mes) → serie plana en 0 → evaluación en cualquier posición = 0.
      repo.getUnicosMonthlyTotalsByCategory.mockResolvedValue([
        row('2026-04', 100000, 'EXPENSE'),
        row('2026-04', 100000, 'INCOME'),
        row('2026-05', 100000, 'EXPENSE'),
        row('2026-05', 100000, 'INCOME'),
        row('2026-06', 100000, 'EXPENSE'),
        row('2026-06', 100000, 'INCOME'),
      ]);

      const items = await service.getSimulatedItemsForMonth(USER_ID, '2026-08', '2026-07-15');
      expect(items).toEqual([]);
    });

    it('signo del valor proyectado positivo → movimiento simulado de tipo INCOME', async () => {
      const { service, repo } = buildService();
      repo.findAllForUser.mockResolvedValue([
        { id: 'sim-1', userId: USER_ID, categoryId: CAT_ID, createdAt: new Date(), updatedAt: new Date() },
      ]);
      // Serie de INGRESOS estable → proyección futura también positiva → INCOME.
      repo.getUnicosMonthlyTotalsByCategory.mockResolvedValue([
        row('2026-04', 500000, 'INCOME'),
        row('2026-05', 500000, 'INCOME'),
        row('2026-06', 500000, 'INCOME'),
      ]);
      repo.findCategoriesByIds.mockResolvedValue([
        { id: CAT_ID, name: 'Freelance', color: '#00FF00', scope: 'BOTH' as never },
      ]);

      const items = await service.getSimulatedItemsForMonth(USER_ID, '2026-08', '2026-07-15');

      expect(items).toHaveLength(1);
      expect(items[0].type).toBe(MovementType.INCOME);
      expect(items[0].amountCents).toBeGreaterThan(0);
    });

    it('sin simulaciones devuelve []', async () => {
      const { service, repo } = buildService();
      repo.findAllForUser.mockResolvedValue([]);
      const items = await service.getSimulatedItemsForMonth(USER_ID, '2026-08', '2026-07-15');
      expect(items).toEqual([]);
      expect(repo.getUnicosMonthlyTotalsByCategory).not.toHaveBeenCalled();
    });

    it('pasa displayCurrencyOverride a la conversión — el ítem sintético queda en esa moneda', async () => {
      const { service, repo } = buildService();
      repo.findAllForUser.mockResolvedValue([
        { id: 'sim-1', userId: USER_ID, categoryId: CAT_ID, createdAt: new Date(), updatedAt: new Date() },
      ]);
      repo.getUnicosMonthlyTotalsByCategory.mockResolvedValue([
        row('2026-04', 300000),
        row('2026-05', 300000),
        row('2026-06', 300000),
      ]);
      repo.findCategoriesByIds.mockResolvedValue([
        { id: CAT_ID, name: 'Salidas', color: '#FF0000', scope: 'BOTH' as never },
      ]);

      const items = await service.getSimulatedItemsForMonth(
        USER_ID,
        '2026-08',
        '2026-07-15',
        Currency.USD,
      );

      expect(items).toHaveLength(1);
      expect(items[0].currency).toBe(Currency.USD);
    });
  });

  // ---------------------------------------------------------------------------
  // getSimulatedItemsForMonths() — RF-SIM-002/003, consumido por getReportsMovements (RF-REP-017)
  // ---------------------------------------------------------------------------

  describe('getSimulatedItemsForMonths()', () => {
    it('devuelve un Map con TODAS las claves pedidas, incluso las que no calificaron (mes pasado/en curso/fuera de horizonte) → []', async () => {
      const { service, repo } = buildService();
      repo.findAllForUser.mockResolvedValue([
        { id: 'sim-1', userId: USER_ID, categoryId: CAT_ID, createdAt: new Date(), updatedAt: new Date() },
      ]);
      repo.getUnicosMonthlyTotalsByCategory.mockResolvedValue([
        row('2026-04', 300000),
        row('2026-05', 300000),
        row('2026-06', 300000),
      ]);
      repo.findCategoriesByIds.mockResolvedValue([
        { id: CAT_ID, name: 'Salidas', color: '#FF0000', scope: 'BOTH' as never },
      ]);

      // today = 2026-07-15 → mes en curso 2026-07; horizonte hasta 2027-01 (extendido).
      const months = ['2026-06', '2026-07', '2026-08', '2027-02'];
      const byMonth = await service.getSimulatedItemsForMonths(USER_ID, months, '2026-07-15');

      expect([...byMonth.keys()]).toEqual(months);
      expect(byMonth.get('2026-06')).toEqual([]); // pasado
      expect(byMonth.get('2026-07')).toEqual([]); // en curso
      expect(byMonth.get('2026-08')).toHaveLength(1); // futuro dentro de horizonte
      expect(byMonth.get('2027-02')).toEqual([]); // fuera de horizonte
    });

    it('ningún mes calificado (todos pasados/fuera de horizonte): no llega a pedir simulaciones ni datos', async () => {
      const { service, repo } = buildService();

      const byMonth = await service.getSimulatedItemsForMonths(USER_ID, ['2026-01', '2026-07'], '2026-07-15');

      expect(byMonth.get('2026-01')).toEqual([]);
      expect(byMonth.get('2026-07')).toEqual([]);
      expect(repo.findAllForUser).not.toHaveBeenCalled();
    });

    it('carga la ventana histórica UNA sola vez para varios meses futuros pedidos (batch, no N llamadas)', async () => {
      const { service, repo } = buildService();
      repo.findAllForUser.mockResolvedValue([
        { id: 'sim-1', userId: USER_ID, categoryId: CAT_ID, createdAt: new Date(), updatedAt: new Date() },
      ]);
      repo.getUnicosMonthlyTotalsByCategory.mockResolvedValue([
        row('2026-04', 300000),
        row('2026-05', 300000),
        row('2026-06', 300000),
      ]);
      repo.findCategoriesByIds.mockResolvedValue([
        { id: CAT_ID, name: 'Salidas', color: '#FF0000', scope: 'BOTH' as never },
      ]);

      const byMonth = await service.getSimulatedItemsForMonths(
        USER_ID,
        ['2026-08', '2026-09', '2026-10'],
        '2026-07-15',
      );

      expect(repo.getUnicosMonthlyTotalsByCategory).toHaveBeenCalledTimes(1);
      expect(byMonth.get('2026-08')).toHaveLength(1);
      expect(byMonth.get('2026-09')).toHaveLength(1);
      expect(byMonth.get('2026-10')).toHaveLength(1);
      expect(byMonth.get('2026-08')![0].id).toBe('simulated:sim-1:2026-08');
      expect(byMonth.get('2026-09')![0].id).toBe('simulated:sim-1:2026-09');
    });

    it('simulación pausada (< 3 meses con datos): no aporta a NINGÚN mes del batch', async () => {
      const { service, repo } = buildService();
      repo.findAllForUser.mockResolvedValue([
        { id: 'sim-1', userId: USER_ID, categoryId: CAT_ID, createdAt: new Date(), updatedAt: new Date() },
      ]);
      repo.getUnicosMonthlyTotalsByCategory.mockResolvedValue([
        row('2026-05', 300000),
        row('2026-06', 300000),
      ]);

      const byMonth = await service.getSimulatedItemsForMonths(
        USER_ID,
        ['2026-08', '2026-09'],
        '2026-07-15',
      );

      expect(byMonth.get('2026-08')).toEqual([]);
      expect(byMonth.get('2026-09')).toEqual([]);
    });

    it('sin simulaciones: Map con todas las claves en [], sin cargar datos mensuales', async () => {
      const { service, repo } = buildService();
      repo.findAllForUser.mockResolvedValue([]);

      const byMonth = await service.getSimulatedItemsForMonths(USER_ID, ['2026-08', '2026-09'], '2026-07-15');

      expect(byMonth.get('2026-08')).toEqual([]);
      expect(byMonth.get('2026-09')).toEqual([]);
      expect(repo.getUnicosMonthlyTotalsByCategory).not.toHaveBeenCalled();
    });
  });
});
