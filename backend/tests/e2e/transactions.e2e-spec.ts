/**
 * Tests e2e del TransactionsModule.
 *
 * Estrategia: mock de PrismaService (sin DB real en CI).
 * Cubre:
 * - Sobre de respuesta estándar
 * - Crear OK (201) + shape de respuesta con categoría embebida
 * - Validaciones de DTO: monto 0/negativo, campos faltantes, ISO inválido
 * - Validación de categoría: inexistente, ajena, eliminada, scope incompatible (RN-010)
 * - GET /id: 200 OK, 404 si no existe/no es del usuario
 * - PATCH: edición OK, revalidación RN-010, 404
 * - DELETE: 204, 404
 * - Aislamiento por userId (RN-003)
 * - 401 sin JWT
 *
 * NOTA: GET /transactions?month=... fue eliminado en Fase 5.
 * El listado por mes ahora es GET /movements?month=YYYY-MM.
 * Ver movements.e2e-spec.ts.
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
  // recurring — necesario para RecurringModule (Fase 6 — registrado en AppModule)
  recurring: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  // recurringSkip — necesario para RecurringModule (Fase 1.1.1)
  recurringSkip: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  // installmentGroup — necesario para InstallmentsModule (Fase 7 — registrado en AppModule)
  installmentGroup: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  // referenceRate — necesario porque MovementsRepository.loadAllPivotRates
  // (invocado desde GET /movements?month=...) llama a referenceRate.findMany
  referenceRate: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $queryRaw: jest.fn().mockResolvedValue([]),
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_A_ID = 'user-a-tx-e2e';
const USER_B_ID = 'user-b-tx-e2e';
const CAT_ID = 'cat-expense-e2e';

function makeDbCategory(overrides: Record<string, unknown> = {}) {
  return {
    id: CAT_ID,
    userId: USER_A_ID,
    name: 'Consumibles',
    scope: CategoryScope.EXPENSE,
    color: '#4F86C6',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeDbTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tx-e2e-001',
    userId: USER_A_ID,
    categoryId: CAT_ID,
    type: MovementType.EXPENSE,
    amountCents: 1500,
    description: null,
    occurredAt: new Date('2026-06-08T17:30:00Z'),
    timezone: 'America/Argentina/Buenos_Aires',
    createdAt: new Date(),
    updatedAt: new Date(),
    category: {
      id: CAT_ID,
      name: 'Consumibles',
      color: '#4F86C6',
      scope: CategoryScope.EXPENSE,
    },
    ...overrides,
  };
}

const VALID_CREATE_BODY = {
  type: 'EXPENSE',
  amountCents: 1500,
  categoryId: CAT_ID,
  occurredAt: '2026-06-08T14:30:00-03:00',
  timezone: 'America/Argentina/Buenos_Aires',
};

// ---------------------------------------------------------------------------
// Setup de la app de test
// ---------------------------------------------------------------------------

describe('Transactions (e2e)', () => {
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
    // user.findUnique / user.update: necesarios porque TransactionsService.create/update
    // llaman a SettingsService.getSettings (anchorCurrency, Fase 1.2.4) y
    // updateLastExchangeRate. Default ARS sin cotización previa; los tests de
    // multi-moneda sobreescriben este mock puntualmente.
    mockPrisma.user.findUnique.mockResolvedValue({
      id: USER_A_ID,
      defaultCurrency: 'ARS',
      lastExchangeRate: null,
    });
    mockPrisma.user.update.mockResolvedValue({
      id: USER_A_ID,
      defaultCurrency: 'ARS',
      lastExchangeRate: null,
    });
  });

  // -------------------------------------------------------------------------
  // POST /transactions
  // -------------------------------------------------------------------------

  describe('POST /transactions', () => {
    it('201 + sobre con transacción creada (shape con categoría embebida)', async () => {
      const cat = makeDbCategory();
      mockPrisma.category.findUnique.mockResolvedValue(cat);
      const tx = makeDbTransaction();
      mockPrisma.transaction.create.mockResolvedValue(tx);

      const res = await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(VALID_CREATE_BODY)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.statusCode).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('type', 'EXPENSE');
      expect(res.body.data).toHaveProperty('amountCents', 1500);
      expect(res.body.data).toHaveProperty('timezone', 'America/Argentina/Buenos_Aires');
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
        .post('/transactions')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(body)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 si amountCents es 0 (RN-002)', async () => {
      const res = await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_CREATE_BODY, amountCents: 0 })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
    });

    it('400 si amountCents es negativo (RN-002)', async () => {
      const res = await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_CREATE_BODY, amountCents: -100 })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 si amountCents excede el máximo de int4 (overflow de Postgres)', async () => {
      const res = await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_CREATE_BODY, amountCents: 999999999999999 })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
    });

    it('400 si occurredAt no es ISO 8601 válido', async () => {
      const res = await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_CREATE_BODY, occurredAt: 'no-es-fecha' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 si type es inválido', async () => {
      const res = await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_CREATE_BODY, type: 'INVALID' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 si falta categoryId', async () => {
      const { categoryId: _cat, ...body } = VALID_CREATE_BODY;
      const res = await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(body)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 si la categoría no existe (RN-010)', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(VALID_CREATE_BODY)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
    });

    it('400 si la categoría pertenece a otro usuario (aislamiento RN-003)', async () => {
      const catOtherUser = makeDbCategory({ userId: USER_B_ID });
      mockPrisma.category.findUnique.mockResolvedValue(catOtherUser);

      const res = await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(VALID_CREATE_BODY)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
    });

    it('400 si la categoría está eliminada (RN-010)', async () => {
      const deletedCat = makeDbCategory({ deletedAt: new Date('2024-01-01') });
      mockPrisma.category.findUnique.mockResolvedValue(deletedCat);

      const res = await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(VALID_CREATE_BODY)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
    });

    it('400 scope incompatible: categoría INCOME con movimiento EXPENSE (RN-010)', async () => {
      const incomeCat = makeDbCategory({ scope: CategoryScope.INCOME });
      mockPrisma.category.findUnique.mockResolvedValue(incomeCat);

      const res = await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_CREATE_BODY, type: 'EXPENSE' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
    });

    it('400 scope incompatible: categoría EXPENSE con movimiento INCOME (RN-010)', async () => {
      const expenseCat = makeDbCategory({ scope: CategoryScope.EXPENSE });
      mockPrisma.category.findUnique.mockResolvedValue(expenseCat);

      const res = await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_CREATE_BODY, type: 'INCOME' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('201 scope BOTH compatible con EXPENSE (RN-010)', async () => {
      const bothCat = makeDbCategory({ scope: CategoryScope.BOTH });
      mockPrisma.category.findUnique.mockResolvedValue(bothCat);
      mockPrisma.transaction.create.mockResolvedValue(makeDbTransaction());

      const res = await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_CREATE_BODY, type: 'EXPENSE' })
        .expect(201);

      expect(res.body.success).toBe(true);
    });

    it('201 scope BOTH compatible con INCOME (RN-010)', async () => {
      const bothCat = makeDbCategory({ scope: CategoryScope.BOTH });
      mockPrisma.category.findUnique.mockResolvedValue(bothCat);
      mockPrisma.transaction.create.mockResolvedValue(
        makeDbTransaction({ type: MovementType.INCOME }),
      );

      const res = await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_CREATE_BODY, type: 'INCOME' })
        .expect(201);

      expect(res.body.success).toBe(true);
    });

    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer())
        .post('/transactions')
        .send(VALID_CREATE_BODY)
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('whitelist: campo extra es rechazado (forbidNonWhitelisted)', async () => {
      const res = await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_CREATE_BODY, userId: 'malicious' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // GET /transactions (sin :id) — eliminado en Fase 5
  // El listado por mes migró a GET /movements?month=YYYY-MM
  // -------------------------------------------------------------------------

  describe('GET /transactions (listado por mes — eliminado en Fase 5)', () => {
    it('GET /transactions sin :id ya no existe como ruta de listado', async () => {
      // Sin :id y sin month/timezone, no hay ruta de listado en TransactionsController.
      // La solicitud GET /transactions sin parámetro de ruta :id
      // no tiene handler → NestJS devuelve 404.
      // (El endpoint de listado por mes fue eliminado en Fase 5 y reemplazado por GET /movements.)
      const res = await request(app.getHttpServer())
        .get('/transactions')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // GET /transactions/:id
  // -------------------------------------------------------------------------

  describe('GET /transactions/:id', () => {
    it('200 + sobre con transacción propia', async () => {
      const tx = makeDbTransaction();
      mockPrisma.transaction.findUnique.mockResolvedValue(tx);

      const res = await request(app.getHttpServer())
        .get('/transactions/tx-e2e-001')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id', 'tx-e2e-001');
      expect(res.body.data.category).toBeDefined();
    });

    it('404 si no existe', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .get('/transactions/no-existe')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('aislamiento: 404 si pertenece a otro usuario (RN-003)', async () => {
      const tx = makeDbTransaction({ userId: USER_B_ID });
      mockPrisma.transaction.findUnique.mockResolvedValue(tx);

      const res = await request(app.getHttpServer())
        .get('/transactions/tx-e2e-001')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer())
        .get('/transactions/tx-e2e-001')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /transactions/:id
  // -------------------------------------------------------------------------

  describe('PATCH /transactions/:id', () => {
    it('200 + sobre con transacción actualizada', async () => {
      const existing = makeDbTransaction();
      mockPrisma.transaction.findUnique.mockResolvedValue(existing);
      const updated = makeDbTransaction({ amountCents: 2000 });
      mockPrisma.transaction.update.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch('/transactions/tx-e2e-001')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ amountCents: 2000 })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.amountCents).toBe(2000);
    });

    it('400 si amountCents es 0 en PATCH (RN-002)', async () => {
      const existing = makeDbTransaction();
      mockPrisma.transaction.findUnique.mockResolvedValue(existing);

      const res = await request(app.getHttpServer())
        .patch('/transactions/tx-e2e-001')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ amountCents: 0 })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 si amountCents excede el máximo de int4 en PATCH (overflow de Postgres)', async () => {
      const existing = makeDbTransaction();
      mockPrisma.transaction.findUnique.mockResolvedValue(existing);

      const res = await request(app.getHttpServer())
        .patch('/transactions/tx-e2e-001')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ amountCents: 999999999999999 })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 scope incompatible al cambiar type (RN-010)', async () => {
      const existing = makeDbTransaction({ type: MovementType.EXPENSE });
      mockPrisma.transaction.findUnique.mockResolvedValue(existing);
      // Categoría actual es EXPENSE → incompatible con INCOME
      const expenseCat = makeDbCategory({ scope: CategoryScope.EXPENSE });
      mockPrisma.category.findUnique.mockResolvedValue(expenseCat);

      const res = await request(app.getHttpServer())
        .patch('/transactions/tx-e2e-001')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ type: 'INCOME' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(mockPrisma.transaction.update).not.toHaveBeenCalled();
    });

    it('400 scope incompatible al cambiar categoría (RN-010)', async () => {
      const existing = makeDbTransaction({ type: MovementType.EXPENSE });
      mockPrisma.transaction.findUnique.mockResolvedValue(existing);
      // Nueva categoría tiene scope INCOME → incompatible con EXPENSE
      const incomeCat = makeDbCategory({ scope: CategoryScope.INCOME, id: 'cat-income' });
      mockPrisma.category.findUnique.mockResolvedValue(incomeCat);

      const res = await request(app.getHttpServer())
        .patch('/transactions/tx-e2e-001')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ categoryId: 'cat-income' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('404 si no existe', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .patch('/transactions/no-existe')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ amountCents: 1000 })
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('aislamiento: 404 si pertenece a otro usuario (RN-003)', async () => {
      const tx = makeDbTransaction({ userId: USER_B_ID });
      mockPrisma.transaction.findUnique.mockResolvedValue(tx);

      const res = await request(app.getHttpServer())
        .patch('/transactions/tx-e2e-001')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ amountCents: 1000 })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(mockPrisma.transaction.update).not.toHaveBeenCalled();
    });

    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer())
        .patch('/transactions/tx-e2e-001')
        .send({ amountCents: 1000 })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /transactions/:id
  // -------------------------------------------------------------------------

  describe('DELETE /transactions/:id', () => {
    it('204 No Content al eliminar (hard delete)', async () => {
      const existing = makeDbTransaction();
      mockPrisma.transaction.findUnique.mockResolvedValue(existing);
      mockPrisma.transaction.delete.mockResolvedValue(existing);

      await request(app.getHttpServer())
        .delete('/transactions/tx-e2e-001')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(204);

      expect(mockPrisma.transaction.delete).toHaveBeenCalledWith({
        where: { id: 'tx-e2e-001' },
      });
    });

    it('404 si no existe', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .delete('/transactions/no-existe')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(mockPrisma.transaction.delete).not.toHaveBeenCalled();
    });

    it('aislamiento: 404 si pertenece a otro usuario (RN-003)', async () => {
      const tx = makeDbTransaction({ userId: USER_B_ID });
      mockPrisma.transaction.findUnique.mockResolvedValue(tx);

      const res = await request(app.getHttpServer())
        .delete('/transactions/tx-e2e-001')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(mockPrisma.transaction.delete).not.toHaveBeenCalled();
    });

    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer())
        .delete('/transactions/tx-e2e-001')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // POST /transactions/:id/skip (P3 — Fase 1.1.1.ext)
  // -------------------------------------------------------------------------

  describe('POST /transactions/:id/skip', () => {
    it('anula el único: skipped=false → true, sin body', async () => {
      const existing = makeDbTransaction({ skipped: false });
      mockPrisma.transaction.findUnique.mockResolvedValue(existing);
      mockPrisma.transaction.update.mockResolvedValue(makeDbTransaction({ skipped: true }));

      const res = await request(app.getHttpServer())
        .post('/transactions/tx-e2e-001/skip')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({});

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({ skipped: true });
      expect(mockPrisma.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tx-e2e-001' },
          data: { skipped: true },
        }),
      );
    });

    it('des-anula el único: skipped=true → false (toggle)', async () => {
      const existing = makeDbTransaction({ skipped: true });
      mockPrisma.transaction.findUnique.mockResolvedValue(existing);
      mockPrisma.transaction.update.mockResolvedValue(makeDbTransaction({ skipped: false }));

      const res = await request(app.getHttpServer())
        .post('/transactions/tx-e2e-001/skip')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({});

      expect(res.body.data).toEqual({ skipped: false });
      expect(mockPrisma.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { skipped: false } }),
      );
    });

    it('404 si el único no existe', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post('/transactions/no-existe/skip')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({})
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(mockPrisma.transaction.update).not.toHaveBeenCalled();
    });

    it('aislamiento: 404 si el único pertenece a otro usuario (RN-003)', async () => {
      const existing = makeDbTransaction({ userId: USER_B_ID, skipped: false });
      mockPrisma.transaction.findUnique.mockResolvedValue(existing);

      const res = await request(app.getHttpServer())
        .post('/transactions/tx-e2e-001/skip')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({})
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(mockPrisma.transaction.update).not.toHaveBeenCalled();
    });

    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer())
        .post('/transactions/tx-e2e-001/skip')
        .send({})
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Multi-moneda: currency y exchangeRate sobreviven al ValidationPipe
  // (Fase 1.2.3 — experimento decisivo para el bug de enum descartado)
  // -------------------------------------------------------------------------

  describe('POST /transactions — currency: "USD" sobrevive al ValidationPipe', () => {
    it('REPRODUCE-BUG: POST con currency "USD" → Prisma.create recibe currency=USD', async () => {
      const cat = makeDbCategory();
      mockPrisma.category.findUnique.mockResolvedValue(cat);
      const tx = makeDbTransaction({ currency: 'USD', exchangeRate: 1200 });
      mockPrisma.transaction.create.mockResolvedValue(tx);
      // updateLastExchangeRate llama a user.update — mock para no romper
      mockPrisma.user.update = jest.fn().mockResolvedValue({});
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue({ id: USER_A_ID });

      const res = await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          ...VALID_CREATE_BODY,
          currency: 'USD',
          exchangeRate: 1200,
        })
        .expect(201);

      expect(res.body.success).toBe(true);

      // Verificar que Prisma.transaction.create fue llamado con currency=USD
      // Si el enum se descarta, create se llama sin currency (o con ARS por default de DB)
      const createCall = mockPrisma.transaction.create.mock.calls[0][0] as {
        data: { currency?: string; exchangeRate?: number };
      };
      expect(createCall.data.currency).toBe('USD');
      expect(createCall.data.exchangeRate).toBe(1200);
    });

    it('400 si currency tiene valor inválido (PESO no es enum válido)', async () => {
      const res = await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_CREATE_BODY, currency: 'PESO' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });
});
