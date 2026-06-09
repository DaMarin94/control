/**
 * Tests unitarios de RecurringService.
 *
 * Cubre:
 * - create: OK + validación de categoría (inexistente, ajena, eliminada, scope) + startMonth semántico
 * - update (PATCH): split con pasado, in-place sin pasado
 * - update: inmutabilidad del type (no cambia en split ni in-place)
 * - update: revalidación de categoría cuando cambia categoryId
 * - update: 404 si no existe o es de otro usuario
 * - remove (DELETE): fromCurrentMonth=true, fromCurrentMonth=false
 * - remove: hard-delete cuando boundary <= startMonth
 * - remove: 404 si no existe o es de otro usuario
 * - remove: validación de formato de currentMonth
 * - nextMonth: rollover de año
 * - Aislamiento por userId (RN-003)
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CategoryScope, MovementType } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { RecurringService } from '../../../src/recurring/recurring.service';
import {
  RecurringRepository,
  RecurringWithCategory,
} from '../../../src/recurring/recurring.repository';
import { PrismaService } from '../../../src/prisma/prisma.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRepo = {
  create: jest.fn(),
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
// Helpers de fixtures
// ---------------------------------------------------------------------------

const USER_A = 'user-a-rec';
const USER_B = 'user-b-rec';
const CAT_ID = 'cat-expense-rec';

function makeCategory(overrides: Record<string, unknown> = {}) {
  return {
    id: CAT_ID,
    userId: USER_A,
    scope: CategoryScope.EXPENSE,
    deletedAt: null,
    ...overrides,
  };
}

function makeRecurring(
  overrides: Partial<RecurringWithCategory> = {},
): RecurringWithCategory {
  return {
    id: 'rec-001',
    userId: USER_A,
    categoryId: CAT_ID,
    type: MovementType.EXPENSE,
    amountCents: 5000,
    description: null,
    startMonth: '2026-01',
    deletedFrom: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: {
      id: CAT_ID,
      name: 'Servicios',
      color: '#4F86C6',
      scope: CategoryScope.EXPENSE,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('RecurringService', () => {
  let service: RecurringService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecurringService,
        { provide: RecurringRepository, useValue: mockRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: Logger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<RecurringService>(RecurringService);
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  describe('create', () => {
    it('crea un fijo y lo devuelve con categoría embebida', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(makeCategory());
      const rec = makeRecurring();
      mockRepo.create.mockResolvedValue(rec);

      const result = await service.create(USER_A, {
        type: MovementType.EXPENSE,
        amountCents: 5000,
        categoryId: CAT_ID,
        startMonth: '2026-06',
      });

      expect(result).toEqual(rec);
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MovementType.EXPENSE,
          amountCents: 5000,
          startMonth: '2026-06',
        }),
      );
    });

    it('persiste description null si no se pasa', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(makeCategory());
      mockRepo.create.mockResolvedValue(makeRecurring({ description: null }));

      await service.create(USER_A, {
        type: MovementType.EXPENSE,
        amountCents: 5000,
        categoryId: CAT_ID,
        startMonth: '2026-06',
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ description: null }),
      );
    });

    it('persiste description si se pasa', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(makeCategory());
      mockRepo.create.mockResolvedValue(makeRecurring({ description: 'Netflix' }));

      await service.create(USER_A, {
        type: MovementType.EXPENSE,
        amountCents: 5000,
        categoryId: CAT_ID,
        startMonth: '2026-06',
        description: 'Netflix',
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Netflix' }),
      );
    });

    it('startMonth con mes inválido (00) → BadRequestException', async () => {
      await expect(
        service.create(USER_A, {
          type: MovementType.EXPENSE,
          amountCents: 5000,
          categoryId: CAT_ID,
          startMonth: '2026-00',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('startMonth con mes inválido (13) → BadRequestException', async () => {
      await expect(
        service.create(USER_A, {
          type: MovementType.EXPENSE,
          amountCents: 5000,
          categoryId: CAT_ID,
          startMonth: '2026-13',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('categoría inexistente → BadRequestException (RN-010)', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.create(USER_A, {
          type: MovementType.EXPENSE,
          amountCents: 5000,
          categoryId: 'no-existe',
          startMonth: '2026-06',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('categoría de otro usuario → BadRequestException (aislamiento RN-003)', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(
        makeCategory({ userId: USER_B }),
      );

      await expect(
        service.create(USER_A, {
          type: MovementType.EXPENSE,
          amountCents: 5000,
          categoryId: CAT_ID,
          startMonth: '2026-06',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('categoría eliminada → BadRequestException (RN-010)', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(
        makeCategory({ deletedAt: new Date('2024-01-01') }),
      );

      await expect(
        service.create(USER_A, {
          type: MovementType.EXPENSE,
          amountCents: 5000,
          categoryId: CAT_ID,
          startMonth: '2026-06',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('scope incompatible EXPENSE con categoría INCOME → BadRequestException (RN-010)', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(
        makeCategory({ scope: CategoryScope.INCOME }),
      );

      await expect(
        service.create(USER_A, {
          type: MovementType.EXPENSE,
          amountCents: 5000,
          categoryId: CAT_ID,
          startMonth: '2026-06',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('scope incompatible INCOME con categoría EXPENSE → BadRequestException (RN-010)', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(
        makeCategory({ scope: CategoryScope.EXPENSE }),
      );

      await expect(
        service.create(USER_A, {
          type: MovementType.INCOME,
          amountCents: 5000,
          categoryId: CAT_ID,
          startMonth: '2026-06',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('scope BOTH compatible con EXPENSE (RN-010)', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(
        makeCategory({ scope: CategoryScope.BOTH }),
      );
      mockRepo.create.mockResolvedValue(makeRecurring({ type: MovementType.EXPENSE }));

      await expect(
        service.create(USER_A, {
          type: MovementType.EXPENSE,
          amountCents: 5000,
          categoryId: CAT_ID,
          startMonth: '2026-06',
        }),
      ).resolves.not.toThrow();
    });

    it('scope BOTH compatible con INCOME (RN-010)', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(
        makeCategory({ scope: CategoryScope.BOTH }),
      );
      mockRepo.create.mockResolvedValue(makeRecurring({ type: MovementType.INCOME }));

      await expect(
        service.create(USER_A, {
          type: MovementType.INCOME,
          amountCents: 5000,
          categoryId: CAT_ID,
          startMonth: '2026-06',
        }),
      ).resolves.not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // update (PATCH) — split con pasado
  // -------------------------------------------------------------------------

  describe('update — split (currentMonth > startMonth)', () => {
    it('split: cierra la fila original con deletedFrom=currentMonth y crea R2', async () => {
      // startMonth='2026-01', currentMonth='2026-06' → hay pasado → split
      const existing = makeRecurring({ startMonth: '2026-01' });
      mockRepo.findById.mockResolvedValue(existing);

      const r2 = makeRecurring({
        id: 'rec-002',
        startMonth: '2026-06',
        amountCents: 9000,
      });
      mockRepo.update.mockResolvedValue({ ...existing, deletedFrom: '2026-06' });
      mockRepo.create.mockResolvedValue(r2);

      const result = await service.update(USER_A, 'rec-001', {
        amountCents: 9000,
        currentMonth: '2026-06',
      });

      // Debe marcar la fila existente con deletedFrom
      expect(mockRepo.update).toHaveBeenCalledWith('rec-001', {
        deletedFrom: '2026-06',
      });
      // Debe crear R2 con startMonth=currentMonth y el nuevo amountCents
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amountCents: 9000,
          startMonth: '2026-06',
        }),
      );
      // Devuelve R2
      expect(result.id).toBe('rec-002');
    });

    it('split: el type NO cambia (RF-MF-003 — inmutabilidad del type)', async () => {
      const existing = makeRecurring({
        startMonth: '2026-01',
        type: MovementType.EXPENSE,
      });
      mockRepo.findById.mockResolvedValue(existing);
      const r2 = makeRecurring({ id: 'rec-002', startMonth: '2026-06' });
      mockRepo.update.mockResolvedValue({ ...existing, deletedFrom: '2026-06' });
      mockRepo.create.mockResolvedValue(r2);

      await service.update(USER_A, 'rec-001', {
        amountCents: 9000,
        currentMonth: '2026-06',
      });

      // R2 debe crearse con el mismo type que la fila original
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: MovementType.EXPENSE }),
      );
    });

    it('split: R2 hereda categoryId si no se pasa nuevo', async () => {
      const existing = makeRecurring({ startMonth: '2026-01', categoryId: CAT_ID });
      mockRepo.findById.mockResolvedValue(existing);
      const r2 = makeRecurring({ id: 'rec-002', startMonth: '2026-06' });
      mockRepo.update.mockResolvedValue({ ...existing, deletedFrom: '2026-06' });
      mockRepo.create.mockResolvedValue(r2);

      await service.update(USER_A, 'rec-001', {
        amountCents: 9000,
        currentMonth: '2026-06',
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          category: { connect: { id: CAT_ID } },
        }),
      );
    });

    it('split: R2 usa el nuevo categoryId si se pasa', async () => {
      const existing = makeRecurring({ startMonth: '2026-01' });
      mockRepo.findById.mockResolvedValue(existing);
      mockPrisma.category.findUnique.mockResolvedValue(
        makeCategory({ id: 'cat-new', scope: CategoryScope.EXPENSE }),
      );
      const r2 = makeRecurring({
        id: 'rec-002',
        startMonth: '2026-06',
        categoryId: 'cat-new',
      });
      mockRepo.update.mockResolvedValue({ ...existing, deletedFrom: '2026-06' });
      mockRepo.create.mockResolvedValue(r2);

      await service.update(USER_A, 'rec-001', {
        categoryId: 'cat-new',
        currentMonth: '2026-06',
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          category: { connect: { id: 'cat-new' } },
        }),
      );
    });

    it('split: R2 hereda description si no se pasa nueva', async () => {
      const existing = makeRecurring({
        startMonth: '2026-01',
        description: 'Netflix',
      });
      mockRepo.findById.mockResolvedValue(existing);
      const r2 = makeRecurring({
        id: 'rec-002',
        startMonth: '2026-06',
        description: 'Netflix',
      });
      mockRepo.update.mockResolvedValue({ ...existing, deletedFrom: '2026-06' });
      mockRepo.create.mockResolvedValue(r2);

      await service.update(USER_A, 'rec-001', {
        currentMonth: '2026-06',
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Netflix' }),
      );
    });

    it('split: R2 usa null de description si se pasa null explícito', async () => {
      const existing = makeRecurring({
        startMonth: '2026-01',
        description: 'Netflix',
      });
      mockRepo.findById.mockResolvedValue(existing);
      const r2 = makeRecurring({
        id: 'rec-002',
        startMonth: '2026-06',
        description: null,
      });
      mockRepo.update.mockResolvedValue({ ...existing, deletedFrom: '2026-06' });
      mockRepo.create.mockResolvedValue(r2);

      await service.update(USER_A, 'rec-001', {
        description: null,
        currentMonth: '2026-06',
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ description: null }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // update (PATCH) — in-place (currentMonth <= startMonth)
  // -------------------------------------------------------------------------

  describe('update — in-place (currentMonth <= startMonth)', () => {
    it('in-place: currentMonth = startMonth → update directo (sin pasado)', async () => {
      const existing = makeRecurring({ startMonth: '2026-06' });
      mockRepo.findById.mockResolvedValue(existing);
      const updated = makeRecurring({ startMonth: '2026-06', amountCents: 9000 });
      mockRepo.update.mockResolvedValue(updated);

      const result = await service.update(USER_A, 'rec-001', {
        amountCents: 9000,
        currentMonth: '2026-06',
      });

      // No debe llamar a create (no hay split)
      expect(mockRepo.create).not.toHaveBeenCalled();
      // Actualiza directamente la fila existente
      expect(mockRepo.update).toHaveBeenCalledWith(
        'rec-001',
        expect.objectContaining({ amountCents: 9000 }),
      );
      expect(result.amountCents).toBe(9000);
    });

    it('in-place: currentMonth < startMonth → update directo', async () => {
      const existing = makeRecurring({ startMonth: '2026-06' });
      mockRepo.findById.mockResolvedValue(existing);
      const updated = makeRecurring({ startMonth: '2026-06', amountCents: 7000 });
      mockRepo.update.mockResolvedValue(updated);

      await service.update(USER_A, 'rec-001', {
        amountCents: 7000,
        currentMonth: '2026-05', // < startMonth '2026-06'
      });

      expect(mockRepo.create).not.toHaveBeenCalled();
      expect(mockRepo.update).toHaveBeenCalledWith(
        'rec-001',
        expect.objectContaining({ amountCents: 7000 }),
      );
    });

    it('in-place: el type NO se modifica (RF-MF-003 — inmutabilidad del type)', async () => {
      // Aunque el DTO no acepta type, verificamos que el service no lo toca
      const existing = makeRecurring({
        startMonth: '2026-06',
        type: MovementType.EXPENSE,
      });
      mockRepo.findById.mockResolvedValue(existing);
      const updated = makeRecurring({ startMonth: '2026-06' });
      mockRepo.update.mockResolvedValue(updated);

      await service.update(USER_A, 'rec-001', {
        amountCents: 9000,
        currentMonth: '2026-06',
      });

      // La llamada al update no debe incluir 'type'
      const updateCall = mockRepo.update.mock.calls[0][1];
      expect(updateCall).not.toHaveProperty('type');
    });

    it('in-place: cambia description a null', async () => {
      const existing = makeRecurring({
        startMonth: '2026-06',
        description: 'Netflix',
      });
      mockRepo.findById.mockResolvedValue(existing);
      const updated = makeRecurring({ description: null });
      mockRepo.update.mockResolvedValue(updated);

      await service.update(USER_A, 'rec-001', {
        description: null,
        currentMonth: '2026-06',
      });

      expect(mockRepo.update).toHaveBeenCalledWith(
        'rec-001',
        expect.objectContaining({ description: null }),
      );
    });

    it('in-place: revalida scope si cambia categoryId', async () => {
      const existing = makeRecurring({
        startMonth: '2026-06',
        type: MovementType.EXPENSE,
      });
      mockRepo.findById.mockResolvedValue(existing);

      // Nueva categoría con scope INCOME → incompatible con EXPENSE
      mockPrisma.category.findUnique.mockResolvedValue(
        makeCategory({ scope: CategoryScope.INCOME }),
      );

      await expect(
        service.update(USER_A, 'rec-001', {
          categoryId: 'cat-income',
          currentMonth: '2026-06',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.update).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // update — errores
  // -------------------------------------------------------------------------

  describe('update — errores', () => {
    it('404 si el fijo no existe', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(
        service.update(USER_A, 'no-existe', { currentMonth: '2026-06' }),
      ).rejects.toThrow(NotFoundException);

      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('aislamiento: 404 si pertenece a otro usuario (RN-003)', async () => {
      const rec = makeRecurring({ userId: USER_B });
      mockRepo.findById.mockResolvedValue(rec);

      await expect(
        service.update(USER_A, 'rec-001', { currentMonth: '2026-06' }),
      ).rejects.toThrow(NotFoundException);

      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('currentMonth con mes inválido (00) → BadRequestException', async () => {
      await expect(
        service.update(USER_A, 'rec-001', { currentMonth: '2026-00' }),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.findById).not.toHaveBeenCalled();
    });

    it('currentMonth con mes inválido (13) → BadRequestException', async () => {
      await expect(
        service.update(USER_A, 'rec-001', { currentMonth: '2026-13' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // remove (DELETE)
  // -------------------------------------------------------------------------

  describe('remove', () => {
    it('fromCurrentMonth=false → boundary = nextMonth → set deletedFrom', async () => {
      // startMonth='2026-01', currentMonth='2026-06', fromCurrentMonth=false
      // boundary = '2026-07' > '2026-01' → soft delete
      const existing = makeRecurring({ startMonth: '2026-01' });
      mockRepo.findById.mockResolvedValue(existing);
      mockRepo.update.mockResolvedValue({ ...existing, deletedFrom: '2026-07' });

      await service.remove(USER_A, 'rec-001', '2026-06', false);

      expect(mockRepo.update).toHaveBeenCalledWith('rec-001', {
        deletedFrom: '2026-07',
      });
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });

    it('fromCurrentMonth=true → boundary = currentMonth → set deletedFrom', async () => {
      // startMonth='2026-01', currentMonth='2026-06', fromCurrentMonth=true
      // boundary = '2026-06' > '2026-01' → soft delete
      const existing = makeRecurring({ startMonth: '2026-01' });
      mockRepo.findById.mockResolvedValue(existing);
      mockRepo.update.mockResolvedValue({ ...existing, deletedFrom: '2026-06' });

      await service.remove(USER_A, 'rec-001', '2026-06', true);

      expect(mockRepo.update).toHaveBeenCalledWith('rec-001', {
        deletedFrom: '2026-06',
      });
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });

    it('hard delete: fromCurrentMonth=true y boundary = startMonth', async () => {
      // startMonth='2026-06', currentMonth='2026-06', fromCurrentMonth=true
      // boundary = '2026-06' <= startMonth='2026-06' → hard delete
      const existing = makeRecurring({ startMonth: '2026-06' });
      mockRepo.findById.mockResolvedValue(existing);
      mockRepo.delete.mockResolvedValue(undefined);

      await service.remove(USER_A, 'rec-001', '2026-06', true);

      expect(mockRepo.delete).toHaveBeenCalledWith('rec-001');
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('hard delete: fromCurrentMonth=false y boundary <= startMonth', async () => {
      // startMonth='2026-07', currentMonth='2026-06', fromCurrentMonth=false
      // boundary = nextMonth('2026-06') = '2026-07' <= startMonth='2026-07' → hard delete
      const existing = makeRecurring({ startMonth: '2026-07' });
      mockRepo.findById.mockResolvedValue(existing);
      mockRepo.delete.mockResolvedValue(undefined);

      await service.remove(USER_A, 'rec-001', '2026-06', false);

      expect(mockRepo.delete).toHaveBeenCalledWith('rec-001');
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('404 si el fijo no existe', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(
        service.remove(USER_A, 'no-existe', '2026-06', false),
      ).rejects.toThrow(NotFoundException);

      expect(mockRepo.delete).not.toHaveBeenCalled();
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('aislamiento: 404 si pertenece a otro usuario (RN-003)', async () => {
      const rec = makeRecurring({ userId: USER_B });
      mockRepo.findById.mockResolvedValue(rec);

      await expect(
        service.remove(USER_A, 'rec-001', '2026-06', false),
      ).rejects.toThrow(NotFoundException);

      expect(mockRepo.delete).not.toHaveBeenCalled();
    });

    it('currentMonth con formato inválido → BadRequestException', async () => {
      await expect(
        service.remove(USER_A, 'rec-001', '202606', false),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.findById).not.toHaveBeenCalled();
    });

    it('currentMonth con mes inválido (00) → BadRequestException', async () => {
      await expect(
        service.remove(USER_A, 'rec-001', '2026-00', false),
      ).rejects.toThrow(BadRequestException);
    });

    it('currentMonth con mes inválido (13) → BadRequestException', async () => {
      await expect(
        service.remove(USER_A, 'rec-001', '2026-13', false),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // nextMonth — helper de rollover
  // -------------------------------------------------------------------------

  describe('nextMonth', () => {
    it('mes intermedio: 2026-06 → 2026-07', () => {
      expect(service.nextMonth('2026-06')).toBe('2026-07');
    });

    it('mes de noviembre: 2026-11 → 2026-12', () => {
      expect(service.nextMonth('2026-11')).toBe('2026-12');
    });

    it('rollover de año: 2026-12 → 2027-01', () => {
      expect(service.nextMonth('2026-12')).toBe('2027-01');
    });

    it('mes 01: 2026-01 → 2026-02', () => {
      expect(service.nextMonth('2026-01')).toBe('2026-02');
    });

    it('rollover con padding: 2099-12 → 2100-01', () => {
      expect(service.nextMonth('2099-12')).toBe('2100-01');
    });
  });
});
