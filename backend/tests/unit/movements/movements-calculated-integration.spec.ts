/**
 * Test de integración — Bug B (flujo real: crear → split → crear calculado).
 *
 * Este test reproduce el bug reportado por el usuario:
 * "Se crea un fijo, se le cambia el monto en algún mes (split), se crea un
 * movimiento calculado desde ese fijo, y en los meses posteriores al cambio
 * de monto el calculado desaparece."
 *
 * El flujo se ejecuta con los servicios reales (RecurringService, MovementsRepository)
 * sobre un mock de PrismaService que simula una mini-DB en memoria — no fixtures
 * armados a mano, sino datos producidos por las mismas funciones del service.
 *
 * También verifica Bug D: el calculado se mezcla por amountCents derivado con
 * el resto de los fijos (no queda al final por tener amountCents=0 en DB).
 */

import { Test } from '@nestjs/testing';
import {
  CategoryScope,
  Currency,
  FormulaOperator,
  MovementType,
} from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { RecurringService } from '../../../src/recurring/recurring.service';
import { RecurringRepository } from '../../../src/recurring/recurring.repository';
import { MovementsRepository } from '../../../src/movements/movements.repository';
import { CategoryValidatorService } from '../../../src/categories/category-validator.service';
import { PaymentMethodValidatorService } from '../../../src/payment-methods/payment-method-validator.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { SettingsService } from '../../../src/settings/settings.service';
import { HistoryService } from '../../../src/history/history.service';

const mockHistoryServiceIntegration = {
  record: jest.fn().mockResolvedValue(undefined),
};

const mockSettingsServiceIntegration = {
  getSettings: jest.fn(),
  updateLastExchangeRate: jest.fn(),
};

// ---------------------------------------------------------------------------
// Mini-DB en memoria
// ---------------------------------------------------------------------------

/**
 * Simula la tabla Recurring en memoria.
 * Implementa las operaciones de Prisma que usan RecurringRepository y MovementsRepository.
 *
 * Los IDs se generan secuencialmente para ser predecibles.
 * Los chainIds siguen el mismo patrón que el schema (@default(cuid())).
 */
class InMemoryRecurringDB {
  private rows: Map<string, any> = new Map();
  private idCounter = 0;
  private chainCounter = 0;

  private newId(): string {
    return `id-${++this.idCounter}`;
  }

  private newChainId(): string {
    return `chain-${++this.chainCounter}`;
  }

  /**
   * Simula prisma.recurring.create
   */
  create(data: any): any {
    const id = this.newId();
    // chainId: si viene explícito en data lo usa, sino genera uno nuevo
    const chainId = data.chainId ?? this.newChainId();

    const row = {
      id,
      userId: data.user?.connect?.id ?? data.userId,
      categoryId: data.category?.connect?.id ?? data.categoryId,
      type: data.type,
      amountCents: data.amountCents ?? 0,
      description: data.description ?? null,
      startMonth: data.startMonth,
      deletedFrom: data.deletedFrom ?? null,
      frequency: data.frequency ?? 1,
      chainId,
      sourceChainId: data.sourceChainId ?? null,
      sourceMovementId: data.sourceMovement?.connect?.id ?? data.sourceMovementId ?? null,
      sourceInstallmentGroupId: data.sourceInstallmentGroup?.connect?.id ?? data.sourceInstallmentGroupId ?? null,
      formulaOperator: data.formulaOperator ?? null,
      formulaOperand: data.formulaOperand ?? null,
      formulaSign: data.formulaSign ?? null,
      // Fase 1.2.3: moneda y cotización (default ARS/1 para tests de integración)
      currency: data.currency ?? Currency.ARS,
      exchangeRate: data.exchangeRate ?? 1,
      // Módulo 3.14 — Historial de cambios: borrado lógico (RF-HIST-006)
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.rows.set(id, row);
    return this.withCategory(row);
  }

  /**
   * Simula prisma.recurring.findUnique (usado por findById)
   */
  findUnique(args: { where: { id: string; deletedAt?: null }; include?: any }): any {
    const row = this.rows.get(args.where.id);
    if (!row) return null;
    // NOT_DELETED (RF-HIST-006): findById pasa { id, deletedAt: null } — un
    // registro con borrado lógico no debe resolverse como existente.
    if (args.where.deletedAt === null && row.deletedAt !== null) return null;
    return this.withCategory(row);
  }

  /**
   * Simula prisma.recurring.update
   */
  update(args: { where: { id: string }; data: any; include?: any }): any {
    const row = this.rows.get(args.where.id);
    if (!row) throw new Error(`Row not found: ${args.where.id}`);

    // Aplicar los cambios del data
    if (args.data.deletedFrom !== undefined) {
      row.deletedFrom = args.data.deletedFrom;
    }
    if (args.data.deletedAt !== undefined) {
      row.deletedAt = args.data.deletedAt;
    }
    if (args.data.amountCents !== undefined) {
      row.amountCents = args.data.amountCents;
    }
    if (args.data.category?.connect?.id !== undefined) {
      row.categoryId = args.data.category.connect.id;
    }
    if (args.data.description !== undefined) {
      row.description = args.data.description;
    }
    if (args.data.currency !== undefined) {
      row.currency = args.data.currency;
    }
    if (args.data.exchangeRate !== undefined) {
      row.exchangeRate = args.data.exchangeRate;
    }
    row.updatedAt = new Date();

    return this.withCategory(row);
  }

  /**
   * Simula prisma.recurring.delete (hard delete físico — reaper/tests únicamente,
   * ya no lo usa el flujo normal de RecurringService, ver softDeleteRow más abajo).
   */
  delete(args: { where: { id: string } }): void {
    this.rows.delete(args.where.id);
  }

  /**
   * Simula prisma.recurring.findMany con los filtros de findFijosByMonth y getFijosTotalsByMonth.
   *
   * El filtro real en findFijosByMonth es:
   *   userId == X AND startMonth <= month AND (deletedFrom IS NULL OR deletedFrom > month)
   * Con orderBy amountCents desc, createdAt desc.
   */
  findMany(args: { where: any; orderBy?: any; include?: any; select?: any }): any[] {
    const { where } = args;
    const results: any[] = [];

    for (const row of this.rows.values()) {
      // Filtrar por userId
      if (where.userId && row.userId !== where.userId) continue;

      // NOT_DELETED (RF-HIST-006): excluir filas con borrado lógico cuando el
      // where lo pide explícitamente (findFijosByMonth, findChainRows, etc.).
      if (where.deletedAt === null && row.deletedAt !== null) continue;

      // Filtrar por chainId exacto (usado por findChainRows)
      if (where.chainId !== undefined && row.chainId !== where.chainId) continue;

      // Filtrar por sourceChainId exacto (usado por findCalculadosBySourceChain)
      if (where.sourceChainId !== undefined && row.sourceChainId !== where.sourceChainId) continue;

      // Filtrar por startMonth <= month
      if (where.startMonth?.lte && row.startMonth > where.startMonth.lte) continue;

      // Filtrar por deletedFrom (OR: deletedFrom IS NULL | deletedFrom > month)
      if (where.OR) {
        const deletedFromNull = row.deletedFrom === null;
        const deletedFromGt = where.OR.find((c: any) => c.deletedFrom?.gt);
        const gtValue = deletedFromGt?.deletedFrom?.gt;
        const passes =
          deletedFromNull ||
          (gtValue !== undefined && row.deletedFrom !== null && row.deletedFrom > gtValue);
        if (!passes) continue;
      }

      results.push(this.withCategoryAndSkips(row, args.where));
    }

    // Ordenar: amountCents desc, createdAt desc
    if (args.orderBy) {
      results.sort((a, b) => {
        for (const order of (Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy])) {
          if (order.amountCents) {
            const diff = b.amountCents - a.amountCents;
            if (diff !== 0) return order.amountCents === 'desc' ? diff : -diff;
          }
          if (order.createdAt) {
            const diff = b.createdAt.getTime() - a.createdAt.getTime();
            if (diff !== 0) return order.createdAt === 'desc' ? diff : -diff;
          }
        }
        return 0;
      });
    }

    return results;
  }

  /**
   * Simula prisma.recurring.deleteMany — elimina todas las filas que coincidan con el where.
   * Solo soporta el caso where: { chainId }.
   */
  deleteMany(args: { where: any }): void {
    for (const [id, row] of this.rows.entries()) {
      if (args.where.chainId && row.chainId === args.where.chainId) {
        this.rows.delete(id);
      }
    }
  }

  /**
   * Simula prisma.recurring.updateMany — actualiza todas las filas que coincidan con el where.
   * Solo soporta el caso where: { chainId, OR: [deletedFrom conditions] }.
   */
  updateMany(args: { where: any; data: any }): void {
    for (const row of this.rows.values()) {
      if (args.where.chainId && row.chainId !== args.where.chainId) continue;
      if (args.data.deletedFrom !== undefined) {
        row.deletedFrom = args.data.deletedFrom;
      }
    }
  }

  // Snapshot de la DB para diagnóstico
  snapshot(): any[] {
    return Array.from(this.rows.values()).map(r => ({
      id: r.id,
      chainId: r.chainId,
      sourceChainId: r.sourceChainId,
      startMonth: r.startMonth,
      deletedFrom: r.deletedFrom,
      deletedAt: r.deletedAt,
      amountCents: r.amountCents,
      frequency: r.frequency,
    }));
  }

  /** Snapshot SIN filtrar borrados lógicos (para verificar RF-HIST-006: la fila sigue existiendo, solo marcada). */
  allRows(): any[] {
    return Array.from(this.rows.values());
  }

  private withCategory(row: any): any {
    return {
      ...row,
      category: {
        id: row.categoryId,
        name: 'Test Cat',
        color: '#4F86C6',
        scope: CategoryScope.EXPENSE,
      },
    };
  }

  private withCategoryAndSkips(row: any, where: any): any {
    const month = where.OR?.[0]?.deletedFrom?.gt ?? where.startMonth?.lte;
    return {
      ...row,
      category: {
        id: row.categoryId,
        name: 'Test Cat',
        color: '#4F86C6',
        scope: CategoryScope.EXPENSE,
      },
      skips: [], // sin skips para estos tests
    };
  }
}

// ---------------------------------------------------------------------------
// Setup del módulo con la mini-DB
// ---------------------------------------------------------------------------

const CATEGORY_ID = 'cat-expense';
const CATEGORY_CALC_ID = 'cat-calc';
const USER_ID = 'user-integration-test';

describe('Bug B — flujo real: crear fijo → split → crear calculado', () => {
  let db: InMemoryRecurringDB;
  let recurringService: RecurringService;
  let movementsRepo: MovementsRepository;

  let prismaMock: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSettingsServiceIntegration.getSettings.mockResolvedValue({ defaultCurrency: Currency.ARS, lastExchangeRate: null });
    mockSettingsServiceIntegration.updateLastExchangeRate.mockResolvedValue(undefined);

    db = new InMemoryRecurringDB();

    prismaMock = {
      recurring: {
        create: jest.fn().mockImplementation((args) => db.create(args.data)),
        findUnique: jest.fn().mockImplementation((args) => db.findUnique(args)),
        findFirst: jest.fn().mockImplementation((args) => {
          // findFirst para findActiveRowByChainId
          const results = db.findMany({ where: args.where });
          if (args.orderBy?.startMonth === 'desc') {
            results.sort((a, b) => b.startMonth.localeCompare(a.startMonth));
          }
          return results[0] ?? null;
        }),
        update: jest.fn().mockImplementation((args) => db.update(args)),
        delete: jest.fn().mockImplementation((args) => db.delete(args)),
        findMany: jest.fn().mockImplementation((args) => db.findMany(args)),
        deleteMany: jest.fn().mockImplementation((args) => { db.deleteMany(args); return undefined; }),
        updateMany: jest.fn().mockImplementation((args) => { db.updateMany(args); return undefined; }),
      },
      recurringSkip: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
      },
      installmentGroup: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      transaction: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      referenceRate: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RecurringService,
        RecurringRepository,
        MovementsRepository,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: CategoryValidatorService,
          useValue: { validateCategory: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: PaymentMethodValidatorService,
          useValue: {
            validatePaymentMethod: jest.fn().mockResolvedValue(undefined),
            resolveAutoDebit: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: Logger,
          useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), verbose: jest.fn() },
        },
        { provide: SettingsService, useValue: mockSettingsServiceIntegration },
        { provide: HistoryService, useValue: mockHistoryServiceIntegration },
      ],
    }).compile();

    recurringService = moduleRef.get<RecurringService>(RecurringService);
    movementsRepo = moduleRef.get<MovementsRepository>(MovementsRepository);
  });

  // ---------------------------------------------------------------------------
  // El flujo completo del bug B
  // ---------------------------------------------------------------------------

  it('BUG B — calculado aparece en meses posteriores al split del origen', async () => {
    // PASO 1: Crear el fijo origen
    const r1 = await recurringService.create(USER_ID, {
      type: MovementType.EXPENSE,
      amountCents: 100000, // $1000
      categoryId: CATEGORY_ID,
      startMonth: '2026-01',
      // frequency = MONTHLY (default)
    });

    const r1Id = r1.id;
    const r1ChainId = r1.chainId;
    console.log(`[PASO 1] R1 creado: id=${r1Id}, chainId=${r1ChainId}`);

    // PASO 2: Editar con split en 2026-03 (cambia el monto)
    const r2 = await recurringService.update(USER_ID, r1Id, {
      currentMonth: '2026-03',
      amountCents: 200000, // $2000 — nuevo monto
    });

    const r2Id = r2.id;
    const r2ChainId = r2.chainId;
    console.log(`[PASO 2] R2 creado por split: id=${r2Id}, chainId=${r2ChainId}`);
    console.log(`[PASO 2] R1 chainId=${r1ChainId}, R2 chainId=${r2ChainId}`);

    // ASERTO CRÍTICO: R2 debe heredar el chainId de R1
    expect(r2ChainId).toBe(r1ChainId);

    // Verificar que el split se guardó correctamente en la mini-DB
    const dbSnapshot = db.snapshot();
    console.log('[PASO 2] DB snapshot:', JSON.stringify(dbSnapshot, null, 2));

    const r1InDB = dbSnapshot.find(r => r.id === r1Id);
    const r2InDB = dbSnapshot.find(r => r.id === r2Id);
    expect(r1InDB?.deletedFrom).toBe('2026-03');
    expect(r2InDB?.startMonth).toBe('2026-03');
    expect(r2InDB?.chainId).toBe(r1ChainId);

    // PASO 3: Crear calculado desde el origen (usando R2 como origen, que es lo que
    // el front ve después del split)
    const calc = await recurringService.createCalculated(USER_ID, r2Id, {
      // `type` ya no se acepta en el DTO (RF-MCALC-003): se deriva del signo del monto
      categoryId: CATEGORY_CALC_ID,
      startMonth: '2026-03', // el mes desde el que se crea (mes actual en el front)
      formulaOperator: FormulaOperator.PCT,
      formulaOperand: 1000, // 10%
      formulaSign: 1,
    });

    const calcId = calc.id;
    const calcSourceChainId = calc.sourceChainId;
    console.log(`[PASO 3] Calculado creado: id=${calcId}, sourceChainId=${calcSourceChainId}`);
    console.log(`[PASO 3] R2 chainId=${r2ChainId}, calculado sourceChainId=${calcSourceChainId}`);

    // ASERTO: el sourceChainId del calculado debe ser el chainId de la cadena del origen
    expect(calcSourceChainId).toBe(r1ChainId); // r1ChainId == r2ChainId

    // PASO 4: Verificar GET /movements para 2026-02 (antes del split)
    const result2026_02 = await movementsRepo.findFijosByMonth(USER_ID, '2026-02');
    console.log('[PASO 4] 2026-02 fijos:', result2026_02.map(f => ({
      id: f.id,
      amountCents: f.amountCents,
      calculated: f.calculated ? 'SÍ' : 'NO',
    })));

    // En 2026-02:
    // - R1 (startMonth='2026-01', deletedFrom='2026-03') está activo → aparece con amount=100000
    // - R2 (startMonth='2026-03') NO está en rango (startMonth > '2026-02')
    // - Calculado (startMonth='2026-03') NO está en rango (startMonth > '2026-02')
    // → Debe haber 1 ítem: R1
    // → El calculado NO aparece en 2026-02 (startMonth='2026-03' > '2026-02')
    const fijoItems2026_02 = result2026_02.filter(f => f.id === r1Id || f.id === r2Id);
    expect(fijoItems2026_02).toHaveLength(1);
    expect(fijoItems2026_02[0].id).toBe(r1Id);
    // El calculado no aparece en 2026-02 (su startMonth es 2026-03)
    const calcItem2026_02 = result2026_02.find(f => f.id === calcId);
    expect(calcItem2026_02).toBeUndefined();

    // PASO 5: Verificar GET /movements para 2026-04 (después del split) — donde el bug ocurre
    const result2026_04 = await movementsRepo.findFijosByMonth(USER_ID, '2026-04');
    console.log('[PASO 5] 2026-04 fijos:', result2026_04.map(f => ({
      id: f.id,
      amountCents: f.amountCents,
      origin: f.origin,
      calculated: f.calculated ? 'SÍ' : 'NO',
      sourceChainId: f.calculated?.sourceChainId,
    })));

    // En 2026-04:
    // - R1 (deletedFrom='2026-03') NO está activo (2026-03 <= 2026-04 → no pasa OR condition)
    // - R2 (startMonth='2026-03', deletedFrom=null) está activo → amount=200000
    // - Calculado (startMonth='2026-03', deletedFrom=null) está activo
    //   → sourceChainId = chainId del origen → encuentran R2 en originMap → amount = 10% de 200000 = 20000

    // BUG B: este aserto falla si el calculado no aparece
    const calcItem2026_04 = result2026_04.find(f => f.id === calcId);
    expect(calcItem2026_04).toBeDefined(); // BUG B: antes era undefined
    // Monto derivado: 10% de 200000 = 20000
    expect(calcItem2026_04!.amountCents).toBe(20000);
    expect(calcItem2026_04!.calculated).not.toBeNull();
    expect(calcItem2026_04!.calculated!.sourceAmountCents).toBe(200000);
    expect(calcItem2026_04!.calculated!.sourceChainId).toBe(r1ChainId);

    // PASO 6: Verificar también 2026-03 (el mes del split)
    const result2026_03 = await movementsRepo.findFijosByMonth(USER_ID, '2026-03');
    console.log('[PASO 6] 2026-03 fijos:', result2026_03.map(f => ({
      id: f.id,
      amountCents: f.amountCents,
      calculated: f.calculated ? 'SÍ' : 'NO',
    })));

    const calcItem2026_03 = result2026_03.find(f => f.id === calcId);
    expect(calcItem2026_03).toBeDefined(); // Calculado aparece en 2026-03 (su startMonth)
    expect(calcItem2026_03!.amountCents).toBe(20000); // 10% de 200000
  });

  // ---------------------------------------------------------------------------
  // Variante: calculado creado ANTES del split
  // ---------------------------------------------------------------------------

  it('BUG B (variante) — calculado creado ANTES del split sigue apareciendo después', async () => {
    // PASO 1: Crear el fijo origen
    const r1 = await recurringService.create(USER_ID, {
      type: MovementType.EXPENSE,
      amountCents: 100000,
      categoryId: CATEGORY_ID,
      startMonth: '2026-01',
    });

    // PASO 2: Crear calculado ANTES del split (con R1 como origen)
    const calc = await recurringService.createCalculated(USER_ID, r1.id, {
      // `type` ya no se acepta en el DTO (RF-MCALC-003)
      categoryId: CATEGORY_CALC_ID,
      startMonth: '2026-01', // mismo mes de inicio que el origen
      formulaOperator: FormulaOperator.PCT,
      formulaOperand: 1000, // 10%
      formulaSign: 1,
    });

    expect(calc.sourceChainId).toBe(r1.chainId);

    // PASO 3: Editar el fijo con split en 2026-03
    const r2 = await recurringService.update(USER_ID, r1.id, {
      currentMonth: '2026-03',
      amountCents: 200000,
    });

    expect(r2.chainId).toBe(r1.chainId); // R2 hereda el chainId

    // PASO 4: 2026-02 — calculado usa R1 (antes del split)
    const result2026_02 = await movementsRepo.findFijosByMonth(USER_ID, '2026-02');
    const calcItem2026_02 = result2026_02.find(f => f.id === calc.id);
    expect(calcItem2026_02).toBeDefined();
    expect(calcItem2026_02!.amountCents).toBe(10000); // 10% de 100000

    // PASO 5: 2026-04 — calculado usa R2 (después del split) — BUG B: aquí desaparecía
    const result2026_04 = await movementsRepo.findFijosByMonth(USER_ID, '2026-04');
    const calcItem2026_04 = result2026_04.find(f => f.id === calc.id);
    expect(calcItem2026_04).toBeDefined(); // BUG B
    expect(calcItem2026_04!.amountCents).toBe(20000); // 10% de 200000
    expect(calcItem2026_04!.calculated!.sourceAmountCents).toBe(200000);
  });

  // ---------------------------------------------------------------------------
  // BUG D — calculado se mezcla por monto derivado (no queda al final por amount=0 en DB)
  // ---------------------------------------------------------------------------

  it('BUG D — calculado se ordena por monto derivado, no por el placeholder 0 de DB', async () => {
    // Fijo 1: amount=100000 → calculado 50% = 50000 → debe aparecer ENTRE fijo1 y fijo2
    // Fijo 2: amount=30000 → fijo normal, sin calculado
    // Orden esperado: fijo1(100000) → calculado(50000) → fijo2(30000)

    const fijo1 = await recurringService.create(USER_ID, {
      type: MovementType.EXPENSE,
      amountCents: 100000,
      categoryId: CATEGORY_ID,
      startMonth: '2026-01',
    });

    const fijo2 = await recurringService.create(USER_ID, {
      type: MovementType.EXPENSE,
      amountCents: 30000,
      categoryId: CATEGORY_ID,
      startMonth: '2026-01',
    });

    const calc = await recurringService.createCalculated(USER_ID, fijo1.id, {
      // `type` ya no se acepta en el DTO (RF-MCALC-003)
      categoryId: CATEGORY_CALC_ID,
      startMonth: '2026-01',
      formulaOperator: FormulaOperator.PCT,
      formulaOperand: 5000, // 50%
      formulaSign: 1,
    });

    const result = await movementsRepo.findFijosByMonth(USER_ID, '2026-06');

    console.log('[BUG D] Orden resultado:', result.map(f => ({ id: f.id, amount: f.amountCents })));

    expect(result).toHaveLength(3);
    // Orden por convertedAmountCents DESC (con currency=ARS/anchor=ARS, coincide con amountCents derivado):
    expect(result[0].id).toBe(fijo1.id);  // 100000 → convertedAmountCents 100000
    expect(result[1].id).toBe(calc.id);   // 50000 derivado → convertedAmountCents 50000
    expect(result[2].id).toBe(fijo2.id);  // 30000 → convertedAmountCents 30000
  });

  // ---------------------------------------------------------------------------
  // Verificar chainId de R1 y R2 explícitamente (aserto del orquestador)
  // ---------------------------------------------------------------------------

  it('El split preserva el chainId: R1.chainId === R2.chainId', async () => {
    const r1 = await recurringService.create(USER_ID, {
      type: MovementType.EXPENSE,
      amountCents: 100000,
      categoryId: CATEGORY_ID,
      startMonth: '2026-01',
    });

    const r2 = await recurringService.update(USER_ID, r1.id, {
      currentMonth: '2026-03',
      amountCents: 150000,
    });

    // ASERTO del orquestador: R1.chainId === R2.chainId
    expect(r1.chainId).toBe(r2.chainId);
    // R2 es una fila diferente (id diferente)
    expect(r1.id).not.toBe(r2.id);
  });

  // ---------------------------------------------------------------------------
  // sourceChainId del calculado apunta a la cadena correcta
  // ---------------------------------------------------------------------------

  it('sourceChainId del calculado es el chainId de la cadena del origen', async () => {
    const r1 = await recurringService.create(USER_ID, {
      type: MovementType.EXPENSE,
      amountCents: 100000,
      categoryId: CATEGORY_ID,
      startMonth: '2026-01',
    });

    // Split primero
    const r2 = await recurringService.update(USER_ID, r1.id, {
      currentMonth: '2026-03',
      amountCents: 200000,
    });

    // Calcular desde R2 (la fila activa post-split)
    const calc = await recurringService.createCalculated(USER_ID, r2.id, {
      // `type` ya no se acepta en el DTO (RF-MCALC-003)
      categoryId: CATEGORY_CALC_ID,
      startMonth: '2026-03',
      formulaOperator: FormulaOperator.PCT,
      formulaOperand: 1000,
      formulaSign: 1,
    });

    // El sourceChainId debe apuntar al chainId de la cadena (que R1 y R2 comparten)
    expect(calc.sourceChainId).toBe(r1.chainId);
    expect(calc.sourceChainId).toBe(r2.chainId);

    // findFijosByMonth('2026-04') debe encontrar el calculado
    const result = await movementsRepo.findFijosByMonth(USER_ID, '2026-04');
    const calcItem = result.find(f => f.id === calc.id);
    expect(calcItem).toBeDefined();
    expect(calcItem!.amountCents).toBe(20000); // 10% de 200000
  });

  // ---------------------------------------------------------------------------
  // BUG B (causa raíz) — desalineamiento de frecuencia no-MONTHLY
  //
  // Para MONTHLY (step=1) el bug no se manifiesta porque cualquier startMonth
  // queda alineado (monthDiff % 1 == 0 siempre). Para frecuencias con step > 1
  // (QUARTERLY, BIMONTHLY, etc.), el calculado puede tener un startMonth que
  // NO está alineado con la frecuencia heredada, causando que el calculado
  // no aparezca en meses donde el origen SÍ aparece.
  //
  // Ejemplo: fijo QUARTERLY startMonth='2026-01' (aparece en 01, 04, 07...).
  // Calculado startMonth='2026-02' (usuario lo crea viendo el mes feb),
  // hereda QUARTERLY.
  // Para '2026-04': isOnFrequency('2026-02', QUARTERLY, '2026-04')
  //   → monthDiff=2, 2%3=2≠0 → calculado NO aparecía (BUG).
  // Con la corrección: los calculados no pasan por isOnFrequency.
  // ---------------------------------------------------------------------------

  it('BUG B (causa raíz) — calculado QUARTERLY con startMonth desalineado aparece igual', async () => {
    // Fijo QUARTERLY startMonth='2026-01' (aparece en 01, 04, 07, 10...)
    const r1 = await recurringService.create(USER_ID, {
      type: MovementType.EXPENSE,
      amountCents: 120000,
      categoryId: CATEGORY_ID,
      startMonth: '2026-01',
      frequency: 3,
    });

    // Calculado creado con startMonth='2026-02' (mes "desalineado" para QUARTERLY).
    // Si se aplicara isOnFrequency('2026-02', QUARTERLY, mes), el calculado
    // no aparecería en '2026-04' (donde el origen sí aparece).
    const calc = await recurringService.createCalculated(USER_ID, r1.id, {
      // `type` ya no se acepta en el DTO (RF-MCALC-003)
      categoryId: CATEGORY_CALC_ID,
      startMonth: '2026-02', // startMonth desalineado respecto a la frecuencia
      formulaOperator: FormulaOperator.PCT,
      formulaOperand: 1000, // 10%
      formulaSign: 1,
    });

    // '2026-04' — el origen aparece (01+3=04); el calculado debe aparecer también
    const result04 = await movementsRepo.findFijosByMonth(USER_ID, '2026-04');
    const calcItem04 = result04.find(f => f.id === calc.id);
    expect(calcItem04).toBeDefined(); // BUG B: antes era undefined
    expect(calcItem04!.amountCents).toBe(12000); // 10% de 120000

    // '2026-07' — el origen aparece (01+6=07); el calculado debe aparecer también
    const result07 = await movementsRepo.findFijosByMonth(USER_ID, '2026-07');
    const calcItem07 = result07.find(f => f.id === calc.id);
    expect(calcItem07).toBeDefined();
    expect(calcItem07!.amountCents).toBe(12000);

    // '2026-03' — el origen NO aparece (step=3: 01→04; 03 no cae en QUARTERLY desde 01)
    // El calculado tampoco debe aparecer
    const result03 = await movementsRepo.findFijosByMonth(USER_ID, '2026-03');
    const calcItem03 = result03.find(f => f.id === calc.id);
    expect(calcItem03).toBeUndefined(); // el origen no aparece → calculado tampoco
  });

  it('BUG B (causa raíz) — calculado BIMONTHLY con startMonth desalineado aparece igual', async () => {
    // Fijo BIMONTHLY startMonth='2026-01' (aparece en 01, 03, 05, 07...)
    const r1 = await recurringService.create(USER_ID, {
      type: MovementType.EXPENSE,
      amountCents: 50000,
      categoryId: CATEGORY_ID,
      startMonth: '2026-01',
      frequency: 2,
    });

    // Calculado creado con startMonth='2026-02' (desalineado: BIMONTHLY desde 2026-02
    // aparecería en 02, 04, 06... — diferente al origen que aparece en 01, 03, 05...)
    const calc = await recurringService.createCalculated(USER_ID, r1.id, {
      // `type` ya no se acepta en el DTO (RF-MCALC-003)
      categoryId: CATEGORY_CALC_ID,
      startMonth: '2026-02',
      formulaOperator: FormulaOperator.PCT,
      formulaOperand: 2000, // 20%
      formulaSign: 1,
    });

    // '2026-03' — origen aparece (01+2=03); calculado debe aparecer
    const result03 = await movementsRepo.findFijosByMonth(USER_ID, '2026-03');
    const calcItem03 = result03.find(f => f.id === calc.id);
    expect(calcItem03).toBeDefined(); // BUG: sin corrección el calculado no aparecía en '2026-03'
    expect(calcItem03!.amountCents).toBe(10000); // 20% de 50000

    // '2026-05' — origen aparece (01+4=05); calculado debe aparecer
    const result05 = await movementsRepo.findFijosByMonth(USER_ID, '2026-05');
    const calcItem05 = result05.find(f => f.id === calc.id);
    expect(calcItem05).toBeDefined();
    expect(calcItem05!.amountCents).toBe(10000);

    // '2026-02' — origen NO aparece (step=2: 01→03; 02 no cae); calculado tampoco
    const result02 = await movementsRepo.findFijosByMonth(USER_ID, '2026-02');
    const calcItem02 = result02.find(f => f.id === calc.id);
    expect(calcItem02).toBeUndefined();
  });

  it('BUG B (causa raíz) — calculado QUARTERLY con split de origen aparece post-split', async () => {
    // Fijo QUARTERLY startMonth='2026-01' → split en '2026-04' → R2 startMonth='2026-04'
    // Calculado creado con startMonth='2026-02' (desalineado)
    const r1 = await recurringService.create(USER_ID, {
      type: MovementType.EXPENSE,
      amountCents: 100000,
      categoryId: CATEGORY_ID,
      startMonth: '2026-01',
      frequency: 3,
    });

    // Crear calculado ANTES del split
    const calc = await recurringService.createCalculated(USER_ID, r1.id, {
      // `type` ya no se acepta en el DTO (RF-MCALC-003)
      categoryId: CATEGORY_CALC_ID,
      startMonth: '2026-01', // alineado con el origen
      formulaOperator: FormulaOperator.PCT,
      formulaOperand: 1000,
      formulaSign: 1,
    });

    // Split del origen en '2026-04'
    const r2 = await recurringService.update(USER_ID, r1.id, {
      currentMonth: '2026-04',
      amountCents: 150000, // nuevo monto
    });

    expect(r2.chainId).toBe(r1.chainId); // split preserva chainId

    // '2026-04' — origen R2 aparece; calculado debe aparecer con monto nuevo
    const result04 = await movementsRepo.findFijosByMonth(USER_ID, '2026-04');
    const calcItem04 = result04.find(f => f.id === calc.id);
    expect(calcItem04).toBeDefined(); // BUG B: calculado desaparecía post-split
    expect(calcItem04!.amountCents).toBe(15000); // 10% de 150000

    // '2026-07' — origen R2 aparece; calculado debe aparecer
    const result07 = await movementsRepo.findFijosByMonth(USER_ID, '2026-07');
    const calcItem07 = result07.find(f => f.id === calc.id);
    expect(calcItem07).toBeDefined();
    expect(calcItem07!.amountCents).toBe(15000);
  });
});

// ---------------------------------------------------------------------------
// BUG de borrado de cadena — flujo real: crear → split → crear calculado → DELETE
// ---------------------------------------------------------------------------

describe('BUG borrado de cadena — flujo real: crear fijo → split → crear calculado → DELETE', () => {
  let db: InMemoryRecurringDB;
  let recurringService: RecurringService;
  let movementsRepo: MovementsRepository;
  let prismaMock: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSettingsServiceIntegration.getSettings.mockResolvedValue({ defaultCurrency: Currency.ARS, lastExchangeRate: null });
    mockSettingsServiceIntegration.updateLastExchangeRate.mockResolvedValue(undefined);

    db = new InMemoryRecurringDB();

    prismaMock = {
      recurring: {
        create: jest.fn().mockImplementation((args) => db.create(args.data)),
        findUnique: jest.fn().mockImplementation((args) => db.findUnique(args)),
        findFirst: jest.fn().mockImplementation((args) => {
          const results = db.findMany({ where: args.where });
          if (args.orderBy?.startMonth === 'desc') {
            results.sort((a: any, b: any) => b.startMonth.localeCompare(a.startMonth));
          }
          return results[0] ?? null;
        }),
        update: jest.fn().mockImplementation((args) => db.update(args)),
        delete: jest.fn().mockImplementation((args) => db.delete(args)),
        findMany: jest.fn().mockImplementation((args) => db.findMany(args)),
        deleteMany: jest.fn().mockImplementation((args) => { db.deleteMany(args); return undefined; }),
        updateMany: jest.fn().mockImplementation((args) => { db.updateMany(args); return undefined; }),
      },
      recurringSkip: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
      },
      installmentGroup: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      transaction: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      referenceRate: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RecurringService,
        RecurringRepository,
        MovementsRepository,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: CategoryValidatorService,
          useValue: { validateCategory: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: PaymentMethodValidatorService,
          useValue: {
            validatePaymentMethod: jest.fn().mockResolvedValue(undefined),
            resolveAutoDebit: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: Logger,
          useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), verbose: jest.fn() },
        },
        { provide: SettingsService, useValue: mockSettingsServiceIntegration },
        { provide: HistoryService, useValue: mockHistoryServiceIntegration },
      ],
    }).compile();

    recurringService = moduleRef.get<RecurringService>(RecurringService);
    movementsRepo = moduleRef.get<MovementsRepository>(MovementsRepository);
  });

  // Escenario principal: DELETE desde m1 elimina toda la cadena (origen + calculado)
  it('DELETE desde m1 con fromCurrentMonth=true elimina R1, R2 y el calculado completo', async () => {
    // PASO 1: crear fijo en m1='2026-01'
    const r1 = await recurringService.create(USER_ID, {
      type: MovementType.EXPENSE,
      amountCents: 100000,
      categoryId: CATEGORY_ID,
      startMonth: '2026-01',
    });

    // PASO 2: split en m3='2026-03' (R1 cubre m1..m2 con deletedFrom=m3, R2 cubre m3+)
    const r2 = await recurringService.update(USER_ID, r1.id, {
      currentMonth: '2026-03',
      amountCents: 150000,
    });

    expect(r2.chainId).toBe(r1.chainId); // misma cadena
    expect(r1.id).not.toBe(r2.id);

    // PASO 3: crear calculado desde la cadena (usando R2 como origen visible)
    const calc = await recurringService.createCalculated(USER_ID, r2.id, {
      // `type` ya no se acepta en el DTO (RF-MCALC-003)
      categoryId: CATEGORY_CALC_ID,
      startMonth: '2026-03',
      formulaOperator: FormulaOperator.PCT,
      formulaOperand: 1000, // 10%
      formulaSign: 1,
    });

    expect(calc.sourceChainId).toBe(r1.chainId);

    // Pre-condición: fijo + calculado aparecen en m1, m2, m4
    const pre_m1 = await movementsRepo.findFijosByMonth(USER_ID, '2026-01');
    expect(pre_m1.find(f => f.id === r1.id)).toBeDefined();

    const pre_m4 = await movementsRepo.findFijosByMonth(USER_ID, '2026-04');
    expect(pre_m4.find(f => f.id === r2.id)).toBeDefined();
    expect(pre_m4.find(f => f.id === calc.id)).toBeDefined();

    // PASO 4: DELETE desde m1 con fromCurrentMonth=true
    // boundary = '2026-01' <= R1.startMonth='2026-01' → borrado lógico de R1 (RF-HIST-006)
    // boundary = '2026-01' <= R2.startMonth='2026-03' → borrado lógico de R2
    // cascada: calculado también se marca como eliminado (RN-024)
    await recurringService.remove(USER_ID, r1.id, '2026-01', true);

    // RF-HIST-006: borrado LÓGICO — las filas siguen existiendo en la tabla,
    // marcadas con deletedAt (reversibles desde /historial), no se hard-deletean.
    const dbSnap = db.snapshot();
    const origenRows = dbSnap.filter(r => r.chainId === r1.chainId && r.sourceChainId === null);
    const calcRows = dbSnap.filter(r => r.sourceChainId === r1.chainId);
    expect(origenRows).toHaveLength(2); // R1 y R2 siguen existiendo, soft-deleted
    expect(origenRows.every(r => r.deletedAt !== null)).toBe(true);
    expect(calcRows).toHaveLength(1);   // calculado sigue existiendo, soft-deleted
    expect(calcRows.every(r => r.deletedAt !== null)).toBe(true);

    // m1: ni el origen ni el calculado aparecen
    const post_m1 = await movementsRepo.findFijosByMonth(USER_ID, '2026-01');
    expect(post_m1.find(f => f.id === r1.id)).toBeUndefined();
    expect(post_m1.find(f => f.id === calc.id)).toBeUndefined();

    // m2: ni el origen ni el calculado aparecen
    const post_m2 = await movementsRepo.findFijosByMonth(USER_ID, '2026-02');
    expect(post_m2.find(f => f.id === r1.id)).toBeUndefined();
    expect(post_m2.find(f => f.id === r2.id)).toBeUndefined();
    expect(post_m2.find(f => f.id === calc.id)).toBeUndefined();

    // m4: R2 ya no existe, calculado ya no existe — la línea entera desaparece
    const post_m4 = await movementsRepo.findFijosByMonth(USER_ID, '2026-04');
    expect(post_m4.find(f => f.id === r2.id)).toBeUndefined();
    expect(post_m4.find(f => f.id === calc.id)).toBeUndefined();
    expect(post_m4).toHaveLength(0);
  });

  // Escenario de boundary intermedio: borrar desde m2 deja solo m1
  it('DELETE desde m2 con fromCurrentMonth=true preserva m1 y elimina m3+', async () => {
    // PASO 1: crear fijo en m1='2026-01'
    const r1 = await recurringService.create(USER_ID, {
      type: MovementType.EXPENSE,
      amountCents: 100000,
      categoryId: CATEGORY_ID,
      startMonth: '2026-01',
    });

    // PASO 2: split en m3='2026-03' (R2 cubre m3+)
    const r2 = await recurringService.update(USER_ID, r1.id, {
      currentMonth: '2026-03',
      amountCents: 150000,
    });

    // PASO 3: crear calculado desde la cadena
    const calc = await recurringService.createCalculated(USER_ID, r2.id, {
      // `type` ya no se acepta en el DTO (RF-MCALC-003)
      categoryId: CATEGORY_CALC_ID,
      startMonth: '2026-01', // incluye m1 y m2 también
      formulaOperator: FormulaOperator.PCT,
      formulaOperand: 1000, // 10%
      formulaSign: 1,
    });

    // PASO 4: DELETE desde m2 con fromCurrentMonth=true
    // boundary = '2026-02'
    // R1 (startMonth='2026-01'): boundary='2026-02' > '2026-01', deletedFrom='2026-03' > '2026-02' → set deletedFrom='2026-02'
    // R2 (startMonth='2026-03'): boundary='2026-02' <= '2026-03' → borrado lógico de R2 (RF-HIST-006)
    // calculado: misma lógica por fila sobre su cadena
    await recurringService.remove(USER_ID, r1.id, '2026-02', true);

    // m1: R1 aún activo (deletedFrom='2026-02' no cubre m1), calculado activo en m1
    const post_m1 = await movementsRepo.findFijosByMonth(USER_ID, '2026-01');
    expect(post_m1.find(f => f.id === r1.id)).toBeDefined();
    // El calculado también debe aparecer en m1 (su cadena también fue truncada a '2026-02')
    expect(post_m1.find(f => f.id === calc.id)).toBeDefined();

    // m2: R1 ya cerrado (deletedFrom='2026-02', '2026-02' no > '2026-02') → no aparece
    const post_m2 = await movementsRepo.findFijosByMonth(USER_ID, '2026-02');
    expect(post_m2.find(f => f.id === r1.id)).toBeUndefined();
    expect(post_m2.find(f => f.id === r2.id)).toBeUndefined();
    expect(post_m2.find(f => f.id === calc.id)).toBeUndefined();

    // m4: R2 fue eliminado, calculado también truncado → nada aparece
    const post_m4 = await movementsRepo.findFijosByMonth(USER_ID, '2026-04');
    expect(post_m4.find(f => f.id === r2.id)).toBeUndefined();
    expect(post_m4.find(f => f.id === calc.id)).toBeUndefined();
    expect(post_m4).toHaveLength(0);

    // DB: R2 sigue existiendo pero soft-deleted (RF-HIST-006); R1 existe con deletedFrom='2026-02'
    const dbSnap = db.snapshot();
    const r1InDB = dbSnap.find(r => r.id === r1.id);
    const r2InDB = dbSnap.find(r => r.id === r2.id);
    expect(r1InDB).toBeDefined();
    expect(r1InDB!.deletedFrom).toBe('2026-02');
    expect(r1InDB!.deletedAt).toBeNull();
    expect(r2InDB).toBeDefined();
    expect(r2InDB!.deletedAt).not.toBeNull();
  });

  // Escenario: eliminar un calculado NO afecta al origen (RF-MCALC-005, sentido contrario)
  it('DELETE del calculado NO afecta al origen', async () => {
    const r1 = await recurringService.create(USER_ID, {
      type: MovementType.EXPENSE,
      amountCents: 100000,
      categoryId: CATEGORY_ID,
      startMonth: '2026-01',
    });

    const r2 = await recurringService.update(USER_ID, r1.id, {
      currentMonth: '2026-03',
      amountCents: 150000,
    });

    const calc = await recurringService.createCalculated(USER_ID, r2.id, {
      // `type` ya no se acepta en el DTO (RF-MCALC-003)
      categoryId: CATEGORY_CALC_ID,
      startMonth: '2026-01',
      formulaOperator: FormulaOperator.PCT,
      formulaOperand: 1000,
      formulaSign: 1,
    });

    // DELETE desde m1 sobre el calculado (fromCurrentMonth=true)
    await recurringService.remove(USER_ID, calc.id, '2026-01', true);

    // El origen (R1, R2) debe seguir existiendo intacto (ni siquiera soft-deleted)
    const dbSnap = db.snapshot();
    const r1InDB = dbSnap.find(r => r.id === r1.id);
    const r2InDB = dbSnap.find(r => r.id === r2.id);
    expect(r1InDB).toBeDefined();
    expect(r1InDB!.deletedAt).toBeNull();
    expect(r2InDB).toBeDefined();
    expect(r2InDB!.deletedAt).toBeNull();

    // El calculado sigue existiendo pero soft-deleted (RF-HIST-006)
    const calcInDB = dbSnap.find(r => r.id === calc.id);
    expect(calcInDB).toBeDefined();
    expect(calcInDB!.deletedAt).not.toBeNull();

    // m4: R2 (origen) aparece, calculado no
    const post_m4 = await movementsRepo.findFijosByMonth(USER_ID, '2026-04');
    expect(post_m4.find(f => f.id === r2.id)).toBeDefined();
    expect(post_m4.find(f => f.id === calc.id)).toBeUndefined();
  });

  // Escenario: DELETE desde el primer mes usando la fila R2 (la del split) como argumento
  it('DELETE pasando el id de R2 (la fila del split) elimina toda la cadena', async () => {
    // El usuario puede hacer click en el fijo viendo el mes m4, donde el ítem visible es R2.
    // El DELETE debe operar sobre la cadena completa aunque el id sea el de R2.
    const r1 = await recurringService.create(USER_ID, {
      type: MovementType.EXPENSE,
      amountCents: 100000,
      categoryId: CATEGORY_ID,
      startMonth: '2026-01',
    });

    const r2 = await recurringService.update(USER_ID, r1.id, {
      currentMonth: '2026-03',
      amountCents: 150000,
    });

    const calc = await recurringService.createCalculated(USER_ID, r2.id, {
      // `type` ya no se acepta en el DTO (RF-MCALC-003)
      categoryId: CATEGORY_CALC_ID,
      startMonth: '2026-01',
      formulaOperator: FormulaOperator.PCT,
      formulaOperand: 1000,
      formulaSign: 1,
    });

    // DELETE usando el id de R2, desde m1 con fromCurrentMonth=true
    // boundary='2026-01' <= R1.startMonth='2026-01' → borrado lógico de R1 (RF-HIST-006)
    // boundary='2026-01' <= R2.startMonth='2026-03' → borrado lógico de R2
    await recurringService.remove(USER_ID, r2.id, '2026-01', true);

    const dbSnap = db.snapshot();
    // Toda la cadena del origen sigue existiendo, marcada como eliminada (RF-HIST-006)
    expect(dbSnap.find(r => r.id === r1.id)?.deletedAt).not.toBeNull();
    expect(dbSnap.find(r => r.id === r2.id)?.deletedAt).not.toBeNull();
    // El calculado también debe estar marcado como eliminado (cascada, RN-024)
    expect(dbSnap.find(r => r.id === calc.id)?.deletedAt).not.toBeNull();
  });
});
