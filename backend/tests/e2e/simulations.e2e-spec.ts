/**
 * Tests e2e del SimulationsModule (Módulo 3.15, RF-SIM-001..004).
 *
 * Estrategia: mock de PrismaService (sin DB real en CI), levantando AppModule
 * completo (guard JWT global, ValidationPipe, ResponseInterceptor, exception
 * filter) — mismo patrón que categories.e2e-spec.ts.
 *
 * Cubre el contrato HTTP: sobre de respuesta, códigos de estado, y las reglas
 * de negocio principales end-to-end (mínimo de datos, unicidad, 404 no
 * idempotente). Esta especie no participa del historial de cambios (RF-SIM-004).
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
    findUnique: jest.fn().mockResolvedValue({ defaultCurrency: 'ARS', lastExchangeRate: null }),
  },
  category: {
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
  },
  simulation: {
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    delete: jest.fn(),
  },
  referenceRate: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  // userPreferences — necesario para PreferencesModule (gotcha documentado — ver docs/backend.md)
  userPreferences: {
    findUnique: jest.fn().mockResolvedValue(null),
    upsert: jest.fn(),
    create: jest.fn().mockResolvedValue({ id: 'prefs-1', userId: 'u', data: {}, createdAt: new Date(), updatedAt: new Date() }),
  },
  $queryRaw: jest.fn().mockResolvedValue([]),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
};

const USER_A_ID = 'user-a-sim-e2e';
const USER_B_ID = 'user-b-sim-e2e';
const CAT_ID = 'cat-sim-e2e-001';

function makeDbCategory(overrides: Record<string, unknown> = {}) {
  return {
    id: CAT_ID,
    userId: USER_A_ID,
    name: 'Salidas',
    scope: 'BOTH',
    color: '#E23B3B',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { transactions: 0, recurrings: 0, installmentGroups: 0 },
    ...overrides,
  };
}

/** Fila cruda esperada de $queryRaw para SimulationsRepository.getUnicosMonthlyTotalsByCategory. */
function makeSqlRow(monthKey: string, totalCents: number, type: 'EXPENSE' | 'INCOME' = 'EXPENSE') {
  return {
    categoryId: CAT_ID,
    monthKey,
    type,
    currency: 'ARS',
    exchangeRate: '1',
    anchorCurrency: 'ARS',
    totalCents: BigInt(totalCents),
  };
}

describe('Simulations (e2e)', () => {
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
    mockPrisma.user.findUnique.mockResolvedValue({ defaultCurrency: 'ARS', lastExchangeRate: null });
    mockPrisma.simulation.findFirst.mockResolvedValue(null);
    mockPrisma.simulation.findMany.mockResolvedValue([]);
    mockPrisma.category.findMany.mockResolvedValue([]);
    mockPrisma.referenceRate.findMany.mockResolvedValue([]);
    mockPrisma.$queryRaw.mockResolvedValue([]);
  });

  // ---------------------------------------------------------------------------
  // POST /simulations
  // ---------------------------------------------------------------------------

  describe('POST /simulations', () => {
    it('201 + sobre { success: true, data: { created, failed } } cuando la categoría tiene ≥3 meses con únicos', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        id: CAT_ID,
        userId: USER_A_ID,
        scope: 'BOTH',
        deletedAt: null,
      });
      mockPrisma.$queryRaw.mockResolvedValue([
        makeSqlRow('2026-04', 10000),
        makeSqlRow('2026-05', 10000),
        makeSqlRow('2026-06', 10000),
      ]);
      mockPrisma.simulation.create.mockResolvedValue({
        id: 'sim-e2e-1',
        userId: USER_A_ID,
        categoryId: CAT_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.category.findMany.mockResolvedValue([makeDbCategory()]);

      const res = await request(app.getHttpServer())
        .post('/simulations')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ categoryIds: [CAT_ID] })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.created).toHaveLength(1);
      expect(res.body.data.created[0].id).toBe('sim-e2e-1');
      expect(res.body.data.created[0].categoryId).toBe(CAT_ID);
      expect(res.body.data.created[0].paused).toBe(false);
      expect(res.body.data.failed).toEqual([]);
    });

    it('201 con failed[0] cuando la categoría no existe / no es del usuario (RN-003 — no revela ajenidad), sin volcar la request entera', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post('/simulations')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ categoryIds: ['cat-inexistente'] })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.created).toEqual([]);
      expect(res.body.data.failed).toEqual([
        { categoryId: 'cat-inexistente', message: expect.any(String) },
      ]);
    });

    it('201 con failed[0] cuando la categoría tiene menos de 3 meses con únicos en la ventana', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        id: CAT_ID,
        userId: USER_A_ID,
        scope: 'BOTH',
        deletedAt: null,
      });
      mockPrisma.$queryRaw.mockResolvedValue([makeSqlRow('2026-05', 10000), makeSqlRow('2026-06', 10000)]);

      const res = await request(app.getHttpServer())
        .post('/simulations')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ categoryIds: [CAT_ID] })
        .expect(201);

      expect(res.body.data.created).toEqual([]);
      expect(res.body.data.failed[0].categoryId).toBe(CAT_ID);
    });

    it('201 con failed[0] cuando ya existe una simulación sobre la categoría', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        id: CAT_ID,
        userId: USER_A_ID,
        scope: 'BOTH',
        deletedAt: null,
      });
      mockPrisma.simulation.findFirst.mockResolvedValue({
        id: 'sim-existing',
        userId: USER_A_ID,
        categoryId: CAT_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app.getHttpServer())
        .post('/simulations')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ categoryIds: [CAT_ID] })
        .expect(201);

      expect(res.body.data.created).toEqual([]);
      expect(res.body.data.failed[0]).toEqual({
        categoryId: CAT_ID,
        message: expect.any(String),
      });
    });

    it('éxito mixto: una categoría se crea y otra falla en la MISMA llamada, sin voltear a la primera', async () => {
      const OTHER_CAT_ID = 'cat-sim-e2e-002';
      mockPrisma.category.findUnique.mockImplementation((args: { where: { id: string } }) => {
        if (args.where.id === CAT_ID) {
          return Promise.resolve({ id: CAT_ID, userId: USER_A_ID, scope: 'BOTH', deletedAt: null });
        }
        return Promise.resolve(null); // OTHER_CAT_ID no existe → falla
      });
      mockPrisma.$queryRaw.mockResolvedValue([
        makeSqlRow('2026-04', 10000),
        makeSqlRow('2026-05', 10000),
        makeSqlRow('2026-06', 10000),
      ]);
      mockPrisma.simulation.create.mockResolvedValue({
        id: 'sim-e2e-mixed',
        userId: USER_A_ID,
        categoryId: CAT_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.category.findMany.mockResolvedValue([makeDbCategory()]);

      const res = await request(app.getHttpServer())
        .post('/simulations')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ categoryIds: [CAT_ID, OTHER_CAT_ID] })
        .expect(201);

      expect(res.body.data.created).toHaveLength(1);
      expect(res.body.data.created[0].categoryId).toBe(CAT_ID);
      expect(res.body.data.failed).toEqual([
        { categoryId: OTHER_CAT_ID, message: expect.any(String) },
      ]);
    });

    it('401 sin JWT', async () => {
      await request(app.getHttpServer())
        .post('/simulations')
        .send({ categoryIds: [CAT_ID] })
        .expect(401);
    });

    it('400 si falta categoryIds en el body', async () => {
      await request(app.getHttpServer())
        .post('/simulations')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({})
        .expect(400);
    });

    it('400 si categoryIds viene vacío', async () => {
      await request(app.getHttpServer())
        .post('/simulations')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ categoryIds: [] })
        .expect(400);
    });

    it('400 si categoryIds trae un id repetido', async () => {
      await request(app.getHttpServer())
        .post('/simulations')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ categoryIds: [CAT_ID, CAT_ID] })
        .expect(400);
    });

    it('201 con el tramo persistido según el "startMonth" del body (extendido a +6)', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        id: CAT_ID,
        userId: USER_A_ID,
        scope: 'BOTH',
        deletedAt: null,
      });
      mockPrisma.$queryRaw.mockResolvedValue([
        makeSqlRow('2026-04', 10000),
        makeSqlRow('2026-05', 10000),
        makeSqlRow('2026-06', 10000),
      ]);
      mockPrisma.simulation.create.mockResolvedValue({
        id: 'sim-e2e-startmonth',
        userId: USER_A_ID,
        categoryId: CAT_ID,
        startMonth: '2026-10',
        endMonth: '2027-04',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.category.findMany.mockResolvedValue([makeDbCategory()]);

      const res = await request(app.getHttpServer())
        .post('/simulations?today=2026-07-15')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ categoryIds: [CAT_ID], startMonth: '2026-10' })
        .expect(201);

      expect(res.body.data.created[0].startMonth).toBe('2026-10');
      expect(res.body.data.created[0].effectiveStartMonth).toBe('2026-10');
      expect(res.body.data.created[0].endMonth).toBe('2027-04');
      expect(mockPrisma.simulation.create).toHaveBeenCalledWith({
        data: { userId: USER_A_ID, categoryId: CAT_ID, startMonth: '2026-10', endMonth: '2027-04' },
      });
    });

    it('400 si el "startMonth" del body tiene formato inválido', async () => {
      await request(app.getHttpServer())
        .post('/simulations')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ categoryIds: [CAT_ID], startMonth: '2026/10' })
        .expect(400);
    });

    it('400 si "today" tiene formato inválido (mismo contrato que los GET)', async () => {
      await request(app.getHttpServer())
        .post('/simulations?today=15-07-2026')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ categoryIds: [CAT_ID] })
        .expect(400);
    });

    it('el "today" cambia la ventana histórica evaluada: misma categoría, mismos datos, veredicto distinto según la fecha', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        id: CAT_ID,
        userId: USER_A_ID,
        scope: 'BOTH',
        deletedAt: null,
      });
      mockPrisma.category.findMany.mockResolvedValue([makeDbCategory()]);
      mockPrisma.simulation.create.mockResolvedValue({
        id: 'sim-e2e-window',
        userId: USER_A_ID,
        categoryId: CAT_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Simula el filtro real de la SQL (WHERE monthKey BETWEEN firstMonth AND
      // lastMonth) a partir de los 3 únicos meses con dato: ago/sep/oct-2025.
      const fixedRows = [
        makeSqlRow('2025-08', 10000),
        makeSqlRow('2025-09', 10000),
        makeSqlRow('2025-10', 10000),
      ];
      mockPrisma.$queryRaw.mockImplementation(
        (_strings: unknown, _userId: unknown, _notDeleted: unknown, firstMonth: string, lastMonth: string) =>
          Promise.resolve(fixedRows.filter((r) => r.monthKey >= firstMonth && r.monthKey <= lastMonth)),
      );

      // today=2026-08-15 → A=2026-08 → ventana [2025-08..2026-07] → los 3
      // meses caen ADENTRO → ≥3 meses con dato → se crea.
      const res1 = await request(app.getHttpServer())
        .post('/simulations?today=2026-08-15')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ categoryIds: [CAT_ID] })
        .expect(201);
      expect(res1.body.data.created).toHaveLength(1);

      // today=2025-08-15 → A=2025-08 → ventana [2024-08..2025-07] → los 3
      // meses caen AFUERA (posteriores) → 0 meses con dato → falla.
      const res2 = await request(app.getHttpServer())
        .post('/simulations?today=2025-08-15')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ categoryIds: [CAT_ID] })
        .expect(201);
      expect(res2.body.data.created).toEqual([]);
      expect(res2.body.data.failed[0].categoryId).toBe(CAT_ID);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /simulations
  // ---------------------------------------------------------------------------

  describe('GET /simulations', () => {
    it('200 + lista vacía sin simulaciones activas (sin horizonEndMonth a nivel respuesta — el tramo es por simulación)', async () => {
      const res = await request(app.getHttpServer())
        .get('/simulations?today=2026-07-15')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.simulations).toEqual([]);
      expect(res.body.data).not.toHaveProperty('horizonEndMonth');
    });

    it('400 si "today" tiene formato inválido', async () => {
      await request(app.getHttpServer())
        .get('/simulations?today=15-07-2026')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);
    });

    it('401 sin JWT', async () => {
      await request(app.getHttpServer()).get('/simulations').expect(401);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /simulations/candidates
  // ---------------------------------------------------------------------------

  describe('GET /simulations/candidates', () => {
    it('200 + universo de categorías activas con monthsWithData y alreadySimulated', async () => {
      mockPrisma.category.findMany.mockResolvedValue([makeDbCategory()]);
      mockPrisma.$queryRaw.mockResolvedValue([
        makeSqlRow('2026-04', 10000),
        makeSqlRow('2026-05', 10000),
        makeSqlRow('2026-06', 10000),
      ]);

      const res = await request(app.getHttpServer())
        .get('/simulations/candidates?today=2026-07-15')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.data.categories).toEqual([
        {
          categoryId: CAT_ID,
          name: 'Salidas',
          color: '#E23B3B',
          monthsWithData: 3,
          alreadySimulated: false,
        },
      ]);
      // Tramo HIPOTÉTICO que resultaría de crear desde el mes en curso (sin
      // `startMonth` en la query): reemplaza al `horizonEndMonth` único de antes.
      expect(res.body.data.startMonth).toBe('2026-07');
      expect(res.body.data.endMonth).toBe('2027-01');
    });

    it('200 + tramo derivado del "startMonth" pedido en la query (extendido a +6)', async () => {
      mockPrisma.category.findMany.mockResolvedValue([makeDbCategory()]);

      const res = await request(app.getHttpServer())
        .get('/simulations/candidates?today=2026-07-15&startMonth=2026-10')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.data.startMonth).toBe('2026-10');
      expect(res.body.data.endMonth).toBe('2027-04');
    });

    it('400 si "startMonth" tiene formato inválido', async () => {
      await request(app.getHttpServer())
        .get('/simulations/candidates?startMonth=2026/10')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE /simulations/:id
  // ---------------------------------------------------------------------------

  describe('DELETE /simulations/:id', () => {
    it('204 sin cuerpo + borra físicamente (sin historial, RF-SIM-004)', async () => {
      mockPrisma.simulation.findUnique.mockResolvedValue({
        id: 'sim-e2e-2',
        userId: USER_A_ID,
        categoryId: CAT_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app.getHttpServer())
        .delete('/simulations/sim-e2e-2')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(204);

      expect(res.body).toEqual({});
      expect(mockPrisma.simulation.delete).toHaveBeenCalledWith({
        where: { id: 'sim-e2e-2' },
      });
    });

    it('404 si no existe', async () => {
      mockPrisma.simulation.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .delete('/simulations/no-existe')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);
    });

    it('404 si es de otro usuario (no revela ajenidad)', async () => {
      mockPrisma.simulation.findUnique.mockResolvedValue({
        id: 'sim-ajena',
        userId: USER_B_ID,
        categoryId: CAT_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await request(app.getHttpServer())
        .delete('/simulations/sim-ajena')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);
    });

    it('401 sin JWT', async () => {
      await request(app.getHttpServer()).delete('/simulations/sim-e2e-2').expect(401);
    });
  });
});
