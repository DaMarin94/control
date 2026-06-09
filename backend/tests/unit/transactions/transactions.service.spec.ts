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
 * - Listado por mes (incluyendo borde de timezone)
 * - Edición que cambia type/categoría → revalidación RN-010
 * - Hard delete
 * - Aislamiento por userId (RN-003)
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CategoryScope, MovementType } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { TransactionsService } from '../../../src/transactions/transactions.service';
import { TransactionsRepository, TransactionWithCategory } from '../../../src/transactions/transactions.repository';
import { PrismaService } from '../../../src/prisma/prisma.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRepo = {
  create: jest.fn(),
  findByUserAndDateRange: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockPrisma = {
  category: {
    findUnique: jest.fn(),
  },
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

function makeCategory(overrides: Record<string, unknown> = {}) {
  return {
    id: CAT_ID,
    userId: USER_A,
    scope: CategoryScope.EXPENSE,
    deletedAt: null,
    ...overrides,
  };
}

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: TransactionsRepository, useValue: mockRepo },
        { provide: PrismaService, useValue: mockPrisma },
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
      const cat = makeCategory({ scope: CategoryScope.EXPENSE });
      mockPrisma.category.findUnique.mockResolvedValue(cat);
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
      const cat = makeCategory({ scope: CategoryScope.EXPENSE });
      mockPrisma.category.findUnique.mockResolvedValue(cat);
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
      const cat = makeCategory({ scope: CategoryScope.BOTH });
      mockPrisma.category.findUnique.mockResolvedValue(cat);
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
      mockPrisma.category.findUnique.mockResolvedValue(null);

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
      const catOtherUser = makeCategory({ userId: USER_B });
      mockPrisma.category.findUnique.mockResolvedValue(catOtherUser);

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
      const deletedCat = makeCategory({ deletedAt: new Date('2024-01-01') });
      mockPrisma.category.findUnique.mockResolvedValue(deletedCat);

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
      const incomeCat = makeCategory({ scope: CategoryScope.INCOME });
      mockPrisma.category.findUnique.mockResolvedValue(incomeCat);

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
      const expenseCat = makeCategory({ scope: CategoryScope.EXPENSE });
      mockPrisma.category.findUnique.mockResolvedValue(expenseCat);

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
      const bothCat = makeCategory({ scope: CategoryScope.BOTH });
      mockPrisma.category.findUnique.mockResolvedValue(bothCat);
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
      const bothCat = makeCategory({ scope: CategoryScope.BOTH });
      mockPrisma.category.findUnique.mockResolvedValue(bothCat);
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
  // findByMonth
  // -------------------------------------------------------------------------

  describe('findByMonth', () => {
    it('llama al repo con rango UTC correcto para UTC-3', async () => {
      mockRepo.findByUserAndDateRange.mockResolvedValue([]);

      await service.findByMonth(USER_A, '2026-06', 'America/Argentina/Buenos_Aires');

      // Junio 2026 en UTC-3:
      // inicio local = 2026-06-01T00:00:00-03:00 → 2026-06-01T03:00:00Z
      // fin   local = 2026-07-01T00:00:00-03:00 → 2026-07-01T03:00:00Z
      expect(mockRepo.findByUserAndDateRange).toHaveBeenCalledWith(
        USER_A,
        new Date('2026-06-01T03:00:00Z'),
        new Date('2026-07-01T03:00:00Z'),
      );
    });

    it('llama al repo con rango UTC correcto para UTC+0 (zona sin offset)', async () => {
      mockRepo.findByUserAndDateRange.mockResolvedValue([]);

      await service.findByMonth(USER_A, '2026-06', 'UTC');

      // Junio 2026 en UTC:
      // inicio = 2026-06-01T00:00:00Z
      // fin    = 2026-07-01T00:00:00Z
      expect(mockRepo.findByUserAndDateRange).toHaveBeenCalledWith(
        USER_A,
        new Date('2026-06-01T00:00:00Z'),
        new Date('2026-07-01T00:00:00Z'),
      );
    });

    it('maneja correctamente el cambio de año (diciembre → enero)', async () => {
      mockRepo.findByUserAndDateRange.mockResolvedValue([]);

      await service.findByMonth(USER_A, '2026-12', 'UTC');

      expect(mockRepo.findByUserAndDateRange).toHaveBeenCalledWith(
        USER_A,
        new Date('2026-12-01T00:00:00Z'),
        new Date('2027-01-01T00:00:00Z'),
      );
    });

    it('devuelve transacciones en orden recibido del repo (desc por occurredAt)', async () => {
      const txs = [
        makeTransaction({ id: 'tx-2', occurredAt: new Date('2026-06-15T00:00:00Z') }),
        makeTransaction({ id: 'tx-1', occurredAt: new Date('2026-06-01T00:00:00Z') }),
      ];
      mockRepo.findByUserAndDateRange.mockResolvedValue(txs);

      const result = await service.findByMonth(USER_A, '2026-06', 'UTC');

      expect(result[0].id).toBe('tx-2');
      expect(result[1].id).toBe('tx-1');
    });

    it('month con formato inválido → BadRequestException', async () => {
      await expect(
        service.findByMonth(USER_A, '2026/06', 'UTC'),
      ).rejects.toThrow(BadRequestException);
    });

    it('month con mes inválido (13) → BadRequestException', async () => {
      await expect(
        service.findByMonth(USER_A, '2026-13', 'UTC'),
      ).rejects.toThrow(BadRequestException);
    });

    it('timezone inválida → BadRequestException', async () => {
      await expect(
        service.findByMonth(USER_A, '2026-06', 'No/Valid/Timezone'),
      ).rejects.toThrow(BadRequestException);
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

      // Intentar cambiar a INCOME → categoría EXPENSE incompatible
      const expenseCat = makeCategory({ scope: CategoryScope.EXPENSE });
      mockPrisma.category.findUnique.mockResolvedValue(expenseCat);

      await expect(
        service.update(USER_A, 'tx-001', { type: MovementType.INCOME }),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('cambia la categoría y revalida scope compatibility (RN-010)', async () => {
      const existing = makeTransaction({ type: MovementType.EXPENSE });
      mockRepo.findById.mockResolvedValue(existing);

      // Nueva categoría con scope INCOME → incompatible con EXPENSE
      const incomeCat = makeCategory({ scope: CategoryScope.INCOME });
      mockPrisma.category.findUnique.mockResolvedValue(incomeCat);

      await expect(
        service.update(USER_A, 'tx-001', { categoryId: 'new-cat-id' }),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('cambia type y categoría juntos: usa ambos nuevos para validar (RN-010)', async () => {
      const existing = makeTransaction({ type: MovementType.EXPENSE });
      mockRepo.findById.mockResolvedValue(existing);

      // Categoría INCOME + type INCOME → compatible
      const incomeCat = makeCategory({ scope: CategoryScope.INCOME });
      mockPrisma.category.findUnique.mockResolvedValue(incomeCat);
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

  // -------------------------------------------------------------------------
  // parseMonthToUtcRange (método público para testear — borde de timezone)
  // -------------------------------------------------------------------------

  describe('parseMonthToUtcRange (bucketeo por mes)', () => {
    it('timezone UTC-3 — inicio del mes en UTC es 03:00:00Z', () => {
      const { from, to } = service.parseMonthToUtcRange('2026-01', 'America/Argentina/Buenos_Aires');

      expect(from).toEqual(new Date('2026-01-01T03:00:00Z'));
      expect(to).toEqual(new Date('2026-02-01T03:00:00Z'));
    });

    it('timezone UTC — inicio del mes en UTC es 00:00:00Z', () => {
      const { from, to } = service.parseMonthToUtcRange('2026-01', 'UTC');

      expect(from).toEqual(new Date('2026-01-01T00:00:00Z'));
      expect(to).toEqual(new Date('2026-02-01T00:00:00Z'));
    });

    it('borde de año: diciembre 2026 → enero 2027', () => {
      const { from, to } = service.parseMonthToUtcRange('2026-12', 'UTC');

      expect(from).toEqual(new Date('2026-12-01T00:00:00Z'));
      expect(to).toEqual(new Date('2027-01-01T00:00:00Z'));
    });

    it('formato inválido lanza BadRequestException', () => {
      expect(() => service.parseMonthToUtcRange('2026/06', 'UTC')).toThrow(BadRequestException);
      expect(() => service.parseMonthToUtcRange('202606', 'UTC')).toThrow(BadRequestException);
    });

    it('mes 00 lanza BadRequestException', () => {
      expect(() => service.parseMonthToUtcRange('2026-00', 'UTC')).toThrow(BadRequestException);
    });

    it('mes 13 lanza BadRequestException', () => {
      expect(() => service.parseMonthToUtcRange('2026-13', 'UTC')).toThrow(BadRequestException);
    });
  });
});
