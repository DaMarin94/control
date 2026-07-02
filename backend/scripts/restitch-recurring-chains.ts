/**
 * restitch-recurring-chains.ts — Re-stitch de cadenas de fijos fragmentadas (chainId)
 *
 * Limpieza de datos legacy de una sola vez. Antes de la migración de `chainId`
 * (Fase 1.1.7), un fijo editado mes a mes quedaba guardado como VARIAS filas
 * `Recurring` independientes (una por tramo), cada una con su propio `chainId`.
 * La lógica de edición actual YA NO fragmenta (el split hereda `chainId` — ver
 * recurring.service.ts líneas 239 y 365): esto NO es un fix de un bug activo,
 * es limpieza de datos legacy.
 *
 * Decisiones cerradas aplicadas en este script (v2 — identidad por descripción):
 *  - Identidad: el usuario confirmó que NO existen dos fijos distintos del
 *    mismo usuario con la misma descripción → la descripción (trim, EXACTA,
 *    sin normalizar case/acentos) es la identidad ÚNICA de un fijo. Se agrupa
 *    por (userId, description) SOLAMENTE — category/type/frequency/currency
 *    YA NO son parte de la clave de identidad (pueden variar entre tramos del
 *    mismo fijo sin impedir el merge; se flaggean si varían, ver abajo).
 *    description = null NUNCA se fusiona (sin señal de identidad — flag).
 *  - Ya NO se exige encadenamiento perfecto sin huecos para agrupar: dos
 *    tramos con la misma descripción son el mismo fijo aunque haya un hueco
 *    en el medio (baja + re-alta). El hueco se reporta, no bloquea el merge.
 *  - Solapamiento (dos tramos de la misma descripción activos el mismo mes)
 *    SÍ bloquea el merge — es una anomalía real (doble conteo). Se flaggea
 *    para que el usuario decida, el grupo entero NO se fusiona.
 *  - Tramos de la misma descripción con moneda/tipo/categoría/frecuencia
 *    distinta entre sí: NO bloquean el merge (puede ser que el usuario
 *    cambió algo), pero se flaggean en el reporte para que el usuario lo vea.
 *  - Merge: sobrevive el chainId del tramo más antiguo (menor startMonth).
 *    Se re-apunta chainId de los tramos absorbidos y sourceChainId de los
 *    calculados-de-fijo dependientes. Solo esos dos campos cambian.
 *  - Calculados-de-fijo: se agrupan por (userId, description, sourceChainId
 *    EFECTIVO post-normalización de fijos) — la descripción sola no alcanza
 *    como identidad acá porque el usuario solo confirmó la unicidad para
 *    FIJOS, no para calculados (dos calculados de fijos distintos podrían
 *    compartir texto, ej. "50%"). Mismas relajaciones de huecos/mixed-fields
 *    que arriba, ancladas al sourceChainId efectivo.
 *  - Calculados-de-único (sourceMovementId) y de-cuota (sourceInstallmentGroupId)
 *    quedan excluidos por completo (autolimitados, no son cadenas de fijo).
 *
 * Seguridad:
 *  - Dry-run por defecto (solo lectura). Requiere `--execute` explícito para
 *    mutar.
 *  - Idempotente: tras una pasada cada fijo lógico queda bajo un único
 *    chainId ⇒ ya no hay "≥2 chainIds por descripción" ⇒ una segunda pasada
 *    no encuentra merge groups (no-op).
 *  - Transaccional por merge group (en modo --execute).
 *  - Backup de las filas afectadas (id, chainId, sourceChainId previos) a un
 *    JSON en scripts/restitch-backups/ antes de mutar cada grupo.
 *
 * Uso (desde backend/):
 *   pnpm restitch:recurring-chains              → dry-run, solo imprime el reporte
 *   pnpm restitch:recurring-chains -- --execute  → ejecuta la mutación real
 */

import * as dotenv from 'dotenv';
dotenv.config();

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// ── Tipos internos ───────────────────────────────────────────────────────────

interface RecurringRow {
  id: string;
  userId: string;
  categoryId: string;
  type: string;
  amountCents: number;
  description: string | null;
  startMonth: string;
  deletedFrom: string | null;
  frequency: string;
  currency: string;
  chainId: string;
  sourceChainId: string | null;
  sourceMovementId: string | null;
  sourceInstallmentGroupId: string | null;
  createdAt: Date;
}

type OriginKind = 'fijo' | 'calculado-de-fijo' | 'excluido';

function originKindOf(row: RecurringRow): OriginKind {
  if (row.sourceMovementId || row.sourceInstallmentGroupId) return 'excluido'; // C-excl
  if (row.sourceChainId) return 'calculado-de-fijo';
  return 'fijo';
}

/** Nota informativa sobre un grupo aceptado o rechazado (no bloquean el merge, salvo overlap). */
type GroupNote =
  | { kind: 'gap'; detail: string }
  | { kind: 'mixed-currency'; detail: string }
  | { kind: 'mixed-type'; detail: string }
  | { kind: 'mixed-category'; detail: string }
  | { kind: 'mixed-frequency'; detail: string };

interface AcceptedGroup {
  originKind: 'fijo' | 'calculado-de-fijo';
  userId: string;
  description: string; // nunca null acá (null se excluye siempre)
  sourceChainIdBefore: string | null; // solo relevante para calculado-de-fijo
  tramos: RecurringRow[]; // ordenados por startMonth
  survivorChainId: string;
  absorbedChainIds: string[];
  notes: GroupNote[];
}

interface RejectedGroup {
  reason: 'overlap' | 'description-null';
  detail: string;
  userId: string;
  description: string | null;
  tramos: RecurringRow[];
}

/** Grupo SANO (1 solo chainId) — no se fusiona, se reporta solo en el modo inventario. */
interface SanoGroup {
  originKind: 'fijo' | 'calculado-de-fijo';
  userId: string;
  description: string | null;
  chainId: string;
  tramos: RecurringRow[];
  suspectedLostEdit: boolean; // "edición comida": ≥2 tramos con amountCents idéntico
}

interface CalculatedRepoint {
  id: string;
  description: string | null;
  oldSourceChainId: string;
  newSourceChainId: string;
}

interface RestitchReport {
  acceptedGroups: AcceptedGroup[];
  rejectedGroups: RejectedGroup[];
  sanoGroups: SanoGroup[];
  calculatedRepoints: CalculatedRepoint[];
}

// ── Utilidades de agrupamiento ───────────────────────────────────────────────

function normalizeDescription(d: string | null): string | null {
  if (d === null) return null;
  return d.trim();
}

function monthCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Fin efectivo de un tramo para comparación de intervalos: null (vigente) = infinito. */
const INFINITY_MONTH = '9999-12';
function effectiveEnd(row: RecurringRow): string {
  return row.deletedFrom ?? INFINITY_MONTH;
}

/**
 * Identidad de agrupamiento:
 *  - fijo: (userId, description) — SOLAMENTE. category/type/frequency/currency
 *    NO participan (pueden variar entre tramos del mismo fijo).
 *  - calculado-de-fijo: (userId, description, sourceChainId EFECTIVO) — se
 *    ancla al sourceChainId porque la unicidad de descripción no está
 *    confirmada para calculados.
 */
function identityKey(row: RecurringRow, sourceChainIdOverride?: string): string {
  const desc = normalizeDescription(row.description);
  const descTag = desc === null ? 'NULL' : desc;
  if (originKindOf(row) === 'calculado-de-fijo') {
    return [row.userId, descTag, 'calc', sourceChainIdOverride ?? row.sourceChainId].join('|||');
  }
  return [row.userId, descTag, 'fijo'].join('|||');
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return map;
}

interface OverlapCheckResult {
  hasOverlap: boolean;
  overlapDetail: string;
}

/**
 * Detecta cualquier solapamiento temporal entre los tramos de un grupo
 * (independientemente de chainId), comparando todos los pares de intervalos
 * [startMonth, effectiveEnd). No asume encadenamiento perfecto ni ausencia
 * de huecos — solo detecta intersección real de rangos.
 */
function detectOverlap(tramosSorted: RecurringRow[]): OverlapCheckResult {
  for (let i = 0; i < tramosSorted.length; i++) {
    for (let j = i + 1; j < tramosSorted.length; j++) {
      const a = tramosSorted[i];
      const b = tramosSorted[j];
      const overlaps = monthCompare(a.startMonth, effectiveEnd(b)) < 0 && monthCompare(b.startMonth, effectiveEnd(a)) < 0;
      if (overlaps) {
        return {
          hasOverlap: true,
          overlapDetail: `tramo ${a.id} [${a.startMonth} → ${a.deletedFrom ?? 'vigente'}] se solapa con tramo ${b.id} [${b.startMonth} → ${b.deletedFrom ?? 'vigente'}]`,
        };
      }
    }
  }
  return { hasOverlap: false, overlapDetail: '' };
}

/** Huecos en la línea de tiempo de un grupo sin overlap (informativo, no bloquea). */
function detectGaps(tramosSorted: RecurringRow[]): GroupNote[] {
  const notes: GroupNote[] = [];
  for (let i = 0; i < tramosSorted.length - 1; i++) {
    const cur = tramosSorted[i];
    const next = tramosSorted[i + 1];
    if (cur.deletedFrom !== null && monthCompare(cur.deletedFrom, next.startMonth) < 0) {
      notes.push({
        kind: 'gap',
        detail: `hueco entre tramo ${cur.id} (termina ${cur.deletedFrom}) y tramo ${next.id} (empieza ${next.startMonth})`,
      });
    }
  }
  return notes;
}

/** Campos que pueden variar entre tramos de la misma identidad — solo informativo. */
function detectMixedFields(tramos: RecurringRow[]): GroupNote[] {
  const notes: GroupNote[] = [];
  const currencies = new Set(tramos.map((t) => t.currency));
  if (currencies.size > 1) {
    notes.push({ kind: 'mixed-currency', detail: `monedas distintas entre tramos: ${[...currencies].join(', ')}` });
  }
  const types = new Set(tramos.map((t) => t.type));
  if (types.size > 1) {
    notes.push({ kind: 'mixed-type', detail: `type distinto entre tramos: ${[...types].join(', ')}` });
  }
  const categories = new Set(tramos.map((t) => t.categoryId));
  if (categories.size > 1) {
    notes.push({ kind: 'mixed-category', detail: `categoryId distinto entre tramos: ${[...categories].join(', ')}` });
  }
  const frequencies = new Set(tramos.map((t) => t.frequency));
  if (frequencies.size > 1) {
    notes.push({ kind: 'mixed-frequency', detail: `frequency distinta entre tramos: ${[...frequencies].join(', ')}` });
  }
  return notes;
}

/**
 * Corre el algoritmo de detección de merge groups sobre un universo de filas
 * ya filtrado por originKind (fijos normales, o calculados-de-fijo).
 * `sourceChainIdOverrideFor` permite pasar el sourceChainId "efectivo" (post
 * re-apuntado) cuando se procesan calculados-de-fijo en la segunda pasada.
 */
function detectGroups(
  rows: RecurringRow[],
  originLabel: 'fijo' | 'calculado-de-fijo',
  sourceChainIdOverrideFor?: (row: RecurringRow) => string,
): { accepted: AcceptedGroup[]; rejected: RejectedGroup[]; sano: SanoGroup[] } {
  const accepted: AcceptedGroup[] = [];
  const rejected: RejectedGroup[] = [];
  const sano: SanoGroup[] = [];

  const byIdentity = groupBy(rows, (r) => identityKey(r, sourceChainIdOverrideFor?.(r)));

  for (const tramos of byIdentity.values()) {
    const sample = tramos[0];
    const description = normalizeDescription(sample.description);
    const sorted = [...tramos].sort((a, b) => monthCompare(a.startMonth, b.startMonth));
    const distinctChainIds = new Set(sorted.map((t) => t.chainId));

    if (description === null) {
      // description = null: nunca se fusiona (sin señal de identidad). Si
      // hubiera sido candidato a merge (≥2 chainId) se flaggea como rechazo;
      // si no, es una cadena SANO con descripción vacía — se reporta igual
      // en el inventario (no se descarta en silencio).
      if (distinctChainIds.size >= 2) {
        rejected.push({
          reason: 'description-null',
          detail: 'description = null: sin señal de identidad, riesgo alto de falso positivo, no se auto-fusiona.',
          userId: sample.userId,
          description: null,
          tramos: sorted,
        });
        continue;
      }
      const amounts = sorted.map((t) => t.amountCents);
      const suspectedLostEdit = amounts.length >= 2 && new Set(amounts).size < amounts.length;
      sano.push({
        originKind: originLabel,
        userId: sample.userId,
        description: null,
        chainId: sorted[0].chainId,
        tramos: sorted,
        suspectedLostEdit,
      });
      continue;
    }

    if (distinctChainIds.size < 2) {
      // SANO: un solo chainId, no es candidato a merge. Se reporta en el
      // inventario completo (posible "edición comida" incluida).
      const amounts = sorted.map((t) => t.amountCents);
      const suspectedLostEdit = amounts.length >= 2 && new Set(amounts).size < amounts.length;
      sano.push({
        originKind: originLabel,
        userId: sample.userId,
        description,
        chainId: sorted[0].chainId,
        tramos: sorted,
        suspectedLostEdit,
      });
      continue;
    }

    // ≥2 chainId bajo la misma descripción → candidato a fusión.
    const { hasOverlap, overlapDetail } = detectOverlap(sorted);
    if (hasOverlap) {
      rejected.push({
        reason: 'overlap',
        detail: overlapDetail,
        userId: sample.userId,
        description,
        tramos: sorted,
      });
      continue;
    }

    const notes: GroupNote[] = [...detectGaps(sorted), ...detectMixedFields(sorted)];
    const survivor = sorted[0]; // más antiguo por startMonth
    const absorbedChainIds = [...distinctChainIds].filter((c) => c !== survivor.chainId);

    accepted.push({
      originKind: originLabel,
      userId: sample.userId,
      description,
      sourceChainIdBefore: originLabel === 'calculado-de-fijo' ? (sample.sourceChainId ?? null) : null,
      tramos: sorted,
      survivorChainId: survivor.chainId,
      absorbedChainIds,
      notes,
    });
  }

  return { accepted, rejected, sano };
}

// ── Orquestación del análisis (dry-run) ─────────────────────────────────────

export async function analyzeRestitch(prisma: PrismaClient): Promise<RestitchReport> {
  const allRows = (await prisma.recurring.findMany({
    orderBy: [{ userId: 'asc' }, { startMonth: 'asc' }],
  })) as unknown as RecurringRow[];

  const fijos = allRows.filter((r) => originKindOf(r) === 'fijo');
  const calculadosDeFijo = allRows.filter((r) => originKindOf(r) === 'calculado-de-fijo');

  // Pasada 1: fijos normales, agrupados por (userId, description).
  const fijoResult = detectGroups(fijos, 'fijo');

  // Mapa absorbido → sobreviviente, solo con los grupos ACEPTADOS de fijos.
  const absorbedToSurvivor = new Map<string, string>();
  for (const g of fijoResult.accepted) {
    for (const absorbed of g.absorbedChainIds) {
      absorbedToSurvivor.set(absorbed, g.survivorChainId);
    }
  }

  // Calculados-de-fijo cuyo sourceChainId apunta a un chainId absorbido: se
  // re-apuntarían al sobreviviente. Se reportan SIEMPRE (no depende de si el
  // calculado en sí está fragmentado).
  const calculatedRepoints: CalculatedRepoint[] = [];
  for (const c of calculadosDeFijo) {
    const oldSourceChainId = c.sourceChainId as string;
    const newSourceChainId = absorbedToSurvivor.get(oldSourceChainId) ?? oldSourceChainId;
    if (newSourceChainId !== oldSourceChainId) {
      calculatedRepoints.push({
        id: c.id,
        description: normalizeDescription(c.description),
        oldSourceChainId,
        newSourceChainId,
      });
    }
  }

  // Pasada 2: cadenas de calculado-de-fijo, agrupadas por (userId,
  // description, sourceChainId efectivo post re-apuntado), por si el
  // calculado en sí quedó fragmentado.
  const effectiveSourceChainId = (row: RecurringRow): string => {
    const original = row.sourceChainId as string;
    return absorbedToSurvivor.get(original) ?? original;
  };
  const calcResult = detectGroups(calculadosDeFijo, 'calculado-de-fijo', effectiveSourceChainId);

  return {
    acceptedGroups: [...fijoResult.accepted, ...calcResult.accepted],
    rejectedGroups: [...fijoResult.rejected, ...calcResult.rejected],
    sanoGroups: [...fijoResult.sano, ...calcResult.sano],
    calculatedRepoints,
  };
}

// ── Impresión del reporte (dry-run) ──────────────────────────────────────────

function fmtCents(cents: number): string {
  return (cents / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function printReport(report: RestitchReport): void {
  console.log('='.repeat(80));
  console.log('RESTITCH DE CADENAS DE FIJOS — DRY RUN (solo lectura, nada mutado)');
  console.log('='.repeat(80));

  console.log(`\n--- GRUPOS A FUSIONAR (${report.acceptedGroups.length}) ---\n`);
  if (report.acceptedGroups.length === 0) {
    console.log('(ninguno)');
  }
  for (const g of report.acceptedGroups) {
    const minMonth = g.tramos[0].startMonth;
    const lastTramo = g.tramos[g.tramos.length - 1];
    const maxMonth = lastTramo.deletedFrom ?? `${lastTramo.startMonth} (vigente, sin fin)`;
    console.log(`[${g.originKind}] "${g.description}"`);
    console.log(`  userId: ${g.userId}`);
    console.log(`  tramos: ${g.tramos.length} | rango cubierto: ${minMonth} → ${maxMonth}`);
    console.log(`  chainId sobreviviente: ${g.survivorChainId} (tramo más antiguo)`);
    console.log(`  chainId(s) absorbido(s): ${g.absorbedChainIds.join(', ')}`);
    if (g.sourceChainIdBefore) {
      console.log(`  sourceChainId actual: ${g.sourceChainIdBefore}`);
    }
    if (g.notes.length > 0) {
      console.log('  notas:');
      for (const n of g.notes) console.log(`    - [${n.kind}] ${n.detail}`);
    }
    console.log('  montos por tramo:');
    for (const t of g.tramos) {
      console.log(
        `    - [${t.startMonth} → ${t.deletedFrom ?? 'vigente'}] $${fmtCents(t.amountCents)} ${t.currency} (id=${t.id}, chainId=${t.chainId}, createdAt=${t.createdAt.toISOString()})`,
      );
    }
    console.log('');
  }

  console.log(`\n--- CANDIDATOS RECHAZADOS (${report.rejectedGroups.length}) ---\n`);
  if (report.rejectedGroups.length === 0) {
    console.log('(ninguno)');
  }
  for (const r of report.rejectedGroups) {
    console.log(`[${r.reason}] "${r.description}"`);
    console.log(`  userId: ${r.userId}`);
    console.log(`  motivo: ${r.detail}`);
    console.log('  tramos involucrados:');
    for (const t of r.tramos) {
      console.log(
        `    - [${t.startMonth} → ${t.deletedFrom ?? 'vigente'}] $${fmtCents(t.amountCents)} ${t.currency} (id=${t.id}, chainId=${t.chainId}, createdAt=${t.createdAt.toISOString()})`,
      );
    }
    console.log('');
  }

  console.log(`\n--- CALCULADOS-DE-FIJO A RE-APUNTAR (${report.calculatedRepoints.length}) ---\n`);
  if (report.calculatedRepoints.length === 0) {
    console.log('(ninguno)');
  }
  for (const c of report.calculatedRepoints) {
    console.log(`  id=${c.id} "${c.description}": sourceChainId ${c.oldSourceChainId} → ${c.newSourceChainId}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log(
    `Resumen: ${report.acceptedGroups.length} grupo(s) a fusionar, ${report.rejectedGroups.length} rechazado(s), ${report.calculatedRepoints.length} calculado(s) a re-apuntar.`,
  );
  console.log('MODO: dry-run. No se modificó ningún dato.');
  console.log('='.repeat(80));
}

// ── Ejecución real (--execute) ───────────────────────────────────────────────

function writeBackup(report: RestitchReport): string {
  const dir = path.join(__dirname, 'restitch-backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `restitch-backup-${timestamp}.json`);

  const backupRows = report.acceptedGroups.flatMap((g) =>
    g.tramos.map((t) => ({
      id: t.id,
      chainIdBefore: t.chainId,
      sourceChainIdBefore: t.sourceChainId,
      willBecomeChainId: g.originKind === 'fijo' ? g.survivorChainId : t.chainId,
    })),
  );
  const backupCalculados = report.calculatedRepoints.map((c) => ({
    id: c.id,
    sourceChainIdBefore: c.oldSourceChainId,
    sourceChainIdAfter: c.newSourceChainId,
  }));

  fs.writeFileSync(
    file,
    JSON.stringify({ generatedAt: new Date().toISOString(), backupRows, backupCalculados }, null, 2),
    'utf-8',
  );
  return file;
}

async function executeRestitch(prisma: PrismaClient, report: RestitchReport): Promise<void> {
  const backupFile = writeBackup(report);
  console.log(`[restitch] Backup escrito en: ${backupFile}`);

  // Fijos normales: cada merge group en su propia transacción.
  const fijoGroups = report.acceptedGroups.filter((g) => g.originKind === 'fijo');
  for (const g of fijoGroups) {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.recurring.updateMany({
        where: { chainId: { in: g.absorbedChainIds } },
        data: { chainId: g.survivorChainId },
      });
      await tx.recurring.updateMany({
        where: { sourceChainId: { in: g.absorbedChainIds } },
        data: { sourceChainId: g.survivorChainId },
      });
    });
    console.log(
      `[restitch] Fusionado "${g.description}": ${g.absorbedChainIds.length} chainId(s) → ${g.survivorChainId}`,
    );
  }

  // Re-apuntados de calculados-de-fijo que no vinieron de un merge group de
  // fijos ya cubierto arriba (updateMany por sourceChainId ya lo cubrió, pero
  // se deja el log explícito para trazabilidad 1:1 con el dry-run).
  if (report.calculatedRepoints.length > 0) {
    console.log(`[restitch] ${report.calculatedRepoints.length} calculado(s) re-apuntado(s) (incluido arriba).`);
  }

  // Calculados-de-fijo fragmentados (segunda pasada).
  const calcGroups = report.acceptedGroups.filter((g) => g.originKind === 'calculado-de-fijo');
  for (const g of calcGroups) {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.recurring.updateMany({
        where: { chainId: { in: g.absorbedChainIds } },
        data: { chainId: g.survivorChainId },
      });
    });
    console.log(
      `[restitch] Fusionado calculado "${g.description}": ${g.absorbedChainIds.length} chainId(s) → ${g.survivorChainId}`,
    );
  }

  console.log('[restitch] Ejecución completa.');
}

// ── Entrypoint standalone ────────────────────────────────────────────────────

async function main(): Promise<void> {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('[restitch] DATABASE_URL no está definida. Abortando.');
    process.exit(1);
  }

  const execute = process.argv.includes('--execute');

  const adapter = new PrismaPg({ connectionString: DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const report = await analyzeRestitch(prisma);
    printReport(report);

    if (execute) {
      if (report.acceptedGroups.length === 0) {
        console.log('[restitch] Nada para fusionar. No se ejecuta ninguna mutación.');
        return;
      }
      console.log('\n[restitch] Modo --execute: aplicando mutaciones...\n');
      await executeRestitch(prisma, report);
    } else {
      console.log('\n[restitch] Dry-run únicamente. Corré con `--execute` para aplicar los cambios.');
    }
  } catch (err) {
    console.error('[restitch] Error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
