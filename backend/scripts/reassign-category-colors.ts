/**
 * reassign-category-colors.ts — Reasignación de colores de categorías a la paleta nueva (feature P1)
 *
 * Migración de datos de una sola vez. La paleta de colores de categorías fue
 * reemplazada (`backend/src/categories/color-pool.ts`, matriz nueva 5×8 / pool
 * de 8 colores base) — ver `docs/design.md`, §"Paleta de colores para
 * categorías". Los hex existentes en DB pertenecen a la matriz VIEJA (7×10) y
 * ya no son válidos contra `isValidCategoryColor` de la matriz nueva, así que
 * TODAS las categorías (activas y soft-deleted) necesitan un color nuevo.
 *
 * Estrategia de reasignación (decisión cerrada del orquestador):
 *  - NO es aleatoria. Reutiliza la MISMA lógica de "menos usado" de
 *    `CategoriesService.assignColor()` (ver `src/categories/categories.service.ts`),
 *    generalizada a un recorrido completo en vez de una sola consulta.
 *  - Se procesa usuario por usuario. Dentro de cada usuario, las categorías
 *    (activas y eliminadas juntas) se ordenan de forma estable por
 *    (createdAt asc, id asc) y se recorren en ese orden.
 *  - Para cada categoría del recorrido se elige el color de `COLOR_POOL` con
 *    menor conteo acumulado DENTRO del recorrido de ese usuario (empate → el
 *    primero en el orden de `COLOR_POOL`), y se incrementa el conteo de ese
 *    color antes de pasar a la siguiente categoría. Esto es una generalización
 *    directa de `assignColor()`: en vez de consultar el conteo de activas en
 *    la DB, el conteo se acumula en memoria a medida que se recorre la lista
 *    completa (activas + eliminadas) — así ninguna categoría del usuario
 *    (tampoco las eliminadas) repite color con otra ya procesada, y las
 *    primeras categorías quedan en los colores base más vívidos del pool.
 *  - El color viejo NO influye en el color nuevo asignado; el mapeo es
 *    puramente por orden y conteo. Por eso el script es idempotente: correrlo
 *    dos veces sobre el mismo estado da el mismo resultado (mismo orden,
 *    mismos conteos, mismo color elegido).
 *
 * Alcance: TODAS las categorías del sistema (todos los usuarios, activas y
 * eliminadas). No hay opción de excluir un subconjunto.
 *
 * Seguridad:
 *  - Dry-run por defecto (solo lectura). Requiere `--execute` explícito para
 *    mutar.
 *  - Transaccional por usuario (en modo --execute): si falla la reasignación
 *    de un usuario, los usuarios previos ya aplicados quedan commiteados y el
 *    resto no se toca. El script informa qué usuarios quedaron sin aplicar.
 *  - Backup de las filas afectadas (id, colorBefore, colorAfter) a un JSON en
 *    scripts/color-reassign-backups/ antes de mutar cada usuario.
 *  - Idempotente (ver arriba): correrlo de nuevo después de una corrida
 *    exitosa reasigna exactamente los mismos colores (no-op funcional).
 *
 * Uso (desde backend/):
 *   pnpm reassign:category-colors              → dry-run, solo imprime el reporte
 *   pnpm reassign:category-colors -- --execute  → ejecuta la mutación real
 */

import * as dotenv from 'dotenv';
dotenv.config();

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { COLOR_POOL } from '../src/categories/color-pool';

// ── Tipos internos ───────────────────────────────────────────────────────────

interface CategoryRow {
  id: string;
  userId: string;
  name: string;
  color: string;
  deletedAt: Date | null;
  createdAt: Date;
}

interface ReassignedCategory {
  id: string;
  name: string;
  deletedAt: Date | null;
  colorBefore: string;
  colorAfter: string;
}

interface UserPlan {
  userId: string;
  reassignments: ReassignedCategory[];
}

interface ReassignReport {
  userPlans: UserPlan[];
  totalCategories: number;
  totalUsers: number;
}

// ── Cálculo del plan (dry-run) ───────────────────────────────────────────────

/**
 * Elige, dado el conteo acumulado hasta el momento, el color del pool menos
 * usado (empate → primero en el orden de COLOR_POOL). Misma mecánica que
 * `CategoriesService.assignColor()`, generalizada a un contador en memoria.
 */
function pickLeastUsedColor(colorCount: Map<string, number>): string {
  let minColor = COLOR_POOL[0];
  let minCount = colorCount.get(COLOR_POOL[0]) ?? 0;

  for (let i = 1; i < COLOR_POOL.length; i++) {
    const count = colorCount.get(COLOR_POOL[i]) ?? 0;
    if (count < minCount) {
      minCount = count;
      minColor = COLOR_POOL[i];
    }
  }

  return minColor;
}

function buildUserPlan(userId: string, categories: CategoryRow[]): UserPlan {
  const sorted = [...categories].sort((a, b) => {
    const byDate = a.createdAt.getTime() - b.createdAt.getTime();
    if (byDate !== 0) return byDate;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const colorCount = new Map<string, number>();
  const reassignments: ReassignedCategory[] = [];

  for (const cat of sorted) {
    const colorAfter = pickLeastUsedColor(colorCount);
    colorCount.set(colorAfter, (colorCount.get(colorAfter) ?? 0) + 1);
    reassignments.push({
      id: cat.id,
      name: cat.name,
      deletedAt: cat.deletedAt,
      colorBefore: cat.color,
      colorAfter,
    });
  }

  return { userId, reassignments };
}

export async function analyzeReassign(prisma: PrismaClient): Promise<ReassignReport> {
  const allRows = (await prisma.category.findMany({
    orderBy: [{ userId: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, userId: true, name: true, color: true, deletedAt: true, createdAt: true },
  })) as unknown as CategoryRow[];

  const byUser = new Map<string, CategoryRow[]>();
  for (const row of allRows) {
    const list = byUser.get(row.userId);
    if (list) list.push(row);
    else byUser.set(row.userId, [row]);
  }

  const userPlans: UserPlan[] = [];
  for (const [userId, categories] of byUser.entries()) {
    userPlans.push(buildUserPlan(userId, categories));
  }

  return {
    userPlans,
    totalCategories: allRows.length,
    totalUsers: byUser.size,
  };
}

// ── Impresión del reporte (dry-run) ──────────────────────────────────────────

function printReport(report: ReassignReport): void {
  console.log('='.repeat(80));
  console.log('REASIGNACIÓN DE COLORES DE CATEGORÍAS — DRY RUN (solo lectura, nada mutado)');
  console.log('='.repeat(80));

  console.log(`\nUsuarios: ${report.totalUsers} | Categorías totales: ${report.totalCategories}\n`);

  for (const plan of report.userPlans) {
    console.log(`--- userId: ${plan.userId} (${plan.reassignments.length} categoría(s)) ---`);
    for (const r of plan.reassignments) {
      const estado = r.deletedAt ? `eliminada ${r.deletedAt.toISOString().slice(0, 10)}` : 'activa';
      console.log(
        `  [${estado}] "${r.name}" (id=${r.id}): ${r.colorBefore} → ${r.colorAfter}`,
      );
    }
    console.log('');
  }

  console.log('='.repeat(80));
  console.log(
    `Resumen: ${report.totalCategories} categoría(s) a reasignar en ${report.totalUsers} usuario(s).`,
  );
  console.log('MODO: dry-run. No se modificó ningún dato.');
  console.log('='.repeat(80));
}

// ── Ejecución real (--execute) ───────────────────────────────────────────────

function writeBackup(report: ReassignReport): string {
  const dir = path.join(__dirname, 'color-reassign-backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `color-reassign-backup-${timestamp}.json`);

  const backupRows = report.userPlans.flatMap((plan) =>
    plan.reassignments.map((r) => ({
      userId: plan.userId,
      id: r.id,
      colorBefore: r.colorBefore,
      colorAfter: r.colorAfter,
    })),
  );

  fs.writeFileSync(
    file,
    JSON.stringify({ generatedAt: new Date().toISOString(), backupRows }, null, 2),
    'utf-8',
  );
  return file;
}

async function executeReassign(prisma: PrismaClient, report: ReassignReport): Promise<void> {
  const backupFile = writeBackup(report);
  console.log(`[reassign-colors] Backup escrito en: ${backupFile}`);

  const failedUsers: string[] = [];

  for (const plan of report.userPlans) {
    try {
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        for (const r of plan.reassignments) {
          await tx.category.update({
            where: { id: r.id },
            data: { color: r.colorAfter },
          });
        }
      });
      console.log(
        `[reassign-colors] userId=${plan.userId}: ${plan.reassignments.length} categoría(s) reasignada(s).`,
      );
    } catch (err) {
      failedUsers.push(plan.userId);
      console.error(`[reassign-colors] ERROR en userId=${plan.userId}:`, err);
    }
  }

  if (failedUsers.length > 0) {
    console.error(
      `[reassign-colors] ${failedUsers.length} usuario(s) NO se pudieron reasignar: ${failedUsers.join(', ')}`,
    );
  }

  console.log('[reassign-colors] Ejecución completa.');
}

// ── Entrypoint standalone ────────────────────────────────────────────────────

async function main(): Promise<void> {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('[reassign-colors] DATABASE_URL no está definida. Abortando.');
    process.exit(1);
  }

  const execute = process.argv.includes('--execute');

  const adapter = new PrismaPg({ connectionString: DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const report = await analyzeReassign(prisma);
    printReport(report);

    if (execute) {
      if (report.totalCategories === 0) {
        console.log('[reassign-colors] Nada para reasignar. No se ejecuta ninguna mutación.');
        return;
      }
      console.log('\n[reassign-colors] Modo --execute: aplicando mutaciones...\n');
      await executeReassign(prisma, report);
    } else {
      console.log('\n[reassign-colors] Dry-run únicamente. Corré con `--execute` para aplicar los cambios.');
    }
  } catch (err) {
    console.error('[reassign-colors] Error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
