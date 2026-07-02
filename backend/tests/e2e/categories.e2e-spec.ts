/**
 * Tests e2e del CategoriesModule.
 *
 * Estrategia: mock de PrismaService (sin DB real en CI).
 * Cubre: sobre de respuesta, códigos HTTP, normalización RN-014,
 * flujo reactivable (shape exacto), aislamiento por userId,
 * soft delete, reactivate, edición con unicidad,
 * color editable (Fase 1.1.2): crear con color válido/inválido, editar color.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { CategoryScope } from '@prisma/client';
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
  $connect: jest.fn(),
  $disconnect: jest.fn(),
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_A_ID = 'user-a-e2e-id';
const USER_B_ID = 'user-b-e2e-id';

function makeDbCategory(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cat-e2e-001',
    userId: USER_A_ID,
    name: 'Consumibles',
    scope: CategoryScope.BOTH,
    color: '#E23B3B',
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

describe('Categories (e2e)', () => {
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

    // Generar tokens JWT para dos usuarios distintos
    jwtService = moduleFixture.get(JwtService);
    tokenA = jwtService.sign({ sub: USER_A_ID });
    tokenB = jwtService.sign({ sub: USER_B_ID });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockPrisma.category.createMany.mockResolvedValue({ count: 0 });
  });

  // -------------------------------------------------------------------------
  // GET /categories
  // -------------------------------------------------------------------------

  describe('GET /categories', () => {
    it('200 + sobre { success: true, data: [...] }', async () => {
      const cats = [makeDbCategory(), makeDbCategory({ id: 'cat-002', name: 'Servicios' })];
      mockPrisma.category.findMany.mockResolvedValue(cats);

      const res = await request(app.getHttpServer())
        .get('/categories')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });

    it('cada categoría incluye movementCount', async () => {
      const cat = makeDbCategory({
        _count: { transactions: 3, recurrings: 1, installmentGroups: 2 },
      });
      mockPrisma.category.findMany.mockResolvedValue([cat]);

      const res = await request(app.getHttpServer())
        .get('/categories')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.data[0].movementCount).toBe(6);
    });

    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer())
        .get('/categories')
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('aislamiento: usa userId del JWT, no del body/query', async () => {
      mockPrisma.category.findMany.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/categories')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      // Verificar que se usó userId B
      expect(mockPrisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: USER_B_ID }),
        }),
      );
    });

    it('lista vacía si no hay categorías', async () => {
      mockPrisma.category.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/categories')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.data).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // POST /categories
  // -------------------------------------------------------------------------

  describe('POST /categories', () => {
    const setupNoCollision = () => {
      // findByNormalizedName → sin colisión (findMany retorna vacío)
      mockPrisma.category.findMany
        .mockResolvedValueOnce([]) // para findByNormalizedName
        .mockResolvedValueOnce([]); // para countActiveByColor
    };

    it('201 + sobre con categoría creada', async () => {
      setupNoCollision();
      const created = makeDbCategory({ name: 'Nueva' });
      mockPrisma.category.create.mockResolvedValue(created);

      const res = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Nueva' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.statusCode).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('name');
      expect(res.body.data).toHaveProperty('color');
      expect(res.body.data).toHaveProperty('scope');
      expect(res.body.data).toHaveProperty('movementCount');
    });

    it('400 si el nombre está vacío', async () => {
      const res = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: '' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
    });

    it('400 si el nombre falta', async () => {
      const res = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ scope: 'BOTH' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 si el scope es inválido', async () => {
      const res = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Test', scope: 'INVALID' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 si se envía campo desconocido (whitelist)', async () => {
      const res = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Test', unknownField: 'oops' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    // --- Color en POST (Fase 1.1.2) ---

    it('201 con color válido de la matriz → se usa ese color', async () => {
      mockPrisma.category.findMany
        .mockResolvedValueOnce([]) // findByNormalizedName
        .mockResolvedValueOnce([]); // countActiveByColor (no debería llamarse, pero por si acaso)
      const colorElegido = '#8DB4ED'; // L2, válido
      const created = makeDbCategory({ name: 'Viajes', color: colorElegido });
      mockPrisma.category.create.mockResolvedValue(created);

      const res = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Viajes', color: colorElegido })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.color).toBe(colorElegido);
    });

    it('201 con color en minúsculas → se acepta (normalizado a mayúsculas)', async () => {
      mockPrisma.category.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      const created = makeDbCategory({ name: 'Test', color: '#8DB4ED' });
      mockPrisma.category.create.mockResolvedValue(created);

      const res = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Test', color: '#8db4ed' })
        .expect(201);

      expect(res.body.success).toBe(true);
    });

    it('400 si el color no pertenece a la matriz', async () => {
      const res = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Test', color: '#FF0000' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
      // El mensaje de error menciona la paleta
      const errorMessage: string =
        typeof res.body.error.message === 'string'
          ? res.body.error.message
          : Array.isArray(res.body.error.message)
            ? res.body.error.message.join(' ')
            : '';
      expect(errorMessage.toLowerCase()).toMatch(/paleta|color/i);
    });

    it('400 si el color es un hex arbitrario libre (no en la matriz)', async () => {
      const res = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Test', color: '#123456' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('colisión con activa → 409 con mensaje de duplicado (RN-008)', async () => {
      const activecat = makeDbCategory({ name: 'Consumibles' });
      // findByNormalizedName llama a findMany → retorna la activa
      mockPrisma.category.findMany.mockResolvedValueOnce([activecat]);

      const res = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'consumibles' }) // misma normalización
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(409);
      expect(res.body.error.message).toMatch(/ya existe/i);
      // Sin payload reactivable
      expect(res.body.error.data).toBeUndefined();
    });

    it('colisión con eliminada → 409 con payload reactivable (RF-CAT-002 A3)', async () => {
      const deletedCat = makeDbCategory({
        id: 'cat-deleted-id',
        name: 'Viajes',
        scope: CategoryScope.EXPENSE,
        color: '#E8863A',
        deletedAt: new Date('2024-01-01'),
      });
      mockPrisma.category.findMany.mockResolvedValue([deletedCat]);

      const res = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'viajes' })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(409);
      expect(res.body.error).toHaveProperty('data');
      expect(res.body.error.data.reactivable).toBe(true);
      expect(res.body.error.data.category.id).toBe('cat-deleted-id');
      expect(res.body.error.data.category.name).toBe('Viajes');
      expect(res.body.error.data.category.scope).toBe('EXPENSE');
      expect(res.body.error.data.category.color).toBe('#E8863A');
    });

    it('colisión por acentos con eliminada → 409 reactivable (RN-014)', async () => {
      const deletedCat = makeDbCategory({
        id: 'cat-acentos',
        name: 'Café',
        deletedAt: new Date(),
      });
      mockPrisma.category.findMany.mockResolvedValue([deletedCat]);

      const res = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'cafe' })
        .expect(409);

      expect(res.body.error.data.reactivable).toBe(true);
      expect(res.body.error.data.category.id).toBe('cat-acentos');
    });

    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'Test' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // POST /categories/:id/reactivate
  // -------------------------------------------------------------------------

  describe('POST /categories/:id/reactivate', () => {
    it('200 + sobre con categoría reactivada', async () => {
      const deletedCat = makeDbCategory({
        id: 'cat-del',
        deletedAt: new Date('2024-01-01'),
        scope: CategoryScope.EXPENSE,
        color: '#E8863A',
      });
      mockPrisma.category.findUnique.mockResolvedValue(deletedCat);
      const reactivated = { ...deletedCat, deletedAt: null };
      mockPrisma.category.update.mockResolvedValue(reactivated);

      const res = await request(app.getHttpServer())
        .post('/categories/cat-del/reactivate')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.statusCode).toBe(200);
      expect(res.body.data.deletedAt).toBeNull();
      expect(res.body.data.id).toBe('cat-del');
      expect(res.body.data.scope).toBe('EXPENSE');
      expect(res.body.data.color).toBe('#E8863A');
    });

    it('404 si la categoría no existe', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post('/categories/no-existe/reactivate')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('aislamiento: 404 si la categoría pertenece a otro usuario', async () => {
      const catOtherUser = makeDbCategory({ id: 'cat-b', userId: USER_B_ID, deletedAt: new Date() });
      mockPrisma.category.findUnique.mockResolvedValue(catOtherUser);

      const res = await request(app.getHttpServer())
        .post('/categories/cat-b/reactivate')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(mockPrisma.category.update).not.toHaveBeenCalled();
    });

    it('409 si la categoría ya está activa', async () => {
      const activecat = makeDbCategory({ id: 'cat-active', deletedAt: null });
      mockPrisma.category.findUnique.mockResolvedValue(activecat);

      const res = await request(app.getHttpServer())
        .post('/categories/cat-active/reactivate')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(409);

      expect(res.body.success).toBe(false);
    });

    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer())
        .post('/categories/cat-del/reactivate')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /categories/:id
  // -------------------------------------------------------------------------

  describe('PATCH /categories/:id', () => {
    it('200 + sobre con categoría actualizada', async () => {
      const existing = makeDbCategory({ id: 'cat-001', name: 'Viejo' });
      mockPrisma.category.findUnique.mockResolvedValue(existing);
      // findActiveExcluding → sin colisión
      mockPrisma.category.findMany.mockResolvedValue([]);
      const updated = { ...existing, name: 'Nuevo' };
      mockPrisma.category.update.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch('/categories/cat-001')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Nuevo' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Nuevo');
    });

    // --- Color en PATCH (Fase 1.1.2) ---

    it('200 editando color a un valor válido de la matriz', async () => {
      const existing = makeDbCategory({ id: 'cat-001', color: '#E23B3B' });
      mockPrisma.category.findUnique.mockResolvedValue(existing);
      const newColor = '#0C4F54'; // L5, válido
      const updated = { ...existing, color: newColor };
      mockPrisma.category.update.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch('/categories/cat-001')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ color: newColor })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.color).toBe(newColor);
    });

    it('200 editando color en minúsculas → aceptado (normalizado a mayúsculas)', async () => {
      const existing = makeDbCategory({ id: 'cat-001', color: '#E23B3B' });
      mockPrisma.category.findUnique.mockResolvedValue(existing);
      const updated = { ...existing, color: '#0C4F54' };
      mockPrisma.category.update.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch('/categories/cat-001')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ color: '#0c4f54' })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('400 si el color no pertenece a la matriz', async () => {
      const res = await request(app.getHttpServer())
        .patch('/categories/cat-001')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ color: '#FF0000' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
    });

    it('400 si el color es un hex arbitrario libre', async () => {
      const res = await request(app.getHttpServer())
        .patch('/categories/cat-001')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ color: '#123456' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 si se envía campo desconocido (whitelist)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/categories/cat-001')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ unknownField: 'oops' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('colisión de nombre → 409 (RN-014 + RN-008)', async () => {
      const existing = makeDbCategory({ id: 'cat-001', name: 'Mi Cat' });
      const otherActive = makeDbCategory({ id: 'cat-002', name: 'Servicios' });
      mockPrisma.category.findUnique.mockResolvedValue(existing);
      // findActiveExcluding retorna otra con el mismo nombre normalizado
      mockPrisma.category.findMany.mockResolvedValue([otherActive]);

      const res = await request(app.getHttpServer())
        .patch('/categories/cat-001')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'servicios' })
        .expect(409);

      expect(res.body.success).toBe(false);
    });

    it('colisión por acentos al editar → 409 (RN-014)', async () => {
      const existing = makeDbCategory({ id: 'cat-001', name: 'Mi Cat' });
      const otherActive = makeDbCategory({ id: 'cat-002', name: 'Café' });
      mockPrisma.category.findUnique.mockResolvedValue(existing);
      mockPrisma.category.findMany.mockResolvedValue([otherActive]);

      const res = await request(app.getHttpServer())
        .patch('/categories/cat-001')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'cafe' })
        .expect(409);

      expect(res.body.success).toBe(false);
    });

    it('404 si no existe o es de otro usuario', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .patch('/categories/no-existe')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Test' })
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('aislamiento: 404 si pertenece a otro usuario', async () => {
      const catOtherUser = makeDbCategory({ id: 'cat-b', userId: USER_B_ID });
      mockPrisma.category.findUnique.mockResolvedValue(catOtherUser);

      const res = await request(app.getHttpServer())
        .patch('/categories/cat-b')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Test' })
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer())
        .patch('/categories/cat-001')
        .send({ name: 'Test' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /categories/:id
  // -------------------------------------------------------------------------

  describe('DELETE /categories/:id', () => {
    it('204 No Content al eliminar (soft delete)', async () => {
      const existing = makeDbCategory({ id: 'cat-001' });
      mockPrisma.category.findUnique.mockResolvedValue(existing);
      mockPrisma.category.update.mockResolvedValue({ ...existing, deletedAt: new Date() });

      await request(app.getHttpServer())
        .delete('/categories/cat-001')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(204);
    });

    it('404 si no existe', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .delete('/categories/no-existe')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('aislamiento: 404 si pertenece a otro usuario', async () => {
      const catOtherUser = makeDbCategory({ id: 'cat-b', userId: USER_B_ID });
      mockPrisma.category.findUnique.mockResolvedValue(catOtherUser);

      const res = await request(app.getHttpServer())
        .delete('/categories/cat-b')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(mockPrisma.category.update).not.toHaveBeenCalled();
    });

    it('404 si ya está eliminada (no es idempotente)', async () => {
      const alreadyDeleted = makeDbCategory({ id: 'cat-del', deletedAt: new Date('2024-01-01') });
      mockPrisma.category.findUnique.mockResolvedValue(alreadyDeleted);

      const res = await request(app.getHttpServer())
        .delete('/categories/cat-del')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer())
        .delete('/categories/cat-001')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });
});
