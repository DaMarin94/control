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
 * - remove: borrado lógico cuando boundary <= startMonth
 * - remove: 404 si no existe o es de otro usuario
 * - remove: validación de formato de currentMonth
 * - nextMonth: rollover de año
 * - Aislamiento por userId (RN-003)
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CategoryScope, Currency, MovementType } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { RecurringService } from '../../../src/recurring/recurring.service';
import {
  RecurringRepository,
  RecurringWithCategory,
} from '../../../src/recurring/recurring.repository';
import { CategoryValidatorService } from '../../../src/categories/category-validator.service';
import { PaymentMethodValidatorService } from '../../../src/payment-methods/payment-method-validator.service';
import { SettingsService } from '../../../src/settings/settings.service';
import { HistoryService } from '../../../src/history/history.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  findSkip: jest.fn(),
  createSkip: jest.fn(),
  deleteSkip: jest.fn(),
  // Fase 1.1.7 — métodos de calculados y cadena
  findChainRows: jest.fn().mockResolvedValue([]),
  findCalculadosBySourceChain: jest.fn().mockResolvedValue([]),
  // Módulo 3.14 — Historial de cambios (borrado lógico, RF-HIST-006)
  softDeleteRow: jest.fn().mockResolvedValue(undefined),
  findChainRowsForSnapshot: jest.fn().mockResolvedValue([]),
  cascadeSoftDeleteBySourceMovement: jest.fn().mockResolvedValue(undefined),
  cascadeSoftDeleteBySourceInstallmentGroup: jest.fn().mockResolvedValue(undefined),
};

const mockHistoryService = {
  record: jest.fn().mockResolvedValue('hist-entry-id'),
};

/**
 * Mock de CategoryValidatorService.
 * Por defecto no lanza (categoría válida). Los tests que quieren fallar
 * lo sobreescriben con mockRejectedValue(new BadRequestException(...)).
 */
const mockCategoryValidator = {
  validateCategory: jest.fn().mockResolvedValue(undefined),
};

const mockPaymentMethodValidator = {
  validatePaymentMethod: jest.fn().mockResolvedValue(undefined),
  resolveAutoDebit: jest.fn().mockResolvedValue(null),
};

const mockLogger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
};

const mockSettingsServiceRec = {
  getSettings: jest.fn().mockResolvedValue({ defaultCurrency: Currency.ARS, lastExchangeRate: null }),
  updateLastExchangeRate: jest.fn().mockResolvedValue(undefined),
};

// ---------------------------------------------------------------------------
// Helpers de fixtures
// ---------------------------------------------------------------------------

const USER_A = 'user-a-rec';
const USER_B = 'user-b-rec';
const CAT_ID = 'cat-expense-rec';

function makeRecurring(
  overrides: Partial<RecurringWithCategory> = {},
): RecurringWithCategory {
  return {
    id: 'rec-001',
    userId: USER_A,
    categoryId: CAT_ID,
    type: MovementType.EXPENSE,
    amountCents: 5000,
    currency: Currency.ARS,
    exchangeRate: 1,
    anchorCurrency: Currency.ARS,
    description: null,
    startMonth: '2026-01',
    deletedFrom: null,
    frequency: 1,
    chainId: 'chain-001',
    sourceChainId: null,
    sourceMovementId: null,
    sourceInstallmentGroupId: null,
    formulaOperator: null,
    formulaOperand: null,
    formulaSign: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: {
      id: CAT_ID,
      name: 'Servicios',
      color: '#4F86C6',
      scope: CategoryScope.EXPENSE,
    },
    paymentMethodId: null,
    paymentMethod: null,
    autoDebit: null,
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
    // Restablecer el default (categoría válida) antes de cada test
    mockCategoryValidator.validateCategory.mockResolvedValue(undefined);
    mockPaymentMethodValidator.validatePaymentMethod.mockResolvedValue(undefined);
    mockPaymentMethodValidator.resolveAutoDebit.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecurringService,
        { provide: RecurringRepository, useValue: mockRepo },
        { provide: CategoryValidatorService, useValue: mockCategoryValidator },
        { provide: PaymentMethodValidatorService, useValue: mockPaymentMethodValidator },
        { provide: Logger, useValue: mockLogger },
        { provide: SettingsService, useValue: mockSettingsServiceRec },
        { provide: HistoryService, useValue: mockHistoryService },
      ],
    }).compile();

    service = module.get<RecurringService>(RecurringService);
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  describe('create', () => {
    it('crea un fijo y lo devuelve con categoría embebida', async () => {
      // mockCategoryValidator.validateCategory ya resuelve por defecto (sin lanzar)
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
      // El validador compartido lanza BadRequestException
      mockCategoryValidator.validateCategory.mockRejectedValue(
        new BadRequestException('La categoría no existe o no pertenece al usuario'),
      );

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
      mockCategoryValidator.validateCategory.mockRejectedValue(
        new BadRequestException('La categoría no existe o no pertenece al usuario'),
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
      mockCategoryValidator.validateCategory.mockRejectedValue(
        new BadRequestException('La categoría está eliminada'),
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
      mockCategoryValidator.validateCategory.mockRejectedValue(
        new BadRequestException('La categoría no es compatible con el tipo'),
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
      mockCategoryValidator.validateCategory.mockRejectedValue(
        new BadRequestException('La categoría no es compatible con el tipo'),
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
      // El validador no lanza (default)
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
      // El validador no lanza (default)
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
  // autoDebit (P4 — corrección de alcance: atributo del movimiento, no del método)
  // -------------------------------------------------------------------------

  describe('autoDebit', () => {
    it('create: delega la resolución en PaymentMethodValidatorService.resolveAutoDebit', async () => {
      mockPaymentMethodValidator.resolveAutoDebit.mockResolvedValue(true);
      mockRepo.create.mockResolvedValue(makeRecurring({ autoDebit: true }));

      await service.create(USER_A, {
        type: MovementType.EXPENSE,
        amountCents: 5000,
        categoryId: CAT_ID,
        startMonth: '2026-01',
        paymentMethodId: 'pm-debit',
        autoDebit: true,
      });

      expect(mockPaymentMethodValidator.resolveAutoDebit).toHaveBeenCalledWith('pm-debit', true);
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ autoDebit: true }),
      );
    });

    it('update in-place: no recalcula autoDebit si ni paymentMethodId ni autoDebit vienen en el body', async () => {
      const existing = makeRecurring({
        startMonth: '2026-01',
        paymentMethodId: 'pm-debit',
        autoDebit: true,
      });
      mockRepo.findById.mockResolvedValue(existing);
      mockRepo.update.mockResolvedValue(existing);

      // currentMonth <= startMonth → in-place
      await service.update(USER_A, 'rec-001', { currentMonth: '2026-01', amountCents: 6000 });

      expect(mockPaymentMethodValidator.resolveAutoDebit).not.toHaveBeenCalled();
      expect(mockRepo.update).toHaveBeenCalledWith(
        'rec-001',
        expect.not.objectContaining({ autoDebit: expect.anything() }),
      );
    });

    it('update split: R2 hereda autoDebit recalculado contra el paymentMethodId efectivo', async () => {
      const existing = makeRecurring({
        startMonth: '2026-01',
        paymentMethodId: 'pm-debit',
        autoDebit: true,
      });
      mockRepo.findById.mockResolvedValue(existing);
      mockRepo.update.mockResolvedValue(existing);
      mockPaymentMethodValidator.resolveAutoDebit.mockResolvedValue(true);
      mockRepo.create.mockResolvedValue(makeRecurring({ id: 'rec-002', autoDebit: true }));

      // currentMonth > startMonth → split
      await service.update(USER_A, 'rec-001', { currentMonth: '2026-06' });

      expect(mockPaymentMethodValidator.resolveAutoDebit).toHaveBeenCalledWith('pm-debit', true);
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ autoDebit: true }),
      );
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
      // El id de la entrada de historial creada viaja en la respuesta (para el
      // "Deshacer" del toast — pega a POST /history/:id/undo).
      expect(result.historyEntryId).toBe('hist-entry-id');
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
      // El validador no lanza (la nueva categoría es válida)
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

    it('split: R2 hereda deletedFrom del original (bug E1 — no pierde terminación)', async () => {
      // Escenario: fijo con startMonth='2026-01' eliminado desde '2026-06'
      // (deletedFrom='2026-06'). Se edita en un mes activo intermedio ('2026-03').
      // El split debe crear R2 con deletedFrom='2026-06', NO con null.
      const existing = makeRecurring({
        startMonth: '2026-01',
        deletedFrom: '2026-06',
      });
      mockRepo.findById.mockResolvedValue(existing);

      const r2 = makeRecurring({
        id: 'rec-002',
        startMonth: '2026-03',
        deletedFrom: '2026-06',
      });
      mockRepo.update.mockResolvedValue({ ...existing, deletedFrom: '2026-03' });
      mockRepo.create.mockResolvedValue(r2);

      await service.update(USER_A, 'rec-001', {
        amountCents: 8000,
        currentMonth: '2026-03',
      });

      // R2 debe preservar la terminación original, no nacer con null
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ deletedFrom: '2026-06' }),
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
      expect(result.historyEntryId).toBe('hist-entry-id');
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

      // El validador lanza porque la nueva categoría es incompatible (scope INCOME con EXPENSE)
      mockCategoryValidator.validateCategory.mockRejectedValue(
        new BadRequestException('La categoría no es compatible con el tipo'),
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
    it('fromCurrentMonth=false → boundary = nextMonth → set deletedFrom en la cadena', async () => {
      // startMonth='2026-01', currentMonth='2026-06', fromCurrentMonth=false
      // boundary = '2026-07' > '2026-01' → soft delete de la fila
      const existing = makeRecurring({ startMonth: '2026-01' });
      mockRepo.findById.mockResolvedValue(existing);
      // La cadena tiene solo una fila (la clickeada, sin splits)
      mockRepo.findChainRows.mockResolvedValue([
        { id: 'rec-001', startMonth: '2026-01', deletedFrom: null },
      ]);
      mockRepo.update.mockResolvedValue({ ...existing, deletedFrom: '2026-07' });

      const result = await service.remove(USER_A, 'rec-001', '2026-06', false);

      // applyBoundaryToChain: boundary='2026-07' > startMonth='2026-01', deletedFrom=null → update
      expect(mockRepo.update).toHaveBeenCalledWith('rec-001', {
        deletedFrom: '2026-07',
      });
      // DELETE ya no devuelve void: devuelve { historyEntryId } (para el
      // "Deshacer" del toast — pega a POST /history/:id/undo).
      expect(result).toEqual({ historyEntryId: 'hist-entry-id' });
    });

    it('fromCurrentMonth=true → boundary = currentMonth → set deletedFrom en la cadena', async () => {
      // startMonth='2026-01', currentMonth='2026-06', fromCurrentMonth=true
      // boundary = '2026-06' > '2026-01' → soft delete de la fila
      const existing = makeRecurring({ startMonth: '2026-01' });
      mockRepo.findById.mockResolvedValue(existing);
      mockRepo.findChainRows.mockResolvedValue([
        { id: 'rec-001', startMonth: '2026-01', deletedFrom: null },
      ]);
      mockRepo.update.mockResolvedValue({ ...existing, deletedFrom: '2026-06' });

      await service.remove(USER_A, 'rec-001', '2026-06', true);

      expect(mockRepo.update).toHaveBeenCalledWith('rec-001', {
        deletedFrom: '2026-06',
      });
    });

    it('borrado lógico: fromCurrentMonth=true y boundary = startMonth (RF-HIST-006)', async () => {
      // startMonth='2026-06', currentMonth='2026-06', fromCurrentMonth=true
      // boundary = '2026-06' <= startMonth='2026-06' → borrado lógico
      const existing = makeRecurring({ startMonth: '2026-06' });
      mockRepo.findById.mockResolvedValue(existing);
      mockRepo.findChainRows.mockResolvedValue([
        { id: 'rec-001', startMonth: '2026-06', deletedFrom: null },
      ]);
      mockRepo.softDeleteRow.mockResolvedValue(undefined);

      await service.remove(USER_A, 'rec-001', '2026-06', true);

      expect(mockRepo.softDeleteRow).toHaveBeenCalledWith('rec-001');
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('borrado lógico: fromCurrentMonth=false y boundary <= startMonth (RF-HIST-006)', async () => {
      // startMonth='2026-07', currentMonth='2026-06', fromCurrentMonth=false
      // boundary = nextMonth('2026-06') = '2026-07' <= startMonth='2026-07' → borrado lógico
      const existing = makeRecurring({ startMonth: '2026-07' });
      mockRepo.findById.mockResolvedValue(existing);
      mockRepo.findChainRows.mockResolvedValue([
        { id: 'rec-001', startMonth: '2026-07', deletedFrom: null },
      ]);
      mockRepo.softDeleteRow.mockResolvedValue(undefined);

      await service.remove(USER_A, 'rec-001', '2026-06', false);

      expect(mockRepo.softDeleteRow).toHaveBeenCalledWith('rec-001');
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('cadena con split: boundary=m1 → borrado lógico de R1 y R2 (escenario del bug)', async () => {
      // Escenario del bug: R1 startMonth='2026-01', R2 startMonth='2026-03'
      // boundary='2026-01' (fromCurrentMonth=true, currentMonth='2026-01')
      // boundary <= R1.startMonth → borrado lógico R1
      // boundary <= R2.startMonth → borrado lógico R2
      const r1 = makeRecurring({ id: 'rec-001', startMonth: '2026-01', chainId: 'chain-abc' });
      mockRepo.findById.mockResolvedValue(r1);
      // La cadena tiene dos filas (R1 y R2 del split)
      mockRepo.findChainRows.mockResolvedValue([
        { id: 'rec-001', startMonth: '2026-01', deletedFrom: '2026-03' },
        { id: 'rec-002', startMonth: '2026-03', deletedFrom: null },
      ]);
      mockRepo.softDeleteRow.mockResolvedValue(undefined);

      await service.remove(USER_A, 'rec-001', '2026-01', true);

      // Ambas filas deben ser borradas lógicamente porque boundary='2026-01' <= startMonth de ambas
      expect(mockRepo.softDeleteRow).toHaveBeenCalledWith('rec-001');
      expect(mockRepo.softDeleteRow).toHaveBeenCalledWith('rec-002');
      expect(mockRepo.softDeleteRow).toHaveBeenCalledTimes(2);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('cadena con split: boundary=m2 → R1 truncado, R2 con borrado lógico', async () => {
      // Escenario: R1 startMonth='2026-01', R2 startMonth='2026-03'
      // boundary='2026-02' (fromCurrentMonth=true, currentMonth='2026-02')
      // boundary > R1.startMonth y deletedFrom='2026-03' > '2026-02' → truncar R1 a '2026-02'
      // boundary <= R2.startMonth ('2026-02' <= '2026-03') → borrado lógico R2
      const r1 = makeRecurring({ id: 'rec-001', startMonth: '2026-01', chainId: 'chain-abc' });
      mockRepo.findById.mockResolvedValue(r1);
      mockRepo.findChainRows.mockResolvedValue([
        { id: 'rec-001', startMonth: '2026-01', deletedFrom: '2026-03' },
        { id: 'rec-002', startMonth: '2026-03', deletedFrom: null },
      ]);
      mockRepo.softDeleteRow.mockResolvedValue(undefined);
      mockRepo.update.mockResolvedValue({});

      await service.remove(USER_A, 'rec-001', '2026-02', true);

      // R1: boundary='2026-02' > startMonth='2026-01', deletedFrom='2026-03' > '2026-02' → update
      expect(mockRepo.update).toHaveBeenCalledWith('rec-001', { deletedFrom: '2026-02' });
      // R2: boundary='2026-02' <= startMonth='2026-03' → borrado lógico
      expect(mockRepo.softDeleteRow).toHaveBeenCalledWith('rec-002');
      expect(mockRepo.softDeleteRow).toHaveBeenCalledTimes(1);
    });

    it('cadena con split: fila pasada no se toca (pasado inmutable)', async () => {
      // R1: startMonth='2026-01', deletedFrom='2026-03' (ya cerrada ANTES del boundary)
      // R2: startMonth='2026-03', deletedFrom=null
      // boundary='2026-05' → R1 ya tiene deletedFrom='2026-03' <= '2026-05' → no tocar
      //                     → R2: deletedFrom=null > '2026-05' → update a '2026-05'
      const r1 = makeRecurring({ id: 'rec-001', startMonth: '2026-01', chainId: 'chain-abc' });
      mockRepo.findById.mockResolvedValue(r1);
      mockRepo.findChainRows.mockResolvedValue([
        { id: 'rec-001', startMonth: '2026-01', deletedFrom: '2026-03' },
        { id: 'rec-002', startMonth: '2026-03', deletedFrom: null },
      ]);
      mockRepo.update.mockResolvedValue({});

      await service.remove(USER_A, 'rec-001', '2026-05', true);

      // R1: deletedFrom='2026-03' <= boundary='2026-05' → NO tocar
      // R2: deletedFrom=null → update a '2026-05'
      expect(mockRepo.update).toHaveBeenCalledTimes(1);
      expect(mockRepo.update).toHaveBeenCalledWith('rec-002', { deletedFrom: '2026-05' });
    });

    it('404 si el fijo no existe', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(
        service.remove(USER_A, 'no-existe', '2026-06', false),
      ).rejects.toThrow(NotFoundException);

      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('aislamiento: 404 si pertenece a otro usuario (RN-003)', async () => {
      const rec = makeRecurring({ userId: USER_B });
      mockRepo.findById.mockResolvedValue(rec);

      await expect(
        service.remove(USER_A, 'rec-001', '2026-06', false),
      ).rejects.toThrow(NotFoundException);

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

  // -------------------------------------------------------------------------
  // toggleSkip (P1 — Fase 1.1.1)
  // -------------------------------------------------------------------------

  describe('toggleSkip', () => {
    it('anula un mes: crea el skip y devuelve { skipped: true, month }', async () => {
      const rec = makeRecurring({ startMonth: '2026-01' });
      mockRepo.findById.mockResolvedValue(rec);
      mockRepo.findSkip.mockResolvedValue(false);
      mockRepo.createSkip.mockResolvedValue(undefined);

      const result = await service.toggleSkip(USER_A, 'rec-001', '2026-06');

      expect(mockRepo.createSkip).toHaveBeenCalledWith('rec-001', '2026-06');
      expect(mockRepo.deleteSkip).not.toHaveBeenCalled();
      expect(result).toEqual({ skipped: true, month: '2026-06' });
    });

    it('des-anula un mes: borra el skip y devuelve { skipped: false, month }', async () => {
      const rec = makeRecurring({ startMonth: '2026-01' });
      mockRepo.findById.mockResolvedValue(rec);
      mockRepo.findSkip.mockResolvedValue(true);
      mockRepo.deleteSkip.mockResolvedValue(undefined);

      const result = await service.toggleSkip(USER_A, 'rec-001', '2026-06');

      expect(mockRepo.deleteSkip).toHaveBeenCalledWith('rec-001', '2026-06');
      expect(mockRepo.createSkip).not.toHaveBeenCalled();
      expect(result).toEqual({ skipped: false, month: '2026-06' });
    });

    it('idempotencia del toggle: anular dos veces des-anula', async () => {
      const rec = makeRecurring({ startMonth: '2026-01' });
      mockRepo.findById.mockResolvedValue(rec);
      // Primera llamada: no estaba skippeado → lo anula
      mockRepo.findSkip.mockResolvedValueOnce(false);
      mockRepo.createSkip.mockResolvedValue(undefined);
      const r1 = await service.toggleSkip(USER_A, 'rec-001', '2026-06');
      expect(r1.skipped).toBe(true);

      // Segunda llamada: ahora está skippeado → lo des-anula
      mockRepo.findSkip.mockResolvedValueOnce(true);
      mockRepo.deleteSkip.mockResolvedValue(undefined);
      const r2 = await service.toggleSkip(USER_A, 'rec-001', '2026-06');
      expect(r2.skipped).toBe(false);
    });

    it('404 si el fijo no existe', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(
        service.toggleSkip(USER_A, 'no-existe', '2026-06'),
      ).rejects.toThrow(NotFoundException);

      expect(mockRepo.findSkip).not.toHaveBeenCalled();
    });

    it('aislamiento: 404 si el fijo pertenece a otro usuario (RN-003)', async () => {
      const rec = makeRecurring({ userId: USER_B });
      mockRepo.findById.mockResolvedValue(rec);

      await expect(
        service.toggleSkip(USER_A, 'rec-001', '2026-06'),
      ).rejects.toThrow(NotFoundException);

      expect(mockRepo.findSkip).not.toHaveBeenCalled();
    });

    it('400 si el mes tiene formato inválido', async () => {
      await expect(
        service.toggleSkip(USER_A, 'rec-001', '202606'),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.findById).not.toHaveBeenCalled();
    });

    it('400 si el mes tiene valor inválido (13)', async () => {
      await expect(
        service.toggleSkip(USER_A, 'rec-001', '2026-13'),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.findById).not.toHaveBeenCalled();
    });

    it('400 si el mes tiene valor inválido (00)', async () => {
      await expect(
        service.toggleSkip(USER_A, 'rec-001', '2026-00'),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.findById).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // create con frequency (P2 — Fase 1.1.1)
  // -------------------------------------------------------------------------

  describe('create con frequency', () => {
    it('persiste MONTHLY como default cuando no se pasa frequency', async () => {
      mockRepo.create.mockResolvedValue(makeRecurring({ frequency: 1 }));

      await service.create(USER_A, {
        type: MovementType.EXPENSE,
        amountCents: 5000,
        categoryId: CAT_ID,
        startMonth: '2026-06',
        // sin frequency
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ frequency: 1 }),
      );
    });

    it('persiste BIMONTHLY cuando se pasa', async () => {
      mockRepo.create.mockResolvedValue(makeRecurring({ frequency: 2 }));

      await service.create(USER_A, {
        type: MovementType.EXPENSE,
        amountCents: 5000,
        categoryId: CAT_ID,
        startMonth: '2026-06',
        frequency: 2,
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ frequency: 2 }),
      );
    });

    it('persiste QUARTERLY cuando se pasa', async () => {
      mockRepo.create.mockResolvedValue(makeRecurring({ frequency: 3 }));

      await service.create(USER_A, {
        type: MovementType.EXPENSE,
        amountCents: 5000,
        categoryId: CAT_ID,
        startMonth: '2026-06',
        frequency: 3,
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ frequency: 3 }),
      );
    });

    it('split: R2 hereda frequency del original (no es editable)', async () => {
      const existing = makeRecurring({
        startMonth: '2026-01',
        frequency: 2,
      });
      mockRepo.findById.mockResolvedValue(existing);
      const r2 = makeRecurring({
        id: 'rec-002',
        startMonth: '2026-06',
        frequency: 2,
      });
      mockRepo.update.mockResolvedValue({ ...existing, deletedFrom: '2026-06' });
      mockRepo.create.mockResolvedValue(r2);

      await service.update(USER_A, 'rec-001', {
        amountCents: 9000,
        currentMonth: '2026-06',
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ frequency: 2 }),
      );
    });
  });
});
