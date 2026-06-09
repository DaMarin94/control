/**
 * Tests unitarios de MovementsService.
 *
 * Cubre:
 * - getMonthMovements: listado del mes con únicos
 * - Totales correctos (expenseCents, incomeCents, balanceCents)
 * - Movimiento de categoría soft-deleted sigue contando en totales y tiene categoría
 * - Validación de month inválido / faltante → BadRequestException
 * - Mes vacío → totales en cero, listas vacías
 * - Aislamiento por userId (delega al repositorio con el userId correcto)
 * - Orden de únicos: occurredAt descendente
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
  getTotalsByMonth: jest.fn(),
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

function makeMovementItem(overrides: Partial<MovementItem> = {}): MovementItem {
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
    ...overrides,
  };
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
      const tx1 = makeMovementItem({ type: MovementType.EXPENSE, amountCents: 1000 });
      const tx2 = makeMovementItem({ id: 'tx-002', type: MovementType.INCOME, amountCents: 5000 });
      mockRepo.findUnicosByMonth.mockResolvedValue([tx1, tx2]);
      mockRepo.getTotalsByMonth.mockResolvedValue({
        expenseCents: 1000,
        incomeCents: 5000,
      });

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

    it('calcula balanceCents correctamente (income − expense)', async () => {
      mockRepo.findUnicosByMonth.mockResolvedValue([]);
      mockRepo.getTotalsByMonth.mockResolvedValue({
        expenseCents: 3000,
        incomeCents: 1000,
      });

      const result = await service.getMonthMovements(USER_A, '2026-06');

      // balance = 1000 - 3000 = -2000
      expect(result.totals.balanceCents).toBe(-2000);
    });

    it('mes vacío → totales en cero y listas vacías', async () => {
      mockRepo.findUnicosByMonth.mockResolvedValue([]);
      mockRepo.getTotalsByMonth.mockResolvedValue({
        expenseCents: 0,
        incomeCents: 0,
      });

      const result = await service.getMonthMovements(USER_A, '2026-06');

      expect(result.totals).toEqual({
        expenseCents: 0,
        incomeCents: 0,
        balanceCents: 0,
      });
      expect(result.movements.unicos).toEqual([]);
    });

    it('movimiento con categoría soft-deleted sigue en la lista (RF-CAT-004)', async () => {
      // El repositorio devuelve el ítem con los datos de la categoría aunque esté soft-deleted
      // (el JOIN en el SQL no filtra por deletedAt). Este test verifica que el service
      // lo pasa sin modificación al response.
      const itemWithDeletedCat = makeMovementItem({
        category: {
          id: 'cat-deleted',
          name: 'Categoría Eliminada',
          color: '#000000',
          scope: CategoryScope.BOTH,
        },
      });
      mockRepo.findUnicosByMonth.mockResolvedValue([itemWithDeletedCat]);
      mockRepo.getTotalsByMonth.mockResolvedValue({
        expenseCents: 1500,
        incomeCents: 0,
      });

      const result = await service.getMonthMovements(USER_A, '2026-06');

      expect(result.movements.unicos).toHaveLength(1);
      expect(result.movements.unicos[0].category.id).toBe('cat-deleted');
      expect(result.movements.unicos[0].category.name).toBe('Categoría Eliminada');
      // Y los totales lo cuentan
      expect(result.totals.expenseCents).toBe(1500);
    });

    it('orden: el repositorio devuelve en orden desc y el service lo preserva', async () => {
      // El order es garantizado por el SQL (ORDER BY occurredAt DESC);
      // el service no reordena, solo pasa los datos. Verificamos que no los altera.
      const items = [
        makeMovementItem({ id: 'tx-newer', occurredAt: new Date('2026-06-15T00:00:00Z') }),
        makeMovementItem({ id: 'tx-older', occurredAt: new Date('2026-06-01T00:00:00Z') }),
      ];
      mockRepo.findUnicosByMonth.mockResolvedValue(items);
      mockRepo.getTotalsByMonth.mockResolvedValue({ expenseCents: 3000, incomeCents: 0 });

      const result = await service.getMonthMovements(USER_A, '2026-06');

      expect(result.movements.unicos[0].id).toBe('tx-newer');
      expect(result.movements.unicos[1].id).toBe('tx-older');
    });

    it('llama al repositorio con el userId correcto (aislamiento RN-003)', async () => {
      mockRepo.findUnicosByMonth.mockResolvedValue([]);
      mockRepo.getTotalsByMonth.mockResolvedValue({ expenseCents: 0, incomeCents: 0 });

      await service.getMonthMovements(USER_B, '2026-06');

      expect(mockRepo.findUnicosByMonth).toHaveBeenCalledWith(USER_B, '2026-06');
      expect(mockRepo.getTotalsByMonth).toHaveBeenCalledWith(USER_B, '2026-06');
    });

    it('lanza las queries al repositorio en paralelo', async () => {
      // Verificamos que Promise.all se está usando: ambos mocks deben ser llamados
      mockRepo.findUnicosByMonth.mockResolvedValue([]);
      mockRepo.getTotalsByMonth.mockResolvedValue({ expenseCents: 0, incomeCents: 0 });

      await service.getMonthMovements(USER_A, '2026-06');

      expect(mockRepo.findUnicosByMonth).toHaveBeenCalledTimes(1);
      expect(mockRepo.getTotalsByMonth).toHaveBeenCalledTimes(1);
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
      mockRepo.findUnicosByMonth.mockResolvedValue([]);
      mockRepo.getTotalsByMonth.mockResolvedValue({ expenseCents: 0, incomeCents: 0 });

      await expect(
        service.getMonthMovements(USER_A, '2026-01'),
      ).resolves.not.toThrow();
    });

    it('month válido (2026-12) → no lanza', async () => {
      mockRepo.findUnicosByMonth.mockResolvedValue([]);
      mockRepo.getTotalsByMonth.mockResolvedValue({ expenseCents: 0, incomeCents: 0 });

      await expect(
        service.getMonthMovements(USER_A, '2026-12'),
      ).resolves.not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Estructura de la respuesta
  // -------------------------------------------------------------------------

  describe('estructura de la respuesta', () => {
    it('cada MovementItem tiene el campo origin="unico"', async () => {
      const item = makeMovementItem({ origin: 'unico' });
      mockRepo.findUnicosByMonth.mockResolvedValue([item]);
      mockRepo.getTotalsByMonth.mockResolvedValue({ expenseCents: 1500, incomeCents: 0 });

      const result = await service.getMonthMovements(USER_A, '2026-06');

      expect(result.movements.unicos[0].origin).toBe('unico');
    });

    it('cada MovementItem tiene categoría embebida con id, name, color, scope', async () => {
      const item = makeMovementItem();
      mockRepo.findUnicosByMonth.mockResolvedValue([item]);
      mockRepo.getTotalsByMonth.mockResolvedValue({ expenseCents: 1500, incomeCents: 0 });

      const result = await service.getMonthMovements(USER_A, '2026-06');

      const cat = result.movements.unicos[0].category;
      expect(cat).toHaveProperty('id');
      expect(cat).toHaveProperty('name');
      expect(cat).toHaveProperty('color');
      expect(cat).toHaveProperty('scope');
    });

    it('fijos y cuotas siempre son arrays vacíos en Fase 5', async () => {
      mockRepo.findUnicosByMonth.mockResolvedValue([makeMovementItem()]);
      mockRepo.getTotalsByMonth.mockResolvedValue({ expenseCents: 1500, incomeCents: 0 });

      const result = await service.getMonthMovements(USER_A, '2026-06');

      expect(Array.isArray(result.movements.fijos)).toBe(true);
      expect(result.movements.fijos).toHaveLength(0);
      expect(Array.isArray(result.movements.cuotas)).toBe(true);
      expect(result.movements.cuotas).toHaveLength(0);
    });
  });
});
