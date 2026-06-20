/**
 * Tests unitarios de InstallmentsService.
 *
 * Cubre:
 * - Crear grupo de cuotas OK
 * - Solo EXPENSE — rechazar INCOME con 400 (decisión D1)
 * - Validación de startMonth (mes 00 y 13 inválidos)
 * - Categoría inexistente / ajena / eliminada / scope incompatible → 400 (via validator)
 * - Editar: amountCents, totalInstallments, startMonth, categoryId, description
 * - Editar: revalida categoría si cambia categoryId
 * - Editar: valida mes si cambia startMonth
 * - Editar: 404 si no existe o es de otro usuario
 * - Eliminar: hard delete OK
 * - Eliminar: 404 si no existe o es de otro usuario
 * - Aislamiento por userId (RN-003)
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CategoryScope, Currency, MovementType } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { InstallmentsService } from '../../../src/installments/installments.service';
import {
  InstallmentsRepository,
  InstallmentGroupWithCategory,
} from '../../../src/installments/installments.repository';
import { CategoryValidatorService } from '../../../src/categories/category-validator.service';
import { SettingsService } from '../../../src/settings/settings.service';

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

const mockSettingsServiceInst = {
  getSettings: jest.fn().mockResolvedValue({ defaultCurrency: Currency.ARS, lastExchangeRate: null }),
  updateLastExchangeRate: jest.fn().mockResolvedValue(undefined),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_A = 'user-a-id';
const USER_B = 'user-b-id';
const CAT_ID = 'cat-expense-id';
const GROUP_ID = 'group-001';

function makeGroup(
  overrides: Partial<InstallmentGroupWithCategory> = {},
): InstallmentGroupWithCategory {
  return {
    id: GROUP_ID,
    userId: USER_A,
    categoryId: CAT_ID,
    type: MovementType.EXPENSE,
    amountCents: 5000,
    currency: Currency.ARS,
    exchangeRate: 1,
    totalInstallments: 12,
    description: null,
    startMonth: '2026-01',
    createdAt: new Date(),
    updatedAt: new Date(),
    category: {
      id: CAT_ID,
      name: 'Electrónica',
      color: '#4F86C6',
      scope: CategoryScope.EXPENSE,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('InstallmentsService', () => {
  let service: InstallmentsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCategoryValidator.validateCategory.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstallmentsService,
        { provide: InstallmentsRepository, useValue: mockRepo },
        { provide: CategoryValidatorService, useValue: mockCategoryValidator },
        { provide: Logger, useValue: mockLogger },
        { provide: SettingsService, useValue: mockSettingsServiceInst },
      ],
    }).compile();

    service = module.get<InstallmentsService>(InstallmentsService);
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  describe('create', () => {
    it('crea un grupo de cuotas y lo devuelve', async () => {
      const group = makeGroup();
      mockRepo.create.mockResolvedValue(group);

      const result = await service.create(USER_A, {
        type: MovementType.EXPENSE,
        amountCents: 5000,
        totalInstallments: 12,
        categoryId: CAT_ID,
        startMonth: '2026-01',
      });

      expect(result).toEqual(group);
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MovementType.EXPENSE,
          amountCents: 5000,
          totalInstallments: 12,
          startMonth: '2026-01',
        }),
      );
    });

    it('rechaza type INCOME con 400 (solo EXPENSE en v1 — decisión D1)', async () => {
      await expect(
        service.create(USER_A, {
          type: MovementType.INCOME,
          amountCents: 5000,
          totalInstallments: 6,
          categoryId: CAT_ID,
          startMonth: '2026-01',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.create).not.toHaveBeenCalled();
      expect(mockCategoryValidator.validateCategory).not.toHaveBeenCalled();
    });

    it('startMonth con mes 00 → BadRequestException', async () => {
      await expect(
        service.create(USER_A, {
          type: MovementType.EXPENSE,
          amountCents: 5000,
          totalInstallments: 6,
          categoryId: CAT_ID,
          startMonth: '2026-00',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('startMonth con mes 13 → BadRequestException', async () => {
      await expect(
        service.create(USER_A, {
          type: MovementType.EXPENSE,
          amountCents: 5000,
          totalInstallments: 6,
          categoryId: CAT_ID,
          startMonth: '2026-13',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('categoría inexistente → BadRequestException (via validator)', async () => {
      mockCategoryValidator.validateCategory.mockRejectedValue(
        new BadRequestException('La categoría no existe o no pertenece al usuario'),
      );

      await expect(
        service.create(USER_A, {
          type: MovementType.EXPENSE,
          amountCents: 5000,
          totalInstallments: 6,
          categoryId: 'no-existe',
          startMonth: '2026-01',
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
          totalInstallments: 6,
          categoryId: CAT_ID,
          startMonth: '2026-01',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('categoría eliminada → BadRequestException', async () => {
      mockCategoryValidator.validateCategory.mockRejectedValue(
        new BadRequestException('La categoría está eliminada'),
      );

      await expect(
        service.create(USER_A, {
          type: MovementType.EXPENSE,
          amountCents: 5000,
          totalInstallments: 6,
          categoryId: CAT_ID,
          startMonth: '2026-01',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('scope incompatible → BadRequestException', async () => {
      mockCategoryValidator.validateCategory.mockRejectedValue(
        new BadRequestException('La categoría no es compatible con el tipo "EXPENSE"'),
      );

      await expect(
        service.create(USER_A, {
          type: MovementType.EXPENSE,
          amountCents: 5000,
          totalInstallments: 6,
          categoryId: CAT_ID,
          startMonth: '2026-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('guarda la descripción opcional', async () => {
      const group = makeGroup({ description: 'Smart TV' });
      mockRepo.create.mockResolvedValue(group);

      const result = await service.create(USER_A, {
        type: MovementType.EXPENSE,
        amountCents: 5000,
        totalInstallments: 12,
        categoryId: CAT_ID,
        startMonth: '2026-01',
        description: 'Smart TV',
      });

      expect(result.description).toBe('Smart TV');
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Smart TV' }),
      );
    });

    it('description omitida → se persiste como null', async () => {
      const group = makeGroup({ description: null });
      mockRepo.create.mockResolvedValue(group);

      await service.create(USER_A, {
        type: MovementType.EXPENSE,
        amountCents: 5000,
        totalInstallments: 12,
        categoryId: CAT_ID,
        startMonth: '2026-01',
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ description: null }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // update (PATCH)
  // -------------------------------------------------------------------------

  describe('update', () => {
    it('actualiza amountCents exitosamente', async () => {
      const existing = makeGroup();
      mockRepo.findById.mockResolvedValue(existing);
      const updated = makeGroup({ amountCents: 8000 });
      mockRepo.update.mockResolvedValue(updated);

      const result = await service.update(USER_A, GROUP_ID, { amountCents: 8000 });

      expect(result.amountCents).toBe(8000);
      expect(mockRepo.update).toHaveBeenCalledWith(
        GROUP_ID,
        expect.objectContaining({ amountCents: 8000 }),
      );
    });

    it('actualiza totalInstallments exitosamente', async () => {
      const existing = makeGroup();
      mockRepo.findById.mockResolvedValue(existing);
      const updated = makeGroup({ totalInstallments: 6 });
      mockRepo.update.mockResolvedValue(updated);

      const result = await service.update(USER_A, GROUP_ID, { totalInstallments: 6 });

      expect(result.totalInstallments).toBe(6);
    });

    it('actualiza startMonth con mes válido', async () => {
      const existing = makeGroup();
      mockRepo.findById.mockResolvedValue(existing);
      const updated = makeGroup({ startMonth: '2026-06' });
      mockRepo.update.mockResolvedValue(updated);

      const result = await service.update(USER_A, GROUP_ID, { startMonth: '2026-06' });

      expect(result.startMonth).toBe('2026-06');
      expect(mockRepo.update).toHaveBeenCalledWith(
        GROUP_ID,
        expect.objectContaining({ startMonth: '2026-06' }),
      );
    });

    it('startMonth con mes 00 → BadRequestException', async () => {
      const existing = makeGroup();
      mockRepo.findById.mockResolvedValue(existing);

      await expect(
        service.update(USER_A, GROUP_ID, { startMonth: '2026-00' }),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('startMonth con mes 13 → BadRequestException', async () => {
      const existing = makeGroup();
      mockRepo.findById.mockResolvedValue(existing);

      await expect(
        service.update(USER_A, GROUP_ID, { startMonth: '2026-13' }),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('revalida categoría si cambia categoryId', async () => {
      const existing = makeGroup();
      mockRepo.findById.mockResolvedValue(existing);
      const updated = makeGroup({ categoryId: 'new-cat-id' });
      mockRepo.update.mockResolvedValue(updated);

      await service.update(USER_A, GROUP_ID, { categoryId: 'new-cat-id' });

      expect(mockCategoryValidator.validateCategory).toHaveBeenCalledWith(
        USER_A,
        'new-cat-id',
        MovementType.EXPENSE,
      );
      expect(mockRepo.update).toHaveBeenCalled();
    });

    it('categoría incompatible al cambiar categoryId → BadRequestException', async () => {
      const existing = makeGroup();
      mockRepo.findById.mockResolvedValue(existing);
      mockCategoryValidator.validateCategory.mockRejectedValue(
        new BadRequestException('La categoría no es compatible con el tipo "EXPENSE"'),
      );

      await expect(
        service.update(USER_A, GROUP_ID, { categoryId: 'income-cat-id' }),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('NO revalida categoría si categoryId no cambia', async () => {
      const existing = makeGroup();
      mockRepo.findById.mockResolvedValue(existing);
      mockRepo.update.mockResolvedValue(makeGroup({ amountCents: 9000 }));

      await service.update(USER_A, GROUP_ID, { amountCents: 9000 });

      expect(mockCategoryValidator.validateCategory).not.toHaveBeenCalled();
    });

    it('actualiza description a string', async () => {
      const existing = makeGroup();
      mockRepo.findById.mockResolvedValue(existing);
      const updated = makeGroup({ description: 'Heladera nueva' });
      mockRepo.update.mockResolvedValue(updated);

      const result = await service.update(USER_A, GROUP_ID, { description: 'Heladera nueva' });

      expect(result.description).toBe('Heladera nueva');
    });

    it('actualiza description a null (limpia la descripción)', async () => {
      const existing = makeGroup({ description: 'Heladera vieja' });
      mockRepo.findById.mockResolvedValue(existing);
      const updated = makeGroup({ description: null });
      mockRepo.update.mockResolvedValue(updated);

      const result = await service.update(USER_A, GROUP_ID, { description: null });

      expect(result.description).toBeNull();
      expect(mockRepo.update).toHaveBeenCalledWith(
        GROUP_ID,
        expect.objectContaining({ description: null }),
      );
    });

    it('404 si no existe', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(
        service.update(USER_A, 'no-existe', { amountCents: 1000 }),
      ).rejects.toThrow(NotFoundException);

      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('aislamiento: 404 si pertenece a otro usuario (RN-003)', async () => {
      const group = makeGroup({ userId: USER_B });
      mockRepo.findById.mockResolvedValue(group);

      await expect(
        service.update(USER_A, GROUP_ID, { amountCents: 1000 }),
      ).rejects.toThrow(NotFoundException);

      expect(mockRepo.update).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // remove (DELETE — hard delete)
  // -------------------------------------------------------------------------

  describe('remove', () => {
    it('elimina permanentemente el grupo propio', async () => {
      const group = makeGroup();
      mockRepo.findById.mockResolvedValue(group);
      mockRepo.delete.mockResolvedValue(undefined);

      await service.remove(USER_A, GROUP_ID);

      expect(mockRepo.delete).toHaveBeenCalledWith(GROUP_ID);
    });

    it('404 si no existe', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.remove(USER_A, 'no-existe')).rejects.toThrow(NotFoundException);

      expect(mockRepo.delete).not.toHaveBeenCalled();
    });

    it('aislamiento: 404 si pertenece a otro usuario (RN-003)', async () => {
      const group = makeGroup({ userId: USER_B });
      mockRepo.findById.mockResolvedValue(group);

      await expect(service.remove(USER_A, GROUP_ID)).rejects.toThrow(NotFoundException);

      expect(mockRepo.delete).not.toHaveBeenCalled();
    });
  });
});
