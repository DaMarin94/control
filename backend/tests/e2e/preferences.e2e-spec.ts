/**
 * Tests e2e de PreferencesModule.
 *
 * Estrategia: mock de PrismaService (sin DB real en CI).
 * Cubre:
 * - GET /preferences: sobre de respuesta, blob actual, default {} sin fila
 * - PUT /preferences: sobre de respuesta, reemplazo del blob completo
 * - Validación de DTO: rechaza arrays, primitivos y blobs mal formados
 * - Aislamiento por usuario: tokens distintos no comparten estado
 * - 401 sin JWT
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
// Mock de PrismaService — sin DB real
// ---------------------------------------------------------------------------

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  category: {
    createMany: jest.fn().mockResolvedValue({ count: 4 }),
  },
  userPreferences: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    create: jest.fn(),
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

const USER_A_ID = 'user-a-prefs-e2e';
const USER_B_ID = 'user-b-prefs-e2e';

function makeDbPreferences(
  userId: string,
  data: Record<string, unknown> = {},
) {
  return {
    id: `prefs-${userId}`,
    userId,
    data,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe('Preferences (e2e)', () => {
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
  });

  // -------------------------------------------------------------------------
  // GET /preferences
  // -------------------------------------------------------------------------

  describe('GET /preferences', () => {
    it('200 + sobre { success: true, data: <blob> } cuando existe la fila', async () => {
      const blob = { monthSections: { collapsed: ['cuotas'] } };
      mockPrisma.userPreferences.findUnique.mockResolvedValue(
        makeDbPreferences(USER_A_ID, blob),
      );

      const res = await request(app.getHttpServer())
        .get('/preferences')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.statusCode).toBe(200);
      expect(res.body.data).toEqual(blob);
    });

    it('200 + data: {} cuando no existe fila (usuario previo a Fase 1.1.0)', async () => {
      mockPrisma.userPreferences.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .get('/preferences')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({});
    });

    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer())
        .get('/preferences')
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(401);
    });

    it('consulta con el userId del token — no mezcla con otro usuario', async () => {
      const blobA = { theme: 'dark' };
      const blobB = { theme: 'light' };

      // Primer llamado → user A, segundo → user B
      mockPrisma.userPreferences.findUnique
        .mockResolvedValueOnce(makeDbPreferences(USER_A_ID, blobA))
        .mockResolvedValueOnce(makeDbPreferences(USER_B_ID, blobB));

      const resA = await request(app.getHttpServer())
        .get('/preferences')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const resB = await request(app.getHttpServer())
        .get('/preferences')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      expect(resA.body.data).toEqual(blobA);
      expect(resB.body.data).toEqual(blobB);
      expect(resA.body.data).not.toEqual(resB.body.data);

      // Verificar que cada llamado usó el userId correcto
      expect(mockPrisma.userPreferences.findUnique).toHaveBeenCalledWith({
        where: { userId: USER_A_ID },
      });
      expect(mockPrisma.userPreferences.findUnique).toHaveBeenCalledWith({
        where: { userId: USER_B_ID },
      });
    });
  });

  // -------------------------------------------------------------------------
  // PUT /preferences
  // -------------------------------------------------------------------------

  describe('PUT /preferences', () => {
    it('200 + sobre { success: true, data: <blob actualizado> }', async () => {
      const newBlob = { monthSections: { order: ['fijos', 'unicos', 'cuotas'] } };
      mockPrisma.userPreferences.upsert.mockResolvedValue(
        makeDbPreferences(USER_A_ID, newBlob),
      );

      const res = await request(app.getHttpServer())
        .put('/preferences')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ data: newBlob })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.statusCode).toBe(200);
      expect(res.body.data).toEqual(newBlob);
    });

    it('200 con blob vacío {}', async () => {
      mockPrisma.userPreferences.upsert.mockResolvedValue(
        makeDbPreferences(USER_A_ID, {}),
      );

      const res = await request(app.getHttpServer())
        .put('/preferences')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ data: {} })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({});
    });

    it('400 si falta el campo data en el body', async () => {
      const res = await request(app.getHttpServer())
        .put('/preferences')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
    });

    it('400 si data es un array (no es objeto plano)', async () => {
      const res = await request(app.getHttpServer())
        .put('/preferences')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ data: ['a', 'b'] })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
    });

    it('400 si data es un string (no es objeto plano)', async () => {
      const res = await request(app.getHttpServer())
        .put('/preferences')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ data: 'string_value' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
    });

    it('400 si data es un número', async () => {
      const res = await request(app.getHttpServer())
        .put('/preferences')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ data: 42 })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
    });

    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer())
        .put('/preferences')
        .send({ data: { key: 'value' } })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(401);
    });

    it('usa el userId del token — no el de otro usuario', async () => {
      const blobForB = { reportCards: [] };
      mockPrisma.userPreferences.upsert.mockResolvedValue(
        makeDbPreferences(USER_B_ID, blobForB),
      );

      await request(app.getHttpServer())
        .put('/preferences')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ data: blobForB })
        .expect(200);

      expect(mockPrisma.userPreferences.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_B_ID },
        }),
      );
    });

    it('hace upsert — funciona para usuario sin fila previa (usuario viejo)', async () => {
      // El mock simula que el upsert devuelve la fila recién creada
      const newBlob = { key: 'initial' };
      mockPrisma.userPreferences.upsert.mockResolvedValue(
        makeDbPreferences(USER_A_ID, newBlob),
      );

      const res = await request(app.getHttpServer())
        .put('/preferences')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ data: newBlob })
        .expect(200);

      expect(res.body.data).toEqual(newBlob);
      // Verificar que se llamó upsert (no create ni update por separado)
      expect(mockPrisma.userPreferences.upsert).toHaveBeenCalled();
    });
  });
});
