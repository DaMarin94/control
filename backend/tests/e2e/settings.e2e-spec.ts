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
import { RateSyncService } from '../../src/settings/rate-sync.service';
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
  inflationRate: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  currencyQuote: {
    findMany: jest.fn(),
  },
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $queryRaw: jest.fn().mockResolvedValue([]),
};

// ---------------------------------------------------------------------------
// Mock de RateSyncService (para POST /settings/external-rates/sync)
// ---------------------------------------------------------------------------

const mockRateSyncService = {
  sync: jest.fn(),
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
      .overrideProvider(RateSyncService)
      .useValue(mockRateSyncService)
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
  // Fixtures — GET /settings/external-rates
  // -------------------------------------------------------------------------

  function makeIpcRow(yearMonth: string, variation: string, index: string) {
    return {
      yearMonth,
      monthlyVariation: variation,
      indexValue: index,
      source: 'apis.datos.gob.ar',
      fetchedAt: new Date('2026-07-01T12:00:00Z'),
    };
  }

  function makeFxRow(
    currency: Currency,
    variant: string,
    compra: string,
    venta: string,
  ) {
    return {
      currency,
      variant,
      yearMonth: '2026-07',
      compra,
      venta,
      source: currency === Currency.ARS ? 'dolarapi.com' : 'api.frankfurter.dev',
      fetchedAt: new Date('2026-07-10T09:00:00Z'),
    };
  }

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

  // -------------------------------------------------------------------------
  // GET /settings/external-rates
  // -------------------------------------------------------------------------

  describe('GET /settings/external-rates', () => {
    it('200 + sobre con ipc y fx', async () => {
      mockPrisma.inflationRate.findFirst
        .mockResolvedValueOnce(makeIpcRow('2026-07', '1.58', '450.2')) // latest
        .mockResolvedValueOnce({ id: 'older-1' }); // hasMore
      mockPrisma.inflationRate.findMany.mockResolvedValue([
        makeIpcRow('2026-07', '1.58', '450.2'),
        makeIpcRow('2026-01', '3.10', '410.0'),
      ]);
      mockPrisma.currencyQuote.findMany.mockResolvedValue([
        makeFxRow(Currency.ARS, 'oficial', '1200.00', '1250.00'),
        makeFxRow(Currency.ARS, 'blue', '1300.00', '1320.00'),
        makeFxRow(Currency.EUR, 'oficial', '0.86', '0.86'),
        makeFxRow(Currency.BRL, 'oficial', '5.4', '5.4'),
      ]);

      const res = await request(app.getHttpServer())
        .get('/settings/external-rates')
        .query({ today: '2026-07-14' })
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.ipc.latest).toMatchObject({
        yearMonth: '2026-07',
        monthlyVariation: 1.58,
        indexValue: 450.2,
      });
      expect(res.body.data.ipc.from).toBe('2026-01');
      expect(res.body.data.ipc.hasMore).toBe(true);
      expect(res.body.data.fx.month).toBe('2026-07');
      expect(res.body.data.fx.arsOficial).toMatchObject({ compra: 1200, venta: 1250 });
      expect(res.body.data.fx.arsBlue).toMatchObject({ compra: 1300, venta: 1320 });
      expect(res.body.data.fx.eur).toMatchObject({ compra: 0.86, venta: 0.86 });
      expect(res.body.data.fx.brl).toMatchObject({ compra: 5.4, venta: 5.4 });
    });

    it('cotización faltante para el mes → null, no rompe', async () => {
      mockPrisma.inflationRate.findFirst.mockResolvedValue(null);
      mockPrisma.inflationRate.findMany.mockResolvedValue([]);
      mockPrisma.currencyQuote.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/settings/external-rates')
        .query({ today: '2026-07-14' })
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.data.ipc.latest).toBeNull();
      expect(res.body.data.fx.arsOficial).toBeNull();
      expect(res.body.data.fx.arsBlue).toBeNull();
      expect(res.body.data.fx.eur).toBeNull();
      expect(res.body.data.fx.brl).toBeNull();
    });

    it('respeta ipcFrom explícito', async () => {
      mockPrisma.inflationRate.findFirst.mockResolvedValue(null);
      mockPrisma.inflationRate.findMany.mockResolvedValue([]);
      mockPrisma.currencyQuote.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/settings/external-rates')
        .query({ today: '2026-07-14', ipcFrom: '2020-01' })
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.data.ipc.from).toBe('2020-01');
    });

    it('400 si "today" tiene formato inválido', async () => {
      const res = await request(app.getHttpServer())
        .get('/settings/external-rates')
        .query({ today: '14-07-2026' })
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 si "ipcFrom" tiene formato inválido', async () => {
      const res = await request(app.getHttpServer())
        .get('/settings/external-rates')
        .query({ ipcFrom: '2026' })
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer())
        .get('/settings/external-rates')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // POST /settings/external-rates/sync
  // -------------------------------------------------------------------------

  describe('POST /settings/external-rates/sync', () => {
    it('200 + SyncResult cuando hay targets aceptados', async () => {
      mockRateSyncService.sync.mockResolvedValue({
        scope: 'all',
        results: [
          { target: 'CurrencyQuote:ARS:oficial:2026-07', accepted: true },
          { target: 'InflationRate:2026-07', accepted: true },
        ],
        acceptedCount: 2,
        rejectedCount: 0,
      });

      const res = await request(app.getHttpServer())
        .post('/settings/external-rates/sync')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.acceptedCount).toBe(2);
      expect(res.body.data.rejectedCount).toBe(0);
      expect(mockRateSyncService.sync).toHaveBeenCalledWith('all');
    });

    it('422 cuando todos los targets son rechazados por validación', async () => {
      mockRateSyncService.sync.mockResolvedValue({
        scope: 'all',
        results: [
          { target: 'InflationRate:2026-07', accepted: false, reason: 'circuit-breaker' },
        ],
        acceptedCount: 0,
        rejectedCount: 1,
      });

      const res = await request(app.getHttpServer())
        .post('/settings/external-rates/sync')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(422);

      expect(res.body.success).toBe(false);
    });

    it('502 cuando todos los targets son rechazados por fuente caída', async () => {
      mockRateSyncService.sync.mockResolvedValue({
        scope: 'all',
        results: [
          { target: 'CurrencyQuote:ARS:oficial:2026-07', accepted: false, reason: 'http-error' },
        ],
        acceptedCount: 0,
        rejectedCount: 1,
      });

      const res = await request(app.getHttpServer())
        .post('/settings/external-rates/sync')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(502);

      expect(res.body.success).toBe(false);
    });

    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer())
        .post('/settings/external-rates/sync')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });
});
