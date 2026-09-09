/**
 * Tests unitarios de SimulationsService (Módulo 3.15, RF-SIM-001..004, RN-028/029).
 *
 * Cubre:
 * - create(): éxito, tramo calculado (incluida la extensión a +6 meses),
 *   clamp de un mes pasado a `startMonth`, categoría inválida (propaga 400
 *   del validador), ya simulada (409), datos insuficientes (<3 meses, 400),
 *   carrera contra el índice único parcial de la DB (P2002 → 409).
 * - remove(): éxito (borrado físico, sin historial), no encontrada / ajena (404).
 * - findAll(): monthsWithData + paused (RF-SIM-002) + tramo (startMonth
 *   crudo/effectiveStartMonth/endMonth) por simulación, incluido el caso en
 *   que el startMonth guardado ya quedó atrás del mes en curso.
 * - findCandidates(): monthsWithData + alreadySimulated por categoría del
 *   catálogo activo, más el tramo HIPOTÉTICO devuelto a nivel respuesta.
 * - getSimulatedItemsForMonth(): mes en curso/pasado (nunca simula), fuera
 *   del TRAMO de la simulación (nunca simula), categoría con exactamente 3
 *   meses (simula), categoría con 2 meses (no simula, pausada), valor que
 *   redondea a 0 centavos (no genera fila aunque haya 3+ meses con datos),
 *   signo que da ingreso, id sintético estable.
 * - getSimulatedItemsForMonths(): pertenencia POR SIMULACIÓN — dos
 *   simulaciones con tramos distintos que aportan a meses distintos, y una
 *   simulación con `endMonth` vencido que no aporta a ningún mes.
 */
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Currency, MovementType, Prisma } from '@prisma/client';
import { SimulationsService } from '../../../src/simulations/simulations.service';
import { SimulationsRepository, RawSimulationUnicoRow } from '../../../src/simulations/simulations.repository';
import { computeHorizonEndMonth } from '../../../src/simulations/simulation-window.helper';

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

/**
 * Fila mock de `Simulation` (Prisma), con tramo propio ya resuelto —
 * `startMonth` ya CLAMPEADO (nunca un mes pasado a la fecha de creación) y
 * `endMonth` derivado con la misma fórmula del helper real
 * (`computeHorizonEndMonth`), salvo que el test pase el suyo explícito para
 * ejercitar un tramo vencido o desalineado.
 */
function simRow(overrides: {
  id?: string;
  userId?: string;
  categoryId?: string;
  createdAt?: Date;
  startMonth: string;
  endMonth?: string;
}) {
  return {
    id: overrides.id ?? 'sim-1',
    userId: overrides.userId ?? USER_ID,
    categoryId: overrides.categoryId ?? CAT_ID,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.createdAt ?? new Date(),
    startMonth: overrides.startMonth,
    endMonth: overrides.endMonth ?? computeHorizonEndMonth(overrides.startMonth),
  };
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
      repo.create.mockResolvedValue(
        simRow({ createdAt: new Date('2026-07-01T00:00:00Z'), startMonth: '2026-07' }),
      );
      repo.findCategoriesByIds.mockResolvedValue([
        { id: CAT_ID, name: 'Salidas', color: '#FF0000', scope: 'BOTH' as never },
      ]);

      const result = await service.create(USER_ID, CAT_ID, '2026-07-15');

      expect(result.id).toBe('sim-1');
      expect(result.monthsWithData).toBe(3);
      expect(result.paused).toBe(false);
      // Sin startMonth en el request → mes en curso (2026-07); tramo natural
      // ago..dic = 5 meses (< 6) → extendido a base+6 = 2027-01.
      expect(result.startMonth).toBe('2026-07');
      expect(result.effectiveStartMonth).toBe('2026-07');
      expect(result.endMonth).toBe('2027-01');
      expect(repo.create).toHaveBeenCalledWith(USER_ID, CAT_ID, '2026-07', '2027-01');
    });

    it('tramo con startMonth explícito: se extiende a +6 meses cuando el tramo natural hasta diciembre queda corto', async () => {
      const { service, repo } = buildService();
      repo.getUnicosMonthlyTotalsByCategory.mockResolvedValue([
        row('2026-04', 10000),
        row('2026-05', 10000),
        row('2026-06', 10000),
      ]);
      repo.create.mockResolvedValue(
        simRow({ createdAt: new Date('2026-10-01T00:00:00Z'), startMonth: '2026-10' }),
      );
      repo.findCategoriesByIds.mockResolvedValue([
        { id: CAT_ID, name: 'Salidas', color: '#FF0000', scope: 'BOTH' as never },
      ]);

      // Parado en octubre 2026, pide crear desde octubre 2026 (mismo mes que "hoy").
      const result = await service.create(USER_ID, CAT_ID, '2026-10-15', '2026-10');

      expect(result.startMonth).toBe('2026-10');
      expect(result.endMonth).toBe('2027-04'); // oct..dic < 6 meses → extendido a oct+6
      expect(repo.create).toHaveBeenCalledWith(USER_ID, CAT_ID, '2026-10', '2027-04');
    });

    it('clamp de un mes pasado: crear con un startMonth anterior al mes en curso equivale a crear desde el mes en curso', async () => {
      const { service, repo } = buildService();
      repo.getUnicosMonthlyTotalsByCategory.mockResolvedValue([
        row('2026-04', 10000),
        row('2026-05', 10000),
        row('2026-06', 10000),
      ]);
      repo.create.mockResolvedValue(
        simRow({ createdAt: new Date('2026-07-01T00:00:00Z'), startMonth: '2026-07' }),
      );
      repo.findCategoriesByIds.mockResolvedValue([
        { id: CAT_ID, name: 'Salidas', color: '#FF0000', scope: 'BOTH' as never },
      ]);

      // "Hoy" es julio 2026, pero el request pide un startMonth de enero (pasado).
      await service.create(USER_ID, CAT_ID, '2026-07-15', '2026-01');

      // Nunca revive un mes pasado: se persiste como si hubiera pedido el mes en curso.
      expect(repo.create).toHaveBeenCalledWith(USER_ID, CAT_ID, '2026-07', '2027-01');
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
      repo.findByCategory.mockResolvedValue(simRow({ id: 'sim-existing', startMonth: '2026-07' }));

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
      repo.findById.mockResolvedValue(simRow({ startMonth: '2026-07' }));

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
      repo.findById.mockResolvedValue(simRow({ userId: 'otro-user', startMonth: '2026-07' }));
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
        simRow({ createdAt: new Date('2026-01-01'), startMonth: '2026-01', endMonth: '2026-12' }),
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

      expect(result.simulations).toHaveLength(1);
      expect(result.simulations[0].monthsWithData).toBe(3);
      expect(result.simulations[0].paused).toBe(false);
      // startMonth crudo (creada en enero) queda atrás del mes en curso (julio):
      // el arranque efectivo NO revive el pasado, pero el crudo no cambia.
      expect(result.simulations[0].startMonth).toBe('2026-01');
      expect(result.simulations[0].effectiveStartMonth).toBe('2026-07');
      expect(result.simulations[0].endMonth).toBe('2026-12');
    });

    it('paused=true (RN-028) cuando la simulación cayó por debajo de 3 meses, sin eliminarse', async () => {
      const { service, repo } = buildService();
      repo.findAllForUser.mockResolvedValue([
        simRow({ createdAt: new Date('2026-01-01'), startMonth: '2026-01', endMonth: '2026-12' }),
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

    it('arranque efectivo = startMonth cuando la simulación se creó desde el mes en curso o después', async () => {
      const { service, repo } = buildService();
      repo.findAllForUser.mockResolvedValue([
        simRow({ createdAt: new Date('2026-10-01'), startMonth: '2026-10' }),
      ]);
      repo.getUnicosMonthlyTotalsByCategory.mockResolvedValue([
        row('2026-04', 10000),
        row('2026-05', 10000),
        row('2026-06', 10000),
      ]);
      repo.findCategoriesByIds.mockResolvedValue([
        { id: CAT_ID, name: 'Salidas', color: '#FF0000', scope: 'BOTH' as never },
      ]);

      // "Hoy" (julio) todavía no alcanzó el startMonth (octubre, futuro).
      const result = await service.findAll(USER_ID, '2026-07-15');

      expect(result.simulations[0].startMonth).toBe('2026-10');
      expect(result.simulations[0].effectiveStartMonth).toBe('2026-10');
    });

    it('sin simulaciones devuelve lista vacía (sin horizonEndMonth a nivel respuesta — el tramo es por simulación)', async () => {
      const { service } = buildService();
      const result = await service.findAll(USER_ID, '2026-06-15');
      expect(result.simulations).toEqual([]);
      expect(result).not.toHaveProperty('horizonEndMonth');
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
        simRow({ id: 'sim-a', categoryId: 'cat-a', startMonth: '2026-07' }),
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

    it('devuelve el tramo HIPOTÉTICO (startMonth/endMonth) que resultaría de crear desde el mes en curso, sin startMonth explícito', async () => {
      const { service } = buildService();
      const result = await service.findCandidates(USER_ID, '2026-06-15');
      expect(result.startMonth).toBe('2026-06');
      expect(result.endMonth).toBe('2026-12'); // jun..dic = 6 meses exactos → no extiende
    });

    it('devuelve el tramo HIPOTÉTICO derivado del startMonth pedido (extendido a +6)', async () => {
      const { service } = buildService();
      const result = await service.findCandidates(USER_ID, '2026-07-15', '2026-10');
      expect(result.startMonth).toBe('2026-10');
      expect(result.endMonth).toBe('2027-04');
    });

    it('clampea un startMonth pasado al mes en curso, igual que create()', async () => {
      const { service } = buildService();
      const result = await service.findCandidates(USER_ID, '2026-06-15', '2026-01');
      expect(result.startMonth).toBe('2026-06');
      expect(result.endMonth).toBe('2026-12');
    });
  });

  // ---------------------------------------------------------------------------
  // getSimulatedItemsForMonth() — RF-SIM-002/003, consumido por MovementsService
  // ---------------------------------------------------------------------------

  describe('getSimulatedItemsForMonth()', () => {
    it('un mes pasado nunca lleva simulados', async () => {
      const { service } = buildService();
      const items = await service.getSimulatedItemsForMonth(USER_ID, '2026-05', '2026-07-15');
      expect(items).toEqual([]);
    });

    it('un mes fuera del horizonte (más allá de A+6 extendido) no lleva simulados', async () => {
      const { service, repo } = buildService();
      repo.findAllForUser.mockResolvedValue([
        simRow({ startMonth: '2026-07' }),
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
        simRow({ startMonth: '2026-07' }),
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
        simRow({ startMonth: '2026-07' }),
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
        simRow({ startMonth: '2026-07' }),
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
        simRow({ startMonth: '2026-07' }),
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
        simRow({ startMonth: '2026-07' }),
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
  // Remanente (nueva regla): el monto simulado de CUALQUIER mes del horizonte
  // —incluido el mes en curso, que ahora arranca el horizonte— es
  // proyección(mes) − total real con signo de únicos de esa categoría en ese
  // mes. Serie de ajuste PLANA (mismo monto los 12 meses de la ventana) para
  // que la proyección sea exacta y verificable a mano: slope=0, intercept =
  // el monto plano, así que evaluateRegressionAt da ese mismo monto en
  // cualquier posición futura.
  // ---------------------------------------------------------------------------

  describe('Remanente — proyección menos real con signo (RN-028)', () => {
    const FLAT_WINDOW_MONTHS = [
      '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
      '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
    ];

    /** Serie histórica plana de gasto (EXPENSE) del mismo monto los 12 meses de la ventana. */
    function flatExpenseWindow(amountCents: number): RawSimulationUnicoRow[] {
      return FLAT_WINDOW_MONTHS.map((m) => row(m, amountCents, 'EXPENSE'));
    }

    /** El mock de la query respeta el rango [firstMonth..lastMonth], como el `$queryRaw` real. */
    function mockRangeAware(repo: jest.Mocked<SimulationsRepository>, rows: RawSimulationUnicoRow[]) {
      repo.getUnicosMonthlyTotalsByCategory.mockImplementation((_userId, firstMonth, lastMonth) =>
        Promise.resolve(rows.filter((r) => r.monthKey >= firstMonth && r.monthKey <= lastMonth)),
      );
    }

    it('mes en curso simulado (RN-028 — arranca el horizonte): sin reales cargados, el remanente es la proyección completa', async () => {
      const { service, repo } = buildService();
      repo.findAllForUser.mockResolvedValue([
        simRow({ startMonth: '2026-07' }),
      ]);
      mockRangeAware(repo, flatExpenseWindow(100000)); // serie plana: $1000 de gasto por mes
      repo.findCategoriesByIds.mockResolvedValue([
        { id: CAT_ID, name: 'Salidas', color: '#FF0000', scope: 'BOTH' as never },
      ]);

      const items = await service.getSimulatedItemsForMonth(USER_ID, '2026-07', '2026-07-15');

      expect(items).toHaveLength(1);
      expect(items[0].type).toBe(MovementType.EXPENSE);
      expect(items[0].amountCents).toBe(100000);
    });

    it('remanente normal: un real más chico en la MISMA dirección reduce el monto simulado sin cancelarlo', async () => {
      const { service, repo } = buildService();
      repo.findAllForUser.mockResolvedValue([
        simRow({ startMonth: '2026-07' }),
      ]);
      mockRangeAware(repo, [
        ...flatExpenseWindow(100000),
        row('2026-07', 30000, 'EXPENSE'), // gasto real ya cargado en el mes en curso
      ]);
      repo.findCategoriesByIds.mockResolvedValue([
        { id: CAT_ID, name: 'Salidas', color: '#FF0000', scope: 'BOTH' as never },
      ]);

      const items = await service.getSimulatedItemsForMonth(USER_ID, '2026-07', '2026-07-15');

      expect(items).toHaveLength(1);
      expect(items[0].type).toBe(MovementType.EXPENSE);
      expect(items[0].amountCents).toBe(70000); // 100000 (proyección) − 30000 (real) = 70000
    });

    it('remanente cancelado por exceso: un real que supera la proyección y cambia de signo NO emite fila', async () => {
      const { service, repo } = buildService();
      repo.findAllForUser.mockResolvedValue([
        simRow({ startMonth: '2026-07' }),
      ]);
      mockRangeAware(repo, [
        ...flatExpenseWindow(100000),
        row('2026-07', 150000, 'EXPENSE'), // el real ya gastó MÁS que lo proyectado
      ]);
      repo.findCategoriesByIds.mockResolvedValue([
        { id: CAT_ID, name: 'Salidas', color: '#FF0000', scope: 'BOTH' as never },
      ]);

      const items = await service.getSimulatedItemsForMonth(USER_ID, '2026-07', '2026-07-15');

      // remanente = -100000 - (-150000) = +50000 → cambia de signo respecto de
      // la proyección (gasto) → NO se emite fila (no se convierte en ingreso).
      expect(items).toEqual([]);
    });

    it('remanente en un mes FUTURO (no el en curso) con reales ya cargados: se descuenta igual', async () => {
      const { service, repo } = buildService();
      repo.findAllForUser.mockResolvedValue([
        simRow({ startMonth: '2026-07' }),
      ]);
      mockRangeAware(repo, [
        ...flatExpenseWindow(100000),
        row('2026-10', 40000, 'EXPENSE'), // el usuario ya cargó gasto real en un mes futuro
      ]);
      repo.findCategoriesByIds.mockResolvedValue([
        { id: CAT_ID, name: 'Salidas', color: '#FF0000', scope: 'BOTH' as never },
      ]);

      const items = await service.getSimulatedItemsForMonth(USER_ID, '2026-10', '2026-07-15');

      expect(items).toHaveLength(1);
      expect(items[0].amountCents).toBe(60000); // 100000 − 40000 = 60000
    });
  });

  // ---------------------------------------------------------------------------
  // getSimulatedItemsForMonths() — RF-SIM-002/003, consumido por getReportsMovements (RF-REP-017)
  // ---------------------------------------------------------------------------

  describe('getSimulatedItemsForMonths()', () => {
    it('devuelve un Map con TODAS las claves pedidas, incluso las que no calificaron (mes pasado/fuera de horizonte) → []; el en curso SÍ califica', async () => {
      const { service, repo } = buildService();
      repo.findAllForUser.mockResolvedValue([
        simRow({ startMonth: '2026-07' }),
      ]);
      repo.getUnicosMonthlyTotalsByCategory.mockResolvedValue([
        row('2026-04', 300000),
        row('2026-05', 300000),
        row('2026-06', 300000),
      ]);
      repo.findCategoriesByIds.mockResolvedValue([
        { id: CAT_ID, name: 'Salidas', color: '#FF0000', scope: 'BOTH' as never },
      ]);

      // today = 2026-07-15 → mes en curso 2026-07 (arranca el horizonte, RN-028);
      // horizonte hasta 2027-01 (extendido).
      const months = ['2026-06', '2026-07', '2026-08', '2027-02'];
      const byMonth = await service.getSimulatedItemsForMonths(USER_ID, months, '2026-07-15');

      expect([...byMonth.keys()]).toEqual(months);
      expect(byMonth.get('2026-06')).toEqual([]); // pasado
      expect(byMonth.get('2026-07')).toHaveLength(1); // en curso — arranca el horizonte
      expect(byMonth.get('2026-08')).toHaveLength(1); // futuro dentro de horizonte
      expect(byMonth.get('2027-02')).toEqual([]); // fuera de horizonte
    });

    it('ningún mes calificado (todos pasados): no llega a pedir simulaciones ni datos', async () => {
      const { service, repo } = buildService();

      const byMonth = await service.getSimulatedItemsForMonths(USER_ID, ['2026-01', '2026-06'], '2026-07-15');

      expect(byMonth.get('2026-01')).toEqual([]);
      expect(byMonth.get('2026-06')).toEqual([]);
      expect(repo.findAllForUser).not.toHaveBeenCalled();
    });

    it('carga la ventana histórica y los reales del horizonte en UNA query cada uno (batch, no N llamadas por mes)', async () => {
      const { service, repo } = buildService();
      repo.findAllForUser.mockResolvedValue([
        simRow({ startMonth: '2026-07' }),
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

      // Dos llamadas TOTALES (ventana histórica + rango del horizonte pedido),
      // no una por mes — con 3 meses pedidos, N llamadas serían 3+.
      expect(repo.getUnicosMonthlyTotalsByCategory).toHaveBeenCalledTimes(2);
      expect(repo.getUnicosMonthlyTotalsByCategory).toHaveBeenCalledWith(USER_ID, '2026-08', '2026-10');
      expect(byMonth.get('2026-08')).toHaveLength(1);
      expect(byMonth.get('2026-09')).toHaveLength(1);
      expect(byMonth.get('2026-10')).toHaveLength(1);
      expect(byMonth.get('2026-08')![0].id).toBe('simulated:sim-1:2026-08');
      expect(byMonth.get('2026-09')![0].id).toBe('simulated:sim-1:2026-09');
    });

    it('simulación pausada (< 3 meses con datos): no aporta a NINGÚN mes del batch', async () => {
      const { service, repo } = buildService();
      repo.findAllForUser.mockResolvedValue([
        simRow({ startMonth: '2026-07' }),
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

    it('pertenencia POR SIMULACIÓN (RN-028/RN-029): dos simulaciones con tramos distintos aportan a meses distintos', async () => {
      const { service, repo } = buildService();
      const CAT_B = 'cat-sim-b';
      // sim-a: tramo corto (jul..ago) — solo aporta a esos dos meses.
      // sim-b: tramo arranca en septiembre — no aporta a jul/ago, sí desde sep.
      repo.findAllForUser.mockResolvedValue([
        simRow({ id: 'sim-a', categoryId: CAT_ID, startMonth: '2026-07', endMonth: '2026-08' }),
        simRow({ id: 'sim-b', categoryId: CAT_B, startMonth: '2026-09', endMonth: '2027-01' }),
      ]);
      const historicalRows = [
        row('2026-04', 100000, 'EXPENSE', CAT_ID),
        row('2026-05', 100000, 'EXPENSE', CAT_ID),
        row('2026-06', 100000, 'EXPENSE', CAT_ID),
        row('2026-04', 200000, 'EXPENSE', CAT_B),
        row('2026-05', 200000, 'EXPENSE', CAT_B),
        row('2026-06', 200000, 'EXPENSE', CAT_B),
      ];
      repo.getUnicosMonthlyTotalsByCategory.mockImplementation((_userId, firstMonth, lastMonth) =>
        Promise.resolve(historicalRows.filter((r) => r.monthKey >= firstMonth && r.monthKey <= lastMonth)),
      );
      repo.findCategoriesByIds.mockResolvedValue([
        { id: CAT_ID, name: 'Salidas', color: '#FF0000', scope: 'BOTH' as never },
        { id: CAT_B, name: 'Otros', color: '#00FF00', scope: 'BOTH' as never },
      ]);

      const byMonth = await service.getSimulatedItemsForMonths(
        USER_ID,
        ['2026-07', '2026-08', '2026-09'],
        '2026-07-15',
      );

      expect(byMonth.get('2026-07')!.map((i) => i.category.id)).toEqual([CAT_ID]);
      expect(byMonth.get('2026-08')!.map((i) => i.category.id)).toEqual([CAT_ID]);
      expect(byMonth.get('2026-09')!.map((i) => i.category.id)).toEqual([CAT_B]);
    });

    it('una simulación con endMonth ya VENCIDO no aporta a ningún mes pedido (sin flag ni estado adicional — RN-028/RN-029)', async () => {
      const { service, repo } = buildService();
      repo.findAllForUser.mockResolvedValue([
        // Tramo enteramente en el pasado respecto de "hoy" (2026-07): venció antes de julio.
        simRow({ startMonth: '2025-01', endMonth: '2025-06' }),
      ]);

      const byMonth = await service.getSimulatedItemsForMonths(
        USER_ID,
        ['2026-08', '2026-09'],
        '2026-07-15',
      );

      expect(byMonth.get('2026-08')).toEqual([]);
      expect(byMonth.get('2026-09')).toEqual([]);
      // Ninguna simulación cubre los meses pedidos → corte temprano: ni
      // siquiera se carga la ventana histórica (O(1), no se desperdicia la query).
      expect(repo.getUnicosMonthlyTotalsByCategory).not.toHaveBeenCalled();
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
