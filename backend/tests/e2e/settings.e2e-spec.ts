/**
 * Tests e2e del SettingsModule.
 *
 * Estrategia: mock de PrismaService (sin DB real en CI).
 * Propósito principal: verificar que el ValidationPipe global
 * (whitelist + forbidNonWhitelisted + transform + enableImplicitConversion)
 * NO descarta ni corrompe el campo enum `defaultCurrency` al pasar por el pipe.
 *
 * Cubre:
 * - GET /settings: shape de respuesta
 * - PATCH /settings con defaultCurrency: "USD" → persiste USD (no queda en ARS)
 * - GET /settings tras el PATCH → defaultCurrency sigue siendo USD
 * - PATCH /settings con lastExchangeRate: 1450 → persiste
 * - PATCH con valor inválido de enum → 400
 * - 401 sin JWT
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { Currency } from '@prisma/client';
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
  recurringSkip: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  installmentGroup: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  transaction: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $queryRaw: jest.fn().mockResolvedValue([]),
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_A_ID = 'user-a-settings-e2e';

function makeDbUser(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_A_ID,
    email: 'user-a@test.com',
    name: 'User A',
    defaultCurrency: Currency.ARS,
    lastExchangeRate: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe('Settings (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let tokenA: string;

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

    // Replicar el mismo ValidationPipe que usa main.ts — este es el camino real
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
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.category.createMany.mockResolvedValue({ count: 0 });
    mockPrisma.userPreferences.findUnique.mockResolvedValue(null);
  });

  // -------------------------------------------------------------------------
  // GET /settings
  // -------------------------------------------------------------------------

  describe('GET /settings', () => {
    it('200 + sobre con defaultCurrency y lastExchangeRate', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(
        makeDbUser({ defaultCurrency: Currency.ARS, lastExchangeRate: null }),
      );

      const res = await request(app.getHttpServer())
        .get('/settings')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('defaultCurrency', 'ARS');
      expect(res.body.data).toHaveProperty('lastExchangeRate', null);
    });

    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer())
        .get('/settings')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /settings — caso principal: ¿el enum Currency sobrevive al pipe?
  // -------------------------------------------------------------------------

  describe('PATCH /settings', () => {
    it('REPRODUCE-BUG: PATCH con defaultCurrency "USD" → el service recibe USD, no ARS', async () => {
      // Simular usuario existente
      mockPrisma.user.findUnique.mockResolvedValue(makeDbUser());
      // El update devuelve USD (lo que el service debería pedir)
      mockPrisma.user.update.mockResolvedValue(
        makeDbUser({ defaultCurrency: Currency.USD }),
      );

      const res = await request(app.getHttpServer())
        .patch('/settings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ defaultCurrency: 'USD' })
        .expect(200);

      expect(res.body.success).toBe(true);
      // Verificar que la respuesta trae USD
      expect(res.body.data.defaultCurrency).toBe('USD');

      // Lo crítico: verificar que Prisma.user.update fue llamado con USD
      // Si el enum se descarta/corrompe, update se llama con ARS o sin el campo
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ defaultCurrency: 'USD' }),
        }),
      );
    });

    it('GET /settings tras PATCH USD → sigue siendo USD', async () => {
      // Simula que el usuario ya tiene USD guardado
      mockPrisma.user.findUnique.mockResolvedValue(
        makeDbUser({ defaultCurrency: Currency.USD }),
      );

      const res = await request(app.getHttpServer())
        .get('/settings')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.data.defaultCurrency).toBe('USD');
    });

    it('PATCH con lastExchangeRate: 1450 → persiste', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeDbUser());
      mockPrisma.user.update.mockResolvedValue(
        makeDbUser({ lastExchangeRate: 1450 }),
      );

      const res = await request(app.getHttpServer())
        .patch('/settings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ lastExchangeRate: 1450 })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.lastExchangeRate).toBe(1450);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lastExchangeRate: 1450 }),
        }),
      );
    });

    it('400 si defaultCurrency tiene valor inválido', async () => {
      const res = await request(app.getHttpServer())
        .patch('/settings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ defaultCurrency: 'GBP' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('400 si lastExchangeRate es negativo', async () => {
      const res = await request(app.getHttpServer())
        .patch('/settings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ lastExchangeRate: -100 })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('400 si se manda un campo no permitido (whitelist)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/settings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ defaultCurrency: 'ARS', userId: 'malicious' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer())
        .patch('/settings')
        .send({ defaultCurrency: 'USD' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });
});
