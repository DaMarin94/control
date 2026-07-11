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
    delete: jest.fn(),
  },
  // installmentGroup — necesario para InstallmentsModule (Fase 7 — registrado en AppModule)
  installmentGroup: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
    delete: jest.fn(),
  },
  // referenceRate — necesario porque MovementsRepository.loadAllPivotRates
  // (invocado desde GET /movements?month=...) llama a referenceRate.findMany
  referenceRate: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  $queryRaw: jest.fn(),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
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
    it('204 No Content — fromCurrentMonth=false (soft delete desde siguiente mes)', async () => {
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

      await request(app.getHttpServer())
        .delete('/recurring/rec-e2e-001?currentMonth=2026-06&fromCurrentMonth=false')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(204);

      expect(mockPrisma.recurring.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'rec-e2e-001' } }),
      );
    });

    it('204 No Content — fromCurrentMonth=true (soft delete desde mes actual)', async () => {
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

      await request(app.getHttpServer())
        .delete('/recurring/rec-e2e-001?currentMonth=2026-06&fromCurrentMonth=true')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(204);
    });

    it('204 No Content — hard delete cuando boundary <= startMonth', async () => {
      // startMonth='2026-06', currentMonth='2026-06', fromCurrentMonth=true → boundary='2026-06' → hard delete
      const existing = makeDbRecurring({ startMonth: '2026-06' });
      mockPrisma.recurring.findUnique.mockResolvedValue(existing);
      mockPrisma.recurring.delete.mockResolvedValue(existing);
      mockPrisma.recurring.findMany.mockImplementation((args: any) => {
        if (args?.where?.sourceMovementId?.not !== undefined) return Promise.resolve([]);
        if (args?.where?.sourceInstallmentGroupId?.not !== undefined) return Promise.resolve([]);
        if (args?.where?.sourceChainId !== undefined) return Promise.resolve([]);
        if (args?.where?.chainId !== undefined) return Promise.resolve([existing]);
        return Promise.resolve([]);
      });

      await request(app.getHttpServer())
        .delete('/recurring/rec-e2e-001?currentMonth=2026-06&fromCurrentMonth=true')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(204);

      expect(mockPrisma.recurring.delete).toHaveBeenCalledWith({
        where: { id: 'rec-e2e-001' },
      });
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
});
