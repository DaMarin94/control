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
 * - Orden de únicos: occurredAt descendente
 * - D3: fijos y cuotas con occurredAt=null, timezone=null
 * - D1: cuotas con campo installment { number, total, startMonth }
 */
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CategoryScope, MovementType } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { MovementsService } from '../../../src/movements/movements.service';
import {
  MovementsRepository,
  MovementItem,
} from '../../../src/movements/movements.repository';

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
const CAT_ID = 'cat-id-001';

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
      id: CAT_ID,
      name: 'Consumibles',
      color: '#4F86C6',
      scope: CategoryScope.EXPENSE,
    },
    installment: null,
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
      id: CAT_ID,
      name: 'Servicios',
      color: '#4F86C6',
      scope: CategoryScope.EXPENSE,
    },
    installment: null,
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
      id: CAT_ID,
      name: 'Tecnología',
      color: '#4F86C6',
      scope: CategoryScope.EXPENSE,
    },
    installment: {
      number: 3,
      total: 12,
      startMonth: '2026-04',
    },
    ...overrides,
  };
}

// Helper para setear todos los mocks con defaults "vacíos"
function setupEmptyMocks() {
  mockRepo.findUnicosByMonth.mockResolvedValue([]);
  mockRepo.findFijosByMonth.mockResolvedValue([]);
  mockRepo.findCuotasByMonth.mockResolvedValue([]);
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
  // getMonthMovements — casos felices
  // -------------------------------------------------------------------------

  describe('getMonthMovements', () => {
    it('devuelve la estructura correcta con mes, totales y movimientos', async () => {
      const tx1 = makeUnicoItem({ type: MovementType.EXPENSE, amountCents: 1000 });
      const tx2 = makeUnicoItem({ id: 'tx-002', type: MovementType.INCOME, amountCents: 5000 });
      mockRepo.findUnicosByMonth.mockResolvedValue([tx1, tx2]);
      mockRepo.findFijosByMonth.mockResolvedValue([]);
      mockRepo.findCuotasByMonth.mockResolvedValue([]);
      mockRepo.getTotalsByMonth.mockResolvedValue({ expenseCents: 1000, incomeCents: 5000 });
      mockRepo.getFijosTotalsByMonth.mockResolvedValue({ expenseCents: 0, incomeCents: 0 });
      mockRepo.getCuotasTotalsByMonth.mockResolvedValue({ expenseCents: 0, incomeCents: 0 });

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
      mockRepo.getTotalsByMonth.mockResolvedValue({ expenseCents: 1000, incomeCents: 0 });
      mockRepo.getFijosTotalsByMonth.mockResolvedValue({ expenseCents: 3000, incomeCents: 0 });
      mockRepo.getCuotasTotalsByMonth.mockResolvedValue({ expenseCents: 2000, incomeCents: 0 });

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
      mockRepo.getTotalsByMonth.mockResolvedValue({ expenseCents: 1000, incomeCents: 0 });
      mockRepo.getFijosTotalsByMonth.mockResolvedValue({ expenseCents: 3000, incomeCents: 0 });
      mockRepo.getCuotasTotalsByMonth.mockResolvedValue({ expenseCents: 0, incomeCents: 0 });

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
      mockRepo.getTotalsByMonth.mockResolvedValue({ expenseCents: 0, incomeCents: 0 });
      mockRepo.getFijosTotalsByMonth.mockResolvedValue({ expenseCents: 0, incomeCents: 80000 });
      mockRepo.getCuotasTotalsByMonth.mockResolvedValue({ expenseCents: 0, incomeCents: 0 });

      const result = await service.getMonthMovements(USER_A, '2026-06');

      expect(result.totals.incomeCents).toBe(80000);
      expect(result.totals.balanceCents).toBe(80000);
    });

    it('calcula balanceCents correctamente (income − expense)', async () => {
      setupEmptyMocks();
      mockRepo.getTotalsByMonth.mockResolvedValue({ expenseCents: 3000, incomeCents: 1000 });

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
      });
      setupEmptyMocks();
      mockRepo.findUnicosByMonth.mockResolvedValue([itemWithDeletedCat]);
      mockRepo.getTotalsByMonth.mockResolvedValue({ expenseCents: 1500, incomeCents: 0 });

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
      });
      setupEmptyMocks();
      mockRepo.findFijosByMonth.mockResolvedValue([fijoWithDeletedCat]);
      mockRepo.getFijosTotalsByMonth.mockResolvedValue({ expenseCents: 5000, incomeCents: 0 });

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
      });
      setupEmptyMocks();
      mockRepo.findCuotasByMonth.mockResolvedValue([cuotaWithDeletedCat]);
      mockRepo.getCuotasTotalsByMonth.mockResolvedValue({ expenseCents: 2000, incomeCents: 0 });

      const result = await service.getMonthMovements(USER_A, '2026-06');

      expect(result.movements.cuotas).toHaveLength(1);
      expect(result.movements.cuotas[0].category.id).toBe('cat-deleted');
      expect(result.totals.expenseCents).toBe(2000);
    });

    it('orden: el repositorio devuelve únicos en orden desc y el service lo preserva', async () => {
      const items = [
        makeUnicoItem({ id: 'tx-newer', occurredAt: new Date('2026-06-15T00:00:00Z') }),
        makeUnicoItem({ id: 'tx-older', occurredAt: new Date('2026-06-01T00:00:00Z') }),
      ];
      setupEmptyMocks();
      mockRepo.findUnicosByMonth.mockResolvedValue(items);
      mockRepo.getTotalsByMonth.mockResolvedValue({ expenseCents: 3000, incomeCents: 0 });

      const result = await service.getMonthMovements(USER_A, '2026-06');

      expect(result.movements.unicos[0].id).toBe('tx-newer');
      expect(result.movements.unicos[1].id).toBe('tx-older');
    });

    it('llama al repositorio con el userId correcto (aislamiento RN-003)', async () => {
      setupEmptyMocks();

      await service.getMonthMovements(USER_B, '2026-06');

      expect(mockRepo.findUnicosByMonth).toHaveBeenCalledWith(USER_B, '2026-06');
      expect(mockRepo.findFijosByMonth).toHaveBeenCalledWith(USER_B, '2026-06');
      expect(mockRepo.findCuotasByMonth).toHaveBeenCalledWith(USER_B, '2026-06');
      expect(mockRepo.getTotalsByMonth).toHaveBeenCalledWith(USER_B, '2026-06');
      expect(mockRepo.getFijosTotalsByMonth).toHaveBeenCalledWith(USER_B, '2026-06');
      expect(mockRepo.getCuotasTotalsByMonth).toHaveBeenCalledWith(USER_B, '2026-06');
    });

    it('lanza las queries al repositorio en paralelo (6 llamadas)', async () => {
      setupEmptyMocks();

      await service.getMonthMovements(USER_A, '2026-06');

      expect(mockRepo.findUnicosByMonth).toHaveBeenCalledTimes(1);
      expect(mockRepo.findFijosByMonth).toHaveBeenCalledTimes(1);
      expect(mockRepo.findCuotasByMonth).toHaveBeenCalledTimes(1);
      expect(mockRepo.getTotalsByMonth).toHaveBeenCalledTimes(1);
      expect(mockRepo.getFijosTotalsByMonth).toHaveBeenCalledTimes(1);
      expect(mockRepo.getCuotasTotalsByMonth).toHaveBeenCalledTimes(1);
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
      mockRepo.getTotalsByMonth.mockResolvedValue({ expenseCents: 1500, incomeCents: 0 });

      const result = await service.getMonthMovements(USER_A, '2026-06');

      expect(result.movements.unicos[0].origin).toBe('unico');
      expect(result.movements.unicos[0].installment).toBeNull();
    });

    it('cada MovementItem fijo tiene origin="fijo", occurredAt=null, timezone=null, installment=null (D3)', async () => {
      const item = makeFijoItem();
      setupEmptyMocks();
      mockRepo.findFijosByMonth.mockResolvedValue([item]);
      mockRepo.getFijosTotalsByMonth.mockResolvedValue({ expenseCents: 5000, incomeCents: 0 });

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
      mockRepo.getCuotasTotalsByMonth.mockResolvedValue({ expenseCents: 2000, incomeCents: 0 });

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
      mockRepo.getTotalsByMonth.mockResolvedValue({ expenseCents: 1500, incomeCents: 0 });

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
      mockRepo.getCuotasTotalsByMonth.mockResolvedValue({ expenseCents: 2000, incomeCents: 0 });

      const result = await service.getMonthMovements(USER_A, '2026-06');

      expect(Array.isArray(result.movements.cuotas)).toBe(true);
      expect(result.movements.cuotas).toHaveLength(1);
    });
  });
});
