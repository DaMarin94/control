/**
 * Tests unitarios de PaymentMethodsService (P4).
 *
 * Espejo de categories.service.spec.ts, adaptado a las diferencias de PaymentMethod:
 * - identidad por ícono (no color)
 * - type obligatorio sin default (allowlist CREDIT/DEBIT/CASH)
 * - campos condicionales por tipo (closingDay/paymentDay — solo CREDIT). autoDebit
 *   NO vive en PaymentMethod (corrección de alcance P4): es un atributo del movimiento.
 *
 * Cubre:
 * - Normalización RN-014 (colisión por mayúsculas y acentos)
 * - Colisión con activo → 409 duplicado
 * - Colisión con eliminado → ReactivableConflictException con id correcto
 * - Reactivar (vuelve con tipo/ícono/campos originales)
 * - Campos condicionales por tipo al crear
 * - Edición: cambio de tipo descarta campos que ya no aplican
 * - Edición: revalidación de unicidad
 * - Soft delete
 * - Contador de movimientos
 * - Aislamiento por userId
 * - Ícono: default "card", fallback si no pertenece al set curado
 */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { PaymentMethodsService } from '../../../src/payment-methods/payment-methods.service';
import {
  PaymentMethodsRepository,
  PaymentMethodWithCount,
} from '../../../src/payment-methods/payment-methods.repository';
import { normalizePaymentMethodName } from '../../../src/payment-methods/payment-methods.repository';
import { ReactivableConflictException } from '../../../src/common/exceptions/reactivable-conflict.exception';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRepo = {
  findActiveByUser: jest.fn(),
  findByNormalizedName: jest.fn(),
  findActiveExcluding: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
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

function makeMethod(overrides: Partial<PaymentMethodWithCount> = {}): PaymentMethodWithCount {
  return {
    id: 'pm-001',
    userId: USER_A,
    name: 'Visa Crédito',
    type: 'CREDIT',
    closingDay: 10,
    paymentDay: 20,
    icon: 'visa',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    movementCount: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('PaymentMethodsService', () => {
  let service: PaymentMethodsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentMethodsService,
        { provide: PaymentMethodsRepository, useValue: mockRepo },
        { provide: Logger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<PaymentMethodsService>(PaymentMethodsService);
  });

  // -------------------------------------------------------------------------
  // normalizePaymentMethodName (helper — espejo de normalizeName)
  // -------------------------------------------------------------------------

  describe('normalizePaymentMethodName (RN-014)', () => {
    it('hace trim y lowercase', () => {
      expect(normalizePaymentMethodName('  EFECTIVO  ')).toBe('efectivo');
    });

    it('es insensible a acentos', () => {
      expect(normalizePaymentMethodName('Débito')).toBe('debito');
    });

    it('detecta colisión entre "Débito" y "debito"', () => {
      expect(normalizePaymentMethodName('Débito')).toBe(normalizePaymentMethodName('debito'));
    });
  });

  // -------------------------------------------------------------------------
  // findAll
  // -------------------------------------------------------------------------

  describe('findAll', () => {
    it('devuelve métodos activos del usuario', async () => {
      const methods = [makeMethod(), makeMethod({ id: 'pm-002', name: 'Efectivo', type: 'CASH' })];
      mockRepo.findActiveByUser.mockResolvedValue(methods);

      const result = await service.findAll(USER_A);

      expect(result).toEqual(methods);
      expect(mockRepo.findActiveByUser).toHaveBeenCalledWith(USER_A);
    });

    it('aislamiento: usa el userId correcto', async () => {
      mockRepo.findActiveByUser.mockResolvedValue([]);

      await service.findAll(USER_B);

      expect(mockRepo.findActiveByUser).toHaveBeenCalledWith(USER_B);
      expect(mockRepo.findActiveByUser).not.toHaveBeenCalledWith(USER_A);
    });

    it('devuelve lista vacía si no hay métodos (cuenta nueva sin métodos por defecto)', async () => {
      mockRepo.findActiveByUser.mockResolvedValue([]);

      const result = await service.findAll(USER_A);

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  describe('create', () => {
    const setupNoCollision = () => {
      mockRepo.findByNormalizedName.mockResolvedValue({ active: null, deleted: null });
    };

    it('crea método CREDIT con closingDay/paymentDay', async () => {
      setupNoCollision();
      mockRepo.create.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve(makeMethod({ ...data } as Partial<PaymentMethodWithCount>)),
      );

      const result = await service.create(USER_A, {
        name: 'Visa',
        type: 'CREDIT',
        closingDay: 5,
        paymentDay: 15,
      });

      expect(result.type).toBe('CREDIT');
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Visa',
          type: 'CREDIT',
          closingDay: 5,
          paymentDay: 15,
        }),
      );
    });

    it('crea método DEBIT sin closingDay/paymentDay (autoDebit no es campo del método)', async () => {
      setupNoCollision();
      mockRepo.create.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve(makeMethod({ ...data } as Partial<PaymentMethodWithCount>)),
      );

      await service.create(USER_A, {
        name: 'Débito Santander',
        type: 'DEBIT',
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'DEBIT',
          closingDay: null,
          paymentDay: null,
        }),
      );
      expect(mockRepo.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ autoDebit: expect.anything() }),
      );
    });

    it('crea método CASH sin campos condicionales', async () => {
      setupNoCollision();
      mockRepo.create.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve(makeMethod({ ...data } as Partial<PaymentMethodWithCount>)),
      );

      await service.create(USER_A, { name: 'Efectivo', type: 'CASH' });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CASH',
          closingDay: null,
          paymentDay: null,
        }),
      );
    });

    it('ignora closingDay/paymentDay si el tipo no es CREDIT (CASH con campos de crédito enviados)', async () => {
      setupNoCollision();
      mockRepo.create.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve(makeMethod({ ...data } as Partial<PaymentMethodWithCount>)),
      );

      await service.create(USER_A, {
        name: 'Efectivo',
        type: 'CASH',
        closingDay: 10,
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ closingDay: null }),
      );
    });

    it('sin icon en DTO → default "card"', async () => {
      setupNoCollision();
      mockRepo.create.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve(makeMethod({ ...data } as Partial<PaymentMethodWithCount>)),
      );

      const result = await service.create(USER_A, { name: 'Efectivo', type: 'CASH' });

      expect(result.icon).toBe('card');
    });

    it('icon fuera del set curado → fallback a "card" (RF-PM-004, distinto de color de categorías)', async () => {
      setupNoCollision();
      mockRepo.create.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve(makeMethod({ ...data } as Partial<PaymentMethodWithCount>)),
      );

      const result = await service.create(USER_A, {
        name: 'Efectivo',
        type: 'CASH',
        icon: 'marca-inexistente',
      });

      expect(result.icon).toBe('card');
    });

    it('icon del set curado → se respeta', async () => {
      setupNoCollision();
      mockRepo.create.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve(makeMethod({ ...data } as Partial<PaymentMethodWithCount>)),
      );

      const result = await service.create(USER_A, {
        name: 'Mercado Pago',
        type: 'DEBIT',
        icon: 'mercadopago',
      });

      expect(result.icon).toBe('mercadopago');
    });

    it('colisión con activo → ConflictException 409 (espejo RN-008)', async () => {
      const active = makeMethod({ name: 'Visa Crédito' });
      mockRepo.findByNormalizedName.mockResolvedValue({ active, deleted: null });

      await expect(
        service.create(USER_A, { name: 'visa crédito', type: 'CREDIT' }),
      ).rejects.toThrow(ConflictException);

      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('colisión con eliminado → ReactivableConflictException con id/type/icon correctos', async () => {
      const deleted = makeMethod({
        id: 'deleted-pm-id',
        name: 'Viejo Débito',
        type: 'DEBIT',
        icon: 'bank',
        deletedAt: new Date('2024-01-01'),
      });
      mockRepo.findByNormalizedName.mockResolvedValue({ active: null, deleted });

      let thrownError: unknown;
      try {
        await service.create(USER_A, { name: 'viejo débito', type: 'DEBIT' });
      } catch (e) {
        thrownError = e;
      }

      expect(thrownError).toBeInstanceOf(ReactivableConflictException);
      const err = thrownError as ReactivableConflictException<
        import('../../../src/common/exceptions/reactivable-conflict.exception').ReactivablePaymentMethodPayload
      >;
      expect(err.reactivablePayload.reactivable).toBe(true);
      expect(err.reactivablePayload.paymentMethod.id).toBe('deleted-pm-id');
      expect(err.reactivablePayload.paymentMethod.name).toBe('Viejo Débito');
      expect(err.reactivablePayload.paymentMethod.type).toBe('DEBIT');
      expect(err.reactivablePayload.paymentMethod.icon).toBe('bank');

      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('nombre vacío → ConflictException', async () => {
      await expect(
        service.create(USER_A, { name: '   ', type: 'CASH' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // -------------------------------------------------------------------------
  // reactivate
  // -------------------------------------------------------------------------

  describe('reactivate', () => {
    it('reactiva método eliminado del usuario → deletedAt = null', async () => {
      const deleted = makeMethod({ id: 'pm-del', deletedAt: new Date('2024-01-01') });
      mockRepo.findById.mockResolvedValue(deleted);
      mockRepo.update.mockResolvedValue({ ...deleted, deletedAt: null });

      const result = await service.reactivate(USER_A, 'pm-del');

      expect(result.deletedAt).toBeNull();
      expect(mockRepo.update).toHaveBeenCalledWith('pm-del', { deletedAt: null });
    });

    it('vuelve con el tipo, ícono y campos condicionales originales intactos', async () => {
      const deleted = makeMethod({
        id: 'pm-del',
        type: 'CREDIT',
        icon: 'mastercard',
        closingDay: 8,
        paymentDay: 18,
        deletedAt: new Date(),
      });
      mockRepo.findById.mockResolvedValue(deleted);
      mockRepo.update.mockResolvedValue({ ...deleted, deletedAt: null });

      const result = await service.reactivate(USER_A, 'pm-del');

      expect(result.type).toBe('CREDIT');
      expect(result.icon).toBe('mastercard');
      expect(result.closingDay).toBe(8);
      expect(result.paymentDay).toBe(18);
    });

    it('404 si no existe', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.reactivate(USER_A, 'no-existe')).rejects.toThrow(NotFoundException);
    });

    it('aislamiento: 404 si pertenece a otro usuario', async () => {
      const other = makeMethod({ id: 'pm-b', userId: USER_B, deletedAt: new Date() });
      mockRepo.findById.mockResolvedValue(other);

      await expect(service.reactivate(USER_A, 'pm-b')).rejects.toThrow(NotFoundException);
    });

    it('ConflictException si ya está activo', async () => {
      const active = makeMethod({ id: 'pm-active', deletedAt: null });
      mockRepo.findById.mockResolvedValue(active);

      await expect(service.reactivate(USER_A, 'pm-active')).rejects.toThrow(ConflictException);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // update (PATCH)
  // -------------------------------------------------------------------------

  describe('update', () => {
    it('actualiza nombre sin tocar tipo/campos condicionales', async () => {
      const existing = makeMethod({ id: 'pm-001', name: 'Viejo' });
      mockRepo.findById.mockResolvedValue(existing);
      mockRepo.findActiveExcluding.mockResolvedValue([]);
      mockRepo.update.mockResolvedValue({ ...existing, name: 'Nuevo' });

      const result = await service.update(USER_A, 'pm-001', { name: 'Nuevo' });

      expect(result.name).toBe('Nuevo');
      expect(mockRepo.update).toHaveBeenCalledWith('pm-001', { name: 'Nuevo' });
    });

    it('cambiar de CREDIT a DEBIT descarta closingDay/paymentDay', async () => {
      const existing = makeMethod({
        id: 'pm-001',
        type: 'CREDIT',
        closingDay: 10,
        paymentDay: 20,
      });
      mockRepo.findById.mockResolvedValue(existing);
      mockRepo.update.mockImplementation((_id, data) =>
        Promise.resolve({ ...existing, ...data }),
      );

      await service.update(USER_A, 'pm-001', { type: 'DEBIT' });

      expect(mockRepo.update).toHaveBeenCalledWith('pm-001', {
        type: 'DEBIT',
        closingDay: null,
        paymentDay: null,
      });
    });

    it('cambiar de CREDIT a CASH descarta todos los campos condicionales', async () => {
      const existing = makeMethod({ id: 'pm-001', type: 'CREDIT', closingDay: 10, paymentDay: 20 });
      mockRepo.findById.mockResolvedValue(existing);
      mockRepo.update.mockImplementation((_id, data) =>
        Promise.resolve({ ...existing, ...data }),
      );

      await service.update(USER_A, 'pm-001', { type: 'CASH' });

      expect(mockRepo.update).toHaveBeenCalledWith('pm-001', {
        type: 'CASH',
        closingDay: null,
        paymentDay: null,
      });
    });

    it('editar closingDay sin cambiar tipo (CREDIT) actualiza solo ese campo', async () => {
      const existing = makeMethod({ id: 'pm-001', type: 'CREDIT', closingDay: 10, paymentDay: 20 });
      mockRepo.findById.mockResolvedValue(existing);
      mockRepo.update.mockImplementation((_id, data) =>
        Promise.resolve({ ...existing, ...data }),
      );

      await service.update(USER_A, 'pm-001', { closingDay: 25 });

      expect(mockRepo.update).toHaveBeenCalledWith('pm-001', { closingDay: 25 });
    });

    it('icon inválido en update → fallback a "card"', async () => {
      const existing = makeMethod({ id: 'pm-001' });
      mockRepo.findById.mockResolvedValue(existing);
      mockRepo.update.mockImplementation((_id, data) =>
        Promise.resolve({ ...existing, ...data }),
      );

      await service.update(USER_A, 'pm-001', { icon: 'no-existe' });

      expect(mockRepo.update).toHaveBeenCalledWith('pm-001', { icon: 'card' });
    });

    it('colisión de nombre con otro activo → ConflictException (RN-014)', async () => {
      const existing = makeMethod({ id: 'pm-001', name: 'Mi método' });
      const other = makeMethod({ id: 'pm-002', name: 'Efectivo' });
      mockRepo.findById.mockResolvedValue(existing);
      mockRepo.findActiveExcluding.mockResolvedValue([other]);

      await expect(
        service.update(USER_A, 'pm-001', { name: 'efectivo' }),
      ).rejects.toThrow(ConflictException);

      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('404 si no existe o es de otro usuario', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.update(USER_A, 'no-existe', { name: 'Test' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('aislamiento: 404 si pertenece a otro usuario', async () => {
      const other = makeMethod({ id: 'pm-b', userId: USER_B });
      mockRepo.findById.mockResolvedValue(other);

      await expect(service.update(USER_A, 'pm-b', { name: 'Test' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('404 al editar un método eliminado', async () => {
      const deleted = makeMethod({ id: 'pm-del', deletedAt: new Date() });
      mockRepo.findById.mockResolvedValue(deleted);

      await expect(service.update(USER_A, 'pm-del', { name: 'Test' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // remove (DELETE / soft delete)
  // -------------------------------------------------------------------------

  describe('remove', () => {
    it('soft delete: actualiza deletedAt a now', async () => {
      const existing = makeMethod({ id: 'pm-001' });
      mockRepo.findById.mockResolvedValue(existing);
      mockRepo.update.mockResolvedValue({ ...existing, deletedAt: new Date() });

      await service.remove(USER_A, 'pm-001');

      expect(mockRepo.update).toHaveBeenCalledWith(
        'pm-001',
        expect.objectContaining({ deletedAt: expect.any(Date) }),
      );
    });

    it('404 si no existe', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.remove(USER_A, 'no-existe')).rejects.toThrow(NotFoundException);
    });

    it('aislamiento: 404 si pertenece a otro usuario', async () => {
      const other = makeMethod({ id: 'pm-b', userId: USER_B });
      mockRepo.findById.mockResolvedValue(other);

      await expect(service.remove(USER_A, 'pm-b')).rejects.toThrow(NotFoundException);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('404 si ya está eliminado (no es idempotente)', async () => {
      const alreadyDeleted = makeMethod({ id: 'pm-del', deletedAt: new Date('2024-01-01') });
      mockRepo.findById.mockResolvedValue(alreadyDeleted);

      await expect(service.remove(USER_A, 'pm-del')).rejects.toThrow(NotFoundException);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });
  });
});
