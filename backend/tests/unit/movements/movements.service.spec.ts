/**
 * Tests unitarios de MovementsService.
 *
 * Cubre:
 * - getMonthMovements: listado del mes con únicos + fijos + cuotas
 * - Totales correctos (únicos + fijos + cuotas combinados)
 * - Movimiento de categoría soft-deleted sigue contando en totales y tiene categoría
 * - Validación de month inválido / faltante → BadRequestException
 * - Mes vacío → totales en cero, listas vacías
 * - Aislamiento por userId (delega al repositorio con el userId correcto)
 * - Orden de únicos: amountCents DESC (desempate occurredAt DESC — lo hace el repositorio/SQL)
 * - D3: fijos y cuotas con occurredAt=null, timezone=null
 * - D1: cuotas con campo installment { number, total, startMonth }
 * - Filtro de categorías (Fase 1.1.6): 3 estados (null=todas, []=ninguna, [ids]=subconjunto)
 * - Fijo skippeado: aparece en lista pero NO suma totales bajo filtro
 * - Frecuencia respetada: el repositorio decide qué fijos caen; el service filtra por categoría
 */
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CategoryScope, MovementType, RecurringFrequency } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { MovementsService } from '../../../src/movements/movements.service';
import {
  MovementsRepository,
  MovementItem,
} from '../../../src/movements/movements.repository';

// ---------------------------------------------------------------------------
// Mocks
// El service ya no llama a getTotalsByMonth/getFijosTotalsByMonth/getCuotasTotalsByMonth:
// recomputa los totales desde las listas filtradas.
// ---------------------------------------------------------------------------

const mockRepo = {
  findUnicosByMonth: jest.fn(),
  findFijosByMonth: jest.fn(),
  findCuotasByMonth: jest.fn(),
  // Los métodos de totales son del repo pero el service NO los usa desde Fase 1.1.6.
  // Se mantienen en el mock por compatibilidad pero no se asertan sobre ellos.
  getTotalsByMonth: jest.fn(),
  getFijosTotalsByMonth: jest.fn(),
  getCuotasTotalsByMonth: jest.fn(),
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

const USER_A = 'user-a-movements';
const USER_B = 'user-b-movements';
const CAT_A = 'cat-id-001';
const CAT_B = 'cat-id-002';

function makeUnicoItem(overrides: Partial<MovementItem> = {}): MovementItem {
  return {
    id: 'tx-001',
    origin: 'unico',
    type: MovementType.EXPENSE,
    amountCents: 1500,
    description: null,
    occurredAt: new Date('2026-06-08T17:30:00Z'),
    timezone: 'America/Argentina/Buenos_Aires',
    category: {
      id: CAT_A,
      name: 'Consumibles',
      color: '#4F86C6',
      scope: CategoryScope.EXPENSE,
    },
    installment: null,
    frequency: null,
    skipped: false,
    calculated: null,
    hasCalculated: false,
    ...overrides,
  };
}

function makeFijoItem(overrides: Partial<MovementItem> = {}): MovementItem {
  return {
    id: 'fijo-001',
    origin: 'fijo',
    type: MovementType.EXPENSE,
    amountCents: 5000,
    description: 'Netflix',
    occurredAt: null,   // D3: fijos no tienen instante
    timezone: null,     // D3: fijos no tienen timezone
    category: {
      id: CAT_A,
      name: 'Servicios',
      color: '#4F86C6',
      scope: CategoryScope.EXPENSE,
    },
    installment: null,
    frequency: RecurringFrequency.MONTHLY,
    skipped: false,
    calculated: null,
    hasCalculated: false,
    ...overrides,
  };
}

function makeCuotaItem(overrides: Partial<MovementItem> = {}): MovementItem {
  return {
    id: 'inst-001',
    origin: 'cuota',
    type: MovementType.EXPENSE,
    amountCents: 2000,
    description: 'Notebook 3/12',
    occurredAt: null,   // D1/D3: cuotas no tienen instante
    timezone: null,     // D1/D3: cuotas no tienen timezone
    category: {
      id: CAT_A,
      name: 'Tecnología',
      color: '#4F86C6',
      scope: CategoryScope.EXPENSE,
    },
    installment: {
      number: 3,
      total: 12,
      startMonth: '2026-04',
    },
    frequency: null,
    skipped: false,
    calculated: null,
    hasCalculated: false,
    ...overrides,
  };
}

// Helper para setear todos los mocks con defaults "vacíos"
function setupEmptyMocks() {
  mockRepo.findUnicosByMonth.mockResolvedValue([]);
  mockRepo.findFijosByMonth.mockResolvedValue([]);
  mockRepo.findCuotasByMonth.mockResolvedValue([]);
  // Los de totales ya no son llamados por el service, pero los dejamos por compatibilidad
  mockRepo.getTotalsByMonth.mockResolvedValue({ expenseCents: 0, incomeCents: 0 });
  mockRepo.getFijosTotalsByMonth.mockResolvedValue({ expenseCents: 0, incomeCents: 0 });
  mockRepo.getCuotasTotalsByMonth.mockResolvedValue({ expenseCents: 0, incomeCents: 0 });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('MovementsService', () => {
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
  // getMonthMovements — casos felices (sin filtro)
  // -------------------------------------------------------------------------

  describe('getMonthMovements (sin filtro)', () => {
    it('devuelve la estructura correcta con mes, totales y movimientos', async () => {
      const tx1 = makeUnicoItem({ type: MovementType.EXPENSE, amountCents: 1000 });
      const tx2 = makeUnicoItem({ id: 'tx-002', type: MovementType.INCOME, amountCents: 5000 });
      mockRepo.findUnicosByMonth.mockResolvedValue([tx1, tx2]);
      mockRepo.findFijosByMonth.mockResolvedValue([]);
      mockRepo.findCuotasByMonth.mockResolvedValue([]);

      const result = await service.getMonthMovements(USER_A, '2026-06');

      expect(result.month).toBe('2026-06');
      expect(result.totals).toEqual({
        expenseCents: 1000,
        incomeCents: 5000,
        balanceCents: 4000,
      });
      expect(result.movements.unicos).toHaveLength(2);
      expect(result.movements.fijos).toEqual([]);
      expect(result.movements.cuotas).toEqual([]);
    });

    it('combina totales de únicos + fijos + cuotas correctamente', async () => {
      // Único EXPENSE 1000, Fijo EXPENSE 3000, Cuota EXPENSE 2000
      mockRepo.findUnicosByMonth.mockResolvedValue([
        makeUnicoItem({ type: MovementType.EXPENSE, amountCents: 1000 }),
      ]);
      mockRepo.findFijosByMonth.mockResolvedValue([
        makeFijoItem({ type: MovementType.EXPENSE, amountCents: 3000 }),
      ]);
      mockRepo.findCuotasByMonth.mockResolvedValue([
        makeCuotaItem({ amountCents: 2000 }),
      ]);

      const result = await service.getMonthMovements(USER_A, '2026-06');

      expect(result.totals.expenseCents).toBe(6000); // 1000 + 3000 + 2000
      expect(result.totals.incomeCents).toBe(0);
      expect(result.totals.balanceCents).toBe(-6000);
    });

    it('combina totales de únicos + fijos sin cuotas', async () => {
      mockRepo.findUnicosByMonth.mockResolvedValue([
        makeUnicoItem({ type: MovementType.EXPENSE, amountCents: 1000 }),
      ]);
      mockRepo.findFijosByMonth.mockResolvedValue([
        makeFijoItem({ type: MovementType.EXPENSE, amountCents: 3000 }),
      ]);
      mockRepo.findCuotasByMonth.mockResolvedValue([]);

      const result = await service.getMonthMovements(USER_A, '2026-06');

      expect(result.totals.expenseCents).toBe(4000); // 1000 + 3000
      expect(result.totals.incomeCents).toBe(0);
      expect(result.totals.balanceCents).toBe(-4000);
    });

    it('combina totales con income de fijos', async () => {
      mockRepo.findUnicosByMonth.mockResolvedValue([]);
      mockRepo.findFijosByMonth.mockResolvedValue([
        makeFijoItem({ type: MovementType.INCOME, amountCents: 80000 }),
      ]);
      mockRepo.findCuotasByMonth.mockResolvedValue([]);

      const result = await service.getMonthMovements(USER_A, '2026-06');

      expect(result.totals.incomeCents).toBe(80000);
      expect(result.totals.balanceCents).toBe(80000);
    });

    it('calcula balanceCents correctamente (income − expense)', async () => {
      mockRepo.findUnicosByMonth.mockResolvedValue([
        makeUnicoItem({ type: MovementType.EXPENSE, amountCents: 3000 }),
        makeUnicoItem({ id: 'tx-inc', type: MovementType.INCOME, amountCents: 1000 }),
      ]);
      mockRepo.findFijosByMonth.mockResolvedValue([]);
      mockRepo.findCuotasByMonth.mockResolvedValue([]);

      const result = await service.getMonthMovements(USER_A, '2026-06');

      // balance = 1000 - 3000 = -2000
      expect(result.totals.balanceCents).toBe(-2000);
    });

    it('mes vacío → totales en cero y listas vacías', async () => {
      setupEmptyMocks();

      const result = await service.getMonthMovements(USER_A, '2026-06');

      expect(result.totals).toEqual({ expenseCents: 0, incomeCents: 0, balanceCents: 0 });
      expect(result.movements.unicos).toEqual([]);
      expect(result.movements.fijos).toEqual([]);
      expect(result.movements.cuotas).toEqual([]);
    });

    it('movimiento con categoría soft-deleted sigue en la lista (RF-CAT-004)', async () => {
      const itemWithDeletedCat = makeUnicoItem({
        category: {
          id: 'cat-deleted',
          name: 'Categoría Eliminada',
          color: '#000000',
          scope: CategoryScope.BOTH,
        },
        amountCents: 1500,
        type: MovementType.EXPENSE,
      });
      setupEmptyMocks();
      mockRepo.findUnicosByMonth.mockResolvedValue([itemWithDeletedCat]);

      const result = await service.getMonthMovements(USER_A, '2026-06');

      expect(result.movements.unicos).toHaveLength(1);
      expect(result.movements.unicos[0].category.id).toBe('cat-deleted');
      expect(result.totals.expenseCents).toBe(1500);
    });

    it('fijo con categoría soft-deleted sigue en la lista y en totales (RF-CAT-004)', async () => {
      const fijoWithDeletedCat = makeFijoItem({
        category: {
          id: 'cat-deleted',
          name: 'Cat Eliminada',
          color: '#000000',
          scope: CategoryScope.BOTH,
        },
        amountCents: 5000,
        skipped: false,
      });
      setupEmptyMocks();
      mockRepo.findFijosByMonth.mockResolvedValue([fijoWithDeletedCat]);

      const result = await service.getMonthMovements(USER_A, '2026-06');

      expect(result.movements.fijos).toHaveLength(1);
      expect(result.movements.fijos[0].category.id).toBe('cat-deleted');
      expect(result.totals.expenseCents).toBe(5000);
    });

    it('cuota con categoría soft-deleted sigue en la lista y en totales (RF-CAT-004)', async () => {
      const cuotaWithDeletedCat = makeCuotaItem({
        category: {
          id: 'cat-deleted',
          name: 'Cat Eliminada',
          color: '#000000',
          scope: CategoryScope.BOTH,
        },
        amountCents: 2000,
      });
      setupEmptyMocks();
      mockRepo.findCuotasByMonth.mockResolvedValue([cuotaWithDeletedCat]);

      const result = await service.getMonthMovements(USER_A, '2026-06');

      expect(result.movements.cuotas).toHaveLength(1);
      expect(result.movements.cuotas[0].category.id).toBe('cat-deleted');
      expect(result.totals.expenseCents).toBe(2000);
    });

    it('orden: el repositorio devuelve únicos en orden amountCents DESC y el service lo preserva', async () => {
      // El repositorio ya ordenó por amountCents DESC; el service preserva ese orden sin reordenar
      const items = [
        makeUnicoItem({ id: 'tx-mayor', amountCents: 5000 }),
        makeUnicoItem({ id: 'tx-menor', amountCents: 1000 }),
      ];
      setupEmptyMocks();
      mockRepo.findUnicosByMonth.mockResolvedValue(items);

      const result = await service.getMonthMovements(USER_A, '2026-06');

      expect(result.movements.unicos[0].id).toBe('tx-mayor');
      expect(result.movements.unicos[1].id).toBe('tx-menor');
    });

    it('llama al repositorio con el userId correcto (aislamiento RN-003)', async () => {
      setupEmptyMocks();

      await service.getMonthMovements(USER_B, '2026-06');

      expect(mockRepo.findUnicosByMonth).toHaveBeenCalledWith(USER_B, '2026-06');
      expect(mockRepo.findFijosByMonth).toHaveBeenCalledWith(USER_B, '2026-06');
      expect(mockRepo.findCuotasByMonth).toHaveBeenCalledWith(USER_B, '2026-06');
    });

    it('lanza las queries al repositorio en paralelo (3 llamadas a find*)', async () => {
      setupEmptyMocks();

      await service.getMonthMovements(USER_A, '2026-06');

      expect(mockRepo.findUnicosByMonth).toHaveBeenCalledTimes(1);
      expect(mockRepo.findFijosByMonth).toHaveBeenCalledTimes(1);
      expect(mockRepo.findCuotasByMonth).toHaveBeenCalledTimes(1);
    });

    it('fijo skippeado aparece en la lista con skipped=true pero NO suma a los totales', async () => {
      const fijoSkipped = makeFijoItem({
        amountCents: 5000,
        type: MovementType.EXPENSE,
        skipped: true,
      });
      setupEmptyMocks();
      mockRepo.findFijosByMonth.mockResolvedValue([fijoSkipped]);

      const result = await service.getMonthMovements(USER_A, '2026-06');

      // El fijo aparece en la lista
      expect(result.movements.fijos).toHaveLength(1);
      expect(result.movements.fijos[0].skipped).toBe(true);
      // Pero NO suma a los totales
      expect(result.totals.expenseCents).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Filtro de categorías (Fase 1.1.6) — 3 estados
  // -------------------------------------------------------------------------

  describe('getMonthMovements — filtro de categorías (Fase 1.1.6)', () => {
    it('null (todas): sin filtro, devuelve todos los movimientos', async () => {
      const unicos = [
        makeUnicoItem({ id: 'u1', category: { id: CAT_A, name: 'A', color: '#aaa', scope: CategoryScope.EXPENSE }, amountCents: 1000 }),
        makeUnicoItem({ id: 'u2', category: { id: CAT_B, name: 'B', color: '#bbb', scope: CategoryScope.EXPENSE }, amountCents: 2000 }),
      ];
      mockRepo.findUnicosByMonth.mockResolvedValue(unicos);
      mockRepo.findFijosByMonth.mockResolvedValue([]);
      mockRepo.findCuotasByMonth.mockResolvedValue([]);

      const result = await service.getMonthMovements(USER_A, '2026-06', null);

      expect(result.movements.unicos).toHaveLength(2);
      expect(result.totals.expenseCents).toBe(3000);
    });

    it('[] (ninguna): retorna listas vacías y totales en cero sin consultar el repo', async () => {
      // Con categoryIds=[], el service debe atajar antes de llamar al repo
      const result = await service.getMonthMovements(USER_A, '2026-06', []);

      expect(result.movements.unicos).toEqual([]);
      expect(result.movements.fijos).toEqual([]);
      expect(result.movements.cuotas).toEqual([]);
      expect(result.totals).toEqual({ expenseCents: 0, incomeCents: 0, balanceCents: 0 });

      // El repo NO debe ser llamado (atajo temprano)
      expect(mockRepo.findUnicosByMonth).not.toHaveBeenCalled();
      expect(mockRepo.findFijosByMonth).not.toHaveBeenCalled();
      expect(mockRepo.findCuotasByMonth).not.toHaveBeenCalled();
    });

    it('[CAT_A]: solo movimientos de CAT_A aparecen; CAT_B excluido', async () => {
      const unicos = [
        makeUnicoItem({ id: 'u1', category: { id: CAT_A, name: 'A', color: '#aaa', scope: CategoryScope.EXPENSE }, amountCents: 1000 }),
        makeUnicoItem({ id: 'u2', category: { id: CAT_B, name: 'B', color: '#bbb', scope: CategoryScope.EXPENSE }, amountCents: 2000 }),
      ];
      mockRepo.findUnicosByMonth.mockResolvedValue(unicos);
      mockRepo.findFijosByMonth.mockResolvedValue([]);
      mockRepo.findCuotasByMonth.mockResolvedValue([]);

      const result = await service.getMonthMovements(USER_A, '2026-06', [CAT_A]);

      expect(result.movements.unicos).toHaveLength(1);
      expect(result.movements.unicos[0].id).toBe('u1');
      expect(result.totals.expenseCents).toBe(1000); // solo CAT_A
    });

    it('filtro afecta fijos y cuotas también', async () => {
      const fijos = [
        makeFijoItem({ id: 'f1', category: { id: CAT_A, name: 'A', color: '#aaa', scope: CategoryScope.EXPENSE }, amountCents: 3000 }),
        makeFijoItem({ id: 'f2', category: { id: CAT_B, name: 'B', color: '#bbb', scope: CategoryScope.EXPENSE }, amountCents: 5000 }),
      ];
      const cuotas = [
        makeCuotaItem({ id: 'c1', category: { id: CAT_B, name: 'B', color: '#bbb', scope: CategoryScope.EXPENSE }, amountCents: 1000 }),
      ];
      mockRepo.findUnicosByMonth.mockResolvedValue([]);
      mockRepo.findFijosByMonth.mockResolvedValue(fijos);
      mockRepo.findCuotasByMonth.mockResolvedValue(cuotas);

      const result = await service.getMonthMovements(USER_A, '2026-06', [CAT_A]);

      expect(result.movements.fijos).toHaveLength(1);
      expect(result.movements.fijos[0].id).toBe('f1');
      expect(result.movements.cuotas).toHaveLength(0); // CAT_B excluido
      expect(result.totals.expenseCents).toBe(3000); // solo fijo de CAT_A
    });

    it('fijo skippeado de CAT_A: aparece en lista con skipped=true pero NO suma a totales bajo filtro', async () => {
      // GOTCHA OBLIGATORIO: un fijo skipped se INCLUYE en la lista pero NO suma a totales.
      // Esto debe respetarse incluso cuando hay filtro activo.
      const fijoSkippedCatA = makeFijoItem({
        id: 'f-skip',
        category: { id: CAT_A, name: 'A', color: '#aaa', scope: CategoryScope.EXPENSE },
        amountCents: 5000,
        skipped: true,
      });
      const fijoNormalCatA = makeFijoItem({
        id: 'f-normal',
        category: { id: CAT_A, name: 'A', color: '#aaa', scope: CategoryScope.EXPENSE },
        amountCents: 2000,
        skipped: false,
      });
      mockRepo.findUnicosByMonth.mockResolvedValue([]);
      mockRepo.findFijosByMonth.mockResolvedValue([fijoSkippedCatA, fijoNormalCatA]);
      mockRepo.findCuotasByMonth.mockResolvedValue([]);

      const result = await service.getMonthMovements(USER_A, '2026-06', [CAT_A]);

      // Ambos fijos de CAT_A aparecen en la lista
      expect(result.movements.fijos).toHaveLength(2);
      // El skippeado está en la lista con skipped=true
      const skip = result.movements.fijos.find((f) => f.id === 'f-skip');
      expect(skip).toBeDefined();
      expect(skip!.skipped).toBe(true);
      // El skippeado NO suma a los totales; solo el normal suma
      expect(result.totals.expenseCents).toBe(2000);
    });

    it('fijo de CAT_B skippeado fuera del filtro: excluido de lista y totales', async () => {
      const fijoSkippedCatB = makeFijoItem({
        id: 'f-skip-b',
        category: { id: CAT_B, name: 'B', color: '#bbb', scope: CategoryScope.EXPENSE },
        amountCents: 5000,
        skipped: true,
      });
      mockRepo.findUnicosByMonth.mockResolvedValue([]);
      mockRepo.findFijosByMonth.mockResolvedValue([fijoSkippedCatB]);
      mockRepo.findCuotasByMonth.mockResolvedValue([]);

      const result = await service.getMonthMovements(USER_A, '2026-06', [CAT_A]);

      // CAT_B excluido del filtro → no aparece ni en lista ni en totales
      expect(result.movements.fijos).toHaveLength(0);
      expect(result.totals.expenseCents).toBe(0);
    });

    it('id desconocido en filtro → ningún movimiento pasa, totales en cero', async () => {
      setupEmptyMocks();
      mockRepo.findUnicosByMonth.mockResolvedValue([
        makeUnicoItem({ amountCents: 5000 }),
      ]);

      const result = await service.getMonthMovements(USER_A, '2026-06', ['id-inexistente']);

      expect(result.movements.unicos).toHaveLength(0);
      expect(result.totals.expenseCents).toBe(0);
    });

    it('filtro incluye INCOME también (EXPENSE e INCOME ambos filtrados por categoría)', async () => {
      const incomeItem = makeUnicoItem({
        id: 'u-income',
        type: MovementType.INCOME,
        amountCents: 10000,
        category: { id: CAT_A, name: 'A', color: '#aaa', scope: CategoryScope.INCOME },
      });
      const expenseItem = makeUnicoItem({
        id: 'u-expense-b',
        type: MovementType.EXPENSE,
        amountCents: 3000,
        category: { id: CAT_B, name: 'B', color: '#bbb', scope: CategoryScope.EXPENSE },
      });
      mockRepo.findUnicosByMonth.mockResolvedValue([incomeItem, expenseItem]);
      mockRepo.findFijosByMonth.mockResolvedValue([]);
      mockRepo.findCuotasByMonth.mockResolvedValue([]);

      // Filtrar solo por CAT_A (INCOME)
      const result = await service.getMonthMovements(USER_A, '2026-06', [CAT_A]);

      expect(result.movements.unicos).toHaveLength(1);
      expect(result.movements.unicos[0].id).toBe('u-income');
      expect(result.totals.incomeCents).toBe(10000);
      expect(result.totals.expenseCents).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Validación de month
  // -------------------------------------------------------------------------

  describe('validación de month', () => {
    it('month con formato inválido (2026/06) → BadRequestException', async () => {
      await expect(
        service.getMonthMovements(USER_A, '2026/06'),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.findUnicosByMonth).not.toHaveBeenCalled();
    });

    it('month sin guión (202606) → BadRequestException', async () => {
      await expect(
        service.getMonthMovements(USER_A, '202606'),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.findUnicosByMonth).not.toHaveBeenCalled();
    });

    it('month con mes inválido (2026-13) → BadRequestException', async () => {
      await expect(
        service.getMonthMovements(USER_A, '2026-13'),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.findUnicosByMonth).not.toHaveBeenCalled();
    });

    it('month con mes inválido (2026-00) → BadRequestException', async () => {
      await expect(
        service.getMonthMovements(USER_A, '2026-00'),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.findUnicosByMonth).not.toHaveBeenCalled();
    });

    it('month vacío → BadRequestException', async () => {
      await expect(
        service.getMonthMovements(USER_A, ''),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.findUnicosByMonth).not.toHaveBeenCalled();
    });

    it('month válido (2026-01) → no lanza', async () => {
      setupEmptyMocks();

      await expect(
        service.getMonthMovements(USER_A, '2026-01'),
      ).resolves.not.toThrow();
    });

    it('month válido (2026-12) → no lanza', async () => {
      setupEmptyMocks();

      await expect(
        service.getMonthMovements(USER_A, '2026-12'),
      ).resolves.not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Estructura de la respuesta
  // -------------------------------------------------------------------------

  describe('estructura de la respuesta', () => {
    it('cada MovementItem único tiene el campo origin="unico" e installment=null', async () => {
      const item = makeUnicoItem({ origin: 'unico' });
      setupEmptyMocks();
      mockRepo.findUnicosByMonth.mockResolvedValue([item]);

      const result = await service.getMonthMovements(USER_A, '2026-06');

      expect(result.movements.unicos[0].origin).toBe('unico');
      expect(result.movements.unicos[0].installment).toBeNull();
    });

    it('cada MovementItem fijo tiene origin="fijo", occurredAt=null, timezone=null, installment=null (D3)', async () => {
      const item = makeFijoItem();
      setupEmptyMocks();
      mockRepo.findFijosByMonth.mockResolvedValue([item]);

      const result = await service.getMonthMovements(USER_A, '2026-06');

      expect(result.movements.fijos[0].origin).toBe('fijo');
      expect(result.movements.fijos[0].occurredAt).toBeNull();
      expect(result.movements.fijos[0].timezone).toBeNull();
      expect(result.movements.fijos[0].installment).toBeNull();
    });

    it('cada MovementItem cuota tiene origin="cuota", occurredAt=null, timezone=null, installment (D1)', async () => {
      const item = makeCuotaItem({
        installment: { number: 3, total: 12, startMonth: '2026-04' },
      });
      setupEmptyMocks();
      mockRepo.findCuotasByMonth.mockResolvedValue([item]);

      const result = await service.getMonthMovements(USER_A, '2026-06');

      const cuota = result.movements.cuotas[0];
      expect(cuota.origin).toBe('cuota');
      expect(cuota.occurredAt).toBeNull();
      expect(cuota.timezone).toBeNull();
      expect(cuota.installment).not.toBeNull();
      expect(cuota.installment!.number).toBe(3);
      expect(cuota.installment!.total).toBe(12);
      expect(cuota.installment!.startMonth).toBe('2026-04');
    });

    it('cada MovementItem tiene categoría embebida con id, name, color, scope', async () => {
      const item = makeUnicoItem();
      setupEmptyMocks();
      mockRepo.findUnicosByMonth.mockResolvedValue([item]);

      const result = await service.getMonthMovements(USER_A, '2026-06');

      const cat = result.movements.unicos[0].category;
      expect(cat).toHaveProperty('id');
      expect(cat).toHaveProperty('name');
      expect(cat).toHaveProperty('color');
      expect(cat).toHaveProperty('scope');
    });

    it('cuotas se pueblan desde Fase 7 (ya no son array vacío fijo)', async () => {
      const cuota = makeCuotaItem();
      setupEmptyMocks();
      mockRepo.findCuotasByMonth.mockResolvedValue([cuota]);

      const result = await service.getMonthMovements(USER_A, '2026-06');

      expect(Array.isArray(result.movements.cuotas)).toBe(true);
      expect(result.movements.cuotas).toHaveLength(1);
    });
  });
});
