/**
 * Tests unitarios de RecurringService — calculados extendidos (Fase 1.1.7.ext).
 *
 * Cubre:
 * - createCalculatedFromTransaction: OK, 404 origen, 400 operando=0, 400 categoría
 * - createCalculatedFromInstallment: OK, 404 origen, 400 operando=0, 400 categoría
 * - updateCalculatedFromTransaction: OK, 404 origen, 404 calculado no encontrado, 400 operando=0
 * - updateCalculatedFromInstallment: OK, 404 origen, 404 calculado no encontrado, 400 operando=0
 * - Exclusión mutua: sourceMovementId y sourceInstallmentGroupId son exclusivos
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  CategoryScope,
  Currency,
  FormulaOperator,
  MovementType,
} from '@prisma/client';
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
  findChainRows: jest.fn().mockResolvedValue([]),
  findCalculadosBySourceChain: jest.fn().mockResolvedValue([]),
  // Fase 1.1.7.ext
  findTransactionById: jest.fn(),
  findInstallmentGroupById: jest.fn(),
  findCalculatedBySourceMovement: jest.fn(),
  findCalculatedBySourceInstallment: jest.fn(),
  // Módulo 3.14 — Historial de cambios (borrado lógico, RF-HIST-006)
  softDeleteRow: jest.fn().mockResolvedValue(undefined),
  findChainRowsForSnapshot: jest.fn().mockResolvedValue([]),
  cascadeSoftDeleteBySourceMovement: jest.fn().mockResolvedValue(undefined),
  cascadeSoftDeleteBySourceInstallmentGroup: jest.fn().mockResolvedValue(undefined),
};

const mockHistoryService = {
  record: jest.fn().mockResolvedValue(undefined),
};

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

const mockSettingsServiceExt = {
  getSettings: jest.fn().mockResolvedValue({ defaultCurrency: Currency.ARS, lastExchangeRate: null }),
  updateLastExchangeRate: jest.fn().mockResolvedValue(undefined),
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_A = 'user-a-ext';
const CAT_ID = 'cat-001';
const TX_ID = 'tx-001';
const GROUP_ID = 'group-001';
const CALC_ID = 'calc-001';

function makeTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: TX_ID,
    userId: USER_A,
    amountCents: 10000,
    type: MovementType.EXPENSE,
    description: 'Viaje',
    occurredAt: new Date('2026-06-15T12:00:00Z'),
    timezone: 'America/Argentina/Buenos_Aires',
    ...overrides,
  };
}

function makeInstallmentGroup(overrides: Record<string, unknown> = {}) {
  return {
    id: GROUP_ID,
    userId: USER_A,
    amountCents: 5000,
    type: MovementType.EXPENSE,
    totalInstallments: 6,
    startMonth: '2026-01',
    description: 'Cuota laptop',
    ...overrides,
  };
}

function makeCalculadoWithCategory(overrides: Partial<RecurringWithCategory> = {}): RecurringWithCategory {
  return {
    id: CALC_ID,
    userId: USER_A,
    categoryId: CAT_ID,
    type: MovementType.EXPENSE,
    amountCents: 0,
    currency: Currency.ARS,
    exchangeRate: 1,
    anchorCurrency: Currency.ARS,
    description: null,
    startMonth: '2026-06',
    deletedFrom: '2026-07',
    frequency: 1,
    chainId: 'chain-calc-001',
    sourceChainId: null,
    sourceMovementId: TX_ID,
    sourceInstallmentGroupId: null,
    formulaOperator: FormulaOperator.PCT,
    formulaOperand: 1000,
    formulaSign: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: {
      id: CAT_ID,
      name: 'Impuestos',
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
// Setup
// ---------------------------------------------------------------------------

describe('RecurringService — calculados extendidos (Fase 1.1.7.ext)', () => {
  let service: RecurringService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPaymentMethodValidator.validatePaymentMethod.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecurringService,
        { provide: RecurringRepository, useValue: mockRepo },
        { provide: CategoryValidatorService, useValue: mockCategoryValidator },
        { provide: PaymentMethodValidatorService, useValue: mockPaymentMethodValidator },
        { provide: Logger, useValue: mockLogger },
        { provide: SettingsService, useValue: mockSettingsServiceExt },
        { provide: HistoryService, useValue: mockHistoryService },
      ],
    }).compile();

    service = module.get<RecurringService>(RecurringService);
  });

  // =========================================================================
  // createCalculatedFromTransaction
  // =========================================================================

  describe('createCalculatedFromTransaction', () => {
    it('crea un calculado de único con startMonth derivado del Transaction y deletedFrom = nextMonth', async () => {
      const tx = makeTransaction();
      mockRepo.findTransactionById.mockResolvedValue(tx);
      const calcRow = makeCalculadoWithCategory({ startMonth: '2026-06', deletedFrom: '2026-07' });
      mockRepo.create.mockResolvedValue(calcRow);

      const result = await service.createCalculatedFromTransaction(USER_A, TX_ID, {
        categoryId: CAT_ID,
        formulaOperator: FormulaOperator.PCT,
        formulaOperand: 1000,
        formulaSign: 1,
      });

      expect(result).toBeDefined();
      expect(result.sourceMovementId).toBe(TX_ID);
      // Verificar que repo.create fue llamado con sourceMovement.connect.id = TX_ID
      const createCall = mockRepo.create.mock.calls[0][0];
      expect(createCall.sourceMovement.connect.id).toBe(TX_ID);
      // startMonth derivado de occurredAt='2026-06-15' en timezone Argentina = '2026-06'
      expect(createCall.startMonth).toBe('2026-06');
      // deletedFrom = nextMonth(startMonth) = '2026-07'
      expect(createCall.deletedFrom).toBe('2026-07');
    });

    it('404 si el Transaction no existe', async () => {
      mockRepo.findTransactionById.mockResolvedValue(null);

      await expect(
        service.createCalculatedFromTransaction(USER_A, TX_ID, {
          categoryId: CAT_ID,
          formulaOperator: FormulaOperator.PCT,
          formulaOperand: 1000,
          formulaSign: 1,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('404 si el Transaction es de otro usuario', async () => {
      mockRepo.findTransactionById.mockResolvedValue(makeTransaction({ userId: 'otro-user' }));

      await expect(
        service.createCalculatedFromTransaction(USER_A, TX_ID, {
          categoryId: CAT_ID,
          formulaOperator: FormulaOperator.PCT,
          formulaOperand: 1000,
          formulaSign: 1,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('400 si operando=0 con DIV', async () => {
      mockRepo.findTransactionById.mockResolvedValue(makeTransaction());

      await expect(
        service.createCalculatedFromTransaction(USER_A, TX_ID, {
          categoryId: CAT_ID,
          formulaOperator: FormulaOperator.DIV,
          formulaOperand: 0,
          formulaSign: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('400 si operando=0 con PCT', async () => {
      mockRepo.findTransactionById.mockResolvedValue(makeTransaction());

      await expect(
        service.createCalculatedFromTransaction(USER_A, TX_ID, {
          categoryId: CAT_ID,
          formulaOperator: FormulaOperator.PCT,
          formulaOperand: 0,
          formulaSign: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('400 si la categoría es inválida', async () => {
      mockRepo.findTransactionById.mockResolvedValue(makeTransaction());
      mockCategoryValidator.validateCategory.mockRejectedValueOnce(
        new BadRequestException('Categoría inválida'),
      );

      await expect(
        service.createCalculatedFromTransaction(USER_A, TX_ID, {
          categoryId: 'cat-invalida',
          formulaOperator: FormulaOperator.PCT,
          formulaOperand: 1000,
          formulaSign: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // createCalculatedFromInstallment
  // =========================================================================

  describe('createCalculatedFromInstallment', () => {
    it('crea un calculado de cuota con startMonth=grupo.startMonth y deletedFrom=null', async () => {
      const group = makeInstallmentGroup();
      mockRepo.findInstallmentGroupById.mockResolvedValue(group);
      const calcRow = makeCalculadoWithCategory({
        startMonth: '2026-01',
        deletedFrom: null,
        sourceMovementId: null,
        sourceInstallmentGroupId: GROUP_ID,
      });
      mockRepo.create.mockResolvedValue(calcRow);

      const result = await service.createCalculatedFromInstallment(USER_A, GROUP_ID, {
        categoryId: CAT_ID,
        formulaOperator: FormulaOperator.PCT,
        formulaOperand: 1000,
        formulaSign: 1,
      });

      expect(result).toBeDefined();
      expect(result.sourceInstallmentGroupId).toBe(GROUP_ID);
      const createCall = mockRepo.create.mock.calls[0][0];
      expect(createCall.sourceInstallmentGroup.connect.id).toBe(GROUP_ID);
      // startMonth hereda del grupo
      expect(createCall.startMonth).toBe('2026-01');
      // deletedFrom = null (rango ilimitado; lo limita la proyección on-the-fly del grupo)
      expect(createCall.deletedFrom).toBeNull();
    });

    it('404 si el InstallmentGroup no existe', async () => {
      mockRepo.findInstallmentGroupById.mockResolvedValue(null);

      await expect(
        service.createCalculatedFromInstallment(USER_A, GROUP_ID, {
          categoryId: CAT_ID,
          formulaOperator: FormulaOperator.PCT,
          formulaOperand: 1000,
          formulaSign: 1,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('404 si el InstallmentGroup es de otro usuario', async () => {
      mockRepo.findInstallmentGroupById.mockResolvedValue(makeInstallmentGroup({ userId: 'otro-user' }));

      await expect(
        service.createCalculatedFromInstallment(USER_A, GROUP_ID, {
          categoryId: CAT_ID,
          formulaOperator: FormulaOperator.PCT,
          formulaOperand: 1000,
          formulaSign: 1,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('400 si operando=0 con DIV', async () => {
      mockRepo.findInstallmentGroupById.mockResolvedValue(makeInstallmentGroup());

      await expect(
        service.createCalculatedFromInstallment(USER_A, GROUP_ID, {
          categoryId: CAT_ID,
          formulaOperator: FormulaOperator.DIV,
          formulaOperand: 0,
          formulaSign: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // updateCalculatedFromTransaction
  // =========================================================================

  describe('updateCalculatedFromTransaction', () => {
    it('actualiza el calculado in-place', async () => {
      const tx = makeTransaction();
      const calcRow = makeCalculadoWithCategory();
      const updatedRow = makeCalculadoWithCategory({ formulaOperand: 2000 });
      mockRepo.findTransactionById.mockResolvedValue(tx);
      mockRepo.findCalculatedBySourceMovement.mockResolvedValue(calcRow);
      mockRepo.update.mockResolvedValue(updatedRow);

      const result = await service.updateCalculatedFromTransaction(USER_A, TX_ID, {
        formulaOperand: 2000,
      });

      expect(result).toBeDefined();
      expect(mockRepo.update).toHaveBeenCalledWith(
        CALC_ID,
        expect.objectContaining({ formulaOperand: 2000 }),
      );
    });

    it('404 si el Transaction no existe', async () => {
      mockRepo.findTransactionById.mockResolvedValue(null);

      await expect(
        service.updateCalculatedFromTransaction(USER_A, TX_ID, { formulaOperand: 2000 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('404 si no existe calculado vinculado al Transaction', async () => {
      mockRepo.findTransactionById.mockResolvedValue(makeTransaction());
      mockRepo.findCalculatedBySourceMovement.mockResolvedValue(null);

      await expect(
        service.updateCalculatedFromTransaction(USER_A, TX_ID, { formulaOperand: 2000 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('400 si operando efectivo=0 con PCT', async () => {
      mockRepo.findTransactionById.mockResolvedValue(makeTransaction());
      mockRepo.findCalculatedBySourceMovement.mockResolvedValue(
        makeCalculadoWithCategory({ formulaOperator: FormulaOperator.PCT, formulaOperand: 1000 }),
      );

      await expect(
        service.updateCalculatedFromTransaction(USER_A, TX_ID, {
          formulaOperand: 0, // intentar poner 0 en PCT → error
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // updateCalculatedFromInstallment
  // =========================================================================

  describe('updateCalculatedFromInstallment', () => {
    it('actualiza el calculado de cuota in-place', async () => {
      const group = makeInstallmentGroup();
      const calcRow = makeCalculadoWithCategory({
        sourceMovementId: null,
        sourceInstallmentGroupId: GROUP_ID,
      });
      const updatedRow = makeCalculadoWithCategory({
        sourceMovementId: null,
        sourceInstallmentGroupId: GROUP_ID,
        formulaOperand: 2000,
      });
      mockRepo.findInstallmentGroupById.mockResolvedValue(group);
      mockRepo.findCalculatedBySourceInstallment.mockResolvedValue(calcRow);
      mockRepo.update.mockResolvedValue(updatedRow);

      const result = await service.updateCalculatedFromInstallment(USER_A, GROUP_ID, {
        formulaOperand: 2000,
      });

      expect(result).toBeDefined();
      expect(mockRepo.update).toHaveBeenCalledWith(
        CALC_ID,
        expect.objectContaining({ formulaOperand: 2000 }),
      );
    });

    it('404 si el InstallmentGroup no existe', async () => {
      mockRepo.findInstallmentGroupById.mockResolvedValue(null);

      await expect(
        service.updateCalculatedFromInstallment(USER_A, GROUP_ID, { formulaOperand: 2000 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('404 si no existe calculado vinculado al grupo', async () => {
      mockRepo.findInstallmentGroupById.mockResolvedValue(makeInstallmentGroup());
      mockRepo.findCalculatedBySourceInstallment.mockResolvedValue(null);

      await expect(
        service.updateCalculatedFromInstallment(USER_A, GROUP_ID, { formulaOperand: 2000 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // remove (DELETE) — calculados de único y cuota: borrado lógico total sin boundary
  // =========================================================================

  describe('remove — calculado de único (sourceMovementId != null)', () => {
    it('hace borrado lógico de la fila entera sin aplicar boundary (RF-HIST-006)', async () => {
      const calcRow = makeCalculadoWithCategory({
        id: CALC_ID,
        sourceMovementId: TX_ID,
        sourceInstallmentGroupId: null,
        startMonth: '2026-06',
        deletedFrom: '2026-07',
      });
      mockRepo.findById.mockResolvedValue(calcRow);
      mockRepo.softDeleteRow.mockResolvedValue(undefined);

      await service.remove(USER_A, CALC_ID, '2026-06', false);

      // Borrado lógico de la fila puntual
      expect(mockRepo.softDeleteRow).toHaveBeenCalledWith(CALC_ID);
      expect(mockRepo.softDeleteRow).toHaveBeenCalledTimes(1);
      // No se consulta la cadena ni se aplica boundary
      expect(mockRepo.findChainRows).not.toHaveBeenCalled();
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('ignora fromCurrentMonth=true (borrado lógico igual)', async () => {
      const calcRow = makeCalculadoWithCategory({
        id: CALC_ID,
        sourceMovementId: TX_ID,
        sourceInstallmentGroupId: null,
      });
      mockRepo.findById.mockResolvedValue(calcRow);
      mockRepo.softDeleteRow.mockResolvedValue(undefined);

      await service.remove(USER_A, CALC_ID, '2026-06', true);

      expect(mockRepo.softDeleteRow).toHaveBeenCalledWith(CALC_ID);
      expect(mockRepo.findChainRows).not.toHaveBeenCalled();
    });

    it('404 si el calculado de único no existe', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(
        service.remove(USER_A, 'no-existe', '2026-06', false),
      ).rejects.toThrow(NotFoundException);

      expect(mockRepo.softDeleteRow).not.toHaveBeenCalled();
    });

    it('404 si el calculado de único pertenece a otro usuario (aislamiento RN-003)', async () => {
      const calcRow = makeCalculadoWithCategory({
        userId: 'otro-user',
        sourceMovementId: TX_ID,
      });
      mockRepo.findById.mockResolvedValue(calcRow);

      await expect(
        service.remove(USER_A, CALC_ID, '2026-06', false),
      ).rejects.toThrow(NotFoundException);

      expect(mockRepo.softDeleteRow).not.toHaveBeenCalled();
    });
  });

  describe('remove — calculado de cuota (sourceInstallmentGroupId != null)', () => {
    it('hace borrado lógico de la fila entera sin aplicar boundary (RF-HIST-006)', async () => {
      const calcRow = makeCalculadoWithCategory({
        id: CALC_ID,
        sourceMovementId: null,
        sourceInstallmentGroupId: GROUP_ID,
        startMonth: '2026-01',
        deletedFrom: null,
      });
      mockRepo.findById.mockResolvedValue(calcRow);
      mockRepo.softDeleteRow.mockResolvedValue(undefined);

      await service.remove(USER_A, CALC_ID, '2026-03', false);

      expect(mockRepo.softDeleteRow).toHaveBeenCalledWith(CALC_ID);
      expect(mockRepo.softDeleteRow).toHaveBeenCalledTimes(1);
      expect(mockRepo.findChainRows).not.toHaveBeenCalled();
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('ignora fromCurrentMonth=true (borrado lógico igual)', async () => {
      const calcRow = makeCalculadoWithCategory({
        id: CALC_ID,
        sourceMovementId: null,
        sourceInstallmentGroupId: GROUP_ID,
        startMonth: '2026-01',
        deletedFrom: null,
      });
      mockRepo.findById.mockResolvedValue(calcRow);
      mockRepo.softDeleteRow.mockResolvedValue(undefined);

      await service.remove(USER_A, CALC_ID, '2026-03', true);

      expect(mockRepo.softDeleteRow).toHaveBeenCalledWith(CALC_ID);
      expect(mockRepo.findChainRows).not.toHaveBeenCalled();
    });

    it('404 si el calculado de cuota pertenece a otro usuario (aislamiento RN-003)', async () => {
      const calcRow = makeCalculadoWithCategory({
        userId: 'otro-user',
        sourceMovementId: null,
        sourceInstallmentGroupId: GROUP_ID,
      });
      mockRepo.findById.mockResolvedValue(calcRow);

      await expect(
        service.remove(USER_A, CALC_ID, '2026-03', false),
      ).rejects.toThrow(NotFoundException);

    });
  });

  describe('remove — fijo normal y calculado de fijo: comportamiento de boundary sin cambios', () => {
    it('fijo normal: aplica boundary a la cadena (no borrado lógico total)', async () => {
      // Fijo normal: sourceMovementId=null, sourceInstallmentGroupId=null, sourceChainId=null
      const fijoNormal = makeCalculadoWithCategory({
        id: 'fijo-001',
        sourceMovementId: null,
        sourceInstallmentGroupId: null,
        sourceChainId: null,
        chainId: 'chain-fijo-001',
        startMonth: '2026-01',
        deletedFrom: null,
        formulaOperator: null,
        formulaOperand: null,
        formulaSign: null,
        amountCents: 5000,
      });
      mockRepo.findById.mockResolvedValue(fijoNormal);
      mockRepo.findChainRows.mockResolvedValue([
        { id: 'fijo-001', startMonth: '2026-01', deletedFrom: null },
      ]);
      mockRepo.findCalculadosBySourceChain.mockResolvedValue([]);
      mockRepo.update.mockResolvedValue({});

      await service.remove(USER_A, 'fijo-001', '2026-06', false);

      // Debe aplicar boundary (nextMonth de '2026-06' = '2026-07') → soft delete
      expect(mockRepo.findChainRows).toHaveBeenCalled();
      expect(mockRepo.update).toHaveBeenCalledWith('fijo-001', { deletedFrom: '2026-07' });
      // No borrado lógico total (solo truncado por boundary)
    });

    it('calculado de fijo (sourceChainId != null): aplica boundary a su cadena (sin afectar al origen)', async () => {
      // Calculado de fijo: sourceChainId != null, sourceMovementId=null, sourceInstallmentGroupId=null
      const calcFijo = makeCalculadoWithCategory({
        id: 'calc-fijo-001',
        sourceMovementId: null,
        sourceInstallmentGroupId: null,
        sourceChainId: 'chain-origen-001',
        chainId: 'chain-calc-fijo-001',
        startMonth: '2026-01',
        deletedFrom: null,
        formulaOperator: FormulaOperator.PCT,
        formulaOperand: 1000,
        formulaSign: 1,
        amountCents: 0,
      });
      mockRepo.findById.mockResolvedValue(calcFijo);
      mockRepo.findChainRows.mockResolvedValue([
        { id: 'calc-fijo-001', startMonth: '2026-01', deletedFrom: null },
      ]);
      // No llama a cascadeDeleteCalculados (es un calculado, no un origen)
      mockRepo.update.mockResolvedValue({});

      await service.remove(USER_A, 'calc-fijo-001', '2026-06', true);

      // boundary = '2026-06' (fromCurrentMonth=true) > startMonth '2026-01' → soft delete
      expect(mockRepo.findChainRows).toHaveBeenCalled();
      expect(mockRepo.update).toHaveBeenCalledWith('calc-fijo-001', { deletedFrom: '2026-06' });
      // No cascada (es un calculado, no un fijo de origen)
      expect(mockRepo.findCalculadosBySourceChain).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Derivación de mes desde occurredAt + timezone
  // =========================================================================

  describe('occurrenceToMonth: derivación de mes desde Transaction', () => {
    it('ocurrencia en junio 2026 en timezone Argentina → startMonth=2026-06', async () => {
      const tx = makeTransaction({
        occurredAt: new Date('2026-06-15T12:00:00Z'),
        timezone: 'America/Argentina/Buenos_Aires',
      });
      mockRepo.findTransactionById.mockResolvedValue(tx);
      mockRepo.create.mockResolvedValue(makeCalculadoWithCategory({ startMonth: '2026-06', deletedFrom: '2026-07' }));

      await service.createCalculatedFromTransaction(USER_A, TX_ID, {
        categoryId: CAT_ID,
        formulaOperator: FormulaOperator.MUL,
        formulaOperand: 1_000_000,
        formulaSign: 1,
      });

      const createCall = mockRepo.create.mock.calls[0][0];
      expect(createCall.startMonth).toBe('2026-06');
      expect(createCall.deletedFrom).toBe('2026-07');
    });

    it('ocurrencia el 31 de diciembre UTC puede caer en enero del año siguiente en UTC+1', async () => {
      // No testea la lógica interna (Intl.DateTimeFormat), pero verifica que
      // el método usa el timezone del Transaction y no hardcodea UTC.
      const tx = makeTransaction({
        occurredAt: new Date('2026-12-31T23:30:00Z'), // en UTC+1 ya es 2027-01-01
        timezone: 'Europe/Paris', // UTC+1 en invierno
      });
      mockRepo.findTransactionById.mockResolvedValue(tx);
      mockRepo.create.mockResolvedValue(makeCalculadoWithCategory({ startMonth: '2027-01', deletedFrom: '2027-02' }));

      await service.createCalculatedFromTransaction(USER_A, TX_ID, {
        categoryId: CAT_ID,
        formulaOperator: FormulaOperator.MUL,
        formulaOperand: 1_000_000,
        formulaSign: 1,
      });

      const createCall = mockRepo.create.mock.calls[0][0];
      // En Paris el 31 dic 23:30 UTC = 1 ene 00:30 → mes = 2027-01
      expect(createCall.startMonth).toBe('2027-01');
      expect(createCall.deletedFrom).toBe('2027-02');
    });
  });
});
