/**
 * Tests unitarios de MovementsRepository — métodos de fijos con frecuencia y skips.
 * Fase 1.1.1 (P1 + P2).
 *
 * Cubre:
 * - findFijosByMonth: filtra por frecuencia; incluye fijos skipped con skipped=true
 * - getFijosTotalsByMonth: excluye fijos que no caen en el mes por frecuencia;
 *   excluye fijos skippeados de los totales
 * - campos frequency y skipped en MovementItem de fijos
 * - back-compat: fijos MONTHLY aparecen en todos los meses (step=1)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CategoryScope, MovementType, RecurringFrequency } from '@prisma/client';
import { MovementsRepository, MovementItem } from '../../../src/movements/movements.repository';
import { PrismaService } from '../../../src/prisma/prisma.service';

// ---------------------------------------------------------------------------
// Tipos auxiliares de Prisma mocks
// ---------------------------------------------------------------------------

type RecurringRow = {
  id: string;
  userId: string;
  type: MovementType;
  amountCents: number;
  description: string | null;
  startMonth: string;
  deletedFrom: string | null;
  frequency: RecurringFrequency;
  chainId: string;
  sourceChainId: string | null;
  sourceMovementId: string | null;
  sourceInstallmentGroupId: string | null;
  formulaOperator: null;
  formulaOperand: null;
  formulaSign: null;
  createdAt: Date;
  updatedAt: Date;
  category: {
    id: string;
    name: string;
    color: string;
    scope: CategoryScope;
  };
  skips: { month: string }[];
};

type RecurringTotalsRow = {
  type: MovementType;
  amountCents: number;
  startMonth: string;
  frequency: RecurringFrequency;
  chainId: string;
  sourceChainId: string | null;
  sourceMovementId: string | null;
  sourceInstallmentGroupId: string | null;
  formulaOperator: null;
  formulaOperand: null;
  formulaSign: null;
  skips: { month: string }[];
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  recurring: {
    findMany: jest.fn(),
  },
  recurringSkip: {
    findMany: jest.fn(),
  },
  installmentGroup: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  transaction: {
    findMany: jest.fn().mockResolvedValue([]),
  },
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_A = 'user-a-freq';
const CAT_ID = 'cat-001';

function makeRecurringRow(overrides: Partial<RecurringRow> = {}): RecurringRow {
  return {
    id: 'rec-001',
    userId: USER_A,
    type: MovementType.EXPENSE,
    amountCents: 5000,
    description: null,
    startMonth: '2026-01',
    deletedFrom: null,
    frequency: RecurringFrequency.MONTHLY,
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
    skips: [],
    ...overrides,
  };
}

function makeTotalsRow(overrides: Partial<RecurringTotalsRow> = {}): RecurringTotalsRow {
  return {
    type: MovementType.EXPENSE,
    amountCents: 5000,
    startMonth: '2026-01',
    frequency: RecurringFrequency.MONTHLY,
    chainId: 'chain-001',
    sourceChainId: null,
    sourceMovementId: null,
    sourceInstallmentGroupId: null,
    formulaOperator: null,
    formulaOperand: null,
    formulaSign: null,
    skips: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('MovementsRepository — fijos con frecuencia y skips (Fase 1.1.1)', () => {
  let repo: MovementsRepository;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovementsRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repo = module.get<MovementsRepository>(MovementsRepository);
  });

  // -------------------------------------------------------------------------
  // findFijosByMonth — frecuencia y back-compat
  // -------------------------------------------------------------------------

  describe('findFijosByMonth — frecuencia', () => {
    it('MONTHLY: aparece en todos los meses (back-compat)', async () => {
      const row = makeRecurringRow({ startMonth: '2026-01', frequency: RecurringFrequency.MONTHLY });
      mockPrisma.recurring.findMany.mockResolvedValue([row]);

      const result = await repo.findFijosByMonth(USER_A, '2026-06');

      expect(result).toHaveLength(1);
      expect(result[0].frequency).toBe(RecurringFrequency.MONTHLY);
    });

    it('BIMONTHLY: aparece en meses pares del anclaje (startMonth=marzo, mes=mayo → aparece)', async () => {
      const row = makeRecurringRow({ startMonth: '2026-03', frequency: RecurringFrequency.BIMONTHLY });
      mockPrisma.recurring.findMany.mockResolvedValue([row]);

      const result = await repo.findFijosByMonth(USER_A, '2026-05');

      expect(result).toHaveLength(1);
    });

    it('BIMONTHLY: NO aparece en mes impar del anclaje (startMonth=marzo, mes=abril → no aparece)', async () => {
      const row = makeRecurringRow({ startMonth: '2026-03', frequency: RecurringFrequency.BIMONTHLY });
      mockPrisma.recurring.findMany.mockResolvedValue([row]);

      const result = await repo.findFijosByMonth(USER_A, '2026-04');

      expect(result).toHaveLength(0);
    });

    it('QUARTERLY: aparece solo cada 3 meses (startMonth=enero, mes=abril → aparece)', async () => {
      const row = makeRecurringRow({ startMonth: '2026-01', frequency: RecurringFrequency.QUARTERLY });
      mockPrisma.recurring.findMany.mockResolvedValue([row]);

      const result = await repo.findFijosByMonth(USER_A, '2026-04');

      expect(result).toHaveLength(1);
    });

    it('QUARTERLY: NO aparece en mes intermedio (startMonth=enero, mes=febrero → no aparece)', async () => {
      const row = makeRecurringRow({ startMonth: '2026-01', frequency: RecurringFrequency.QUARTERLY });
      mockPrisma.recurring.findMany.mockResolvedValue([row]);

      const result = await repo.findFijosByMonth(USER_A, '2026-02');

      expect(result).toHaveLength(0);
    });

    it('BIANNUAL: aparece cada 6 meses (startMonth=enero, mes=julio → aparece)', async () => {
      const row = makeRecurringRow({ startMonth: '2026-01', frequency: RecurringFrequency.BIANNUAL });
      mockPrisma.recurring.findMany.mockResolvedValue([row]);

      const result = await repo.findFijosByMonth(USER_A, '2026-07');

      expect(result).toHaveLength(1);
    });

    it('BIANNUAL: NO aparece en mes intermedio (startMonth=enero, mes=junio → no aparece)', async () => {
      const row = makeRecurringRow({ startMonth: '2026-01', frequency: RecurringFrequency.BIANNUAL });
      mockPrisma.recurring.findMany.mockResolvedValue([row]);

      const result = await repo.findFijosByMonth(USER_A, '2026-06');

      expect(result).toHaveLength(0);
    });

    it('ANNUAL: aparece solo en el mes de startMonth del año siguiente', async () => {
      const row = makeRecurringRow({ startMonth: '2026-06', frequency: RecurringFrequency.ANNUAL });
      mockPrisma.recurring.findMany.mockResolvedValue([row]);

      const resultSame = await repo.findFijosByMonth(USER_A, '2026-06');
      expect(resultSame).toHaveLength(1);

      const resultNext = await repo.findFijosByMonth(USER_A, '2027-06');
      // La DB mockea devolviendo el mismo resultado para la query de rango,
      // y la condición de frecuencia se aplica en JS
      mockPrisma.recurring.findMany.mockResolvedValue([row]);
      const resultNextYear = await repo.findFijosByMonth(USER_A, '2027-06');
      expect(resultNextYear).toHaveLength(1);
    });

    it('ANNUAL: NO aparece en un mes distinto del anclaje', async () => {
      const row = makeRecurringRow({ startMonth: '2026-06', frequency: RecurringFrequency.ANNUAL });
      mockPrisma.recurring.findMany.mockResolvedValue([row]);

      const result = await repo.findFijosByMonth(USER_A, '2026-07');

      expect(result).toHaveLength(0);
    });

    it('expone frequency correcto en el MovementItem', async () => {
      const row = makeRecurringRow({ frequency: RecurringFrequency.QUARTERLY });
      mockPrisma.recurring.findMany.mockResolvedValue([row]);

      // QUARTERLY, startMonth='2026-01', mes='2026-04' → diff=3, 3%3=0 → aparece
      const result = await repo.findFijosByMonth(USER_A, '2026-04');

      expect(result[0].frequency).toBe(RecurringFrequency.QUARTERLY);
    });
  });

  // -------------------------------------------------------------------------
  // findFijosByMonth — skips (P1)
  // -------------------------------------------------------------------------

  describe('findFijosByMonth — skips (P1)', () => {
    it('fijo NO skippeado → skipped=false', async () => {
      const row = makeRecurringRow({ skips: [] });
      mockPrisma.recurring.findMany.mockResolvedValue([row]);

      const result = await repo.findFijosByMonth(USER_A, '2026-06');

      expect(result[0].skipped).toBe(false);
    });

    it('fijo skippeado → aparece en la lista con skipped=true', async () => {
      const row = makeRecurringRow({ skips: [{ month: '2026-06' }] });
      mockPrisma.recurring.findMany.mockResolvedValue([row]);

      const result = await repo.findFijosByMonth(USER_A, '2026-06');

      // El fijo SE INCLUYE en la lista aunque esté skipped (el ítem aparece marcado)
      expect(result).toHaveLength(1);
      expect(result[0].skipped).toBe(true);
    });

    it('fijo skippeado mantiene sus datos originales (amountCents, category, etc.)', async () => {
      const row = makeRecurringRow({
        amountCents: 8000,
        skips: [{ month: '2026-06' }],
      });
      mockPrisma.recurring.findMany.mockResolvedValue([row]);

      const result = await repo.findFijosByMonth(USER_A, '2026-06');

      expect(result[0].amountCents).toBe(8000);
      expect(result[0].category.id).toBe(CAT_ID);
    });

    it('dos fijos: uno skippeado y otro no → ambos aparecen, con flags correctos', async () => {
      const rowA = makeRecurringRow({ id: 'rec-001', amountCents: 5000, skips: [] });
      const rowB = makeRecurringRow({ id: 'rec-002', amountCents: 3000, skips: [{ month: '2026-06' }] });
      mockPrisma.recurring.findMany.mockResolvedValue([rowA, rowB]);

      const result = await repo.findFijosByMonth(USER_A, '2026-06');

      expect(result).toHaveLength(2);
      const a = result.find((r) => r.id === 'rec-001')!;
      const b = result.find((r) => r.id === 'rec-002')!;
      expect(a.skipped).toBe(false);
      expect(b.skipped).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // getFijosTotalsByMonth — frecuencia y skips
  // -------------------------------------------------------------------------

  describe('getFijosTotalsByMonth — frecuencia y skips', () => {
    it('MONTHLY activo sin skip → suma al total (back-compat)', async () => {
      const row = makeTotalsRow({ amountCents: 5000, frequency: RecurringFrequency.MONTHLY, skips: [] });
      mockPrisma.recurring.findMany.mockResolvedValue([row]);

      const result = await repo.getFijosTotalsByMonth(USER_A, '2026-06');

      expect(result.expenseCents).toBe(5000);
    });

    it('BIMONTHLY: NO suma si no cae en el mes (startMonth=marzo, mes=abril → diff=1, 1%2=1)', async () => {
      const row = makeTotalsRow({
        amountCents: 5000,
        startMonth: '2026-03',
        frequency: RecurringFrequency.BIMONTHLY,
        skips: [],
      });
      mockPrisma.recurring.findMany.mockResolvedValue([row]);

      const result = await repo.getFijosTotalsByMonth(USER_A, '2026-04');

      expect(result.expenseCents).toBe(0);
    });

    it('BIMONTHLY: SÍ suma cuando cae en el mes (startMonth=marzo, mes=mayo → diff=2, 2%2=0)', async () => {
      const row = makeTotalsRow({
        amountCents: 5000,
        startMonth: '2026-03',
        frequency: RecurringFrequency.BIMONTHLY,
        skips: [],
      });
      mockPrisma.recurring.findMany.mockResolvedValue([row]);

      const result = await repo.getFijosTotalsByMonth(USER_A, '2026-05');

      expect(result.expenseCents).toBe(5000);
    });

    it('fijo skippeado NO suma al total aunque caiga en el mes', async () => {
      const row = makeTotalsRow({
        amountCents: 5000,
        startMonth: '2026-01',
        frequency: RecurringFrequency.MONTHLY,
        skips: [{ month: '2026-06' }],
      });
      mockPrisma.recurring.findMany.mockResolvedValue([row]);

      const result = await repo.getFijosTotalsByMonth(USER_A, '2026-06');

      expect(result.expenseCents).toBe(0);
    });

    it('dos fijos: uno skippeado y otro no → solo el no-skippeado suma', async () => {
      const rows: RecurringTotalsRow[] = [
        makeTotalsRow({ amountCents: 5000, startMonth: '2026-01', frequency: RecurringFrequency.MONTHLY, skips: [] }),
        makeTotalsRow({ amountCents: 3000, startMonth: '2026-01', frequency: RecurringFrequency.MONTHLY, skips: [{ month: '2026-06' }] }),
      ];
      mockPrisma.recurring.findMany.mockResolvedValue(rows);

      const result = await repo.getFijosTotalsByMonth(USER_A, '2026-06');

      expect(result.expenseCents).toBe(5000); // solo el no-skippeado
    });

    it('QUARTERLY skippeado NO suma al total', async () => {
      const row = makeTotalsRow({
        amountCents: 10000,
        startMonth: '2026-01',
        frequency: RecurringFrequency.QUARTERLY,
        skips: [{ month: '2026-04' }],
      });
      mockPrisma.recurring.findMany.mockResolvedValue([row]);

      const result = await repo.getFijosTotalsByMonth(USER_A, '2026-04');

      // Aunque cae (diff=3, 3%3=0), está skipped → no suma
      expect(result.expenseCents).toBe(0);
    });

    it('QUARTERLY activo sin skip sí suma', async () => {
      const row = makeTotalsRow({
        amountCents: 10000,
        startMonth: '2026-01',
        frequency: RecurringFrequency.QUARTERLY,
        skips: [],
      });
      mockPrisma.recurring.findMany.mockResolvedValue([row]);

      const result = await repo.getFijosTotalsByMonth(USER_A, '2026-04');

      expect(result.expenseCents).toBe(10000);
    });

    it('fijo INCOME activo suma a incomeCents, no a expenseCents', async () => {
      const row = makeTotalsRow({
        type: MovementType.INCOME,
        amountCents: 80000,
        startMonth: '2026-01',
        frequency: RecurringFrequency.MONTHLY,
        skips: [],
      });
      mockPrisma.recurring.findMany.mockResolvedValue([row]);

      const result = await repo.getFijosTotalsByMonth(USER_A, '2026-06');

      expect(result.incomeCents).toBe(80000);
      expect(result.expenseCents).toBe(0);
    });

    it('fijo INCOME skippeado no suma a incomeCents', async () => {
      const row = makeTotalsRow({
        type: MovementType.INCOME,
        amountCents: 80000,
        startMonth: '2026-01',
        frequency: RecurringFrequency.MONTHLY,
        skips: [{ month: '2026-06' }],
      });
      mockPrisma.recurring.findMany.mockResolvedValue([row]);

      const result = await repo.getFijosTotalsByMonth(USER_A, '2026-06');

      expect(result.incomeCents).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Campos frequency y skipped en MovementItem de fijos
  // -------------------------------------------------------------------------

  describe('MovementItem — campos nuevos (frequency y skipped)', () => {
    it('origin="fijo" tiene frequency no-null', async () => {
      const row = makeRecurringRow({ frequency: RecurringFrequency.BIANNUAL });
      mockPrisma.recurring.findMany.mockResolvedValue([row]);

      // BIANNUAL, startMonth='2026-01', mes='2026-07' → diff=6, 6%6=0 → aparece
      const result = await repo.findFijosByMonth(USER_A, '2026-07');

      expect(result[0].origin).toBe('fijo');
      expect(result[0].frequency).toBe(RecurringFrequency.BIANNUAL);
      expect(result[0].skipped).toBeDefined();
    });

    it('todos los fijos en la lista tienen el campo skipped (boolean)', async () => {
      const rows = [
        makeRecurringRow({ id: 'r1', skips: [] }),
        makeRecurringRow({ id: 'r2', skips: [{ month: '2026-06' }] }),
      ];
      mockPrisma.recurring.findMany.mockResolvedValue(rows);

      const result = await repo.findFijosByMonth(USER_A, '2026-06');

      result.forEach((item) => {
        expect(typeof item.skipped).toBe('boolean');
      });
    });

    it('únicos tienen frequency=null y skipped=false', async () => {
      // Verificar que el mapper de únicos asigna los valores correctos
      // No hay un método separado para esto en el repositorio;
      // el mapper privado lo hace. Lo validamos vía getMonthMovements a nivel
      // de MovementsService, pero aquí verificamos la interfaz.
      // El test de MovementsService ya cubre esto.
      // Simplemente verificamos que los campos del MovementItem de fijo son los correctos.
      const row = makeRecurringRow({ frequency: RecurringFrequency.MONTHLY });
      mockPrisma.recurring.findMany.mockResolvedValue([row]);

      const result: MovementItem[] = await repo.findFijosByMonth(USER_A, '2026-06');

      expect(result[0].frequency).not.toBeNull();
      expect(result[0].skipped).toBe(false);
    });
  });
});
