/**
 * Tests e2e del HistoryModule (Módulo 3.14 — RF-HIST-001..006).
 *
 * Estrategia: mock de PrismaService (sin DB real en CI) — igual que el resto
 * de la suite e2e. El comportamiento de filtrado SQL real (RF-HIST-006) se
 * cubre aparte con un test de integración contra Postgres real, ver
 * tests/unit/history/movements-soft-delete.integration.spec.ts.
 *
 * Cubre:
 * - GET /history: 200 + sobre, lista vacía, 401 sin JWT.
 * - POST /history/:id/undo: 404 si no existe / no es del usuario, 401 sin JWT.
 * - Aislamiento por userId (RN-003): un usuario no ve ni puede deshacer
 *   entradas de otro.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { HistoryAction, HistoryTargetKind } from '@prisma/client';
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
    findMany: jest.fn().mockResolvedValue([]),
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
  userPreferences: {
    findUnique: jest.fn().mockResolvedValue(null),
    upsert: jest.fn(),
    create: jest.fn().mockResolvedValue({ id: 'prefs-1', userId: 'u', data: {}, createdAt: new Date(), updatedAt: new Date() }),
  },
  recurring: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn(),
  },
  recurringSkip: {
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  installmentGroup: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
    delete: jest.fn(),
  },
  referenceRate: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  // historyEntry — el propio HistoryModule (Módulo 3.14).
  historyEntry: {
    create: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  $transaction: jest.fn().mockImplementation(async (cb: (tx: unknown) => Promise<void>) => cb(mockPrismaTxHandle())),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $queryRaw: jest.fn().mockResolvedValue([]),
};

// Handle usado dentro de $transaction (undo) — espeja los mismos modelos.
function mockPrismaTxHandle() {
  return {
    transaction: mockPrisma.transaction,
    recurring: mockPrisma.recurring,
    installmentGroup: mockPrisma.installmentGroup,
    historyEntry: mockPrisma.historyEntry,
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_A_ID = 'user-a-hist-e2e';
const USER_B_ID = 'user-b-hist-e2e';

function makeHistoryEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'hist-e2e-001',
    userId: USER_A_ID,
    targetKind: HistoryTargetKind.UNICO,
    targetId: 'tx-e2e-001',
    action: HistoryAction.EDIT,
    snapshot: {
      type: 'EXPENSE',
      amountCents: 1000,
      categoryId: 'cat-1',
      description: null,
      occurredAt: new Date('2026-05-01T12:00:00Z').toISOString(),
      timezone: 'America/Argentina/Buenos_Aires',
      currency: 'ARS',
      exchangeRate: 1,
      anchorCurrency: 'ARS',
      paymentMethodId: null,
      autoDebit: null,
    },
    createdAt: new Date('2026-05-02T00:00:00Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe('History (e2e)', () => {
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
    mockPrisma.historyEntry.findMany.mockResolvedValue([]);
    // Moneda default VIGENTE del usuario (getUserDefaultCurrency), usada en la
    // regla de omisión de `Moneda` del estado de eliminación (§3.3).
    mockPrisma.user.findUnique.mockResolvedValue({ defaultCurrency: 'ARS' });
  });

  // -------------------------------------------------------------------------
  // GET /history
  // -------------------------------------------------------------------------

  describe('GET /history', () => {
    it('200 + sobre con lista vacía cuando el usuario no tiene entradas', async () => {
      mockPrisma.historyEntry.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/history')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('200 + entrada de EDIT con category embebida', async () => {
      const entry = makeHistoryEntry();
      // findAllForUserAsc y findExpiredForUser comparten historyEntry.findMany;
      // ambas resuelven a la misma lista (sin vencidas en este fixture).
      mockPrisma.historyEntry.findMany.mockResolvedValue([entry]);
      mockPrisma.category.findMany.mockResolvedValue([
        { id: 'cat-1', name: 'Consumibles', color: '#4F86C6', scope: 'EXPENSE' },
      ]);
      // "next" (estado vigente) del único, para el diff de la única entrada del stack.
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'tx-e2e-001',
        type: 'EXPENSE',
        amountCents: 2000,
        categoryId: 'cat-1',
        description: null,
        currency: 'ARS',
        exchangeRate: 1,
        paymentMethodId: null,
        autoDebit: null,
        occurredAt: new Date('2026-05-01T12:00:00Z'),
        timezone: 'America/Argentina/Buenos_Aires',
      });

      const res = await request(app.getHttpServer())
        .get('/history')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      const item = res.body.data[0];
      expect(item.id).toBe('hist-e2e-001');
      expect(item.targetKind).toBe('UNICO');
      expect(item.action).toBe('EDIT');
      expect(item.canUndo).toBe(true);
      expect(item.blockingCount).toBe(0);
      expect(item.category).toEqual(
        expect.objectContaining({ id: 'cat-1', name: 'Consumibles' }),
      );
      // Identificación top-level (RF-HIST-002 — contrato ampliado).
      expect(item.amount).toEqual({ amountCents: 1000, currency: 'ARS', type: 'EXPENSE' });
      expect(item.isCalculated).toBe(false);
      // amountCents cambió de 1000 (snapshot) a 2000 (vigente) → debe aparecer en el diff
      // bajo el campo compuesto `amount` (monto + moneda + tipo).
      expect(item.changes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'amount',
            previous: { amountCents: 1000, currency: 'ARS', type: 'EXPENSE' },
            next: { amountCents: 2000, currency: 'ARS', type: 'EXPENSE' },
          }),
        ]),
      );
    });

    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer()).get('/history').expect(401);
      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // POST /history/:id/undo
  // -------------------------------------------------------------------------

  describe('POST /history/:id/undo', () => {
    it('200 + deshace y borra la entrada (caso simple, sin posteriores)', async () => {
      const entry = makeHistoryEntry();
      mockPrisma.historyEntry.findUnique.mockResolvedValue(entry);
      mockPrisma.historyEntry.findMany.mockResolvedValue([entry]);

      const res = await request(app.getHttpServer())
        .post('/history/hist-e2e-001/undo')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(mockPrisma.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'tx-e2e-001' } }),
      );
      expect(mockPrisma.historyEntry.delete).toHaveBeenCalledWith({ where: { id: 'hist-e2e-001' } });
      // El undo no genera ninguna entrada nueva (RF-HIST-003).
      expect(mockPrisma.historyEntry.create).not.toHaveBeenCalled();
    });

    it('404 si la entrada no existe', async () => {
      mockPrisma.historyEntry.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post('/history/no-existe/undo')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('aislamiento: 404 si la entrada pertenece a otro usuario (RN-003)', async () => {
      const entry = makeHistoryEntry({ userId: USER_B_ID });
      mockPrisma.historyEntry.findUnique.mockResolvedValue(entry);

      const res = await request(app.getHttpServer())
        .post('/history/hist-e2e-001/undo')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(mockPrisma.transaction.update).not.toHaveBeenCalled();
    });

    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer())
        .post('/history/hist-e2e-001/undo')
        .expect(401);
      expect(res.body.success).toBe(false);
    });

    it('usuario B no puede ver ni deshacer una entrada de usuario A (aislamiento cruzado)', async () => {
      const entry = makeHistoryEntry();
      mockPrisma.historyEntry.findUnique.mockResolvedValue(entry);

      await request(app.getHttpServer())
        .post('/history/hist-e2e-001/undo')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);
    });
  });
});
