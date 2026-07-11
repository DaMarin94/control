/**
 * Tests unitarios — P4 (métodos de pago): embebido en MovementItem.
 *
 * Cubre (espejo del patrón de movements-skip-unicos-cuotas.spec.ts):
 * 1. findUnicosByMonth — Transaction con paymentMethodId → item.paymentMethod embebido
 * 2. findUnicosByMonth — Transaction sin paymentMethodId → item.paymentMethod null
 * 3. findUnicosByMonth — calculado de único hereda el paymentMethod del Transaction origen
 * 4. findFijosByMonth — Recurring normal con paymentMethod → item.paymentMethod embebido
 * 5. findFijosByMonth — calculado de fijo hereda el paymentMethod del fijo origen (no propio)
 * 6. findCuotasByMonth — InstallmentGroup con paymentMethod → item.paymentMethod embebido
 * 7. findCuotasByMonth — calculado de cuota hereda el paymentMethod del grupo origen
 */

import { Test, TestingModule } from '@nestjs/testing';
import { FormulaOperator, MovementType } from '@prisma/client';
import { MovementsRepository } from '../../../src/movements/movements.repository';
import { PrismaService } from '../../../src/prisma/prisma.service';

const USER_A = 'user-pm-test';
const CAT_ID = 'cat-pm-test';
const MONTH = '2026-06';

const PM_VISA = {
  id: 'pm-visa', name: 'Visa Crédito', icon: 'visa', type: 'CREDIT', closingDay: 10, paymentDay: 20,
};
const PM_EFECTIVO = {
  id: 'pm-cash', name: 'Efectivo', icon: 'cash', type: 'CASH', closingDay: null, paymentDay: null,
};

const mockPrisma = {
  recurring: { findMany: jest.fn() },
  transaction: { findMany: jest.fn() },
  installmentGroup: { findMany: jest.fn() },
  referenceRate: { findMany: jest.fn().mockResolvedValue([]) },
  $queryRaw: jest.fn().mockResolvedValue([]),
};

describe('MovementsRepository — método de pago embebido (P4)', () => {
  let repo: MovementsRepository;

  beforeEach(async () => {
    // resetAllMocks (no solo clearAllMocks): también limpia colas de
    // mockResolvedValueOnce no consumidas por un test anterior que no
    // llegó a disparar la segunda query (evita fugas entre tests).
    jest.resetAllMocks();
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.referenceRate.findMany.mockResolvedValue([]);
    mockPrisma.recurring.findMany.mockResolvedValue([]);
    mockPrisma.installmentGroup.findMany.mockResolvedValue([]);
    mockPrisma.transaction.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovementsRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repo = module.get<MovementsRepository>(MovementsRepository);
  });

  // ---- Únicos ---------------------------------------------------------------

  describe('findUnicosByMonth', () => {
    it('único con método de pago asociado → item.paymentMethod embebido', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          id: 'tx-1',
          userId: USER_A,
          type: 'EXPENSE',
          amountCents: 1000,
          description: null,
          occurredAt: new Date('2026-06-10T12:00:00Z'),
          timezone: 'America/Argentina/Buenos_Aires',
          currency: 'ARS',
          exchangeRate: '1',
          anchorCurrency: 'ARS',
          skipped: false,
          categoryId: CAT_ID,
          categoryName: 'Consumibles',
          categoryColor: '#4F86C6',
          categoryScope: 'EXPENSE',
          paymentMethodId: PM_VISA.id,
          paymentMethodName: PM_VISA.name,
          paymentMethodIcon: PM_VISA.icon,
          paymentMethodType: PM_VISA.type,
          paymentMethodClosingDay: PM_VISA.closingDay,
          paymentMethodPaymentDay: PM_VISA.paymentDay,
        },
      ]);

      const result = await repo.findUnicosByMonth(USER_A, MONTH);

      expect(result).toHaveLength(1);
      expect(result[0].paymentMethod).toEqual(PM_VISA);
    });

    it('único sin método de pago → item.paymentMethod null', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          id: 'tx-2',
          userId: USER_A,
          type: 'EXPENSE',
          amountCents: 1000,
          description: null,
          occurredAt: new Date('2026-06-10T12:00:00Z'),
          timezone: 'America/Argentina/Buenos_Aires',
          currency: 'ARS',
          exchangeRate: '1',
          anchorCurrency: 'ARS',
          skipped: false,
          categoryId: CAT_ID,
          categoryName: 'Consumibles',
          categoryColor: '#4F86C6',
          categoryScope: 'EXPENSE',
          paymentMethodId: null,
          paymentMethodName: null,
          paymentMethodIcon: null,
          paymentMethodType: null,
          paymentMethodClosingDay: null,
          paymentMethodPaymentDay: null,
        },
      ]);

      const result = await repo.findUnicosByMonth(USER_A, MONTH);

      expect(result[0].paymentMethod).toBeNull();
    });

    it('calculado de único hereda el paymentMethod del Transaction origen (no persiste uno propio)', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]); // sin únicos normales
      mockPrisma.recurring.findMany.mockResolvedValue([
        {
          id: 'calc-1',
          category: { id: CAT_ID, name: 'Impuestos', color: '#000', scope: 'EXPENSE' },
          skips: [],
          sourceMovementId: 'tx-origin',
          description: 'Calculado',
          formulaOperator: FormulaOperator.PCT,
          formulaOperand: 1000,
          formulaSign: 1,
        },
      ]);
      mockPrisma.transaction.findMany.mockResolvedValue([
        {
          id: 'tx-origin',
          amountCents: 5000,
          description: 'Origen',
          occurredAt: new Date('2026-06-05T12:00:00Z'),
          timezone: 'America/Argentina/Buenos_Aires',
          currency: 'ARS',
          exchangeRate: 1,
          anchorCurrency: 'ARS',
          skipped: false,
          paymentMethod: PM_EFECTIVO,
        },
      ]);

      const result = await repo.findUnicosByMonth(USER_A, MONTH);

      expect(result).toHaveLength(1);
      expect(result[0].calculated).not.toBeNull();
      // El calculado hereda el método del origen, no tiene uno propio
      expect(result[0].paymentMethod).toEqual(PM_EFECTIVO);
    });
  });

  // ---- Fijos ------------------------------------------------------------------

  describe('findFijosByMonth', () => {
    it('fijo normal con método de pago asociado → item.paymentMethod embebido', async () => {
      mockPrisma.recurring.findMany.mockResolvedValue([
        {
          id: 'rec-1',
          chainId: 'chain-1',
          sourceChainId: null,
          startMonth: '2026-01',
          deletedFrom: null,
          frequency: 1,
          type: MovementType.EXPENSE,
          amountCents: 5000,
          currency: 'ARS',
          exchangeRate: 1,
          anchorCurrency: 'ARS',
          description: 'Netflix',
          category: { id: CAT_ID, name: 'Servicios', color: '#4F86C6', scope: 'EXPENSE' },
          paymentMethod: PM_VISA,
          skips: [],
        },
      ]);

      const result = await repo.findFijosByMonth(USER_A, MONTH);

      expect(result).toHaveLength(1);
      expect(result[0].paymentMethod).toEqual(PM_VISA);
    });

    it('fijo sin método de pago → item.paymentMethod null', async () => {
      mockPrisma.recurring.findMany.mockResolvedValue([
        {
          id: 'rec-2',
          chainId: 'chain-2',
          sourceChainId: null,
          startMonth: '2026-01',
          deletedFrom: null,
          frequency: 1,
          type: MovementType.EXPENSE,
          amountCents: 5000,
          currency: 'ARS',
          exchangeRate: 1,
          anchorCurrency: 'ARS',
          description: 'Alquiler',
          category: { id: CAT_ID, name: 'Servicios', color: '#4F86C6', scope: 'EXPENSE' },
          paymentMethod: null,
          skips: [],
        },
      ]);

      const result = await repo.findFijosByMonth(USER_A, MONTH);

      expect(result[0].paymentMethod).toBeNull();
    });

    it('calculado de fijo hereda el paymentMethod del fijo origen (no propio)', async () => {
      mockPrisma.recurring.findMany.mockResolvedValue([
        // Fijo origen, con método de pago propio
        {
          id: 'rec-origin',
          chainId: 'chain-origin',
          sourceChainId: null,
          startMonth: '2026-01',
          deletedFrom: null,
          frequency: 1,
          type: MovementType.EXPENSE,
          amountCents: 10000,
          currency: 'ARS',
          exchangeRate: 1,
          anchorCurrency: 'ARS',
          description: 'Sueldo',
          category: { id: CAT_ID, name: 'Ingresos', color: '#4F86C6', scope: 'INCOME' },
          paymentMethod: PM_VISA,
          skips: [],
        },
        // Calculado, sin método propio (siempre null en su fila)
        {
          id: 'calc-fijo',
          chainId: 'chain-calc',
          sourceChainId: 'chain-origin',
          startMonth: '2026-01',
          deletedFrom: null,
          frequency: 1,
          type: MovementType.EXPENSE,
          amountCents: 0,
          currency: 'ARS',
          exchangeRate: 1,
          anchorCurrency: 'ARS',
          description: 'Descuento',
          category: { id: CAT_ID, name: 'Impuestos', color: '#000', scope: 'EXPENSE' },
          paymentMethod: null,
          skips: [],
          formulaOperator: FormulaOperator.PCT,
          formulaOperand: 1000,
          formulaSign: -1,
        },
      ]);

      const result = await repo.findFijosByMonth(USER_A, MONTH);

      const calcItem = result.find((r) => r.calculated !== null);
      expect(calcItem).toBeDefined();
      expect(calcItem!.paymentMethod).toEqual(PM_VISA);
    });
  });

  // ---- Cuotas -----------------------------------------------------------------

  describe('findCuotasByMonth', () => {
    it('cuota con método de pago asociado → item.paymentMethod embebido', async () => {
      mockPrisma.installmentGroup.findMany
        .mockResolvedValueOnce([
          {
            id: 'grp-1',
            type: MovementType.EXPENSE,
            amountCents: 2000,
            totalInstallments: 12,
            startMonth: '2026-01',
            currency: 'ARS',
            exchangeRate: 1,
            anchorCurrency: 'ARS',
            description: 'Notebook',
            category: { id: CAT_ID, name: 'Tecnología', color: '#4F86C6', scope: 'EXPENSE' },
            paymentMethod: PM_VISA,
            skips: [],
          },
        ])
        .mockResolvedValueOnce([]); // groupRows para calculados (no aplica acá)

      const result = await repo.findCuotasByMonth(USER_A, MONTH);

      expect(result).toHaveLength(1);
      expect(result[0].paymentMethod).toEqual(PM_VISA);
    });

    it('calculado de cuota hereda el paymentMethod del grupo origen (no propio)', async () => {
      mockPrisma.installmentGroup.findMany
        .mockResolvedValueOnce([]) // sin cuotas normales
        .mockResolvedValueOnce([
          // groupRows: datos del grupo origen para el calculado
          {
            id: 'grp-origin',
            amountCents: 2000,
            description: 'Notebook',
            totalInstallments: 12,
            startMonth: '2026-01',
            currency: 'ARS',
            exchangeRate: 1,
            anchorCurrency: 'ARS',
            paymentMethod: PM_EFECTIVO,
            skips: [],
          },
        ]);
      mockPrisma.recurring.findMany.mockResolvedValue([
        {
          id: 'calc-cuota',
          category: { id: CAT_ID, name: 'Impuestos', color: '#000', scope: 'EXPENSE' },
          skips: [],
          sourceInstallmentGroupId: 'grp-origin',
          description: 'Interés',
          formulaOperator: FormulaOperator.PCT,
          formulaOperand: 500,
          formulaSign: 1,
        },
      ]);

      const result = await repo.findCuotasByMonth(USER_A, MONTH);

      expect(result).toHaveLength(1);
      expect(result[0].calculated).not.toBeNull();
      expect(result[0].paymentMethod).toEqual(PM_EFECTIVO);
    });
  });
});
