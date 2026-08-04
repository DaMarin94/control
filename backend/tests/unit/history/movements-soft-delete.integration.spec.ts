/**
 * Test de integración contra Postgres REAL — RF-HIST-006 / Módulo 3.14.
 *
 * Es el "e2e que no puede faltar" pedido para el historial de cambios: un
 * movimiento con borrado lógico (`deletedAt`) no debe aparecer en `/movements`
 * (findUnicosByMonth/findFijosByMonth/findCuotasByMonth), ni sumar a los
 * totales del mes (getTotalsByMonth), ni entrar en la agregación anual que
 * alimenta `/movements/reports` (getAnnualUnicosAggregated).
 *
 * GOTCHA DE INFRAESTRUCTURA: a diferencia de TODO el resto de la suite (que
 * mockea PrismaService — "sin DB real en CI"), este test necesita ejecutar
 * las queries `$queryRaw` REALES contra Postgres: un mock nunca podría
 * validar que el fragmento SQL `AND t."deletedAt" IS NULL` realmente filtra
 * (un mock devuelve lo que se le dice sin importar el WHERE). Usa el mismo
 * DATABASE_URL que `prisma migrate` (ver backend/.env / prisma.config.ts) en
 * vez de la URL falsa `test:test@localhost:5432/test` que fija
 * tests/e2e/jest-e2e-setup.ts para el resto de los e2e (mockeados). Si el
 * entorno de CI no tiene un Postgres migrado alcanzable en esa URL, este
 * test específico necesita ajustarse (documentado en el reporte de la tarea).
 *
 * Se conecta directo con PrismaClient + adapter-pg (sin pasar por
 * NestJS/ConfigService) para no depender de la validación Zod de env vars
 * no relacionadas (JWT_SECRET, etc.) — MovementsRepository solo necesita un
 * objeto con la forma de PrismaClient.
 */
import { PrismaClient, CategoryScope, MovementType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { MovementsRepository } from '../../../src/movements/movements.repository';

const DATABASE_URL =
  process.env.DATABASE_URL_INTEGRATION ??
  'postgresql://postgres:admin@localhost:5432/control_dev';

describe('MovementsRepository — borrado lógico excluye de listados/totales/reportes (integración Postgres real, RF-HIST-006)', () => {
  let prisma: PrismaClient;
  let repo: MovementsRepository;
  let userId: string;
  let categoryId: string;

  beforeAll(async () => {
    const adapter = new PrismaPg({ connectionString: DATABASE_URL });
    prisma = new PrismaClient({ adapter });

    repo = new MovementsRepository(prisma as unknown as ConstructorParameters<typeof MovementsRepository>[0]);

    const user = await prisma.user.create({
      data: {
        email: `hist-softdelete-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`,
        timezone: 'America/Argentina/Buenos_Aires',
      },
    });
    userId = user.id;

    const category = await prisma.category.create({
      data: {
        userId,
        name: 'Test Softdelete',
        scope: CategoryScope.EXPENSE,
        color: '#000000',
      },
    });
    categoryId = category.id;
  });

  afterAll(async () => {
    // Limpieza en orden por FK: Transaction -> Category -> User.
    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.category.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it('un único con deletedAt desaparece de la lista, de los totales del mes y de la agregación anual', async () => {
    const tx = await prisma.transaction.create({
      data: {
        userId,
        categoryId,
        type: MovementType.EXPENSE,
        amountCents: 12345,
        occurredAt: new Date('2026-05-15T12:00:00Z'),
        timezone: 'America/Argentina/Buenos_Aires',
      },
    });

    try {
      // Pre-condición: antes del borrado, el único aparece y suma.
      const before = await repo.findUnicosByMonth(userId, '2026-05');
      expect(before.some((m) => m.id === tx.id)).toBe(true);

      const totalsBefore = await repo.getTotalsByMonth(userId, '2026-05');
      expect(totalsBefore.expenseCents).toBe(12345);

      const annualBefore = await repo.getAnnualUnicosAggregated(userId, 2026);
      expect(annualBefore.some((r) => r.categoryId === categoryId)).toBe(true);

      // Borrado lógico (RF-HIST-006) — lo que hace TransactionsService.remove().
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { deletedAt: new Date() },
      });

      // Post-condición: el mismo único desaparece de TODAS las lecturas de negocio.
      const after = await repo.findUnicosByMonth(userId, '2026-05');
      expect(after.some((m) => m.id === tx.id)).toBe(false);

      const totalsAfter = await repo.getTotalsByMonth(userId, '2026-05');
      expect(totalsAfter.expenseCents).toBe(0);
      expect(totalsAfter.incomeCents).toBe(0);

      const annualAfter = await repo.getAnnualUnicosAggregated(userId, 2026);
      expect(annualAfter.some((r) => r.categoryId === categoryId)).toBe(false);

      // getEarliestYear (usado para acotar el rango de /movements/reports) también
      // debe ignorar el registro soft-deleted: si era el único movimiento del
      // usuario, ya no debe reportar 2026 como año con datos.
      const earliestYear = await repo.getEarliestYear(userId);
      expect(earliestYear).toBeNull();
    } finally {
      await prisma.transaction.deleteMany({ where: { id: tx.id } });
    }
  });
});
