/**
 * Tests e2e del PaymentMethodsModule (P4).
 *
 * Estrategia: mock de PrismaService (sin DB real en CI). Espejo de categories.e2e-spec.ts.
 * Cubre: sobre de respuesta, códigos HTTP, normalización RN-014,
 * flujo reactivable (shape exacto), aislamiento por userId,
 * soft delete, reactivate, edición con unicidad y campos condicionales por tipo,
 * validación de tipo obligatorio (sin preselección) e ícono con fallback.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
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
  paymentMethod: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  // userPreferences — necesario para PreferencesModule
  userPreferences: {
    findUnique: jest.fn().mockResolvedValue(null),
    upsert: jest.fn(),
    create: jest.fn().mockResolvedValue({ id: 'prefs-1', userId: 'u', data: {}, createdAt: new Date(), updatedAt: new Date() }),
  },
  // category — necesario para CategoriesModule (registrado en AppModule)
  category: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  // recurring — necesario para RecurringModule (registrado en AppModule)
  recurring: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  recurringSkip: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  // installmentGroup — necesario para InstallmentsModule (registrado en AppModule)
  installmentGroup: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $connect: jest.fn(),
  $disconnect: jest.fn(),
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_A_ID = 'user-a-pm-e2e';
const USER_B_ID = 'user-b-pm-e2e';

function makeDbPaymentMethod(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pm-e2e-001',
    userId: USER_A_ID,
    name: 'Visa Crédito',
    type: 'CREDIT',
    closingDay: 10,
    paymentDay: 20,
    icon: 'visa',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { transactions: 0, recurrings: 0, installmentGroups: 0 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup de la app de test
// ---------------------------------------------------------------------------

describe('PaymentMethods (e2e)', () => {
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
    jest.resetAllMocks();
  });

  // -------------------------------------------------------------------------
  // GET /payment-methods
  // -------------------------------------------------------------------------

  describe('GET /payment-methods', () => {
    it('200 + sobre { success: true, data: [...] }', async () => {
      const methods = [makeDbPaymentMethod(), makeDbPaymentMethod({ id: 'pm-002', name: 'Efectivo', type: 'CASH' })];
      mockPrisma.paymentMethod.findMany.mockResolvedValue(methods);

      const res = await request(app.getHttpServer())
        .get('/payment-methods')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });

    it('cada método incluye movementCount', async () => {
      const method = makeDbPaymentMethod({
        _count: { transactions: 3, recurrings: 1, installmentGroups: 2 },
      });
      mockPrisma.paymentMethod.findMany.mockResolvedValue([method]);

      const res = await request(app.getHttpServer())
        .get('/payment-methods')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.data[0].movementCount).toBe(6);
    });

    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer())
        .get('/payment-methods')
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('aislamiento: usa userId del JWT, no del body/query', async () => {
      mockPrisma.paymentMethod.findMany.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/payment-methods')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      expect(mockPrisma.paymentMethod.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: USER_B_ID }),
        }),
      );
    });

    it('lista vacía si no hay métodos (cuenta nueva sin métodos por defecto)', async () => {
      mockPrisma.paymentMethod.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/payment-methods')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.data).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // POST /payment-methods
  // -------------------------------------------------------------------------

  describe('POST /payment-methods', () => {
    const setupNoCollision = () => {
      mockPrisma.paymentMethod.findMany.mockResolvedValueOnce([]); // findByNormalizedName
    };

    it('201 + sobre con método creado (CREDIT con closingDay/paymentDay)', async () => {
      setupNoCollision();
      const created = makeDbPaymentMethod({ name: 'Visa', type: 'CREDIT', closingDay: 5, paymentDay: 15 });
      mockPrisma.paymentMethod.create.mockResolvedValue(created);

      const res = await request(app.getHttpServer())
        .post('/payment-methods')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Visa', type: 'CREDIT', closingDay: 5, paymentDay: 15 })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.statusCode).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('type', 'CREDIT');
      expect(res.body.data).toHaveProperty('icon');
      expect(res.body.data).toHaveProperty('closingDay');
      expect(res.body.data).toHaveProperty('paymentDay');
      expect(res.body.data).toHaveProperty('movementCount');
      // Sin campo color (a diferencia de categorías) ni autoDebit (vive en el movimiento — P4)
      expect(res.body.data).not.toHaveProperty('color');
      expect(res.body.data).not.toHaveProperty('autoDebit');
    });

    it('201 método CASH sin campos condicionales', async () => {
      setupNoCollision();
      const created = makeDbPaymentMethod({ name: 'Efectivo', type: 'CASH', closingDay: null, paymentDay: null });
      mockPrisma.paymentMethod.create.mockResolvedValue(created);

      const res = await request(app.getHttpServer())
        .post('/payment-methods')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Efectivo', type: 'CASH' })
        .expect(201);

      expect(res.body.data.type).toBe('CASH');
      expect(res.body.data.closingDay).toBeNull();
      expect(res.body.data.paymentDay).toBeNull();
    });

    it('400 si se envía autoDebit (whitelist — vive en el movimiento, no en el método)', async () => {
      const res = await request(app.getHttpServer())
        .post('/payment-methods')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Débito', type: 'DEBIT', autoDebit: true })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 si el nombre está vacío', async () => {
      const res = await request(app.getHttpServer())
        .post('/payment-methods')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: '', type: 'CASH' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
    });

    it('400 si el tipo falta (obligatorio, sin preselección)', async () => {
      const res = await request(app.getHttpServer())
        .post('/payment-methods')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Test' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 si el tipo es inválido (fuera de la allowlist)', async () => {
      const res = await request(app.getHttpServer())
        .post('/payment-methods')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Test', type: 'BITCOIN' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 si se envía campo desconocido (whitelist)', async () => {
      const res = await request(app.getHttpServer())
        .post('/payment-methods')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Test', type: 'CASH', unknownField: 'oops' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 si closingDay está fuera de 1-31', async () => {
      const res = await request(app.getHttpServer())
        .post('/payment-methods')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Visa', type: 'CREDIT', closingDay: 32 })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('201 con icon fuera del set curado → fallback a "card" (RF-PM-004)', async () => {
      setupNoCollision();
      const created = makeDbPaymentMethod({ name: 'Efectivo', type: 'CASH', icon: 'card' });
      mockPrisma.paymentMethod.create.mockResolvedValue(created);

      const res = await request(app.getHttpServer())
        .post('/payment-methods')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Efectivo', type: 'CASH', icon: 'marca-inexistente' })
        .expect(201);

      expect(res.body.data.icon).toBe('card');
    });

    it('colisión con activo → 409 con mensaje de duplicado (espejo RN-008)', async () => {
      const active = makeDbPaymentMethod({ name: 'Visa Crédito' });
      mockPrisma.paymentMethod.findMany.mockResolvedValueOnce([active]);

      const res = await request(app.getHttpServer())
        .post('/payment-methods')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'visa crédito', type: 'CREDIT' })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(409);
      expect(res.body.error.message).toMatch(/ya existe/i);
      expect(res.body.error.data).toBeUndefined();
    });

    it('colisión con eliminado → 409 con payload reactivable (RF-PM-001, A4)', async () => {
      const deleted = makeDbPaymentMethod({
        id: 'pm-deleted-id',
        name: 'Viejo Débito',
        type: 'DEBIT',
        icon: 'bank',
        deletedAt: new Date('2024-01-01'),
      });
      mockPrisma.paymentMethod.findMany.mockResolvedValueOnce([deleted]);

      const res = await request(app.getHttpServer())
        .post('/payment-methods')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'viejo débito', type: 'DEBIT' })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(409);
      expect(res.body.error).toHaveProperty('data');
      expect(res.body.error.data.reactivable).toBe(true);
      expect(res.body.error.data.paymentMethod.id).toBe('pm-deleted-id');
      expect(res.body.error.data.paymentMethod.name).toBe('Viejo Débito');
      expect(res.body.error.data.paymentMethod.type).toBe('DEBIT');
      expect(res.body.error.data.paymentMethod.icon).toBe('bank');
    });

    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer())
        .post('/payment-methods')
        .send({ name: 'Test', type: 'CASH' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // POST /payment-methods/:id/reactivate
  // -------------------------------------------------------------------------

  describe('POST /payment-methods/:id/reactivate', () => {
    it('200 + sobre con método reactivado', async () => {
      const deleted = makeDbPaymentMethod({
        id: 'pm-del',
        deletedAt: new Date('2024-01-01'),
        type: 'DEBIT',
        icon: 'bank',
      });
      mockPrisma.paymentMethod.findUnique.mockResolvedValue(deleted);
      const reactivated = { ...deleted, deletedAt: null };
      mockPrisma.paymentMethod.update.mockResolvedValue(reactivated);

      const res = await request(app.getHttpServer())
        .post('/payment-methods/pm-del/reactivate')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.deletedAt).toBeNull();
      expect(res.body.data.id).toBe('pm-del');
      expect(res.body.data.type).toBe('DEBIT');
      expect(res.body.data.icon).toBe('bank');
    });

    it('404 si el método no existe', async () => {
      mockPrisma.paymentMethod.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post('/payment-methods/no-existe/reactivate')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('aislamiento: 404 si el método pertenece a otro usuario', async () => {
      const otherUser = makeDbPaymentMethod({ id: 'pm-b', userId: USER_B_ID, deletedAt: new Date() });
      mockPrisma.paymentMethod.findUnique.mockResolvedValue(otherUser);

      const res = await request(app.getHttpServer())
        .post('/payment-methods/pm-b/reactivate')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(mockPrisma.paymentMethod.update).not.toHaveBeenCalled();
    });

    it('409 si el método ya está activo', async () => {
      const active = makeDbPaymentMethod({ id: 'pm-active', deletedAt: null });
      mockPrisma.paymentMethod.findUnique.mockResolvedValue(active);

      const res = await request(app.getHttpServer())
        .post('/payment-methods/pm-active/reactivate')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(409);

      expect(res.body.success).toBe(false);
    });

    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer())
        .post('/payment-methods/pm-del/reactivate')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /payment-methods/:id
  // -------------------------------------------------------------------------

  describe('PATCH /payment-methods/:id', () => {
    it('200 + sobre con método actualizado (nombre)', async () => {
      const existing = makeDbPaymentMethod({ id: 'pm-001', name: 'Viejo' });
      mockPrisma.paymentMethod.findUnique.mockResolvedValue(existing);
      mockPrisma.paymentMethod.findMany.mockResolvedValue([]); // findActiveExcluding
      const updated = { ...existing, name: 'Nuevo' };
      mockPrisma.paymentMethod.update.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch('/payment-methods/pm-001')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Nuevo' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Nuevo');
    });

    it('200 cambiando de CREDIT a DEBIT descarta closingDay/paymentDay', async () => {
      const existing = makeDbPaymentMethod({ id: 'pm-001', type: 'CREDIT', closingDay: 10, paymentDay: 20 });
      mockPrisma.paymentMethod.findUnique.mockResolvedValue(existing);
      const updated = { ...existing, type: 'DEBIT', closingDay: null, paymentDay: null };
      mockPrisma.paymentMethod.update.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch('/payment-methods/pm-001')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ type: 'DEBIT' })
        .expect(200);

      expect(res.body.data.type).toBe('DEBIT');
      expect(res.body.data.closingDay).toBeNull();
      expect(res.body.data.paymentDay).toBeNull();
      expect(mockPrisma.paymentMethod.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'DEBIT',
            closingDay: null,
            paymentDay: null,
          }),
        }),
      );
    });

    it('400 si se envía autoDebit en PATCH (whitelist — vive en el movimiento, no en el método)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/payment-methods/pm-001')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ autoDebit: true })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 si se envía campo desconocido (whitelist)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/payment-methods/pm-001')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ unknownField: 'oops' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('colisión de nombre → 409 (RN-014 + RN-008)', async () => {
      const existing = makeDbPaymentMethod({ id: 'pm-001', name: 'Mi método' });
      const other = makeDbPaymentMethod({ id: 'pm-002', name: 'Efectivo' });
      mockPrisma.paymentMethod.findUnique.mockResolvedValue(existing);
      mockPrisma.paymentMethod.findMany.mockResolvedValue([other]);

      const res = await request(app.getHttpServer())
        .patch('/payment-methods/pm-001')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'efectivo' })
        .expect(409);

      expect(res.body.success).toBe(false);
    });

    it('404 si no existe o es de otro usuario', async () => {
      mockPrisma.paymentMethod.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .patch('/payment-methods/no-existe')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Test' })
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('aislamiento: 404 si pertenece a otro usuario', async () => {
      const otherUser = makeDbPaymentMethod({ id: 'pm-b', userId: USER_B_ID });
      mockPrisma.paymentMethod.findUnique.mockResolvedValue(otherUser);

      const res = await request(app.getHttpServer())
        .patch('/payment-methods/pm-b')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Test' })
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer())
        .patch('/payment-methods/pm-001')
        .send({ name: 'Test' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /payment-methods/:id
  // -------------------------------------------------------------------------

  describe('DELETE /payment-methods/:id', () => {
    it('204 No Content al eliminar (soft delete)', async () => {
      const existing = makeDbPaymentMethod({ id: 'pm-001' });
      mockPrisma.paymentMethod.findUnique.mockResolvedValue(existing);
      mockPrisma.paymentMethod.update.mockResolvedValue({ ...existing, deletedAt: new Date() });

      await request(app.getHttpServer())
        .delete('/payment-methods/pm-001')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(204);
    });

    it('404 si no existe', async () => {
      mockPrisma.paymentMethod.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .delete('/payment-methods/no-existe')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('aislamiento: 404 si pertenece a otro usuario', async () => {
      const otherUser = makeDbPaymentMethod({ id: 'pm-b', userId: USER_B_ID });
      mockPrisma.paymentMethod.findUnique.mockResolvedValue(otherUser);

      const res = await request(app.getHttpServer())
        .delete('/payment-methods/pm-b')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(mockPrisma.paymentMethod.update).not.toHaveBeenCalled();
    });

    it('404 si ya está eliminado (no es idempotente)', async () => {
      const alreadyDeleted = makeDbPaymentMethod({ id: 'pm-del', deletedAt: new Date('2024-01-01') });
      mockPrisma.paymentMethod.findUnique.mockResolvedValue(alreadyDeleted);

      const res = await request(app.getHttpServer())
        .delete('/payment-methods/pm-del')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer())
        .delete('/payment-methods/pm-001')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });
});
