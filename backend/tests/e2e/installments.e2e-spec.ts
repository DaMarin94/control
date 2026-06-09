/**
 * Tests e2e del InstallmentsModule.
 *
 * Estrategia: mock de PrismaService (sin DB real en CI).
 *
 * Cubre:
 * - POST /installments: 201 + shape con categoría embebida
 * - POST /installments: solo EXPENSE (INCOME → 400)
 * - POST /installments: validaciones de DTO (amountCents, totalInstallments, startMonth)
 * - POST /installments: 400 categoría inexistente / ajena / eliminada / scope incompatible
 * - PATCH /installments/:id: 200 in-place + shape
 * - PATCH /installments/:id: 404 si no existe / es de otro usuario
 * - DELETE /installments/:id: 204, 404
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
  recurring: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
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

const USER_A_ID = 'user-a-inst-e2e';
const USER_B_ID = 'user-b-inst-e2e';
const CAT_ID = 'cat-expense-inst-e2e';
const GROUP_ID = 'group-e2e-001';

function makeDbCategory(overrides: Record<string, unknown> = {}) {
  return {
    id: CAT_ID,
    userId: USER_A_ID,
    name: 'Electrónica',
    scope: CategoryScope.EXPENSE,
    color: '#4F86C6',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeDbInstallmentGroup(overrides: Record<string, unknown> = {}) {
  return {
    id: GROUP_ID,
    userId: USER_A_ID,
    categoryId: CAT_ID,
    type: MovementType.EXPENSE,
    amountCents: 5000,
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

const VALID_CREATE_BODY = {
  type: 'EXPENSE',
  amountCents: 5000,
  totalInstallments: 12,
  categoryId: CAT_ID,
  startMonth: '2026-01',
};

// ---------------------------------------------------------------------------
// Setup de la app de test
// ---------------------------------------------------------------------------

describe('Installments (e2e)', () => {
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
  });

  // -------------------------------------------------------------------------
  // POST /installments
  // -------------------------------------------------------------------------

  describe('POST /installments', () => {
    it('201 + sobre con shape de InstallmentGroup (categoría embebida)', async () => {
      const cat = makeDbCategory();
      mockPrisma.category.findUnique.mockResolvedValue(cat);
      const group = makeDbInstallmentGroup();
      mockPrisma.installmentGroup.create.mockResolvedValue(group);

      const res = await request(app.getHttpServer())
        .post('/installments')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(VALID_CREATE_BODY)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.statusCode).toBe(201);

      const data = res.body.data;
      expect(data).toHaveProperty('id', GROUP_ID);
      expect(data).toHaveProperty('type', 'EXPENSE');
      expect(data).toHaveProperty('amountCents', 5000);
      expect(data).toHaveProperty('totalInstallments', 12);
      expect(data).toHaveProperty('startMonth', '2026-01');
      expect(data).toHaveProperty('description', null);

      // Categoría embebida
      expect(data.category).toBeDefined();
      expect(data.category).toHaveProperty('id', CAT_ID);
      expect(data.category).toHaveProperty('name', 'Electrónica');
      expect(data.category).toHaveProperty('color', '#4F86C6');
      expect(data.category).toHaveProperty('scope', 'EXPENSE');
    });

    it('201 + con descripción opcional', async () => {
      const cat = makeDbCategory();
      mockPrisma.category.findUnique.mockResolvedValue(cat);
      const group = makeDbInstallmentGroup({ description: 'Smart TV' });
      mockPrisma.installmentGroup.create.mockResolvedValue(group);

      const res = await request(app.getHttpServer())
        .post('/installments')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_CREATE_BODY, description: 'Smart TV' })
        .expect(201);

      expect(res.body.data.description).toBe('Smart TV');
    });

    it('400 si type es INCOME (solo EXPENSE en v1 — decisión D1)', async () => {
      const res = await request(app.getHttpServer())
        .post('/installments')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_CREATE_BODY, type: 'INCOME' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
      expect(mockPrisma.installmentGroup.create).not.toHaveBeenCalled();
    });

    it('400 si amountCents es 0', async () => {
      const res = await request(app.getHttpServer())
        .post('/installments')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_CREATE_BODY, amountCents: 0 })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 si amountCents es negativo', async () => {
      const res = await request(app.getHttpServer())
        .post('/installments')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_CREATE_BODY, amountCents: -500 })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 si totalInstallments es 0', async () => {
      const res = await request(app.getHttpServer())
        .post('/installments')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_CREATE_BODY, totalInstallments: 0 })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 si startMonth tiene formato inválido', async () => {
      const res = await request(app.getHttpServer())
        .post('/installments')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_CREATE_BODY, startMonth: '202601' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 si startMonth tiene mes inválido (2026-00)', async () => {
      const cat = makeDbCategory();
      mockPrisma.category.findUnique.mockResolvedValue(cat);

      const res = await request(app.getHttpServer())
        .post('/installments')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_CREATE_BODY, startMonth: '2026-00' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 si categoryId falta', async () => {
      const { categoryId: _removed, ...bodyWithout } = VALID_CREATE_BODY;
      const res = await request(app.getHttpServer())
        .post('/installments')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(bodyWithout)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 si categoría inexistente (RN-010)', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post('/installments')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(VALID_CREATE_BODY)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(mockPrisma.installmentGroup.create).not.toHaveBeenCalled();
    });

    it('400 si categoría de otro usuario (aislamiento RN-003 — misma respuesta que inexistente)', async () => {
      const catOtherUser = makeDbCategory({ userId: USER_B_ID });
      mockPrisma.category.findUnique.mockResolvedValue(catOtherUser);

      const res = await request(app.getHttpServer())
        .post('/installments')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(VALID_CREATE_BODY)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(mockPrisma.installmentGroup.create).not.toHaveBeenCalled();
    });

    it('400 si categoría eliminada (RN-010)', async () => {
      const deletedCat = makeDbCategory({ deletedAt: new Date('2025-01-01') });
      mockPrisma.category.findUnique.mockResolvedValue(deletedCat);

      const res = await request(app.getHttpServer())
        .post('/installments')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(VALID_CREATE_BODY)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(mockPrisma.installmentGroup.create).not.toHaveBeenCalled();
    });

    it('400 si scope incompatible EXPENSE con categoría INCOME (RN-010)', async () => {
      const incomeCat = makeDbCategory({ scope: CategoryScope.INCOME });
      mockPrisma.category.findUnique.mockResolvedValue(incomeCat);

      const res = await request(app.getHttpServer())
        .post('/installments')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(VALID_CREATE_BODY)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(mockPrisma.installmentGroup.create).not.toHaveBeenCalled();
    });

    it('201 con categoría scope BOTH (compatible con EXPENSE)', async () => {
      const bothCat = makeDbCategory({ scope: CategoryScope.BOTH });
      mockPrisma.category.findUnique.mockResolvedValue(bothCat);
      const group = makeDbInstallmentGroup();
      mockPrisma.installmentGroup.create.mockResolvedValue(group);

      const res = await request(app.getHttpServer())
        .post('/installments')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(VALID_CREATE_BODY)
        .expect(201);

      expect(res.body.success).toBe(true);
    });

    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer())
        .post('/installments')
        .send(VALID_CREATE_BODY)
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /installments/:id
  // -------------------------------------------------------------------------

  describe('PATCH /installments/:id', () => {
    it('200 + shape actualizado (amountCents)', async () => {
      const existing = makeDbInstallmentGroup();
      mockPrisma.installmentGroup.findUnique.mockResolvedValue(existing);
      const updated = makeDbInstallmentGroup({ amountCents: 8000 });
      mockPrisma.installmentGroup.update.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch(`/installments/${GROUP_ID}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ amountCents: 8000 })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.amountCents).toBe(8000);
      expect(res.body.data.category).toBeDefined();
    });

    it('200 + shape actualizado (totalInstallments)', async () => {
      const existing = makeDbInstallmentGroup();
      mockPrisma.installmentGroup.findUnique.mockResolvedValue(existing);
      const updated = makeDbInstallmentGroup({ totalInstallments: 6 });
      mockPrisma.installmentGroup.update.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch(`/installments/${GROUP_ID}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ totalInstallments: 6 })
        .expect(200);

      expect(res.body.data.totalInstallments).toBe(6);
    });

    it('200 + shape actualizado (startMonth)', async () => {
      const existing = makeDbInstallmentGroup();
      mockPrisma.installmentGroup.findUnique.mockResolvedValue(existing);
      const updated = makeDbInstallmentGroup({ startMonth: '2026-06' });
      mockPrisma.installmentGroup.update.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch(`/installments/${GROUP_ID}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ startMonth: '2026-06' })
        .expect(200);

      expect(res.body.data.startMonth).toBe('2026-06');
    });

    it('200 + cambia categoría con revalidación', async () => {
      const NEW_CAT_ID = 'cat-new-id';
      const existing = makeDbInstallmentGroup();
      mockPrisma.installmentGroup.findUnique.mockResolvedValue(existing);

      // Revalidar la nueva categoría
      const newCat = makeDbCategory({ id: NEW_CAT_ID });
      mockPrisma.category.findUnique.mockResolvedValue(newCat);

      const updated = makeDbInstallmentGroup({ categoryId: NEW_CAT_ID });
      mockPrisma.installmentGroup.update.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch(`/installments/${GROUP_ID}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ categoryId: NEW_CAT_ID })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('400 si startMonth tiene mes inválido (2026-13)', async () => {
      const existing = makeDbInstallmentGroup();
      mockPrisma.installmentGroup.findUnique.mockResolvedValue(existing);

      const res = await request(app.getHttpServer())
        .patch(`/installments/${GROUP_ID}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ startMonth: '2026-13' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 si nueva categoría no existe', async () => {
      const existing = makeDbInstallmentGroup();
      mockPrisma.installmentGroup.findUnique.mockResolvedValue(existing);
      mockPrisma.category.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .patch(`/installments/${GROUP_ID}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ categoryId: 'no-existe' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(mockPrisma.installmentGroup.update).not.toHaveBeenCalled();
    });

    it('404 si no existe', async () => {
      mockPrisma.installmentGroup.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .patch('/installments/no-existe')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ amountCents: 1000 })
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('aislamiento: 404 si pertenece a otro usuario (RN-003)', async () => {
      const group = makeDbInstallmentGroup({ userId: USER_B_ID });
      mockPrisma.installmentGroup.findUnique.mockResolvedValue(group);

      const res = await request(app.getHttpServer())
        .patch(`/installments/${GROUP_ID}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ amountCents: 1000 })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(mockPrisma.installmentGroup.update).not.toHaveBeenCalled();
    });

    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/installments/${GROUP_ID}`)
        .send({ amountCents: 1000 })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /installments/:id
  // -------------------------------------------------------------------------

  describe('DELETE /installments/:id', () => {
    it('204 sin cuerpo (hard delete)', async () => {
      const group = makeDbInstallmentGroup();
      mockPrisma.installmentGroup.findUnique.mockResolvedValue(group);
      mockPrisma.installmentGroup.delete.mockResolvedValue(group);

      await request(app.getHttpServer())
        .delete(`/installments/${GROUP_ID}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(204);

      expect(mockPrisma.installmentGroup.delete).toHaveBeenCalled();
    });

    it('404 si no existe', async () => {
      mockPrisma.installmentGroup.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .delete('/installments/no-existe')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(mockPrisma.installmentGroup.delete).not.toHaveBeenCalled();
    });

    it('aislamiento: 404 si pertenece a otro usuario (RN-003)', async () => {
      const group = makeDbInstallmentGroup({ userId: USER_B_ID });
      mockPrisma.installmentGroup.findUnique.mockResolvedValue(group);

      const res = await request(app.getHttpServer())
        .delete(`/installments/${GROUP_ID}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(mockPrisma.installmentGroup.delete).not.toHaveBeenCalled();
    });

    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/installments/${GROUP_ID}`)
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });
});
