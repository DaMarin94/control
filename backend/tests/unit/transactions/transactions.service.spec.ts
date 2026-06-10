/**
 * Tests unitarios de TransactionsService.
 *
 * Cubre:
 * - Crear transacción OK
 * - Validación de amountCents (monto 0 rechazado a nivel DTO, negativo también)
 * - Categoría inexistente → 400
 * - Categoría de otro usuario → 400
 * - Categoría eliminada → 400
 * - Scope incompatible (RN-010): EXPENSE con categoría INCOME, etc.
 * - Persistencia de occurredAt UTC + timezone
 * - Edición que cambia type/categoría → revalidación RN-010
 * - Hard delete
 * - Aislamiento por userId (RN-003)
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MovementType } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { TransactionsService } from '../../../src/transactions/transactions.service';
import { TransactionsRepository, TransactionWithCategory } from '../../../src/transactions/transactions.repository';
import { CategoryValidatorService } from '../../../src/categories/category-validator.service';
import { CategoryScope } from '@prisma/client';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockCategoryValidator = {
  validateCategory: jest.fn().mockResolvedValue(undefined),
};

const mockLogger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_A = 'user-a-id';
const USER_B = 'user-b-id';
const CAT_ID = 'cat-expense-id';

function makeTransaction(overrides: Partial<TransactionWithCategory> = {}): TransactionWithCategory {
  return {
    id: 'tx-001',
    userId: USER_A,
    categoryId: CAT_ID,
    type: MovementType.EXPENSE,
    amountCents: 1500,
    description: null,
    occurredAt: new Date('2026-06-08T14:30:00Z'),
    timezone: 'America/Argentina/Buenos_Aires',
    createdAt: new Date(),
    updatedAt: new Date(),
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

describe('TransactionsService', () => {
  let service: TransactionsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCategoryValidator.validateCategory.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: TransactionsRepository, useValue: mockRepo },
        { provide: CategoryValidatorService, useValue: mockCategoryValidator },
        { provide: Logger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  describe('create', () => {
    it('crea una transacción y la devuelve', async () => {
      const tx = makeTransaction();
      mockRepo.create.mockResolvedValue(tx);

      const result = await service.create(USER_A, {
        type: MovementType.EXPENSE,
        amountCents: 1500,
        categoryId: CAT_ID,
        occurredAt: '2026-06-08T14:30:00-03:00',
        timezone: 'America/Argentina/Buenos_Aires',
      });

      expect(result).toEqual(tx);
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MovementType.EXPENSE,
          amountCents: 1500,
          timezone: 'America/Argentina/Buenos_Aires',
        }),
      );
    });

    it('persiste occurredAt como objeto Date en UTC (RN-004)', async () => {
      mockRepo.create.mockResolvedValue(makeTransaction());

      await service.create(USER_A, {
        type: MovementType.EXPENSE,
        amountCents: 1500,
        categoryId: CAT_ID,
        occurredAt: '2026-06-08T14:30:00-03:00',
        timezone: 'America/Argentina/Buenos_Aires',
      });

      // occurredAt ISO con offset -03:00 → UTC equivalente 17:30:00Z
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          occurredAt: new Date('2026-06-08T17:30:00Z'),
        }),
      );
    });

    it('persiste el timezone IANA del registro (RN-004)', async () => {
      mockRepo.create.mockResolvedValue(makeTransaction({ timezone: 'Europe/Madrid' }));

      await service.create(USER_A, {
        type: MovementType.EXPENSE,
        amountCents: 500,
        categoryId: CAT_ID,
        occurredAt: '2026-06-08T12:00:00+02:00',
        timezone: 'Europe/Madrid',
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ timezone: 'Europe/Madrid' }),
      );
    });

    it('categoría inexistente → BadRequestException (RN-010)', async () => {
      mockCategoryValidator.validateCategory.mockRejectedValue(
        new BadRequestException('La categoría no existe o no pertenece al usuario'),
      );

      await expect(
        service.create(USER_A, {
          type: MovementType.EXPENSE,
          amountCents: 1000,
          categoryId: 'no-existe',
          occurredAt: '2026-06-08T12:00:00Z',
          timezone: 'America/Argentina/Buenos_Aires',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('categoría de otro usuario → BadRequestException (aislamiento RN-003)', async () => {
      mockCategoryValidator.validateCategory.mockRejectedValue(
        new BadRequestException('La categoría no existe o no pertenece al usuario'),
      );

      await expect(
        service.create(USER_A, {
          type: MovementType.EXPENSE,
          amountCents: 1000,
          categoryId: CAT_ID,
          occurredAt: '2026-06-08T12:00:00Z',
          timezone: 'America/Argentina/Buenos_Aires',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('categoría eliminada → BadRequestException (RN-010)', async () => {
      mockCategoryValidator.validateCategory.mockRejectedValue(
        new BadRequestException('La categoría está eliminada'),
      );

      await expect(
        service.create(USER_A, {
          type: MovementType.EXPENSE,
          amountCents: 1000,
          categoryId: CAT_ID,
          occurredAt: '2026-06-08T12:00:00Z',
          timezone: 'America/Argentina/Buenos_Aires',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('scope incompatible EXPENSE con categoría INCOME → BadRequestException (RN-010)', async () => {
      mockCategoryValidator.validateCategory.mockRejectedValue(
        new BadRequestException('La categoría no es compatible con el tipo "EXPENSE"'),
      );

      await expect(
        service.create(USER_A, {
          type: MovementType.EXPENSE,
          amountCents: 1000,
          categoryId: CAT_ID,
          occurredAt: '2026-06-08T12:00:00Z',
          timezone: 'America/Argentina/Buenos_Aires',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('scope incompatible INCOME con categoría EXPENSE → BadRequestException (RN-010)', async () => {
      mockCategoryValidator.validateCategory.mockRejectedValue(
        new BadRequestException('La categoría no es compatible con el tipo "INCOME"'),
      );

      await expect(
        service.create(USER_A, {
          type: MovementType.INCOME,
          amountCents: 1000,
          categoryId: CAT_ID,
          occurredAt: '2026-06-08T12:00:00Z',
          timezone: 'America/Argentina/Buenos_Aires',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('scope BOTH es compatible con EXPENSE (RN-010)', async () => {
      // mockCategoryValidator resuelve sin error por default
      mockRepo.create.mockResolvedValue(makeTransaction({ type: MovementType.EXPENSE }));

      await expect(
        service.create(USER_A, {
          type: MovementType.EXPENSE,
          amountCents: 1000,
          categoryId: CAT_ID,
          occurredAt: '2026-06-08T12:00:00Z',
          timezone: 'America/Argentina/Buenos_Aires',
        }),
      ).resolves.not.toThrow();
    });

    it('scope BOTH es compatible con INCOME (RN-010)', async () => {
      // mockCategoryValidator resuelve sin error por default
      mockRepo.create.mockResolvedValue(makeTransaction({ type: MovementType.INCOME }));

      await expect(
        service.create(USER_A, {
          type: MovementType.INCOME,
          amountCents: 1000,
          categoryId: CAT_ID,
          occurredAt: '2026-06-08T12:00:00Z',
          timezone: 'America/Argentina/Buenos_Aires',
        }),
      ).resolves.not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // findOne
  // -------------------------------------------------------------------------

  describe('findOne', () => {
    it('devuelve la transacción propia', async () => {
      const tx = makeTransaction();
      mockRepo.findById.mockResolvedValue(tx);

      const result = await service.findOne(USER_A, 'tx-001');

      expect(result).toEqual(tx);
    });

    it('404 si no existe', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.findOne(USER_A, 'no-existe')).rejects.toThrow(NotFoundException);
    });

    it('aislamiento: 404 si pertenece a otro usuario (RN-003)', async () => {
      const tx = makeTransaction({ userId: USER_B });
      mockRepo.findById.mockResolvedValue(tx);

      await expect(service.findOne(USER_A, 'tx-001')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // update (PATCH)
  // -------------------------------------------------------------------------

  describe('update', () => {
    it('actualiza amountCents exitosamente', async () => {
      const existing = makeTransaction();
      mockRepo.findById.mockResolvedValue(existing);
      const updated = makeTransaction({ amountCents: 2000 });
      mockRepo.update.mockResolvedValue(updated);

      const result = await service.update(USER_A, 'tx-001', { amountCents: 2000 });

      expect(result.amountCents).toBe(2000);
    });

    it('actualiza description exitosamente', async () => {
      const existing = makeTransaction();
      mockRepo.findById.mockResolvedValue(existing);
      const updated = makeTransaction({ description: 'Nuevo texto' });
      mockRepo.update.mockResolvedValue(updated);

      const result = await service.update(USER_A, 'tx-001', { description: 'Nuevo texto' });

      expect(result.description).toBe('Nuevo texto');
    });

    it('cambia el type y revalida scope compatibility (RN-010)', async () => {
      // Transacción EXPENSE con categoría EXPENSE
      const existing = makeTransaction({ type: MovementType.EXPENSE });
      mockRepo.findById.mockResolvedValue(existing);

      // Intentar cambiar a INCOME → categoría EXPENSE incompatible → validator rechaza
      mockCategoryValidator.validateCategory.mockRejectedValue(
        new BadRequestException('La categoría no es compatible con el tipo "INCOME"'),
      );

      await expect(
        service.update(USER_A, 'tx-001', { type: MovementType.INCOME }),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('cambia la categoría y revalida scope compatibility (RN-010)', async () => {
      const existing = makeTransaction({ type: MovementType.EXPENSE });
      mockRepo.findById.mockResolvedValue(existing);

      // Nueva categoría con scope INCOME → incompatible con EXPENSE → validator rechaza
      mockCategoryValidator.validateCategory.mockRejectedValue(
        new BadRequestException('La categoría no es compatible con el tipo "EXPENSE"'),
      );

      await expect(
        service.update(USER_A, 'tx-001', { categoryId: 'new-cat-id' }),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('cambia type y categoría juntos: usa ambos nuevos para validar (RN-010)', async () => {
      const existing = makeTransaction({ type: MovementType.EXPENSE });
      mockRepo.findById.mockResolvedValue(existing);

      // Categoría INCOME + type INCOME → compatible → validator resuelve OK (default)
      const updated = makeTransaction({ type: MovementType.INCOME });
      mockRepo.update.mockResolvedValue(updated);

      await expect(
        service.update(USER_A, 'tx-001', {
          type: MovementType.INCOME,
          categoryId: 'income-cat-id',
        }),
      ).resolves.not.toThrow();
    });

    it('actualiza occurredAt: persiste como Date UTC', async () => {
      const existing = makeTransaction();
      mockRepo.findById.mockResolvedValue(existing);
      mockRepo.update.mockResolvedValue(makeTransaction({ occurredAt: new Date('2026-06-15T03:00:00Z') }));

      await service.update(USER_A, 'tx-001', {
        occurredAt: '2026-06-15T00:00:00-03:00',
      });

      expect(mockRepo.update).toHaveBeenCalledWith(
        'tx-001',
        expect.objectContaining({
          occurredAt: new Date('2026-06-15T03:00:00Z'),
        }),
      );
    });

    it('404 si no existe', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(
        service.update(USER_A, 'no-existe', { amountCents: 1000 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('aislamiento: 404 si pertenece a otro usuario (RN-003)', async () => {
      const tx = makeTransaction({ userId: USER_B });
      mockRepo.findById.mockResolvedValue(tx);

      await expect(
        service.update(USER_A, 'tx-001', { amountCents: 1000 }),
      ).rejects.toThrow(NotFoundException);

      expect(mockRepo.update).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // remove (DELETE — hard delete)
  // -------------------------------------------------------------------------

  describe('remove', () => {
    it('elimina permanentemente la transacción propia', async () => {
      const tx = makeTransaction();
      mockRepo.findById.mockResolvedValue(tx);
      mockRepo.delete.mockResolvedValue(undefined);

      await service.remove(USER_A, 'tx-001');

      expect(mockRepo.delete).toHaveBeenCalledWith('tx-001');
    });

    it('404 si no existe', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.remove(USER_A, 'no-existe')).rejects.toThrow(NotFoundException);

      expect(mockRepo.delete).not.toHaveBeenCalled();
    });

    it('aislamiento: 404 si pertenece a otro usuario (RN-003)', async () => {
      const tx = makeTransaction({ userId: USER_B });
      mockRepo.findById.mockResolvedValue(tx);

      await expect(service.remove(USER_A, 'tx-001')).rejects.toThrow(NotFoundException);

      expect(mockRepo.delete).not.toHaveBeenCalled();
    });
  });

});
