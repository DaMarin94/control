/**
 * Tests e2e del MovementsModule.
 *
 * Estrategia: mock de PrismaService.$queryRaw (sin DB real en CI).
 *
 * Cubre:
 * - Shape completo de la respuesta (sobre + data con month, totals, movements)
 * - Listado del mes con únicos (orden: convertedAmountCents DESC, desempate occurredAt DESC)
 * - Totales correctos (expenseCents, incomeCents, balanceCents)
 * - Movimiento con categoría soft-deleted sigue en totales y con categoría
 * - Bucketeo por zona propia: el mock devuelve los ítems que corresponden
 *   al mes EN LA ZONA DEL REGISTRO (el SQL lo hace; el test verifica el shape)
 * - month inválido / faltante → 400
 * - Aislamiento por userId (RN-003)
 * - Mes vacío → totales en cero, listas vacías
 * - 401 sin JWT
 * - Filtro de categorías (Fase 1.1.6): 3 estados en /movements y /reports
 *
 * Nota sobre el bucketeo por zona propia:
 * El SQL real (AT TIME ZONE t.timezone) corre en Postgres. En los tests e2e
 * mockeamos $queryRaw completo. Los casos de borde de timezone (un movimiento
 * cuyo occurredAt UTC cae en un mes distinto al de su hora local) se verifican
 * en tests unitarios del repositorio (ver movements.repository.spec.ts si se añade)
 * o en integration tests con DB real. Aquí verificamos el shape, los errores,
 * y que el service pasa correctamente los datos del mock al response.
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
// $queryRaw se usa para el bucketeo por zona propia (MovementsRepository).
// Los otros métodos de Prisma son para los módulos que siguen activos.
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
  // recurring.findMany se usa para fijos (Fase 6 — findFijosByMonth / getFijosTotalsByMonth)
  recurring: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
    delete: jest.fn(),
  },
  // recurringSkip.findMany se usa en getAllFijosForAnnual (Fase 1.1.5)
  recurringSkip: {
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    delete: jest.fn(),
    findUnique: jest.fn(),
  },
  // installmentGroup.findMany se usa para cuotas (Fase 7 — findCuotasByMonth / getCuotasTotalsByMonth)
  installmentGroup: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
    delete: jest.fn(),
  },
  // installmentSkip.findMany se usa en getAllCuotasForAnnual (P3 — Fase 1.1.1.ext)
  installmentSkip: {
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    delete: jest.fn(),
    findUnique: jest.fn(),
  },
  // referenceRate.findMany se usa en loadAllPivotRates → loadPivotRatesForYear
  referenceRate: {
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    upsert: jest.fn(),
    findUnique: jest.fn(),
  },
  // inflationRate.findMany se usa en loadInflationRatesForYear (reporte anual de únicos / inflación-ingresos)
  inflationRate: {
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    upsert: jest.fn(),
    findUnique: jest.fn(),
  },
  // $queryRaw se mockea para que MovementsRepository pueda funcionar
  $queryRaw: jest.fn(),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_A_ID = 'user-a-mv-e2e';
const USER_B_ID = 'user-b-mv-e2e';
const CAT_ID = 'cat-mv-e2e';

/**
 * Fila raw que devuelve $queryRaw para un movimiento único.
 * Los alias coinciden con los definidos en MovementsRepository.findUnicosByMonth.
 */
function makeRawTransactionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tx-mv-001',
    userId: USER_A_ID,
    type: 'EXPENSE',
    amountCents: 1500,
    // Fase 1.2.3: campos de moneda (como string, igual que los devuelve $queryRaw con ::text)
    currency: 'ARS',
    exchangeRate: '1',
    description: null,
    occurredAt: new Date('2026-06-08T17:30:00Z'),
    timezone: 'America/Argentina/Buenos_Aires',
    categoryId: CAT_ID,
    categoryName: 'Consumibles',
    categoryColor: '#4F86C6',
    categoryScope: 'EXPENSE',
    ...overrides,
  };
}

/**
 * Fila raw de totales que devuelve $queryRaw.
 * Los valores son BigInt porque COALESCE SUM en Postgres devuelve BIGINT.
 */
function makeRawTotalsRow(expense = 0n, income = 0n) {
  return {
    expenseCents: BigInt(expense),
    incomeCents: BigInt(income),
  };
}

// ---------------------------------------------------------------------------
// Setup de la app de test
// ---------------------------------------------------------------------------

describe('Movements (e2e)', () => {
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
    mockPrisma.user.findUnique.mockResolvedValue({
      id: USER_A_ID,
      defaultCurrency: 'ARS',
      lastExchangeRate: null,
    });
    // Default: sin fijos activos (Fase 6). Los tests de fijos lo sobreescriben.
    mockPrisma.recurring.findMany.mockResolvedValue([]);
    // Default: sin cuotas activas (Fase 7). Los tests de cuotas lo sobreescriben.
    mockPrisma.installmentGroup.findMany.mockResolvedValue([]);
    // Default: sin skips (Fase 1.1.1). Usado por getAllFijosForAnnual en /reports.
    mockPrisma.recurringSkip.findMany.mockResolvedValue([]);
  });

  // -------------------------------------------------------------------------
  // GET /movements?month=YYYY-MM — casos felices
  // -------------------------------------------------------------------------

  describe('GET /movements — casos felices', () => {
    it('200 + sobre con shape completo (month, totals, movements)', async () => {
      const row = makeRawTransactionRow();
      // $queryRaw se llama 1 vez: findUnicosByMonth.
      // getTotalsByMonth ya NO se llama: el service calcula totales desde las listas.
      mockPrisma.$queryRaw.mockResolvedValueOnce([row]);

      const res = await request(app.getHttpServer())
        .get('/movements?month=2026-06')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.statusCode).toBe(200);

      // Shape del data
      const data = res.body.data;
      expect(data).toHaveProperty('month', '2026-06');
      expect(data).toHaveProperty('totals');
      expect(data).toHaveProperty('movements');

      // Totales (calculados desde la lista filtrada)
      expect(data.totals).toHaveProperty('expenseCents', 1500);
      expect(data.totals).toHaveProperty('incomeCents', 0);
      expect(data.totals).toHaveProperty('balanceCents', -1500);

      // Movimientos
      expect(data.movements).toHaveProperty('unicos');
      expect(data.movements).toHaveProperty('fijos');
      expect(data.movements).toHaveProperty('cuotas');
      expect(Array.isArray(data.movements.unicos)).toBe(true);
      expect(Array.isArray(data.movements.fijos)).toBe(true);
      expect(Array.isArray(data.movements.cuotas)).toBe(true);
    });

    it('200 + listado de unicos con shape correcto de MovementItem', async () => {
      const row = makeRawTransactionRow({
        id: 'tx-001',
        type: 'EXPENSE',
        amountCents: 1500,
        description: 'Almuerzo',
        occurredAt: new Date('2026-06-08T17:30:00Z'),
        timezone: 'America/Argentina/Buenos_Aires',
      });
      mockPrisma.$queryRaw.mockResolvedValueOnce([row]);

      const res = await request(app.getHttpServer())
        .get('/movements?month=2026-06')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const item = res.body.data.movements.unicos[0];
      expect(item).toHaveProperty('id', 'tx-001');
      expect(item).toHaveProperty('origin', 'unico');
      expect(item).toHaveProperty('type', 'EXPENSE');
      expect(item).toHaveProperty('amountCents', 1500);
      expect(item).toHaveProperty('description', 'Almuerzo');
      expect(item).toHaveProperty('occurredAt');
      expect(item).toHaveProperty('timezone', 'America/Argentina/Buenos_Aires');
      // Categoría embebida
      expect(item.category).toBeDefined();
      expect(item.category).toHaveProperty('id', CAT_ID);
      expect(item.category).toHaveProperty('name', 'Consumibles');
      expect(item.category).toHaveProperty('color', '#4F86C6');
      expect(item.category).toHaveProperty('scope', 'EXPENSE');
    });

    it('200 + totales correctos con expense e income distintos', async () => {
      const rowExpense = makeRawTransactionRow({ id: 'tx-01', type: 'EXPENSE', amountCents: 3000 });
      const rowIncome = makeRawTransactionRow({ id: 'tx-02', type: 'INCOME', amountCents: 8000 });
      mockPrisma.$queryRaw.mockResolvedValueOnce([rowExpense, rowIncome]);

      const res = await request(app.getHttpServer())
        .get('/movements?month=2026-06')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.data.totals.expenseCents).toBe(3000);
      expect(res.body.data.totals.incomeCents).toBe(8000);
      expect(res.body.data.totals.balanceCents).toBe(5000); // 8000 - 3000
    });

    it('200 + mes vacío → totales cero y listas vacías', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);

      const res = await request(app.getHttpServer())
        .get('/movements?month=2026-06')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.data.totals).toEqual({ expenseCents: 0, incomeCents: 0, balanceCents: 0 });
      expect(res.body.data.movements.unicos).toEqual([]);
      expect(res.body.data.movements.fijos).toEqual([]);
      expect(res.body.data.movements.cuotas).toEqual([]);
    });

    it('200 + categoría soft-deleted: el ítem aparece con su categoría (RF-CAT-004)', async () => {
      // La categoría puede tener deletedAt != null en la DB, pero el SQL JOIN
      // no filtra por deletedAt → el ítem aparece con su nombre e info de categoría
      const rowWithDeletedCat = makeRawTransactionRow({
        categoryId: 'cat-deleted',
        categoryName: 'Categoría Eliminada',
        categoryColor: '#AAAAAA',
        categoryScope: 'BOTH',
      });
      mockPrisma.$queryRaw.mockResolvedValueOnce([rowWithDeletedCat]);

      const res = await request(app.getHttpServer())
        .get('/movements?month=2026-06')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const item = res.body.data.movements.unicos[0];
      expect(item.category.id).toBe('cat-deleted');
      expect(item.category.name).toBe('Categoría Eliminada');
      // Y sigue contando en totales
      expect(res.body.data.totals.expenseCents).toBe(1500);
    });

    it('200 + orden de unicos: mayor monto primero (convertedAmountCents DESC)', async () => {
      // El repo ordena por convertedAmountCents DESC; con moneda ARS coincide con amountCents DESC
      const row1 = makeRawTransactionRow({
        id: 'tx-mayor',
        amountCents: 5000,
        occurredAt: new Date('2026-06-01T00:00:00Z'),
      });
      const row2 = makeRawTransactionRow({
        id: 'tx-menor',
        amountCents: 1000,
        occurredAt: new Date('2026-06-15T00:00:00Z'),
      });
      mockPrisma.$queryRaw.mockResolvedValueOnce([row1, row2]);

      const res = await request(app.getHttpServer())
        .get('/movements?month=2026-06')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.data.movements.unicos[0].id).toBe('tx-mayor');
      expect(res.body.data.movements.unicos[1].id).toBe('tx-menor');
    });

    /**
     * Caso de borde: bucketeo por zona propia.
     *
     * Escenario: un movimiento ocurre el 2026-06-01T02:00:00Z (UTC).
     * Si se bucketeara con UTC, caería en junio (día 1 a las 02:00 UTC = junio).
     * Pero si la timezone del registro es "America/Argentina/Buenos_Aires" (UTC-3),
     * la hora local es 2026-05-31T23:00:00-03:00 → MAYO en su zona local.
     *
     * Con el criterio correcto (AT TIME ZONE del registro), ese movimiento
     * NO debe aparecer en la consulta de junio — debe aparecer en mayo.
     *
     * En este test verificamos que si el SQL (mockeado) devuelve vacío para junio
     * (porque ese movimiento cayó en mayo según su zona), los totales también son cero.
     * La verificación real del SQL la haría un integration test con DB real.
     */
    it('borde timezone: movimiento en hora local de mayo no aparece en junio (SQL devuelve vacío)', async () => {
      // El SQL bucketeó correctamente y excluyó el movimiento de mayo;
      // nuestro mock simula ese resultado.
      mockPrisma.$queryRaw.mockResolvedValueOnce([]); // sin movimientos en junio

      const res = await request(app.getHttpServer())
        .get('/movements?month=2026-06')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.data.movements.unicos).toHaveLength(0);
      expect(res.body.data.totals.expenseCents).toBe(0);
    });

    /**
     * Caso de borde inverso: movimiento cuyo occurredAt UTC cae en julio,
     * pero en su zona local (UTC+3) cae en junio.
     *
     * occurredAt = 2026-06-30T22:00:00Z → local UTC+3 = 2026-07-01T01:00:00+03:00 = JULIO.
     * No aplica en UTC-3 pero sí para otras zonas.
     *
     * El SQL usa AT TIME ZONE del REGISTRO, por lo que bucketeará correctamente.
     * El mock devuelve el movimiento para junio para demostrar que cuando el SQL
     * determina que pertenece a junio (en su zona), aparece en junio.
     */
    it('borde timezone inverso: movimiento que en UTC es julio pero en su zona es junio → aparece en junio', async () => {
      // occurredAt = 2026-07-01T00:30:00Z, timezone = "America/Argentina/Buenos_Aires" (UTC-3)
      // hora local = 2026-06-30T21:30:00-03:00 → JUNIO en su zona
      const row = makeRawTransactionRow({
        id: 'tx-border',
        occurredAt: new Date('2026-07-01T00:30:00Z'),
        timezone: 'America/Argentina/Buenos_Aires',
      });
      mockPrisma.$queryRaw.mockResolvedValueOnce([row]);

      const res = await request(app.getHttpServer())
        .get('/movements?month=2026-06')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      // El movimiento aparece en junio porque en su zona local es junio
      expect(res.body.data.movements.unicos).toHaveLength(1);
      expect(res.body.data.movements.unicos[0].id).toBe('tx-border');
      expect(res.body.data.totals.expenseCents).toBe(1500);
    });
  });

  // -------------------------------------------------------------------------
  // Validaciones — month inválido o faltante → 400
  // -------------------------------------------------------------------------

  describe('GET /movements — validaciones', () => {
    it('400 si falta el parámetro month', async () => {
      const res = await request(app.getHttpServer())
        .get('/movements')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
    });

    it('400 si month tiene formato inválido (2026/06)', async () => {
      const res = await request(app.getHttpServer())
        .get('/movements?month=2026/06')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
    });

    it('400 si month tiene formato inválido (202606 sin guión)', async () => {
      const res = await request(app.getHttpServer())
        .get('/movements?month=202606')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 si month tiene mes inválido (2026-13)', async () => {
      const res = await request(app.getHttpServer())
        .get('/movements?month=2026-13')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 si month tiene mes inválido (2026-00)', async () => {
      const res = await request(app.getHttpServer())
        .get('/movements?month=2026-00')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('NO acepta timezone como query param (campo ignorado o no afecta el resultado)', async () => {
      // Verificar que timezone en query NO se requiere ni se usa
      // (el endpoint solo requiere month; timezone en query es ignorado)
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);

      const res = await request(app.getHttpServer())
        .get('/movements?month=2026-06&timezone=America%2FArgentina%2FBuenos_Aires')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      // Pasa sin error (timezone en query no rompe nada, simplemente no se usa)
      expect(res.body.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Aislamiento por userId (RN-003)
  // -------------------------------------------------------------------------

  describe('GET /movements — aislamiento por userId', () => {
    it('usa el userId del JWT (no del query), aislamiento RN-003', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);

      await request(app.getHttpServer())
        .get('/movements?month=2026-06')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      // Verificar que $queryRaw fue llamado con USER_B_ID (no USER_A_ID)
      // La primera llamada es findUnicosByMonth con el userId del token B
      const firstCall = mockPrisma.$queryRaw.mock.calls[0];
      // La template tag genera un objeto TemplateStringsArray + args;
      // verificamos que el userId del tokenB aparece en los argumentos
      const argsFlat = firstCall.flat(Infinity);
      expect(argsFlat).toContain(USER_B_ID);
    });
  });

  // -------------------------------------------------------------------------
  // Cuotas (Fase 7) — GET /movements mostrando cuotas con installment field
  // -------------------------------------------------------------------------

  describe('GET /movements — cuotas (Fase 7)', () => {
    /**
     * Helper: crea un InstallmentGroup tal como lo devuelve prisma.installmentGroup.findMany
     * con include de categoría.
     */
    function makeDbInstallmentGroup(overrides: Record<string, unknown> = {}) {
      return {
        id: 'group-001',
        userId: USER_A_ID,
        categoryId: CAT_ID,
        type: 'EXPENSE',
        amountCents: 5000,
        totalInstallments: 12,
        startMonth: '2026-01',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: {
          id: CAT_ID,
          name: 'Electrónica',
          color: '#4F86C6',
          scope: 'EXPENSE',
        },
        skips: [],
        ...overrides,
      };
    }

    it('200 + cuota activa aparece en movements.cuotas con campo installment', async () => {
      // Grupo de 12 cuotas desde 2026-01: la cuota 6 cae en 2026-06
      const group = makeDbInstallmentGroup({
        startMonth: '2026-01',
        totalInstallments: 12,
        amountCents: 5000,
      });
      // findMany de installmentGroup: devuelve el grupo (startMonth '2026-01' <= '2026-06')
      // Se llama 1 vez: findCuotasByMonth. getCuotasTotalsByMonth ya NO se llama (totales por lista).
      mockPrisma.installmentGroup.findMany.mockResolvedValueOnce([group]);

      // $queryRaw (únicos): sin únicos este mes. Solo 1 llamada (findUnicosByMonth).
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);

      const res = await request(app.getHttpServer())
        .get('/movements?month=2026-06')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const data = res.body.data;
      expect(data.movements.cuotas).toHaveLength(1);

      const cuota = data.movements.cuotas[0];
      expect(cuota).toHaveProperty('id', 'group-001');
      expect(cuota).toHaveProperty('origin', 'cuota');
      expect(cuota).toHaveProperty('type', 'EXPENSE');
      expect(cuota).toHaveProperty('amountCents', 5000);
      expect(cuota.occurredAt).toBeNull();
      expect(cuota.timezone).toBeNull();

      // Campo installment: cuota 6 de 12, startMonth '2026-01'
      expect(cuota.installment).toBeDefined();
      expect(cuota.installment.number).toBe(6);  // monthDiff('2026-01', '2026-06') + 1
      expect(cuota.installment.total).toBe(12);
      expect(cuota.installment.startMonth).toBe('2026-01');

      // Categoría embebida
      expect(cuota.category).toBeDefined();
      expect(cuota.category.id).toBe(CAT_ID);
      expect(cuota.category.name).toBe('Electrónica');
    });

    it('cuota suma al total expenseCents', async () => {
      const group = makeDbInstallmentGroup({ amountCents: 3000, totalInstallments: 6, startMonth: '2026-01' });
      mockPrisma.installmentGroup.findMany.mockResolvedValueOnce([group]);
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);

      const res = await request(app.getHttpServer())
        .get('/movements?month=2026-06')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      // Total debe incluir la cuota (3000) — únicos aportan 0
      expect(res.body.data.totals.expenseCents).toBe(3000);
      expect(res.body.data.totals.balanceCents).toBe(-3000);
    });

    it('cuota más único: totales combinados correctos', async () => {
      const group = makeDbInstallmentGroup({ amountCents: 2000, totalInstallments: 3, startMonth: '2026-05' });
      mockPrisma.installmentGroup.findMany.mockResolvedValueOnce([group]);

      // Un único de 1000 en el mes
      const row = makeRawTransactionRow({ amountCents: 1000 });
      mockPrisma.$queryRaw.mockResolvedValueOnce([row]);

      const res = await request(app.getHttpServer())
        .get('/movements?month=2026-06')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      // 1000 (único) + 2000 (cuota) = 3000
      expect(res.body.data.totals.expenseCents).toBe(3000);
      expect(res.body.data.movements.unicos).toHaveLength(1);
      expect(res.body.data.movements.cuotas).toHaveLength(1);
    });

    it('grupo terminado no aparece como cuota activa', async () => {
      // Grupo de 3 cuotas desde 2026-01: termina en 2026-03 (última cuota).
      // En 2026-06 ya no está activo.
      const group = makeDbInstallmentGroup({ startMonth: '2026-01', totalInstallments: 3 });
      mockPrisma.installmentGroup.findMany.mockResolvedValueOnce([group]);
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);

      const res = await request(app.getHttpServer())
        .get('/movements?month=2026-06')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      // El grupo terminó en 2026-03, no debe aparecer en 2026-06
      expect(res.body.data.movements.cuotas).toHaveLength(0);
      expect(res.body.data.totals.expenseCents).toBe(0);
    });

    it('primera cuota: number = 1 cuando month === startMonth', async () => {
      // Grupo desde '2026-06': la primera cuota cae en 2026-06
      const group = makeDbInstallmentGroup({ startMonth: '2026-06', totalInstallments: 6 });
      mockPrisma.installmentGroup.findMany.mockResolvedValueOnce([group]);
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);

      const res = await request(app.getHttpServer())
        .get('/movements?month=2026-06')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const cuota = res.body.data.movements.cuotas[0];
      expect(cuota.installment.number).toBe(1);
      expect(cuota.installment.total).toBe(6);
    });
  });

  // -------------------------------------------------------------------------
  // Filtro de categorías en GET /movements (Fase 1.1.6) — 3 estados
  // -------------------------------------------------------------------------

  describe('GET /movements — filtro de categorías (Fase 1.1.6)', () => {
    const CAT_A_MES = 'cat-mes-a';
    const CAT_B_MES = 'cat-mes-b';

    function makeRowForCat(catId: string, amountCents: number) {
      return makeRawTransactionRow({
        id: `tx-${catId}`,
        amountCents,
        categoryId: catId,
        categoryName: catId === CAT_A_MES ? 'Cat A' : 'Cat B',
      });
    }

    it('sin param categories → todas las categorías (comportamiento base)', async () => {
      // $queryRaw: findUnicosByMonth devuelve 2 únicos de cat distinta
      mockPrisma.$queryRaw.mockResolvedValueOnce([
        makeRowForCat(CAT_A_MES, 1000),
        makeRowForCat(CAT_B_MES, 2000),
      ]);

      const res = await request(app.getHttpServer())
        .get('/movements?month=2026-06')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.data.movements.unicos).toHaveLength(2);
      expect(res.body.data.totals.expenseCents).toBe(3000);
    });

    it('categories= (vacío) → ninguna: listas vacías y totales en cero, SIN llamar al repo', async () => {
      // Cuando categories está presente y vacío, el service atajar antes de consultar el repo
      const res = await request(app.getHttpServer())
        .get('/movements?month=2026-06&categories=')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.data.movements.unicos).toEqual([]);
      expect(res.body.data.movements.fijos).toEqual([]);
      expect(res.body.data.movements.cuotas).toEqual([]);
      expect(res.body.data.totals).toEqual({ expenseCents: 0, incomeCents: 0, balanceCents: 0 });
      // El repo no fue consultado (atajo temprano)
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('categories=<catId> → solo esa categoría aparece en la respuesta', async () => {
      // El repo devuelve 2 únicos; el filtro debe dejar pasar solo el de CAT_A_MES
      mockPrisma.$queryRaw.mockResolvedValueOnce([
        makeRowForCat(CAT_A_MES, 1000),
        makeRowForCat(CAT_B_MES, 2000),
      ]);

      const res = await request(app.getHttpServer())
        .get(`/movements?month=2026-06&categories=${CAT_A_MES}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.data.movements.unicos).toHaveLength(1);
      expect(res.body.data.movements.unicos[0].category.id).toBe(CAT_A_MES);
      expect(res.body.data.totals.expenseCents).toBe(1000);
    });

    it('fijo skippeado con filtro: aparece en lista (skipped=true) pero NO suma totales', async () => {
      // Un fijo de CAT_A_MES skippeado + un fijo normal de CAT_A_MES
      const fijoSkipped = {
        id: 'fijo-skip',
        userId: USER_A_ID,
        categoryId: CAT_A_MES,
        type: 'EXPENSE',
        amountCents: 5000,
        // Fase 1.2.3: moneda y cotización (default ARS/1)
        currency: 'ARS',
        exchangeRate: 1,
        startMonth: '2026-01',
        deletedFrom: null,
        description: null,
        frequency: 1,
        chainId: 'chain-skip',
        sourceChainId: null,
        sourceMovementId: null,
        sourceInstallmentGroupId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: CAT_A_MES, name: 'Cat A', color: '#aaa', scope: 'EXPENSE' },
        skips: [{ month: '2026-06' }], // skippeado este mes
      };
      const fijoNormal = {
        id: 'fijo-normal',
        userId: USER_A_ID,
        categoryId: CAT_A_MES,
        type: 'EXPENSE',
        amountCents: 2000,
        // Fase 1.2.3: moneda y cotización (default ARS/1)
        currency: 'ARS',
        exchangeRate: 1,
        startMonth: '2026-01',
        deletedFrom: null,
        description: null,
        frequency: 1,
        chainId: 'chain-normal',
        sourceChainId: null,
        sourceMovementId: null,
        sourceInstallmentGroupId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: CAT_A_MES, name: 'Cat A', color: '#aaa', scope: 'EXPENSE' },
        skips: [],
      };

      // Los fijos solo se devuelven cuando recurring.findMany busca fijos activos.
      // Cuando busca calculados de único (sourceMovementId: { not: null }) o calculados de cuota
      // (sourceInstallmentGroupId: { not: null }), debe devolver [].
      mockPrisma.recurring.findMany.mockImplementation((args: any) => {
        if (args?.where?.sourceMovementId?.not !== undefined) return Promise.resolve([]);
        if (args?.where?.sourceInstallmentGroupId?.not !== undefined) return Promise.resolve([]);
        return Promise.resolve([fijoSkipped, fijoNormal]);
      });
      // Sin únicos
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);

      const res = await request(app.getHttpServer())
        .get(`/movements?month=2026-06&categories=${CAT_A_MES}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const fijos = res.body.data.movements.fijos;
      // Ambos fijos de CAT_A aparecen (filtro pasa CAT_A)
      expect(fijos).toHaveLength(2);
      // El skippeado tiene skipped=true
      const skip = fijos.find((f: { id: string }) => f.id === 'fijo-skip');
      expect(skip).toBeDefined();
      expect(skip.skipped).toBe(true);
      // Totales: solo el normal suma (2000); el skippeado no
      expect(res.body.data.totals.expenseCents).toBe(2000);
    });
  });

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  describe('GET /movements — autenticación', () => {
    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer())
        .get('/movements?month=2026-06')
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // GET /movements/reports?year=YYYY[&categories=...] (Fase 1.1.5)
  //
  // Nota sobre la estrategia de mock:
  // El endpoint de reportes llama a 4 métodos del repositorio que envuelven
  // prisma directamente (no $queryRaw para fijos/cuotas). Para los tests e2e
  // mockeamos las tablas de Prisma de forma similar a los tests del mes.
  // -------------------------------------------------------------------------

  describe('GET /movements/reports — casos felices', () => {
    /**
     * Helper: crea una fila agregada de únicos (como la devuelve $queryRaw
     * en getAnnualUnicosAggregated).
     */
    function makeAnnualUnicoRow(overrides: Record<string, unknown> = {}) {
      return {
        monthKey: '2026-06',
        categoryId: CAT_ID,
        categoryName: 'Consumibles',
        categoryColor: '#4F86C6',
        categoryScope: 'EXPENSE',
        type: 'EXPENSE',
        totalCents: BigInt(1500),
        ...overrides,
      };
    }

    beforeEach(() => {
      // Por defecto, sin fijos ni cuotas en estos tests (se sobreescriben si necesario)
      mockPrisma.recurring.findMany.mockResolvedValue([]);
      mockPrisma.installmentGroup.findMany.mockResolvedValue([]);
    });

    it('200 + shape completo de ReportsMovementsResponse', async () => {
      // $queryRaw se llama 2 veces en reports:
      //   1. getAnnualUnicosAggregated
      //   2. getEarliestYear
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([makeAnnualUnicoRow()])   // getAnnualUnicosAggregated
        .mockResolvedValueOnce([{ earliestYear: BigInt(2026) }]); // getEarliestYear
      // getAllFijosForAnnual y getAllCuotasForAnnual usan prisma.recurring/installmentGroup
      mockPrisma.recurring.findMany.mockResolvedValue([]);
      mockPrisma.installmentGroup.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/movements/reports?year=2026')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.statusCode).toBe(200);

      const data = res.body.data;
      expect(data).toHaveProperty('year', 2026);
      expect(data).toHaveProperty('months');
      expect(data).toHaveProperty('categories');
      expect(data).toHaveProperty('earliestYear', 2026);

      // months: siempre 12 entradas
      expect(Array.isArray(data.months)).toBe(true);
      expect(data.months).toHaveLength(12);
      // El primer mes es enero
      expect(data.months[0].month).toBe('2026-01');
      // El último mes es diciembre
      expect(data.months[11].month).toBe('2026-12');
      // Junio (índice 5) tiene el gasto del único
      expect(data.months[5].expenseCents).toBe(1500);

      // categories
      expect(Array.isArray(data.categories)).toBe(true);
      expect(data.categories).toHaveLength(1);
      expect(data.categories[0].categoryId).toBe(CAT_ID);
      expect(data.categories[0].monthlyExpenseCents).toHaveLength(12);
      expect(data.categories[0].monthlyExpenseCents[5]).toBe(1500); // junio
    });

    it('200 + año vacío → 12 meses en cero, categories vacío, earliestYear null', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])                                   // getAnnualUnicosAggregated
        .mockResolvedValueOnce([{ earliestYear: null }]);            // getEarliestYear
      mockPrisma.recurring.findMany.mockResolvedValue([]);
      mockPrisma.installmentGroup.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/movements/reports?year=2026')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const data = res.body.data;
      expect(data.year).toBe(2026);
      expect(data.months).toHaveLength(12);
      data.months.forEach((m: { incomeCents: number; expenseCents: number }) => {
        expect(m.incomeCents).toBe(0);
        expect(m.expenseCents).toBe(0);
      });
      expect(data.categories).toEqual([]);
      expect(data.earliestYear).toBeNull();
    });

    it('200 + INCOME no aparece en categories, solo en months[*].incomeCents', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          makeAnnualUnicoRow({ type: 'INCOME', totalCents: BigInt(50000) }),
        ])
        .mockResolvedValueOnce([{ earliestYear: BigInt(2026) }]);
      mockPrisma.recurring.findMany.mockResolvedValue([]);
      mockPrisma.installmentGroup.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/movements/reports?year=2026')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const data = res.body.data;
      expect(data.months[5].incomeCents).toBe(50000);
      expect(data.months[5].expenseCents).toBe(0);
      // No hay categorías (solo aparecen las de EXPENSE)
      expect(data.categories).toHaveLength(0);
    });
  });

  describe('GET /movements/reports — validaciones', () => {
    it('400 si falta el parámetro year', async () => {
      const res = await request(app.getHttpServer())
        .get('/movements/reports')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
    });

    it('400 si year tiene menos de 4 dígitos (202)', async () => {
      const res = await request(app.getHttpServer())
        .get('/movements/reports?year=202')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 si year tiene más de 4 dígitos (20260)', async () => {
      const res = await request(app.getHttpServer())
        .get('/movements/reports?year=20260')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 si year no es un número (abcd)', async () => {
      const res = await request(app.getHttpServer())
        .get('/movements/reports?year=abcd')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 si year está fuera de rango (1800)', async () => {
      const res = await request(app.getHttpServer())
        .get('/movements/reports?year=1800')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /movements/reports — filtro de categorías (Fase 1.1.5/1.1.6)', () => {
    const CAT_A_ID = 'cat-reports-a';
    const CAT_B_ID = 'cat-reports-b';

    function makeAnnualRow(categoryId: string, monthKey: string, totalCents: number) {
      return {
        monthKey,
        categoryId,
        categoryName: categoryId === CAT_A_ID ? 'Cat A' : 'Cat B',
        categoryColor: '#4F86C6',
        categoryScope: 'EXPENSE',
        type: 'EXPENSE',
        totalCents: BigInt(totalCents),
      };
    }

    beforeEach(() => {
      mockPrisma.recurring.findMany.mockResolvedValue([]);
      mockPrisma.installmentGroup.findMany.mockResolvedValue([]);
    });

    it('sin param categories (ausente) → todas las categorías (estado "todas")', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          makeAnnualRow(CAT_A_ID, '2026-06', 1000),
          makeAnnualRow(CAT_B_ID, '2026-06', 2000),
        ])
        .mockResolvedValueOnce([{ earliestYear: BigInt(2026) }]);

      const res = await request(app.getHttpServer())
        .get('/movements/reports?year=2026')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      // Sin filtro: CAT_A + CAT_B = 3000
      expect(res.body.data.months[5].expenseCents).toBe(3000);
      expect(res.body.data.categories).toHaveLength(2);
    });

    it('categories= (vacío) → NINGUNA categoría: meses en cero, categories vacío (estado "ninguna")', async () => {
      // Con categories=vacío el service pasa [] y el filterSet es un Set vacío.
      // Ningún movimiento pasa el filtro → todo en cero.
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          makeAnnualRow(CAT_A_ID, '2026-06', 1000),
          makeAnnualRow(CAT_B_ID, '2026-06', 2000),
        ])
        .mockResolvedValueOnce([{ earliestYear: BigInt(2026) }]);

      const res = await request(app.getHttpServer())
        .get('/movements/reports?year=2026&categories=')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      // Ninguna categoría pasa el filtro vacío → todo en cero
      res.body.data.months.forEach((m: { expenseCents: number; incomeCents: number }) => {
        expect(m.expenseCents).toBe(0);
        expect(m.incomeCents).toBe(0);
      });
      expect(res.body.data.categories).toHaveLength(0);
    });

    it('categories= (vacío) → earliestYear NO se ve afectado (sigue calculándose sobre todos)', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          makeAnnualRow(CAT_A_ID, '2026-06', 1000),
        ])
        .mockResolvedValueOnce([{ earliestYear: BigInt(2023) }]);

      const res = await request(app.getHttpServer())
        .get('/movements/reports?year=2026&categories=')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.data.months[5].expenseCents).toBe(0); // filtrado
      expect(res.body.data.earliestYear).toBe(2023); // sin filtrar
    });

    it('categories=<id> → solo esa categoría cuenta en totales y desglose (estado "subconjunto")', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          makeAnnualRow(CAT_A_ID, '2026-06', 1000),
          makeAnnualRow(CAT_B_ID, '2026-06', 2000),
        ])
        .mockResolvedValueOnce([{ earliestYear: BigInt(2026) }]);

      const res = await request(app.getHttpServer())
        .get(`/movements/reports?year=2026&categories=${CAT_A_ID}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      // Solo CAT_A (1000); CAT_B queda fuera
      expect(res.body.data.months[5].expenseCents).toBe(1000);
      expect(res.body.data.categories).toHaveLength(1);
      expect(res.body.data.categories[0].categoryId).toBe(CAT_A_ID);
    });

    it('categories=<id1,id2> → ambas categorías cuentan', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          makeAnnualRow(CAT_A_ID, '2026-06', 1000),
          makeAnnualRow(CAT_B_ID, '2026-06', 2000),
        ])
        .mockResolvedValueOnce([{ earliestYear: BigInt(2026) }]);

      const res = await request(app.getHttpServer())
        .get(`/movements/reports?year=2026&categories=${CAT_A_ID},${CAT_B_ID}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      // Ambas → 3000
      expect(res.body.data.months[5].expenseCents).toBe(3000);
      expect(res.body.data.categories).toHaveLength(2);
    });

    it('id desconocido en categories → no matchea nada, no es 400', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          makeAnnualRow(CAT_A_ID, '2026-06', 1000),
        ])
        .mockResolvedValueOnce([{ earliestYear: BigInt(2026) }]);

      const res = await request(app.getHttpServer())
        .get('/movements/reports?year=2026&categories=id-inexistente')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      // El id no existe → nada matchea → totales en cero
      expect(res.body.data.months[5].expenseCents).toBe(0);
      expect(res.body.data.categories).toHaveLength(0);
    });

    it('earliestYear NO cambia al filtrar por categorías (estado "subconjunto")', async () => {
      // Todos los movimientos son de CAT_B, pero filtramos por CAT_A
      // El earliestYear debe ser el año más antiguo de TODOS los movimientos
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          makeAnnualRow(CAT_B_ID, '2026-06', 5000),
        ])
        .mockResolvedValueOnce([{ earliestYear: BigInt(2023) }]); // año más antiguo = 2023

      const res = await request(app.getHttpServer())
        .get(`/movements/reports?year=2026&categories=${CAT_A_ID}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      // Totales en cero (CAT_A no tiene datos)
      expect(res.body.data.months[5].expenseCents).toBe(0);
      // Pero earliestYear sigue siendo 2023 (ignora el filtro)
      expect(res.body.data.earliestYear).toBe(2023);
    });
  });

  describe('GET /movements/reports — autenticación', () => {
    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer())
        .get('/movements/reports?year=2026')
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // GET /movements/reports — override de moneda (P3)
  // -------------------------------------------------------------------------

  describe('GET /movements/reports — override de currency (P3)', () => {
    // Los happy-path de currency (200) se cubren en el unit spec de reports
    // (movements.reports.service.spec.ts) donde loadPivotRatesForYear ya está mockeado.
    // Aquí solo se validan los casos de rechazo 400 que no dependen del repo.

    it('currency inválido → 400 con sobre de error', async () => {
      const res = await request(app.getHttpServer())
        .get('/movements/reports?year=2026&currency=GBP')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
    });

    it('currency en minúsculas (ars) → 400 (enum es case-sensitive)', async () => {
      const res = await request(app.getHttpServer())
        .get('/movements/reports?year=2026&currency=ars')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
    });

    it('currency vacío ("") → 400 (no es un valor del enum)', async () => {
      const res = await request(app.getHttpServer())
        .get('/movements/reports?year=2026&currency=')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // GET /movements/reports/annual-inflation-income (P5)
  //
  // Estrategia de mock:
  //   - $queryRaw se llama en orden:
  //       1. getAnnualUnicosAggregated (únicos INCOME+EXPENSE del año)
  //       2. getUnicosIncomeForMonth (únicos INCOME de dic del año previo)
  //       3. getEarliestYear
  //       4. (loadPivotRatesForYear usa loadAllPivotRates → referenceRate.findMany)
  //   - inflationRate.findMany → loadInflationRatesForYear
  //   - recurring.findMany → getAllFijosForAnnual (incluye allSkips via recurringSkip.findMany)
  //   - installmentGroup.findMany → getAllCuotasForAnnual
  // -------------------------------------------------------------------------

  describe('GET /movements/reports/annual-inflation-income (P5)', () => {
    /** Helper: fila de único para getAnnualUnicosAggregated */
    function makeInflIncomUnicoRow(overrides: Record<string, unknown> = {}) {
      return {
        monthKey: '2025-01',
        categoryId: CAT_ID,
        categoryName: 'Sueldo',
        categoryColor: '#4F86C6',
        categoryScope: 'INCOME',
        type: 'INCOME',
        totalCents: BigInt(50000),
        currency: 'ARS',
        exchangeRate: '1',
        anchorCurrency: 'ARS',
        ...overrides,
      };
    }

    /** Helper: fila de único para getUnicosIncomeForMonth (dic previo) */
    function makePrevDecRow(overrides: Record<string, unknown> = {}) {
      return {
        categoryId: CAT_ID,
        categoryName: 'Sueldo',
        categoryColor: '#4F86C6',
        totalCents: BigInt(40000),
        currency: 'ARS',
        exchangeRate: '1',
        anchorCurrency: 'ARS',
        ...overrides,
      };
    }

    /** Configura los mocks para una corrida básica del endpoint */
    function setupInflationIncomeMocks({
      unicosYear = [] as unknown[],
      unicosPrevDec = [] as unknown[],
      earliestYear = null as bigint | null,
      inflationRates = [] as Array<{ yearMonth: string; monthlyVariation: number }>,
    } = {}) {
      // $queryRaw se llama en este orden:
      //   1. getAnnualUnicosAggregated (únicos del año)
      //   2. getUnicosIncomeForMonth (únicos INCOME de dic del año previo)
      //   3. getEarliestYear
      mockPrisma.$queryRaw
        .mockResolvedValueOnce(unicosYear)
        .mockResolvedValueOnce(unicosPrevDec)
        .mockResolvedValueOnce(
          earliestYear !== null ? [{ earliestYear }] : [{ earliestYear: null }],
        );
      // loadPivotRatesForYear → referenceRate.findMany (sin datos = Map vacío para tests básicos)
      mockPrisma.referenceRate.findMany.mockResolvedValue([]);
      // fijos y cuotas vacíos por defecto
      mockPrisma.recurring.findMany.mockResolvedValue([]);
      mockPrisma.installmentGroup.findMany.mockResolvedValue([]);
      // IPC
      mockPrisma.inflationRate.findMany.mockResolvedValue(
        inflationRates.map((r) => ({ yearMonth: r.yearMonth, monthlyVariation: r.monthlyVariation })),
      );
    }

    beforeEach(() => {
      // Defaults mínimos para que el endpoint no falle en las tablas requeridas
      mockPrisma.recurring.findMany.mockResolvedValue([]);
      mockPrisma.installmentGroup.findMany.mockResolvedValue([]);
      mockPrisma.inflationRate.findMany.mockResolvedValue([]);
      mockPrisma.referenceRate.findMany.mockResolvedValue([]);
    });

    it('200 + shape completo de AnnualInflationIncomeResponse', async () => {
      setupInflationIncomeMocks({
        unicosYear: [makeInflIncomUnicoRow({ monthKey: '2025-03', totalCents: BigInt(50000) })],
        unicosPrevDec: [makePrevDecRow({ totalCents: BigInt(40000) })],
        earliestYear: BigInt(2025),
        inflationRates: [{ yearMonth: '2025-01', monthlyVariation: 3.5 }],
      });

      const res = await request(app.getHttpServer())
        .get('/movements/reports/annual-inflation-income?year=2025&today=2025-12-31')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.statusCode).toBe(200);

      const data = res.body.data;
      expect(data).toHaveProperty('year', 2025);
      expect(data).toHaveProperty('currency', 'ARS');
      expect(data).toHaveProperty('months');
      expect(data).toHaveProperty('incomeTrend');
      expect(data).toHaveProperty('incomeAdjTrend');
      expect(data).toHaveProperty('earliestYear', 2025);
      expect(data).toHaveProperty('availableCategories');

      // months: siempre 12 entradas
      expect(Array.isArray(data.months)).toBe(true);
      expect(data.months).toHaveLength(12);

      // Cada mes tiene los campos correctos
      data.months.forEach((m: Record<string, unknown>) => {
        expect(m).toHaveProperty('inflationPct');
        expect(m).toHaveProperty('incomePct');
        expect(m).toHaveProperty('incomePctAdj');
      });

      // Enero tiene IPC = 3.5
      expect(data.months[0].inflationPct).toBe(3.5);

      // incomeTrend tiene shape correcto
      expect(data.incomeTrend).toHaveProperty('slope');
      expect(data.incomeTrend).toHaveProperty('intercept');
      expect(data.incomeTrend).toHaveProperty('points');
    });

    it('enero usa diciembre del año previo → incomePct calculado vs dic-2024', async () => {
      // Dic 2024: 40000; Enero 2025: 50000 → incomePct = ROUNDDOWN((50000*100/40000)-100, 2) = 25.00
      setupInflationIncomeMocks({
        unicosYear: [makeInflIncomUnicoRow({ monthKey: '2025-01', totalCents: BigInt(50000) })],
        unicosPrevDec: [makePrevDecRow({ totalCents: BigInt(40000) })],
        earliestYear: BigInt(2025),
      });

      const res = await request(app.getHttpServer())
        .get('/movements/reports/annual-inflation-income?year=2025&today=2025-12-31')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.data.months[0].incomePct).toBe(25.00);
    });

    it('meses futuros del año en curso → incomePct null', async () => {
      // Today = 2025-06-25, año 2025 → meses 7..12 son futuros
      setupInflationIncomeMocks({
        // Inyectamos ingreso en todos los meses para que solo los futuros sean null
        unicosYear: Array.from({ length: 12 }, (_, i) =>
          makeInflIncomUnicoRow({
            monthKey: `2025-${String(i + 1).padStart(2, '0')}`,
            totalCents: BigInt(50000),
          }),
        ),
        unicosPrevDec: [makePrevDecRow({ totalCents: BigInt(40000) })],
        earliestYear: BigInt(2025),
      });

      const res = await request(app.getHttpServer())
        .get('/movements/reports/annual-inflation-income?year=2025&today=2025-06-25')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      // Enero..junio → no null (pasados o en curso)
      expect(res.body.data.months[0].incomePct).not.toBeNull();
      expect(res.body.data.months[5].incomePct).not.toBeNull();
      // Julio..diciembre → null (futuros)
      expect(res.body.data.months[6].incomePct).toBeNull();
      expect(res.body.data.months[11].incomePct).toBeNull();
    });

    it('previo en 0 → incomePct null', async () => {
      // Dic previo sin datos → prevDecIncome = 0 → enero incomePct null
      setupInflationIncomeMocks({
        unicosYear: [makeInflIncomUnicoRow({ monthKey: '2025-01', totalCents: BigInt(50000) })],
        unicosPrevDec: [], // sin datos de dic previo
        earliestYear: BigInt(2025),
      });

      const res = await request(app.getHttpServer())
        .get('/movements/reports/annual-inflation-income?year=2025&today=2025-12-31')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.data.months[0].incomePct).toBeNull();
    });

    it('filtro de categorías: categories= (vacío) → incomePct null (previo=0 por filtro)', async () => {
      // Con filtro vacío, ningún ingreso pasa → previo=0 → incomePct null
      setupInflationIncomeMocks({
        unicosYear: [makeInflIncomUnicoRow({ monthKey: '2025-01', totalCents: BigInt(50000) })],
        unicosPrevDec: [makePrevDecRow({ totalCents: BigInt(40000) })],
        earliestYear: BigInt(2025),
      });

      const res = await request(app.getHttpServer())
        .get('/movements/reports/annual-inflation-income?year=2025&today=2025-12-31&categories=')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.data.months[0].incomePct).toBeNull();
      // availableCategories sigue teniendo las categorías (no afectada por el filtro)
      expect(res.body.data.availableCategories).toHaveLength(1);
    });

    it('400 si falta year', async () => {
      const res = await request(app.getHttpServer())
        .get('/movements/reports/annual-inflation-income')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
    });

    it('400 si currency es inválido (GBP)', async () => {
      const res = await request(app.getHttpServer())
        .get('/movements/reports/annual-inflation-income?year=2025&currency=GBP')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
    });

    it('400 si currency está vacío', async () => {
      const res = await request(app.getHttpServer())
        .get('/movements/reports/annual-inflation-income?year=2025&currency=')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
    });

    it('401 sin JWT', async () => {
      const res = await request(app.getHttpServer())
        .get('/movements/reports/annual-inflation-income?year=2025')
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(401);
    });

    it('200 con año vacío → 12 meses todos null, earliestYear null, availableCategories []', async () => {
      setupInflationIncomeMocks({
        unicosYear: [],
        unicosPrevDec: [],
        earliestYear: null,
      });

      const res = await request(app.getHttpServer())
        .get('/movements/reports/annual-inflation-income?year=2025&today=2025-12-31')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const data = res.body.data;
      expect(data.year).toBe(2025);
      expect(data.months).toHaveLength(12);
      data.months.forEach((m: Record<string, unknown>) => {
        expect(m.inflationPct).toBeNull();
        expect(m.incomePct).toBeNull();
        expect(m.incomePctAdj).toBeNull();
      });
      expect(data.earliestYear).toBeNull();
      expect(data.availableCategories).toEqual([]);
    });
  });
});
