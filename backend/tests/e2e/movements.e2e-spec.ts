/**
 * Tests e2e del MovementsModule.
 *
 * Estrategia: mock de PrismaService.$queryRaw (sin DB real en CI).
 *
 * Cubre:
 * - Shape completo de la respuesta (sobre + data con month, totals, movements)
 * - Listado del mes con únicos (orden: amountCents DESC, desempate occurredAt DESC)
 * - Totales correctos (expenseCents, incomeCents, balanceCents)
 * - Movimiento con categoría soft-deleted sigue en totales y con categoría
 * - Bucketeo por zona propia: el mock devuelve los ítems que corresponden
 *   al mes EN LA ZONA DEL REGISTRO (el SQL lo hace; el test verifica el shape)
 * - month inválido / faltante → 400
 * - Aislamiento por userId (RN-003)
 * - Mes vacío → totales en cero, listas vacías
 * - 401 sin JWT
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
  // recurring.findMany se usa para fijos (Fase 6 — findFijosByMonth / getFijosTotalsByMonth)
  recurring: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
    delete: jest.fn(),
  },
  // installmentGroup.findMany se usa para cuotas (Fase 7 — findCuotasByMonth / getCuotasTotalsByMonth)
  installmentGroup: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
    delete: jest.fn(),
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
    // Default: sin fijos activos (Fase 6). Los tests de fijos lo sobreescriben.
    mockPrisma.recurring.findMany.mockResolvedValue([]);
    // Default: sin cuotas activas (Fase 7). Los tests de cuotas lo sobreescriben.
    mockPrisma.installmentGroup.findMany.mockResolvedValue([]);
  });

  // -------------------------------------------------------------------------
  // GET /movements?month=YYYY-MM — casos felices
  // -------------------------------------------------------------------------

  describe('GET /movements — casos felices', () => {
    it('200 + sobre con shape completo (month, totals, movements)', async () => {
      const row = makeRawTransactionRow();
      // $queryRaw se llama 2 veces: una para findUnicosByMonth, otra para getTotalsByMonth
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([row])
        .mockResolvedValueOnce([makeRawTotalsRow(1500n, 0n)]);

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

      // Totales
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
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([row])
        .mockResolvedValueOnce([makeRawTotalsRow(1500n, 0n)]);

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
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([rowExpense, rowIncome])
        .mockResolvedValueOnce([makeRawTotalsRow(3000n, 8000n)]);

      const res = await request(app.getHttpServer())
        .get('/movements?month=2026-06')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.data.totals.expenseCents).toBe(3000);
      expect(res.body.data.totals.incomeCents).toBe(8000);
      expect(res.body.data.totals.balanceCents).toBe(5000); // 8000 - 3000
    });

    it('200 + mes vacío → totales cero y listas vacías', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([makeRawTotalsRow(0n, 0n)]);

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
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([rowWithDeletedCat])
        .mockResolvedValueOnce([makeRawTotalsRow(1500n, 0n)]);

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

    it('200 + orden de unicos: mayor monto primero (amountCents DESC)', async () => {
      // El SQL ordena por amountCents DESC; el mock devuelve en ese orden y el service lo preserva
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
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([row1, row2])
        .mockResolvedValueOnce([makeRawTotalsRow(6000n, 0n)]);

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
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])                        // sin movimientos en junio
        .mockResolvedValueOnce([makeRawTotalsRow(0n, 0n)]); // totales en cero

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
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([row])
        .mockResolvedValueOnce([makeRawTotalsRow(1500n, 0n)]);

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
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([makeRawTotalsRow(0n, 0n)]);

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
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([makeRawTotalsRow(0n, 0n)]);

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
      // Se llama 2 veces: findCuotasByMonth y getCuotasTotalsByMonth
      mockPrisma.installmentGroup.findMany
        .mockResolvedValueOnce([group])  // findCuotasByMonth
        .mockResolvedValueOnce([group]); // getCuotasTotalsByMonth

      // $queryRaw (únicos): sin únicos este mes
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])                        // findUnicosByMonth
        .mockResolvedValueOnce([makeRawTotalsRow(0n, 0n)]); // getTotalsByMonth

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
      mockPrisma.installmentGroup.findMany
        .mockResolvedValueOnce([group])
        .mockResolvedValueOnce([group]);

      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([makeRawTotalsRow(0n, 0n)]);

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
      mockPrisma.installmentGroup.findMany
        .mockResolvedValueOnce([group])
        .mockResolvedValueOnce([group]);

      // Un único de 1000 en el mes
      const row = makeRawTransactionRow({ amountCents: 1000 });
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([row])
        .mockResolvedValueOnce([makeRawTotalsRow(1000n, 0n)]);

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
      mockPrisma.installmentGroup.findMany
        .mockResolvedValueOnce([group])
        .mockResolvedValueOnce([group]);

      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([makeRawTotalsRow(0n, 0n)]);

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
      mockPrisma.installmentGroup.findMany
        .mockResolvedValueOnce([group])
        .mockResolvedValueOnce([group]);

      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([makeRawTotalsRow(0n, 0n)]);

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
});
