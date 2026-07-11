/**
 * Tests unitarios de MovementsRepository — movimientos calculados (Fase 1.1.7).
 *
 * Reproduce bugs B, C y D reportados por el usuario:
 *
 * BUG B: El calculado desaparece cuando el origen es una cadena con split
 *   (R1 → R2, mismo chainId). El calculado debe aparecer en todos los meses
 *   donde el origen esté activo, antes y después del split, con el monto del
 *   fijo activo en ese mes.
 *
 * BUG C: El calculado no suma a los totales del mes. El monto derivado del
 *   calculado debe incluirse en expenseCents/incomeCents según su propio type.
 *
 * BUG D: El calculado se ordena al final en vez de mezclarse por monto con el
 *   resto de los fijos. Debe ordenarse por amountCents DESC igual que los demás.
 *
 * Además: campo sourceAmountCents en MovementItem de calculado.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CategoryScope, FormulaOperator, MovementType } from '@prisma/client';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { MovementsRepository } from '../../../src/movements/movements.repository';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { CreateCalculatedRecurringDto } from '../../../src/recurring/dto/create-calculated-recurring.dto';
import { UpdateCalculatedRecurringDto } from '../../../src/recurring/dto/update-calculated-recurring.dto';

// ---------------------------------------------------------------------------
// Tipos auxiliares
// ---------------------------------------------------------------------------

type RecurringRow = {
  id: string;
  userId: string;
  type: MovementType;
  amountCents: number;
  currency: string;
  exchangeRate: number;
  anchorCurrency: string;
  description: string | null;
  startMonth: string;
  deletedFrom: string | null;
  frequency: number;
  chainId: string;
  sourceChainId: string | null;
  sourceMovementId: string | null;
  sourceInstallmentGroupId: string | null;
  formulaOperator: FormulaOperator | null;
  formulaOperand: number | null;
  formulaSign: number | null;
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

// ---------------------------------------------------------------------------
// Mock de Prisma
// ---------------------------------------------------------------------------

const mockPrisma = {
  recurring: {
    findMany: jest.fn(),
  },
  recurringSkip: {
    findMany: jest.fn(),
  },
  installmentGroup: {
    findMany: jest.fn().mockResolvedValue([]), // no hay calculados de cuota en estos tests
  },
  transaction: {
    findMany: jest.fn().mockResolvedValue([]), // no hay calculados de único en estos tests
  },
  referenceRate: {
    findMany: jest.fn().mockResolvedValue([]), // sin cotizaciones de referencia en estos tests (mismo anchor)
  },
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_A = 'user-calc-test';
const CAT_NORMAL = 'cat-normal';
const CAT_CALC = 'cat-calc';

const ORIGIN_CHAIN_ID = 'chain-origin-001';
const CALC_CHAIN_ID = 'chain-calc-001';

function makeNormalRow(overrides: Partial<RecurringRow> = {}): RecurringRow {
  return {
    id: 'normal-001',
    userId: USER_A,
    type: MovementType.EXPENSE,
    amountCents: 10000,
    currency: 'ARS',
    exchangeRate: 1,
    anchorCurrency: 'ARS',
    description: 'Alquiler',
    startMonth: '2026-01',
    deletedFrom: null,
    frequency: 1,
    chainId: ORIGIN_CHAIN_ID,
    sourceChainId: null,
    sourceMovementId: null,
    sourceInstallmentGroupId: null,
    formulaOperator: null,
    formulaOperand: null,
    formulaSign: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: {
      id: CAT_NORMAL,
      name: 'Vivienda',
      color: '#4F86C6',
      scope: CategoryScope.EXPENSE,
    },
    skips: [],
    ...overrides,
  };
}

function makeCalcRow(overrides: Partial<RecurringRow> = {}): RecurringRow {
  return {
    id: 'calc-001',
    userId: USER_A,
    type: MovementType.EXPENSE,
    amountCents: 0, // placeholder — el monto real se deriva on-the-fly
    currency: 'ARS',
    exchangeRate: 1,
    anchorCurrency: 'ARS',
    description: 'Expensas (10% del alquiler)',
    startMonth: '2026-01',
    deletedFrom: null,
    frequency: 1,
    chainId: CALC_CHAIN_ID,
    sourceChainId: ORIGIN_CHAIN_ID,
    sourceMovementId: null,
    sourceInstallmentGroupId: null,
    formulaOperator: FormulaOperator.PCT,
    formulaOperand: 1000, // 10% (pct × 100 = 10 × 100 = 1000)
    formulaSign: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: {
      id: CAT_CALC,
      name: 'Expensas',
      color: '#6DBF67',
      scope: CategoryScope.EXPENSE,
    },
    skips: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Suite de DTOs — caso (d): los DTOs no aceptan `type` (RF-MCALC-003)
// ---------------------------------------------------------------------------

describe('DTOs de calculado — type no aceptado (RF-MCALC-003)', () => {
  it('CreateCalculatedRecurringDto no tiene campo `type` (TypeScript lo rechaza)', () => {
    // Verificación estructural: el DTO no define la propiedad `type`
    const dto = new CreateCalculatedRecurringDto();
    // `type` no es un campo del DTO — no existe en la instancia
    expect('type' in dto).toBe(false);
  });

  it('UpdateCalculatedRecurringDto no tiene campo `type` (TypeScript lo rechaza)', () => {
    const dto = new UpdateCalculatedRecurringDto();
    expect('type' in dto).toBe(false);
  });

  it('CreateCalculatedRecurringDto con campo `type` en el payload: class-validator no lo falla (no está declarado)', async () => {
    // El DTO no declara `type` con ningún decorador de class-validator.
    // Al validar con class-validator, `type` no genera error de validación.
    // El whitelist del ValidationPipe de NestJS (whitelist: true) sí lo stripea a nivel HTTP;
    // aquí verificamos que class-validator no genera errores por `type`.
    const payload = {
      categoryId: 'cat-abc',
      startMonth: '2026-06',
      formulaOperator: FormulaOperator.PCT,
      formulaOperand: 1000,
      formulaSign: 1,
      type: MovementType.EXPENSE, // campo no declarado en el DTO
    };
    const dto = plainToInstance(CreateCalculatedRecurringDto, payload);
    const errors = await validate(dto);
    // class-validator no falla por un campo desconocido (whitelist lo hace el Pipe de NestJS)
    expect(errors).toHaveLength(0);
    // Los campos declarados del DTO están presentes y correctos
    expect(dto.categoryId).toBe('cat-abc');
    expect(dto.startMonth).toBe('2026-06');
    expect(dto.formulaOperator).toBe(FormulaOperator.PCT);
    expect(dto.formulaOperand).toBe(1000);
    expect(dto.formulaSign).toBe(1);
  });

  it('UpdateCalculatedRecurringDto con campo `type` en el payload: class-validator no lo falla', async () => {
    const payload = {
      categoryId: 'cat-abc',
      currentMonth: '2026-06',
      type: MovementType.INCOME, // campo no declarado en el DTO
    };
    const dto = plainToInstance(UpdateCalculatedRecurringDto, payload);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    // Los campos declarados del DTO están presentes
    expect(dto.categoryId).toBe('cat-abc');
    expect(dto.currentMonth).toBe('2026-06');
  });
});

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('MovementsRepository — calculados (Fase 1.1.7)', () => {
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
  // BUG B: calculado sobre origen con cadena (split)
  // -------------------------------------------------------------------------

  describe('BUG B: calculado sobre origen con split de cadena', () => {
    it('calculado aparece antes del split usando el monto de R1', async () => {
      // R1: startMonth='2026-01', deletedFrom='2026-04', amountCents=10000
      // R2: startMonth='2026-04', deletedFrom=null, amountCents=15000, chainId=ORIGIN_CHAIN_ID
      // Calculado: PCT 10% sobre ORIGIN_CHAIN_ID

      const R1 = makeNormalRow({
        id: 'r1',
        amountCents: 10000,
        startMonth: '2026-01',
        deletedFrom: '2026-04',
      });
      // Para mes 2026-03, la DB devuelve R1 (activo) y el calculado.
      // R2 tiene startMonth='2026-04' > '2026-03', no es devuelto por la DB.
      const calc = makeCalcRow();

      // La DB solo devuelve R1 y calc (R2 no está en rango para 2026-03)
      mockPrisma.recurring.findMany.mockResolvedValue([R1, calc]);

      const result = await repo.findFijosByMonth(USER_A, '2026-03');

      // El calculado debe aparecer
      const calcItem = result.find((r) => r.id === 'calc-001');
      expect(calcItem).toBeDefined();
      // Monto derivado: 10% de 10000 = 1000
      expect(calcItem!.amountCents).toBe(1000);
    });

    it('calculado aparece después del split usando el monto de R2', async () => {
      // Mismo escenario: para mes 2026-05, la DB devuelve R2 y el calculado.
      // R1 tiene deletedFrom='2026-04' <= '2026-05', no es devuelto por la DB.
      const R2 = makeNormalRow({
        id: 'r2',
        amountCents: 15000, // nuevo monto tras el split
        startMonth: '2026-04',
        deletedFrom: null,
        chainId: ORIGIN_CHAIN_ID, // R2 hereda el chainId de R1
      });
      const calc = makeCalcRow();

      // La DB solo devuelve R2 y calc
      mockPrisma.recurring.findMany.mockResolvedValue([R2, calc]);

      const result = await repo.findFijosByMonth(USER_A, '2026-05');

      // El calculado debe aparecer (BUG B: antes podría desaparecer si chainId no coincide)
      const calcItem = result.find((r) => r.id === 'calc-001');
      expect(calcItem).toBeDefined();
      // Monto derivado: 10% de 15000 = 1500 (usa el monto de R2, no R1)
      expect(calcItem!.amountCents).toBe(1500);
    });

    it('calculado no aparece si el origen fue eliminado (fuera de rango)', async () => {
      // La DB devuelve solo el calculado (el origen está eliminado — no en rango)
      const calc = makeCalcRow();
      mockPrisma.recurring.findMany.mockResolvedValue([calc]);

      const result = await repo.findFijosByMonth(USER_A, '2026-06');

      // Sin origen activo → calculado no aparece
      const calcItem = result.find((r) => r.id === 'calc-001');
      expect(calcItem).toBeUndefined();
    });

    it('mapa originMap usa chainId del origen como clave (no id de fila)', async () => {
      // Este test verifica que el mapa originMap usa chainId (no id) como clave,
      // garantizando que funciona aunque cambie el id de la fila del origen (por split).
      const R2 = makeNormalRow({
        id: 'r2-nuevo-id',   // id diferente al que el calculado conocía originalmente
        chainId: ORIGIN_CHAIN_ID, // mismo chainId
        amountCents: 20000,
      });
      const calc = makeCalcRow({
        sourceChainId: ORIGIN_CHAIN_ID, // vínculo por chainId, no por id
      });

      mockPrisma.recurring.findMany.mockResolvedValue([R2, calc]);

      const result = await repo.findFijosByMonth(USER_A, '2026-06');

      const calcItem = result.find((r) => r.id === 'calc-001');
      expect(calcItem).toBeDefined();
      // 10% de 20000 = 2000
      expect(calcItem!.amountCents).toBe(2000);
    });
  });

  // -------------------------------------------------------------------------
  // BUG C: calculado suma a los totales del mes
  // -------------------------------------------------------------------------

  describe('BUG C: calculado suma a los totales con su monto derivado (RN-019)', () => {
    it('calculado con sign=+1 suma MAGNITUD al bucket INCOME (monto positivo → type derivado INCOME)', async () => {
      // Origen: EXPENSE 10000. Calculado: 10% con sign=+1 → +1000 → INCOME.
      // RN-019: el type se deriva del signo del monto (positivo → INCOME).
      // RN-019: se suma la magnitud (1000) al bucket del tipo derivado (incomeCents).
      const origin = makeNormalRow({ amountCents: 10000, type: MovementType.EXPENSE });
      const calc = makeCalcRow({
        formulaOperator: FormulaOperator.PCT,
        formulaOperand: 1000, // 10%
        formulaSign: 1,       // positivo → derived = +1000 → INCOME
      });
      mockPrisma.recurring.findMany.mockResolvedValue([origin, calc]);

      const result = await repo.getFijosTotalsByMonth(USER_A, '2026-06');

      expect(result.expenseCents).toBe(10000); // solo el origen
      expect(result.incomeCents).toBe(1000);   // calculado derivado positivo → INCOME
    });

    it('calculado con sign=-1 suma MAGNITUD al bucket EXPENSE (monto negativo → type derivado EXPENSE)', async () => {
      // Origen: EXPENSE 10000. Calculado: 10% con sign=-1 → -1000 → EXPENSE.
      // RN-019: magnitud (1000) suma a expenseCents.
      const origin = makeNormalRow({ amountCents: 10000, type: MovementType.EXPENSE });
      const calc = makeCalcRow({
        formulaOperator: FormulaOperator.PCT,
        formulaOperand: 1000, // 10%
        formulaSign: -1,      // negativo → derived = -1000 → EXPENSE
      });
      mockPrisma.recurring.findMany.mockResolvedValue([origin, calc]);

      const result = await repo.getFijosTotalsByMonth(USER_A, '2026-06');

      // expenseCents = origin (10000) + magnitud del calculado (1000) = 11000
      expect(result.expenseCents).toBe(11000);
      expect(result.incomeCents).toBe(0);
    });

    it('calculado skippeado (origen skippeado) NO suma a totales', async () => {
      // Origen skippeado en este mes
      const origin = makeNormalRow({
        amountCents: 10000,
        skips: [{ month: '2026-06' }],
      });
      const calc = makeCalcRow({
        formulaOperator: FormulaOperator.PCT,
        formulaOperand: 1000,
        formulaSign: 1,
      });
      mockPrisma.recurring.findMany.mockResolvedValue([origin, calc]);

      const result = await repo.getFijosTotalsByMonth(USER_A, '2026-06');

      // Origen skippeado → calculado hereda skip → ni origen ni calculado suman
      expect(result.expenseCents).toBe(0);
      expect(result.incomeCents).toBe(0);
    });

    it('calculado con monto 0 (borde RN-018) no aporta a ningún bucket', async () => {
      // sign=+1 pero PCT 0% (si el operando fuera 0 sería rechazado en DIV/PCT; usamos SUB igual al origen)
      // En este caso usamos SUB: 10000 - 10000 = 0 → EXPENSE por convención, pero magnitud=0
      const origin = makeNormalRow({ amountCents: 10000, type: MovementType.EXPENSE });
      const calc = makeCalcRow({
        formulaOperator: FormulaOperator.SUB,
        formulaOperand: 10000, // 10000 - 10000 = 0
        formulaSign: 1,
      });
      mockPrisma.recurring.findMany.mockResolvedValue([origin, calc]);

      const result = await repo.getFijosTotalsByMonth(USER_A, '2026-06');

      // Solo el origen suma; el calculado con monto=0 no aporta a ningún bucket
      expect(result.expenseCents).toBe(10000);
      expect(result.incomeCents).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // BUG D: calculado se ordena por monto derivado (no placeholder 0)
  // -------------------------------------------------------------------------

  describe('BUG D: calculado ordenado por convertedAmountCents derivado', () => {
    it('calculado con monto derivado > 0 no aparece al final', async () => {
      // Origen: 10000. Calculado: 50% = 5000.
      // Otro fijo normal: 3000.
      // Orden esperado: origen (10000) → calculado (5000) → otro (3000)
      const origin = makeNormalRow({ id: 'origin', amountCents: 10000 });
      const calc = makeCalcRow({
        id: 'calc',
        formulaOperator: FormulaOperator.PCT,
        formulaOperand: 5000, // 50%
        formulaSign: 1,
      });
      const otro = makeNormalRow({
        id: 'otro',
        amountCents: 3000,
        chainId: 'chain-otro',
        sourceChainId: null,
      });
      // La DB devuelve en orden DB (amountCents desc): origin(10000), otro(3000), calc(0)
      mockPrisma.recurring.findMany.mockResolvedValue([origin, otro, calc]);

      const result = await repo.findFijosByMonth(USER_A, '2026-06');

      expect(result).toHaveLength(3);
      // El orden final debe ser por convertedAmountCents derivado DESC (con ARS coincide con amountCents)
      expect(result[0].id).toBe('origin'); // convertedAmountCents 10000
      expect(result[1].id).toBe('calc');   // convertedAmountCents 5000 derivado
      expect(result[2].id).toBe('otro');   // convertedAmountCents 3000
    });

    it('calculado con monto derivado < monto de otro fijo aparece después de ese fijo', async () => {
      // Origen: 10000. Calculado: 5% = 500.
      // Otro fijo: 3000.
      // Orden esperado: origen (10000) → otro (3000) → calculado (500)
      const origin = makeNormalRow({ id: 'origin', amountCents: 10000 });
      const calc = makeCalcRow({
        id: 'calc',
        formulaOperator: FormulaOperator.PCT,
        formulaOperand: 500, // 5%
        formulaSign: 1,
      });
      const otro = makeNormalRow({
        id: 'otro',
        amountCents: 3000,
        chainId: 'chain-otro',
        sourceChainId: null,
      });
      mockPrisma.recurring.findMany.mockResolvedValue([origin, otro, calc]);

      const result = await repo.findFijosByMonth(USER_A, '2026-06');

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('origin'); // 10000
      expect(result[1].id).toBe('otro');   // 3000
      expect(result[2].id).toBe('calc');   // 500
    });

    it('calculado con placeholder 0 en DB se ordena por monto derivado real', async () => {
      // Verifica explícitamente que el placeholder 0 en DB no filtra al ordering
      const origin = makeNormalRow({ id: 'origin', amountCents: 5000 });
      const calc = makeCalcRow({
        id: 'calc',
        amountCents: 0, // placeholder en DB
        formulaOperator: FormulaOperator.MUL,
        formulaOperand: 2_000_000, // ×2
        formulaSign: 1,
        // derived = 5000 × 2 = 10000 → debe aparecer ANTES del origen (10000 == 5000? no: 10000 > 5000)
      });
      mockPrisma.recurring.findMany.mockResolvedValue([origin, calc]);

      const result = await repo.findFijosByMonth(USER_A, '2026-06');

      expect(result).toHaveLength(2);
      // convertedAmountCents del calc = 10000 > del origin = 5000 → calculado aparece primero
      expect(result[0].id).toBe('calc');   // convertedAmountCents 10000 derivado
      expect(result[1].id).toBe('origin'); // convertedAmountCents 5000
    });
  });

  // -------------------------------------------------------------------------
  // Campo sourceAmountCents en MovementItem de calculado
  // -------------------------------------------------------------------------

  describe('campo sourceAmountCents en MovementItem de calculado', () => {
    it('calculado tiene sourceAmountCents igual al amountCents del origen en ese mes', async () => {
      const origin = makeNormalRow({ amountCents: 10000 });
      const calc = makeCalcRow({
        formulaOperator: FormulaOperator.PCT,
        formulaOperand: 1000,
        formulaSign: 1,
      });
      mockPrisma.recurring.findMany.mockResolvedValue([origin, calc]);

      const result = await repo.findFijosByMonth(USER_A, '2026-06');

      const calcItem = result.find((r) => r.id === 'calc-001');
      expect(calcItem).toBeDefined();
      expect(calcItem!.calculated).not.toBeNull();
      // sourceAmountCents debe ser 10000 (el monto del origen en este mes)
      expect(calcItem!.calculated!.sourceAmountCents).toBe(10000);
    });

    it('sourceAmountCents refleja el monto de R2 después del split (no R1)', async () => {
      const R2 = makeNormalRow({
        id: 'r2',
        amountCents: 15000,
        startMonth: '2026-04',
        chainId: ORIGIN_CHAIN_ID,
      });
      const calc = makeCalcRow({
        formulaOperator: FormulaOperator.PCT,
        formulaOperand: 1000,
        formulaSign: 1,
      });
      mockPrisma.recurring.findMany.mockResolvedValue([R2, calc]);

      const result = await repo.findFijosByMonth(USER_A, '2026-05');

      const calcItem = result.find((r) => r.id === 'calc-001');
      expect(calcItem!.calculated!.sourceAmountCents).toBe(15000);
    });

    it('fijo normal tiene sourceAmountCents null', async () => {
      const origin = makeNormalRow();
      mockPrisma.recurring.findMany.mockResolvedValue([origin]);

      const result = await repo.findFijosByMonth(USER_A, '2026-06');

      const normalItem = result.find((r) => r.id === 'normal-001');
      expect(normalItem).toBeDefined();
      expect(normalItem!.calculated).toBeNull();
      // Los fijos normales no tienen sourceAmountCents (está en calculated que es null)
    });
  });

  // -------------------------------------------------------------------------
  // Campos calculated y hasCalculated en MovementItem
  // -------------------------------------------------------------------------

  describe('campos calculated y hasCalculated', () => {
    it('calculado tiene calculated != null con todos los campos', async () => {
      const origin = makeNormalRow({ amountCents: 10000 });
      const calc = makeCalcRow({
        formulaOperator: FormulaOperator.PCT,
        formulaOperand: 1000,
        formulaSign: 1,
      });
      mockPrisma.recurring.findMany.mockResolvedValue([origin, calc]);

      const result = await repo.findFijosByMonth(USER_A, '2026-06');

      const calcItem = result.find((r) => r.id === 'calc-001');
      expect(calcItem!.calculated).not.toBeNull();
      expect(calcItem!.calculated!.sourceChainId).toBe(ORIGIN_CHAIN_ID);
      expect(calcItem!.calculated!.formulaOperator).toBe(FormulaOperator.PCT);
      expect(calcItem!.calculated!.formulaOperand).toBe(1000);
      expect(calcItem!.calculated!.formulaSign).toBe(1);
      expect(calcItem!.hasCalculated).toBe(false);
    });

    it('calculado tiene hasCalculated=false (no puede ser origen de otro)', async () => {
      const origin = makeNormalRow({ amountCents: 10000 });
      const calc = makeCalcRow();
      mockPrisma.recurring.findMany.mockResolvedValue([origin, calc]);

      const result = await repo.findFijosByMonth(USER_A, '2026-06');

      const calcItem = result.find((r) => r.id === 'calc-001');
      expect(calcItem!.hasCalculated).toBe(false);
    });

    it('fijo origen con calculado activo tiene hasCalculated=true', async () => {
      const origin = makeNormalRow({ amountCents: 10000 });
      const calc = makeCalcRow();
      mockPrisma.recurring.findMany.mockResolvedValue([origin, calc]);

      const result = await repo.findFijosByMonth(USER_A, '2026-06');

      const originItem = result.find((r) => r.id === 'normal-001');
      expect(originItem!.hasCalculated).toBe(true);
    });

    it('fijo origen sin calculados activos tiene hasCalculated=false', async () => {
      const origin = makeNormalRow();
      mockPrisma.recurring.findMany.mockResolvedValue([origin]);

      const result = await repo.findFijosByMonth(USER_A, '2026-06');

      expect(result[0].hasCalculated).toBe(false);
    });

    it('fijo origen con calculado activo trae el derivado en calculatedChildren (Fase 1.1.9)', async () => {
      const origin = makeNormalRow({ amountCents: 10000 });
      const calc = makeCalcRow();
      mockPrisma.recurring.findMany.mockResolvedValue([origin, calc]);

      const result = await repo.findFijosByMonth(USER_A, '2026-06');

      const originItem = result.find((r) => r.id === 'normal-001')!;
      expect(originItem.calculatedChildren).toHaveLength(1);
      expect(originItem.calculatedChildren[0].id).toBe('calc-001');
      // 10% de 10000 = 1000
      expect(originItem.calculatedChildren[0].convertedAmountCents).toBe(1000);

      const calcItem = result.find((r) => r.id === 'calc-001')!;
      expect(calcItem.calculatedChildren).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Caso (c): tipo derivado puede cambiar entre meses según el monto del origen
  // -------------------------------------------------------------------------

  describe('tipo derivado cambia entre meses si el monto del origen cambia (RF-MCALC-003)', () => {
    it('con SUB: si sourceAmount < operand, derivado es negativo (EXPENSE); si sourceAmount > operand, positivo (INCOME)', async () => {
      // Mes A: origen con amountCents=5000. Calculado: SUB 8000 → 5000-8000=-3000 → EXPENSE (sign=+1 pero negativo)
      const originMonthA = makeNormalRow({ id: 'r-a', amountCents: 5000, chainId: ORIGIN_CHAIN_ID });
      const calcRow = makeCalcRow({
        formulaOperator: FormulaOperator.SUB,
        formulaOperand: 8000,
        formulaSign: 1, // sign=+1 pero sourceAmount < operand → derivado negativo
      });
      mockPrisma.recurring.findMany.mockResolvedValue([originMonthA, calcRow]);
      const resultA = await repo.findFijosByMonth(USER_A, '2026-01');
      const calcA = resultA.find(r => r.id === 'calc-001');
      expect(calcA).toBeDefined();
      expect(calcA!.amountCents).toBe(-3000); // negativo
      expect(calcA!.type).toBe(MovementType.EXPENSE); // derivado EXPENSE (negativo)

      // Mes B: mismo fijo (mismo chainId), pero en un mes diferente la DB devuelve
      // un origen con amountCents=20000 (post-split). SUB 8000 → 20000-8000=12000 → positivo → INCOME
      jest.clearAllMocks();
      const originMonthB = makeNormalRow({ id: 'r-b', amountCents: 20000, chainId: ORIGIN_CHAIN_ID });
      mockPrisma.recurring.findMany.mockResolvedValue([originMonthB, calcRow]);
      const resultB = await repo.findFijosByMonth(USER_A, '2026-07');
      const calcB = resultB.find(r => r.id === 'calc-001');
      expect(calcB).toBeDefined();
      expect(calcB!.amountCents).toBe(12000); // positivo
      expect(calcB!.type).toBe(MovementType.INCOME); // derivado INCOME (positivo) ← CAMBIÓ
    });
  });

  // -------------------------------------------------------------------------
  // Herencia de skip del origen al calculado
  // -------------------------------------------------------------------------

  describe('herencia de skip del origen al calculado', () => {
    it('calculado hereda skipped=true cuando el origen está skippeado', async () => {
      const origin = makeNormalRow({
        amountCents: 10000,
        skips: [{ month: '2026-06' }], // origen skippeado
      });
      const calc = makeCalcRow({ skips: [] }); // calculado no skippeado directamente
      mockPrisma.recurring.findMany.mockResolvedValue([origin, calc]);

      const result = await repo.findFijosByMonth(USER_A, '2026-06');

      const calcItem = result.find((r) => r.id === 'calc-001');
      expect(calcItem).toBeDefined();
      expect(calcItem!.skipped).toBe(true); // heredó el skip del origen
    });

    it('calculado tiene skipped=false cuando el origen no está skippeado', async () => {
      const origin = makeNormalRow({ skips: [] });
      const calc = makeCalcRow({ skips: [] });
      mockPrisma.recurring.findMany.mockResolvedValue([origin, calc]);

      const result = await repo.findFijosByMonth(USER_A, '2026-06');

      const calcItem = result.find((r) => r.id === 'calc-001');
      expect(calcItem!.skipped).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Fórmulas: ADD, SUB, MUL, DIV, PCT
  // -------------------------------------------------------------------------

  describe('cálculo de fórmulas', () => {
    const cases = [
      {
        desc: 'ADD: sourceAmount + operand',
        sourceAmount: 10000,
        operator: FormulaOperator.ADD,
        operand: 5000, // +5000 cents
        sign: 1,
        expected: 15000,
      },
      {
        desc: 'SUB: sourceAmount - operand',
        sourceAmount: 10000,
        operator: FormulaOperator.SUB,
        operand: 3000,
        sign: 1,
        expected: 7000,
      },
      {
        desc: 'MUL: sourceAmount × factor',
        sourceAmount: 10000,
        operator: FormulaOperator.MUL,
        operand: 1_500_000, // ×1.5
        sign: 1,
        expected: 15000,
      },
      {
        desc: 'DIV: sourceAmount ÷ divisor',
        sourceAmount: 10000,
        operator: FormulaOperator.DIV,
        operand: 2_000_000, // ÷2
        sign: 1,
        expected: 5000,
      },
      {
        desc: 'PCT: sourceAmount × pct/100',
        sourceAmount: 10000,
        operator: FormulaOperator.PCT,
        operand: 1000, // 10%
        sign: 1,
        expected: 1000,
      },
      {
        desc: 'sign=-1 invierte el signo del resultado',
        sourceAmount: 10000,
        operator: FormulaOperator.PCT,
        operand: 1000, // 10%
        sign: -1,
        expected: -1000,
      },
    ];

    for (const c of cases) {
      it(`${c.desc}`, async () => {
        const origin = makeNormalRow({ amountCents: c.sourceAmount });
        const calc = makeCalcRow({
          formulaOperator: c.operator,
          formulaOperand: c.operand,
          formulaSign: c.sign,
        });
        mockPrisma.recurring.findMany.mockResolvedValue([origin, calc]);

        const result = await repo.findFijosByMonth(USER_A, '2026-06');

        const calcItem = result.find((r) => r.id === 'calc-001');
        expect(calcItem).toBeDefined();
        expect(calcItem!.amountCents).toBe(c.expected);
      });
    }
  });
});
