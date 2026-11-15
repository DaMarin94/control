/**
 * Tests e2e del RecurringModule y de /movements mostrando fijos.
 *
 * Estrategia: mock de PrismaService (sin DB real en CI).
 *
 * Cubre:
 * - POST /recurring: 201 + shape con categoría embebida
 * - POST /recurring: validaciones de DTO (amountCents, type, categoryId, startMonth)
 * - POST /recurring: 400 categoría inexistente / ajena / eliminada / scope incompatible
 * - PATCH /recurring/:id: 200 in-place + shape
 * - PATCH /recurring/:id: split (mockeado via update + create del repo)
 * - PATCH /recurring/:id: 404 si no existe / es de otro usuario
 * - DELETE /recurring/:id: 204, query params faltantes, 404
 * - GET /movements: fijos en la lista + totales combinados
 * - GET /movements: fijos con categoría soft-deleted siguen en totales (RF-CAT-004)
 * - 401 sin JWT
 * - Aislamiento por userId (RN-003)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { CategoryScope, MovementType } from '@prisma/client';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { Logger } from 'nestjs-pino';

// ---------------------------------------------------------------------------
// Mock de PrismaService
// ---------------------------------------------------------------------------

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  category: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  transaction: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  // userPreferences — necesario para PreferencesModule (Fase 1.1.0)
  userPreferences: {
    findUnique: jest.fn().mockResolvedValue(null),
    upsert: jest.fn(),
    create: jest.fn().mockResolvedValue({ id: 'prefs-1', userId: 'u', data: {}, createdAt: new Date(), updatedAt: new Date() }),
  },
  recurring: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn(),
  },
  // installmentGroup — necesario para InstallmentsModule (Fase 7 — registrado en AppModule)
  // simulation.findMany: SimulationsService.getSimulatedItemsForMonth cuando GET /movements recibe `today`
  simulation: { findMany: jest.fn().mockResolvedValue([]) },
  installmentGroup: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
    delete: jest.fn(),
  },
  // historyEntry — necesario para HistoryModule (Módulo 3.14, RF-HIST-001):
  // RecurringService.update/remove/updateCalculated graban una entrada en cada llamada.
  historyEntry: {
    create: jest.fn().mockResolvedValue({
      id: 'hist-1',
      userId: 'user-a-rec-e2e',
      targetKind: 'FIJO',
      targetId: 'chain-e2e-001',
      action: 'EDIT',
      snapshot: {},
      createdAt: new Date(),
    }),
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(undefined),
  },
  // referenceRate — necesario porque MovementsRepository.loadAllPivotRates
  // (invocado desde GET /movements?month=...) llama a referenceRate.findMany
  referenceRate: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  // recurringSkip — necesario para POST /recurring/:id/skip, alcance puntual
  // (RecurringRepository.findSkip/createSkip/deleteSkip) y alcance de rango
  // (RecurringRepository.applySkipRange — RF-MF-005).
  recurringSkip: {
    findUnique: jest.fn().mockResolvedValue(null),
    // getAllFijosForAnnual (evolutionAvailable, RF-VM-009): skips del universo de fijos
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    delete: jest.fn(),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  // paymentMethod — RecurringRepository.findPaymentMethodDeletedMap (reapertura, RF-MF-008)
  paymentMethod: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
  $queryRaw: jest.fn(),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  // $transaction interactivo: RecurringRepository.applySkipRange (RF-MF-005)
  // corre createMany/deleteMany dentro de una transacción. En el mock, el
  // callback recibe el mismo mockPrisma como "cliente transaccional".
  $transaction: jest.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockPrisma)),
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_A_ID = 'user-a-rec-e2e';
const USER_B_ID = 'user-b-rec-e2e';
const CAT_ID = 'cat-expense-rec-e2e';

function makeDbCategory(overrides: Record<string, unknown> = {}) {
  return {
    id: CAT_ID,
    userId: USER_A_ID,
    name: 'Servicios',
    scope: CategoryScope.EXPENSE,
    color: '#4F86C6',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeDbRecurring(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rec-e2e-001',
    userId: USER_A_ID,
    categoryId: CAT_ID,
    type: MovementType.EXPENSE,
    frequency: 1,
    amountCents: 5000,
    description: null,
    startMonth: '2026-06',
    deletedFrom: null,
    // Campos de cadena (null = fijo normal, no calculado)
    chainId: 'chain-e2e-001',
    sourceChainId: null,
    sourceMovementId: null,
    sourceInstallmentGroupId: null,
    formulaOperator: null,
    formulaOperand: null,
    formulaSign: null,
    // Mes de referencia (offset): 0 = comportamiento actual (base = mes consultado).
    sourceMonthOffset: 0,
    // Fase 1.2.3: moneda y cotización
    currency: 'ARS',
    exchangeRate: 1,
    skips: [],
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

function makeRawTotalsRow(expense = 0n, income = 0n) {
  return {
    expenseCents: BigInt(expense),
    incomeCents: BigInt(income),
  };
}

const VALID_CREATE_BODY = {
  type: 'EXPENSE',
  amountCents: 5000,
  categoryId: CAT_ID,
  startMonth: '2026-06',
};

// ---------------------------------------------------------------------------
// Setup de la app de test
// ---------------------------------------------------------------------------

describe('Recurring (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleFixture.createNestApplication({ bufferLogs: true });
    const logger = app.get(Logger);
    app.useLogger(logger);

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter(logger));

    await app.init();

    jwtService = moduleFixture.get(JwtService);
    tokenA = jwtService.sign({ sub: USER_A_ID });
    tokenB = jwtService.sign({ sub: USER_B_ID });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.category.createMany.mockResolvedValue({ count: 0 });
    // Fase 1.2.3: user.findUnique devuelve settings de moneda por defecto (ARS)
    // Necesario para SettingsService.getSettings() en GET /movements y updateLastExchangeRate
    mockPrisma.user.findUnique.mockResolvedValue({
      id: USER_A_ID,
      defaultCurrency: 'ARS',
      lastExchangeRate: null,
    });
    // user.update: necesario para SettingsService.updateLastExchangeRate
    mockPrisma.user.update.mockResolvedValue({ id: USER_A_ID, defaultCurrency: 'ARS', lastExchangeRate: null });
    // recurring.findMany: implementación base que distingue entre la query de fijos activos
    // y las de calculados de único/cuota (que siempre deben devolver [] por defecto).
    // Los tests individuales pueden sobreescribir para la query de fijos activos.
    mockPrisma.recurring.findMany.mockImplementation((args: any) => {
      if (args?.where?.sourceMovementId?.not !== undefined) return Promise.resolve([]);
      if (args?.where?.sourceInstallmentGroupId?.not !== undefined) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    // $queryRaw: sin transacciones por defecto (para /movements)
    mockPrisma.$queryRaw.mockResolvedValue([]);
    // installmentGroup.findMany: sin cuotas por defecto
    mockPrisma.installmentGroup.findMany.mockResolvedValue([]);
  });

  // -------------------------------------------------------------------------
  // POST /recurring
  // -------------------------------------------------------------------------

  describe('POST /recurring', () => {
    it('201 + sobre con shape de Recurring (categoría embebida)', async () => {
      const cat = makeDbCategory();
      mockPrisma.category.findUnique.mockResolvedValue(cat);
      const rec = makeDbRecurring();
      mockPrisma.recurring.create.mockResolvedValue(rec);

      const res = await request(app.getHttpServer())
        .post('/recurring')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(VALID_CREATE_BODY)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.statusCode).toBe(201);
      expect(res.body.data).toHaveProperty('id', 'rec-e2e-001');
      expect(res.body.data).toHaveProperty('type', 'EXPENSE');
      expect(res.body.data).toHaveProperty('amountCents', 5000);
      expect(res.body.data).toHaveProperty('startMonth', '2026-06');
      expect(res.body.data).toHaveProperty('deletedFrom', null);
      // Categoría embebida
      expect(res.body.data.category).toBeDefined();
      expect(res.body.data.category).toHaveProperty('id');
      expect(res.body.data.category).toHaveProperty('name');
      expect(res.body.data.category).toHaveProperty('color');
      expect(res.body.data.category).toHaveProperty('scope');
    });

    it('400 si falta type', async () => {
      const { type: _type, ...body } = VALID_CREATE_BODY;
      const res = await request(app.getHttpServer())
        .post('/recurring')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(body)
        .expect(400);
      expect(res.body.success).toBe(false);
    });

    it('400 si amountCents es 0 (RN-002)', async () => {
      const res = await request(app.getHttpServer())
        .post('/recurring')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_CREATE_BODY, amountCents: 0 })
        .expect(400);
      expect(res.body.success).toBe(false);
    });

    it('400 si description supera los 200 caracteres', async () => {
      const res = await request(app.getHttpServer())
        .post('/recurring')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_CREATE_BODY, description: 'a'.repeat(201) })
        .expect(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain(
        'La descripción no puede superar los 200 caracteres',
      );
    });

    it('400 si amountCents es negativo (RN-002)', async () => {
      const res = await request(app.getHttpServer())
        .post('/recurring')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_CREATE_BODY, amountCents: -100 })
        .expect(400);
      expect(res.body.success).toBe(false);
    });

    it('400 si amountCents excede el máximo de int4 (overflow de Postgres)', async () => {
      const res = await request(app.getHttpServer())
        .post('/recurring')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_CREATE_BODY, amountCents: 999999999999999 })
        .expect(400);
      expect(res.body.success).toBe(false);
    });

    it('400 si falta startMonth', async () => {
      const { startMonth: _sm, ...body } = VALID_CREATE_BODY;
      const res = await request(app.getHttpServer())
        .post('/recurring')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(body)
        .expect(400);
      expect(res.body.success).toBe(false);
    });

    it('400 si startMonth tiene formato inválido (2026/06)', async () => {
      const res = await request(app.getHttpServer())
        .post('/recurring')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_CREATE_BODY, startMonth: '2026/06' })
        .expect(400);
      expect(res.body.success).toBe(false);
    });

    it('400 si startMonth tiene mes inválido (2026-13)', async () => {
      // La regex pasa el formato YYYY-MM pero el service valida el valor semántico
      mockPrisma.category.findUnique.mockResolvedValue(null);
      const res = await request(app.getHttpServer())
        .post('/recurring')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_CREATE_BODY, startMonth: '2026-13' })
        .expect(400);
      expect(res.body.success).toBe(false);
    });

    it('400 si la categoría no existe (RN-010)', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);
      const res = await request(app.getHttpServer())
        .post('/recurring')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(VALID_CREATE_BODY)
        .expect(400);
      expect(res.body.success).toBe(false);
      expect(mockPrisma.recurring.create).not.toHaveBeenCalled();
    });

    it('400 si la categoría pertenece a otro usuario (aislamiento RN-003)', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(
        makeDbCategory({ userId: USER_B_ID }),
      );
      const res = await request(app.getHttpServer())
        .post('/recurring')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(VALID_CREATE_BODY)
        .expect(400);
      expect(res.body.success).toBe(false);
      expect(mockPrisma.recurring.create).not.toHaveBeenCalled();
    });

    it('400 si la categoría está eliminada (RN-010)', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(
        makeDbCategory({ deletedAt: new Date('2024-01-01') }),
      );
      const res = await request(app.getHttpServer())
        .post('/recurring')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(VALID_CREATE_BODY)
        .expect(400);
      expect(res.body.success).toBe(false);
    });

    it('400 scope incompatible: INCOME con categoría EXPENSE (RN-010)', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(
        makeDbCategory({ scope: CategoryScope.EXPENSE }),
      );
      const res = await request(app.getHttpServer())
        .post('/recurring')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_CREATE_BODY, type: 'INCOME' })
        .expect(400);
      expect(res.body.success).toBe(false);
    });

    it('201 scope BOTH compatible con EXPENSE (RN-010)', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(
        makeDbCategory({ scope: CategoryScope.BOTH }),
      );
      mockPrisma.recurring.create.mockResolvedValue(makeDbRecurring());
      const res = await request(app.getHttpServer())
        .post('/recurring')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_CREATE_BODY, type: 'EXPENSE' })
        .expect(201);
      expect(res.body.success).toBe(true);
    });

    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer())
        .post('/recurring')
        .send(VALID_CREATE_BODY)
        .expect(401);
      expect(res.body.success).toBe(false);
    });

    it('whitelist: campo extra es rechazado (forbidNonWhitelisted)', async () => {
      const res = await request(app.getHttpServer())
        .post('/recurring')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_CREATE_BODY, userId: 'malicious' })
        .expect(400);
      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /recurring/:id
  // -------------------------------------------------------------------------

  describe('PATCH /recurring/:id', () => {
    it('200 + sobre con fijo actualizado (in-place)', async () => {
      const existing = makeDbRecurring({ startMonth: '2026-06' });
      mockPrisma.recurring.findUnique.mockResolvedValue(existing);
      const updated = makeDbRecurring({ amountCents: 9000 });
      mockPrisma.recurring.update.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch('/recurring/rec-e2e-001')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ amountCents: 9000, currentMonth: '2026-06' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.amountCents).toBe(9000);
      expect(res.body.data.category).toBeDefined();
      // El id de la entrada de historial creada viaja en la respuesta (para el
      // "Deshacer" del toast — pega a POST /history/:id/undo).
      expect(res.body.data.historyEntryId).toBe('hist-1');
    });

    it('200 + R2 devuelto en split (currentMonth > startMonth)', async () => {
      const existing = makeDbRecurring({ startMonth: '2026-01' });
      mockPrisma.recurring.findUnique.mockResolvedValue(existing);

      // La lógica de split llama: update (cierre de R), luego create (R2)
      const closedR = { ...existing, deletedFrom: '2026-06' };
      mockPrisma.recurring.update.mockResolvedValue(closedR);
      const r2 = makeDbRecurring({
        id: 'rec-e2e-002',
        startMonth: '2026-06',
        amountCents: 9000,
      });
      mockPrisma.recurring.create.mockResolvedValue(r2);

      const res = await request(app.getHttpServer())
        .patch('/recurring/rec-e2e-001')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ amountCents: 9000, currentMonth: '2026-06' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('rec-e2e-002');
      expect(res.body.data.startMonth).toBe('2026-06');
      expect(res.body.data.historyEntryId).toBe('hist-1');
    });

    it('400 si falta currentMonth', async () => {
      const res = await request(app.getHttpServer())
        .patch('/recurring/rec-e2e-001')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ amountCents: 9000 })
        .expect(400);
      expect(res.body.success).toBe(false);
    });

    it('400 si currentMonth tiene formato inválido', async () => {
      const res = await request(app.getHttpServer())
        .patch('/recurring/rec-e2e-001')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ amountCents: 9000, currentMonth: '2026/06' })
        .expect(400);
      expect(res.body.success).toBe(false);
    });

    it('400 si amountCents es 0 en PATCH (RN-002)', async () => {
      const existing = makeDbRecurring();
      mockPrisma.recurring.findUnique.mockResolvedValue(existing);
      const res = await request(app.getHttpServer())
        .patch('/recurring/rec-e2e-001')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ amountCents: 0, currentMonth: '2026-06' })
        .expect(400);
      expect(res.body.success).toBe(false);
    });

    it('400 si amountCents excede el máximo de int4 en PATCH (overflow de Postgres)', async () => {
      const existing = makeDbRecurring();
      mockPrisma.recurring.findUnique.mockResolvedValue(existing);
      const res = await request(app.getHttpServer())
        .patch('/recurring/rec-e2e-001')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ amountCents: 999999999999999, currentMonth: '2026-06' })
        .expect(400);
      expect(res.body.success).toBe(false);
    });

    it('404 si no existe', async () => {
      mockPrisma.recurring.findUnique.mockResolvedValue(null);
      const res = await request(app.getHttpServer())
        .patch('/recurring/no-existe')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ amountCents: 9000, currentMonth: '2026-06' })
        .expect(404);
      expect(res.body.success).toBe(false);
    });

    it('aislamiento: 404 si pertenece a otro usuario (RN-003)', async () => {
      const rec = makeDbRecurring({ userId: USER_B_ID });
      mockPrisma.recurring.findUnique.mockResolvedValue(rec);
      const res = await request(app.getHttpServer())
        .patch('/recurring/rec-e2e-001')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ amountCents: 9000, currentMonth: '2026-06' })
        .expect(404);
      expect(res.body.success).toBe(false);
      expect(mockPrisma.recurring.update).not.toHaveBeenCalled();
    });

    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer())
        .patch('/recurring/rec-e2e-001')
        .send({ amountCents: 9000, currentMonth: '2026-06' })
        .expect(401);
      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /recurring/:id
  // -------------------------------------------------------------------------

  describe('DELETE /recurring/:id', () => {
    it('200 + { historyEntryId } — fromCurrentMonth=false (soft delete desde siguiente mes)', async () => {
      const existing = makeDbRecurring({ startMonth: '2026-01' });
      mockPrisma.recurring.findUnique.mockResolvedValue(existing);
      mockPrisma.recurring.update.mockResolvedValue({
        ...existing,
        deletedFrom: '2026-07',
      });
      // applyBoundaryToChain necesita que findChainRows devuelva el fijo existente
      // Las queries de calculados (sourceMovementId.not / sourceInstallmentGroupId.not)
      // deben devolver [] para que cascadeDeleteCalculados no haga nada extra.
      mockPrisma.recurring.findMany.mockImplementation((args: any) => {
        if (args?.where?.sourceMovementId?.not !== undefined) return Promise.resolve([]);
        if (args?.where?.sourceInstallmentGroupId?.not !== undefined) return Promise.resolve([]);
        if (args?.where?.sourceChainId !== undefined) return Promise.resolve([]);
        // Caso chainId: findChainRows devuelve el fijo existente
        if (args?.where?.chainId !== undefined) return Promise.resolve([existing]);
        return Promise.resolve([]);
      });

      const res = await request(app.getHttpServer())
        .delete('/recurring/rec-e2e-001?currentMonth=2026-06&fromCurrentMonth=false')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      // DELETE ya no es 204 sin cuerpo: devuelve { historyEntryId } (para el
      // "Deshacer" del toast — pega a POST /history/:id/undo).
      expect(res.body.data).toEqual({ historyEntryId: 'hist-1' });
      expect(mockPrisma.recurring.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'rec-e2e-001' } }),
      );
    });

    it('200 + { historyEntryId } — fromCurrentMonth=true (soft delete desde mes actual)', async () => {
      const existing = makeDbRecurring({ startMonth: '2026-01' });
      mockPrisma.recurring.findUnique.mockResolvedValue(existing);
      mockPrisma.recurring.update.mockResolvedValue({
        ...existing,
        deletedFrom: '2026-06',
      });
      mockPrisma.recurring.findMany.mockImplementation((args: any) => {
        if (args?.where?.sourceMovementId?.not !== undefined) return Promise.resolve([]);
        if (args?.where?.sourceInstallmentGroupId?.not !== undefined) return Promise.resolve([]);
        if (args?.where?.sourceChainId !== undefined) return Promise.resolve([]);
        if (args?.where?.chainId !== undefined) return Promise.resolve([existing]);
        return Promise.resolve([]);
      });

      const res = await request(app.getHttpServer())
        .delete('/recurring/rec-e2e-001?currentMonth=2026-06&fromCurrentMonth=true')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.data).toEqual({ historyEntryId: 'hist-1' });
    });

    it('200 + { historyEntryId } — borrado lógico cuando boundary <= startMonth (RF-HIST-006)', async () => {
      // startMonth='2026-06', currentMonth='2026-06', fromCurrentMonth=true → boundary='2026-06' → borrado lógico
      const existing = makeDbRecurring({ startMonth: '2026-06' });
      mockPrisma.recurring.findUnique.mockResolvedValue(existing);
      mockPrisma.recurring.update.mockResolvedValue({ ...existing, deletedAt: new Date() });
      mockPrisma.recurring.findMany.mockImplementation((args: any) => {
        if (args?.where?.sourceMovementId?.not !== undefined) return Promise.resolve([]);
        if (args?.where?.sourceInstallmentGroupId?.not !== undefined) return Promise.resolve([]);
        if (args?.where?.sourceChainId !== undefined) return Promise.resolve([]);
        if (args?.where?.chainId !== undefined) return Promise.resolve([existing]);
        return Promise.resolve([]);
      });

      const res = await request(app.getHttpServer())
        .delete('/recurring/rec-e2e-001?currentMonth=2026-06&fromCurrentMonth=true')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.data).toEqual({ historyEntryId: 'hist-1' });
      expect(mockPrisma.recurring.update).toHaveBeenCalledWith({
        where: { id: 'rec-e2e-001' },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      });
      expect(mockPrisma.recurring.delete).not.toHaveBeenCalled();
    });

    it('400 si falta currentMonth', async () => {
      const res = await request(app.getHttpServer())
        .delete('/recurring/rec-e2e-001?fromCurrentMonth=false')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);
      expect(res.body.success).toBe(false);
    });

    it('400 si falta fromCurrentMonth', async () => {
      const res = await request(app.getHttpServer())
        .delete('/recurring/rec-e2e-001?currentMonth=2026-06')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);
      expect(res.body.success).toBe(false);
    });

    it('400 si currentMonth tiene formato inválido', async () => {
      const res = await request(app.getHttpServer())
        .delete('/recurring/rec-e2e-001?currentMonth=202606&fromCurrentMonth=false')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);
      expect(res.body.success).toBe(false);
    });

    it('404 si no existe', async () => {
      mockPrisma.recurring.findUnique.mockResolvedValue(null);
      const res = await request(app.getHttpServer())
        .delete('/recurring/no-existe?currentMonth=2026-06&fromCurrentMonth=false')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);
      expect(res.body.success).toBe(false);
    });

    it('aislamiento: 404 si pertenece a otro usuario (RN-003)', async () => {
      const rec = makeDbRecurring({ userId: USER_B_ID });
      mockPrisma.recurring.findUnique.mockResolvedValue(rec);
      const res = await request(app.getHttpServer())
        .delete('/recurring/rec-e2e-001?currentMonth=2026-06&fromCurrentMonth=false')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);
      expect(res.body.success).toBe(false);
      expect(mockPrisma.recurring.delete).not.toHaveBeenCalled();
    });

    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer())
        .delete('/recurring/rec-e2e-001?currentMonth=2026-06&fromCurrentMonth=false')
        .expect(401);
      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // POST /recurring/:id/skip — alcance puntual (toggle) y de rango (RF-MF-005)
  // -------------------------------------------------------------------------

  describe('POST /recurring/:id/skip', () => {
    it('alcance puntual (toggle, sin cambios): + { skipped: true, month } (200 — @HttpCode(OK), es un toggle)', async () => {
      const existing = makeDbRecurring({ startMonth: '2026-01' });
      mockPrisma.recurring.findUnique.mockResolvedValue(existing);
      mockPrisma.recurringSkip.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post('/recurring/rec-e2e-001/skip')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ month: '2026-06' })
        .expect(200);

      expect(res.body.data).toEqual({ skipped: true, month: '2026-06' });
      expect(mockPrisma.recurringSkip.create).toHaveBeenCalledWith({
        data: { recurringId: 'rec-e2e-001', month: '2026-06' },
      });
    });

    it('alcance de rango: + { action, from, to, affectedCount } — crea skips con createMany + skipDuplicates', async () => {
      // startMonth=2026-03, frequency=3 → apariciones marzo/junio/septiembre/diciembre
      const existing = makeDbRecurring({ startMonth: '2026-03', frequency: 3 });
      mockPrisma.recurring.findUnique.mockResolvedValue(existing);
      mockPrisma.recurring.findMany.mockImplementation((args: any) => {
        if (args?.where?.chainId !== undefined) return Promise.resolve([existing]);
        return Promise.resolve([]);
      });

      const res = await request(app.getHttpServer())
        .post('/recurring/rec-e2e-001/skip')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ from: '2026-03', to: '2026-12', action: 'skip' })
        .expect(200);

      expect(res.body.data).toEqual({
        action: 'skip',
        from: '2026-03',
        to: '2026-12',
        affectedCount: 4,
      });
      expect(mockPrisma.recurringSkip.createMany).toHaveBeenCalledWith({
        data: [
          { recurringId: 'rec-e2e-001', month: '2026-03' },
          { recurringId: 'rec-e2e-001', month: '2026-06' },
          { recurringId: 'rec-e2e-001', month: '2026-09' },
          { recurringId: 'rec-e2e-001', month: '2026-12' },
        ],
        skipDuplicates: true,
      });
    });

    it('alcance de rango, des-anular: borra TODOS los skips de la cadena en [from, to] con deleteMany', async () => {
      const existing = makeDbRecurring({ startMonth: '2026-01', frequency: 1 });
      mockPrisma.recurring.findUnique.mockResolvedValue(existing);
      mockPrisma.recurring.findMany.mockImplementation((args: any) => {
        if (args?.where?.chainId !== undefined) return Promise.resolve([existing]);
        return Promise.resolve([]);
      });

      const res = await request(app.getHttpServer())
        .post('/recurring/rec-e2e-001/skip')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ from: '2026-01', to: '2026-03', action: 'unskip' })
        .expect(200);

      expect(res.body.data).toEqual({
        action: 'unskip',
        from: '2026-01',
        to: '2026-03',
        affectedCount: 3,
      });
      expect(mockPrisma.recurringSkip.deleteMany).toHaveBeenCalledWith({
        where: {
          month: { gte: '2026-01', lte: '2026-03' },
          recurring: { chainId: existing.chainId },
        },
      });
    });

    it('idempotencia (rango): repetir el mismo "skip" no falla ni cambia el resultado', async () => {
      const existing = makeDbRecurring({ startMonth: '2026-01', frequency: 1 });
      mockPrisma.recurring.findUnique.mockResolvedValue(existing);
      mockPrisma.recurring.findMany.mockImplementation((args: any) => {
        if (args?.where?.chainId !== undefined) return Promise.resolve([existing]);
        return Promise.resolve([]);
      });

      const body = { from: '2026-01', to: '2026-02', action: 'skip' };
      const res1 = await request(app.getHttpServer())
        .post('/recurring/rec-e2e-001/skip')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(body)
        .expect(200);
      const res2 = await request(app.getHttpServer())
        .post('/recurring/rec-e2e-001/skip')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(body)
        .expect(200);

      expect(res1.body.data).toEqual(res2.body.data);
      expect(mockPrisma.recurringSkip.createMany).toHaveBeenCalledTimes(2);
    });

    it('rango que cruza un split de la cadena: resuelve cada mes contra la fila que lo cubre', async () => {
      const r1 = makeDbRecurring({ id: 'rec-e2e-001', startMonth: '2026-01', deletedFrom: '2026-07', frequency: 2 });
      const r2 = makeDbRecurring({ id: 'rec-e2e-002', startMonth: '2026-07', deletedFrom: null, frequency: 2 });
      mockPrisma.recurring.findUnique.mockResolvedValue(r2);
      mockPrisma.recurring.findMany.mockImplementation((args: any) => {
        if (args?.where?.chainId !== undefined) return Promise.resolve([r2, r1]);
        return Promise.resolve([]);
      });

      const res = await request(app.getHttpServer())
        .post('/recurring/rec-e2e-002/skip')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ from: '2026-02', to: '2026-10', action: 'skip' })
        .expect(200);

      expect(res.body.data.affectedCount).toBe(4);
      expect(mockPrisma.recurringSkip.createMany).toHaveBeenCalledWith({
        data: [
          { recurringId: 'rec-e2e-001', month: '2026-03' },
          { recurringId: 'rec-e2e-001', month: '2026-05' },
          { recurringId: 'rec-e2e-002', month: '2026-07' },
          { recurringId: 'rec-e2e-002', month: '2026-09' },
        ],
        skipDuplicates: true,
      });
    });

    it('400 si el rango supera los 24 meses', async () => {
      const existing = makeDbRecurring({ startMonth: '2020-01' });
      mockPrisma.recurring.findUnique.mockResolvedValue(existing);
      mockPrisma.recurring.findMany.mockImplementation((args: any) => {
        if (args?.where?.chainId !== undefined) return Promise.resolve([existing]);
        return Promise.resolve([]);
      });

      const res = await request(app.getHttpServer())
        .post('/recurring/rec-e2e-001/skip')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ from: '2026-01', to: '2028-02', action: 'skip' })
        .expect(400);
      expect(res.body.success).toBe(false);
      expect(mockPrisma.recurringSkip.createMany).not.toHaveBeenCalled();
    });

    it('400 si el rango empieza antes del arranque del fijo (piso)', async () => {
      const existing = makeDbRecurring({ startMonth: '2026-06' });
      mockPrisma.recurring.findUnique.mockResolvedValue(existing);
      mockPrisma.recurring.findMany.mockImplementation((args: any) => {
        if (args?.where?.chainId !== undefined) return Promise.resolve([existing]);
        return Promise.resolve([]);
      });

      const res = await request(app.getHttpServer())
        .post('/recurring/rec-e2e-001/skip')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ from: '2026-01', to: '2026-08', action: 'skip' })
        .expect(400);
      expect(res.body.success).toBe(false);
    });

    it('400 si el rango termina después del último mes de aparición (techo)', async () => {
      const existing = makeDbRecurring({ startMonth: '2026-01', frequency: 3, deletedFrom: '2026-08' });
      mockPrisma.recurring.findUnique.mockResolvedValue(existing);
      mockPrisma.recurring.findMany.mockImplementation((args: any) => {
        if (args?.where?.chainId !== undefined) return Promise.resolve([existing]);
        return Promise.resolve([]);
      });

      const res = await request(app.getHttpServer())
        .post('/recurring/rec-e2e-001/skip')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ from: '2026-01', to: '2026-08', action: 'skip' })
        .expect(400);
      expect(res.body.success).toBe(false);
    });

    it('400 si el body mezcla "month" con campos de rango', async () => {
      const res = await request(app.getHttpServer())
        .post('/recurring/rec-e2e-001/skip')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ month: '2026-06', from: '2026-01', to: '2026-02', action: 'skip' })
        .expect(400);
      expect(res.body.success).toBe(false);
    });

    it('400 si el body no trae ni "month" ni el combo completo de rango', async () => {
      const res = await request(app.getHttpServer())
        .post('/recurring/rec-e2e-001/skip')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ from: '2026-01', to: '2026-02' }) // falta action
        .expect(400);
      expect(res.body.success).toBe(false);
    });

    it('400 si "action" no es "skip" ni "unskip"', async () => {
      const res = await request(app.getHttpServer())
        .post('/recurring/rec-e2e-001/skip')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ from: '2026-01', to: '2026-02', action: 'toggle' })
        .expect(400);
      expect(res.body.success).toBe(false);
    });

    it('404 si el fijo no existe (alcance de rango)', async () => {
      mockPrisma.recurring.findUnique.mockResolvedValue(null);
      const res = await request(app.getHttpServer())
        .post('/recurring/no-existe/skip')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ from: '2026-01', to: '2026-02', action: 'skip' })
        .expect(404);
      expect(res.body.success).toBe(false);
    });

    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer())
        .post('/recurring/rec-e2e-001/skip')
        .send({ from: '2026-01', to: '2026-02', action: 'skip' })
        .expect(401);
      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // POST|PATCH /recurring/:id/calculated — mes de referencia (sourceMonthOffset)
  // -------------------------------------------------------------------------

  describe('POST /recurring/:id/calculated — sourceMonthOffset', () => {
    const VALID_CALC_BODY = {
      categoryId: CAT_ID,
      startMonth: '2026-06',
      formulaOperator: 'PCT',
      formulaOperand: 1000,
      formulaSign: 1,
    };

    it('201 con sourceMonthOffset en rango — lo devuelve en el Recurring creado', async () => {
      const cat = makeDbCategory();
      mockPrisma.category.findUnique.mockResolvedValue(cat);
      const origin = makeDbRecurring({ id: 'origin-e2e-001', sourceChainId: null });
      mockPrisma.recurring.findUnique.mockResolvedValue(origin);
      mockPrisma.recurring.create.mockResolvedValue(
        makeDbRecurring({ id: 'calc-e2e-001', sourceChainId: origin.chainId, sourceMonthOffset: 1 }),
      );

      const res = await request(app.getHttpServer())
        .post('/recurring/origin-e2e-001/calculated')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_CALC_BODY, sourceMonthOffset: 1 })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('sourceMonthOffset', 1);
      expect(mockPrisma.recurring.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ sourceMonthOffset: 1 }) }),
      );
    });

    it('201 sin sourceMonthOffset — persiste 0 (default)', async () => {
      const cat = makeDbCategory();
      mockPrisma.category.findUnique.mockResolvedValue(cat);
      const origin = makeDbRecurring({ id: 'origin-e2e-001', sourceChainId: null });
      mockPrisma.recurring.findUnique.mockResolvedValue(origin);
      mockPrisma.recurring.create.mockResolvedValue(
        makeDbRecurring({ id: 'calc-e2e-001', sourceChainId: origin.chainId, sourceMonthOffset: 0 }),
      );

      const res = await request(app.getHttpServer())
        .post('/recurring/origin-e2e-001/calculated')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(VALID_CALC_BODY)
        .expect(201);

      expect(res.body.data).toHaveProperty('sourceMonthOffset', 0);
      expect(mockPrisma.recurring.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ sourceMonthOffset: 0 }) }),
      );
    });

    it.each([-1, 13])('400 si sourceMonthOffset = %i (fuera de 0..12)', async (value) => {
      const res = await request(app.getHttpServer())
        .post('/recurring/origin-e2e-001/calculated')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_CALC_BODY, sourceMonthOffset: value })
        .expect(400);
      expect(res.body.success).toBe(false);
    });

    it('400 si sourceMonthOffset no es un entero (1.5)', async () => {
      const res = await request(app.getHttpServer())
        .post('/recurring/origin-e2e-001/calculated')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_CALC_BODY, sourceMonthOffset: 1.5 })
        .expect(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /recurring/:id/calculated — sourceMonthOffset', () => {
    it('200 in-place: actualiza sourceMonthOffset y lo devuelve', async () => {
      const existing = makeDbRecurring({
        id: 'calc-e2e-001',
        startMonth: '2026-01',
        sourceChainId: 'chain-origin-e2e',
        formulaOperator: 'PCT',
        formulaOperand: 1000,
        formulaSign: 1,
        sourceMonthOffset: 0,
      });
      mockPrisma.recurring.findUnique.mockResolvedValue(existing);
      mockPrisma.recurring.update.mockResolvedValue({ ...existing, sourceMonthOffset: 2 });

      const res = await request(app.getHttpServer())
        .patch('/recurring/calc-e2e-001/calculated')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ currentMonth: '2026-01', sourceMonthOffset: 2 })
        .expect(200);

      expect(res.body.data).toHaveProperty('sourceMonthOffset', 2);
      expect(mockPrisma.recurring.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ sourceMonthOffset: 2 }) }),
      );
    });

    it.each([-1, 13])('400 si sourceMonthOffset = %i (fuera de 0..12)', async (value) => {
      const res = await request(app.getHttpServer())
        .patch('/recurring/calc-e2e-001/calculated')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ currentMonth: '2026-01', sourceMonthOffset: value })
        .expect(400);
      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // GET /movements — fijos integrados
  // -------------------------------------------------------------------------

  describe('GET /movements — con fijos', () => {
    it('200 + fijos en movements.fijos con shape de MovementItem', async () => {
      // $queryRaw: únicos vacíos (findUnicosByMonth).
      // getTotalsByMonth ya NO se llama: el service calcula totales desde las listas.
      mockPrisma.$queryRaw.mockResolvedValueOnce([]); // findUnicosByMonth

      // Prisma ORM: fijo activo en el mes
      const fijo = makeDbRecurring({
        id: 'fijo-mv-001',
        startMonth: '2026-01',
        deletedFrom: null,
        category: {
          id: CAT_ID,
          name: 'Servicios',
          color: '#4F86C6',
          scope: CategoryScope.EXPENSE,
        },
      });
      // Solo devolver el fijo para la query principal (no para calculados de único/cuota)
      mockPrisma.recurring.findMany.mockImplementation((args: any) => {
        if (args?.where?.sourceMovementId?.not !== undefined) return Promise.resolve([]);
        if (args?.where?.sourceInstallmentGroupId?.not !== undefined) return Promise.resolve([]);
        return Promise.resolve([fijo]);
      });

      const res = await request(app.getHttpServer())
        .get('/movements?month=2026-06')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.movements.fijos).toHaveLength(1);

      const item = res.body.data.movements.fijos[0];
      expect(item).toHaveProperty('id', 'fijo-mv-001');
      expect(item).toHaveProperty('origin', 'fijo');
      expect(item).toHaveProperty('type', 'EXPENSE');
      expect(item).toHaveProperty('amountCents', 5000);
      expect(item).toHaveProperty('occurredAt', null);
      expect(item).toHaveProperty('timezone', null);
      expect(item.category).toBeDefined();
      expect(item.category).toHaveProperty('id', CAT_ID);
      expect(item.category).toHaveProperty('name', 'Servicios');
    });

    it('evolutionAvailable: true con >=2 apariciones hasta el mes en curso (today), false con 1', async () => {
      mockPrisma.recurring.findMany.mockImplementation((args: any) => {
        if (args?.where?.sourceMovementId?.not !== undefined) return Promise.resolve([]);
        if (args?.where?.sourceInstallmentGroupId?.not !== undefined) return Promise.resolve([]);
        return Promise.resolve([
          makeDbRecurring({ id: 'fijo-ev-1', chainId: 'chain-ev-1', startMonth: '2026-01' }),
          makeDbRecurring({ id: 'fijo-ev-2', chainId: 'chain-ev-2', startMonth: '2026-11', amountCents: 4000 }),
        ]);
      });

      const res = await request(app.getHttpServer())
        .get('/movements?month=2026-11&today=2026-11-14')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const byId = Object.fromEntries(
        res.body.data.movements.fijos.map((f: any) => [f.id, f.evolutionAvailable]),
      );
      expect(byId['fijo-ev-1']).toBe(true);
      expect(byId['fijo-ev-2']).toBe(false);
      // únicos/cuotas: siempre false
      res.body.data.movements.unicos.forEach((u: any) => expect(u.evolutionAvailable).toBe(false));
    });

    it('200 + totales combinados: únicos + fijos', async () => {
      // Único EXPENSE 1500
      const rawRow = {
        id: 'tx-001',
        userId: USER_A_ID,
        type: 'EXPENSE',
        amountCents: 1500,
        // Fase 1.2.3: campos de moneda
        currency: 'ARS',
        exchangeRate: '1',
        description: null,
        occurredAt: new Date('2026-06-08T17:30:00Z'),
        timezone: 'America/Argentina/Buenos_Aires',
        categoryId: CAT_ID,
        categoryName: 'Consumibles',
        categoryColor: '#4F86C6',
        categoryScope: 'EXPENSE',
      };
      // $queryRaw: una llamada para findUnicosByMonth. Totales se calculan desde listas.
      mockPrisma.$queryRaw.mockResolvedValueOnce([rawRow]); // findUnicosByMonth

      // Fijo EXPENSE 5000
      const fijo = makeDbRecurring({
        startMonth: '2026-01',
        deletedFrom: null,
        amountCents: 5000,
        type: MovementType.EXPENSE,
        category: {
          id: CAT_ID,
          name: 'Servicios',
          color: '#4F86C6',
          scope: CategoryScope.EXPENSE,
        },
      });
      // Solo devolver el fijo para la query principal (no para calculados de único/cuota)
      mockPrisma.recurring.findMany.mockImplementation((args: any) => {
        if (args?.where?.sourceMovementId?.not !== undefined) return Promise.resolve([]);
        if (args?.where?.sourceInstallmentGroupId?.not !== undefined) return Promise.resolve([]);
        return Promise.resolve([fijo]);
      });

      const res = await request(app.getHttpServer())
        .get('/movements?month=2026-06')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      // expenseCents = 1500 (único) + 5000 (fijo) = 6500
      expect(res.body.data.totals.expenseCents).toBe(6500);
      expect(res.body.data.totals.incomeCents).toBe(0);
      expect(res.body.data.totals.balanceCents).toBe(-6500);
    });

    it('200 + fijo con categoría soft-deleted sigue en totales (RF-CAT-004)', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]); // findUnicosByMonth (sin únicos)

      // Fijo cuya categoría está eliminada (el campo deletedAt no importa en el join de movimientos)
      const fijo = makeDbRecurring({
        startMonth: '2026-01',
        amountCents: 3000,
        type: MovementType.EXPENSE,
        category: {
          id: 'cat-deleted',
          name: 'Cat Eliminada',
          color: '#000000',
          scope: CategoryScope.BOTH,
        },
      });
      // Solo devolver el fijo para la query principal (no para calculados de único/cuota)
      mockPrisma.recurring.findMany.mockImplementation((args: any) => {
        if (args?.where?.sourceMovementId?.not !== undefined) return Promise.resolve([]);
        if (args?.where?.sourceInstallmentGroupId?.not !== undefined) return Promise.resolve([]);
        return Promise.resolve([fijo]);
      });

      const res = await request(app.getHttpServer())
        .get('/movements?month=2026-06')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.data.movements.fijos).toHaveLength(1);
      expect(res.body.data.movements.fijos[0].category.id).toBe('cat-deleted');
      // Y suma en totales
      expect(res.body.data.totals.expenseCents).toBe(3000);
    });

    it('200 + mes sin fijos → movements.fijos vacío', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]); // findUnicosByMonth

      mockPrisma.recurring.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/movements?month=2026-06')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.data.movements.fijos).toEqual([]);
      expect(res.body.data.totals.expenseCents).toBe(0);
    });

    it('aislamiento: fijos filtrados por userId del JWT (RN-003)', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]); // findUnicosByMonth

      mockPrisma.recurring.findMany.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/movements?month=2026-06')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      // findMany llamado con el userId del token B
      const findManyCall = mockPrisma.recurring.findMany.mock.calls[0][0];
      expect(findManyCall.where.userId).toBe(USER_B_ID);
    });
  });

  // -------------------------------------------------------------------------
  // POST /recurring/:id/reopen y GET /recurring/:id/reopen-preview (RF-MF-008)
  // -------------------------------------------------------------------------

  describe('reabrir fijo terminado (RF-MF-008)', () => {
    const ended = () =>
      makeDbRecurring({
        startMonth: '2026-01',
        deletedFrom: '2026-09',
        frequency: 3,
        paymentMethodId: null,
        paymentMethod: null,
        autoDebit: null,
        anchorCurrency: 'ARS',
      });
    const calc = () =>
      makeDbRecurring({
        id: 'calc-e2e-1',
        chainId: 'calc-chain-e2e-1',
        sourceChainId: 'chain-e2e-001',
        formulaOperator: 'PCT',
        formulaOperand: 1000,
        formulaSign: 1,
        amountCents: 0,
        startMonth: '2026-01',
        deletedFrom: '2026-09',
        paymentMethodId: null,
        paymentMethod: null,
        autoDebit: null,
        anchorCurrency: 'ARS',
      });

    function wire(rows: any[], calcs: any[] = []) {
      const all = [...rows, ...calcs];
      mockPrisma.recurring.findUnique.mockImplementation((args: any) =>
        Promise.resolve(all.find((r) => r.id === args.where.id) ?? null),
      );
      mockPrisma.recurring.findMany.mockImplementation((args: any) => {
        if (args?.where?.chainId !== undefined) return Promise.resolve(rows);
        if (args?.where?.sourceChainId !== undefined) return Promise.resolve(calcs);
        return Promise.resolve([]);
      });
      let n = 0;
      mockPrisma.recurring.create.mockImplementation(() => Promise.resolve({ id: `new-${n++}` }));
      mockPrisma.recurring.update.mockResolvedValue({});
      mockPrisma.category.findMany.mockResolvedValue([{ id: CAT_ID, deletedAt: null }]);
      mockPrisma.recurringSkip.findMany.mockResolvedValue([]);
    }

    const BODY = { currentMonth: '2026-11', reopenMonth: '2026-11', amountCents: 9000 };

    it('200: cierra V en X, crea N, y registra la entrada REOPEN (con espejo)', async () => {
      wire([ended()], [calc()]);

      const res = await request(app.getHttpServer())
        .post('/recurring/rec-e2e-001/reopen')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(BODY)
        .expect(200);

      // relleno [2026-09, 2026-11) con ancla 2026-01 cada 3: ninguna aparición (jul/oct fuera de [sep,nov) salvo oct)
      expect(res.body.data).toMatchObject({
        id: 'new-0',
        chainId: 'chain-e2e-001',
        previousEndMonth: '2026-09',
        reopenMonth: '2026-11',
        skippedCount: 1, // 2026-10
        reopenedCalculatedChainIds: ['calc-chain-e2e-1'],
      });
      expect(res.body.data.historyEntryId).toBeDefined();
      expect(mockPrisma.recurring.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'rec-e2e-001' }, data: { deletedFrom: '2026-11' } }),
      );
      expect(mockPrisma.recurring.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'calc-e2e-1' }, data: { deletedFrom: '2026-11' } }),
      );
      const createdRows = mockPrisma.recurring.create.mock.calls.map((c: any) => c[0].data);
      expect(createdRows).toHaveLength(2);
      expect(createdRows[0]).toMatchObject({
        startMonth: '2026-11',
        deletedFrom: null,
        amountCents: 9000,
        chainId: 'chain-e2e-001',
        frequency: 3,
      });
      expect(createdRows[1]).toMatchObject({
        startMonth: '2026-11',
        deletedFrom: null,
        chainId: 'calc-chain-e2e-1',
        sourceChainId: 'chain-e2e-001',
      });
      expect(mockPrisma.historyEntry.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.historyEntry.create.mock.calls[0][0].data).toMatchObject({
        userId: USER_A_ID,
        targetKind: 'FIJO',
        targetId: 'chain-e2e-001',
        action: 'REOPEN',
      });
    });

    it('relleno con frecuencia > 1: skips solo de las apariciones viejas (origen + espejo) con createMany', async () => {
      // fin 2026-07 (ancla 2026-01 cada 3: jul y oct), X = 2026-12
      wire([{ ...ended(), deletedFrom: '2026-07' }], [{ ...calc(), deletedFrom: '2026-07' }]);
      await request(app.getHttpServer())
        .post('/recurring/rec-e2e-001/reopen')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...BODY, reopenMonth: '2026-12' })
        .expect(200);

      expect(mockPrisma.recurringSkip.createMany).toHaveBeenCalledWith({
        data: [
          { recurringId: 'rec-e2e-001', month: '2026-07' },
          { recurringId: 'rec-e2e-001', month: '2026-10' },
        ],
        skipDuplicates: true,
      });
      expect(mockPrisma.recurringSkip.createMany).toHaveBeenCalledWith({
        data: [
          { recurringId: 'calc-e2e-1', month: '2026-07' },
          { recurringId: 'calc-e2e-1', month: '2026-10' },
        ],
        skipDuplicates: true,
      });
    });

    it('X == endMonth (fin futuro): sin relleno, no escribe skips', async () => {
      wire([{ ...ended(), deletedFrom: '2027-03' }]);
      const res = await request(app.getHttpServer())
        .post('/recurring/rec-e2e-001/reopen')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...BODY, reopenMonth: '2027-03' })
        .expect(200);
      expect(res.body.data.skippedCount).toBe(0);
      expect(mockPrisma.recurringSkip.createMany).not.toHaveBeenCalled();
    });

    it('400 si X < máx(mes en curso, endMonth)', async () => {
      wire([{ ...ended(), deletedFrom: '2027-03' }]);
      const res = await request(app.getHttpServer())
        .post('/recurring/rec-e2e-001/reopen')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...BODY, reopenMonth: '2027-02' })
        .expect(400);
      expect(res.body.success).toBe(false);
      expect(mockPrisma.recurring.create).not.toHaveBeenCalled();
    });

    it('400 de DTO: monto 0, mes mal formado, tope de monto, campos extra', async () => {
      wire([ended()]);
      for (const bad of [
        { ...BODY, amountCents: 0 },
        { ...BODY, reopenMonth: '2026/11' },
        { ...BODY, amountCents: 2147483648 },
        { ...BODY, foo: 1 },
      ]) {
        await request(app.getHttpServer())
          .post('/recurring/rec-e2e-001/reopen')
          .set('Authorization', `Bearer ${tokenA}`)
          .send(bad)
          .expect(400);
      }
    });

    it('400 si el fijo no tiene fin; 400 si es un calculado', async () => {
      wire([{ ...ended(), deletedFrom: null }]);
      await request(app.getHttpServer())
        .post('/recurring/rec-e2e-001/reopen')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(BODY)
        .expect(400);

      wire([ended()], [calc()]);
      await request(app.getHttpServer())
        .post('/recurring/calc-e2e-1/reopen')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(BODY)
        .expect(400);
    });

    it('404 si el fijo es de otro usuario (RN-003); 401 sin JWT', async () => {
      wire([ended()]);
      await request(app.getHttpServer())
        .post('/recurring/rec-e2e-001/reopen')
        .set('Authorization', `Bearer ${tokenB}`)
        .send(BODY)
        .expect(404);
      await request(app.getHttpServer()).post('/recurring/rec-e2e-001/reopen').send(BODY).expect(401);
    });

    it('categoría dada de baja: 400 sin reemplazo, 200 con categoryId activo', async () => {
      wire([ended()]);
      mockPrisma.category.findMany.mockResolvedValue([{ id: CAT_ID, deletedAt: new Date() }]);
      await request(app.getHttpServer())
        .post('/recurring/rec-e2e-001/reopen')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(BODY)
        .expect(400);

      mockPrisma.category.findUnique.mockResolvedValue(makeDbCategory({ id: 'cat-new' }));
      await request(app.getHttpServer())
        .post('/recurring/rec-e2e-001/reopen')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...BODY, categoryId: 'cat-new' })
        .expect(200);
      expect(mockPrisma.recurring.create.mock.calls[0][0].data.category).toEqual({
        connect: { id: 'cat-new' },
      });
    });

    it('método de pago dado de baja: 400 sin campo, 200 con paymentMethodId null ("sin método")', async () => {
      wire([{ ...ended(), paymentMethodId: 'pm-dead' }]);
      mockPrisma.paymentMethod.findMany.mockResolvedValue([{ id: 'pm-dead', deletedAt: new Date() }]);
      await request(app.getHttpServer())
        .post('/recurring/rec-e2e-001/reopen')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(BODY)
        .expect(400);

      await request(app.getHttpServer())
        .post('/recurring/rec-e2e-001/reopen')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...BODY, paymentMethodId: null })
        .expect(200);
      expect(mockPrisma.recurring.create.mock.calls[0][0].data.paymentMethod).toBeUndefined();
    });

    it('GET reopen-preview: paymentMethod incluye icon', async () => {
      wire([{ ...ended(), paymentMethodId: 'pm-ok', paymentMethod: { id: 'pm-ok', name: 'Débito', icon: 'credit-card', type: 'DEBIT' } }]);
      mockPrisma.paymentMethod.findMany.mockResolvedValue([{ id: 'pm-ok', deletedAt: null }]);
      const res = await request(app.getHttpServer())
        .get('/recurring/rec-e2e-001/reopen-preview?currentMonth=2026-11')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(res.body.data.paymentMethod).toEqual({ id: 'pm-ok', name: 'Débito', icon: 'credit-card', deleted: false });
    });

    it('paymentMethodId null con método activo -> 400', async () => {
      wire([{ ...ended(), paymentMethodId: 'pm-ok' }]);
      mockPrisma.paymentMethod.findMany.mockResolvedValue([{ id: 'pm-ok', deletedAt: null }]);
      await request(app.getHttpServer())
        .post('/recurring/rec-e2e-001/reopen')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...BODY, paymentMethodId: null })
        .expect(400);
    });

    it('categoryId con categoría activa -> 400 (el reemplazo se rechaza si no hace falta)', async () => {
      wire([ended()]);
      await request(app.getHttpServer())
        .post('/recurring/rec-e2e-001/reopen')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...BODY, categoryId: 'cat-new' })
        .expect(400);
    });

    it('espejo con categoría de baja exige calculatedCategories', async () => {
      wire([ended()], [{ ...calc(), categoryId: 'cat-dead' }]);
      mockPrisma.category.findMany.mockResolvedValue([
        { id: CAT_ID, deletedAt: null },
        { id: 'cat-dead', deletedAt: new Date() },
      ]);
      await request(app.getHttpServer())
        .post('/recurring/rec-e2e-001/reopen')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(BODY)
        .expect(400);

      mockPrisma.category.findUnique.mockResolvedValue(makeDbCategory({ id: 'cat-new' }));
      await request(app.getHttpServer())
        .post('/recurring/rec-e2e-001/reopen')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          ...BODY,
          calculatedCategories: [{ chainId: 'calc-chain-e2e-1', categoryId: 'cat-new' }],
        })
        .expect(200);
      expect(mockPrisma.recurring.create.mock.calls[1][0].data.category).toEqual({
        connect: { id: 'cat-new' },
      });
    });

    it('GET reopen-preview: piso de X, último monto y reemplazos requeridos', async () => {
      wire(
        [{ ...ended(), deletedFrom: '2027-03', amountCents: 4200 }],
        [{ ...calc(), deletedFrom: '2027-03', categoryId: 'cat-dead' }],
      );
      mockPrisma.category.findMany.mockResolvedValue([
        { id: CAT_ID, deletedAt: null },
        { id: 'cat-dead', deletedAt: new Date() },
      ]);
      const res = await request(app.getHttpServer())
        .get('/recurring/rec-e2e-001/reopen-preview?currentMonth=2026-11')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(res.body.data).toMatchObject({
        chainId: 'chain-e2e-001',
        endMonth: '2027-03',
        minReopenMonth: '2027-03',
        amountCents: 4200,
        requiresCategory: false,
        requiresPaymentMethod: false,
      });
      expect(res.body.data.mirrors).toEqual([
        expect.objectContaining({ chainId: 'calc-chain-e2e-1', requiresCategory: true }),
      ]);
    });

    it('GET reopen-preview: 400 sin currentMonth', async () => {
      wire([ended()]);
      await request(app.getHttpServer())
        .get('/recurring/rec-e2e-001/reopen-preview')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);
    });
  });
});
