/**
 * backfill-rates.ts — Herramienta de backfill de cotización ARS/USD (Fase 1.2.3)
 *
 * Backfilla la cotización ARS/USD para datos existentes cargados con back-compat
 * (exchangeRate = 1, que es el default para registros anteriores a 1.2.3).
 * Es seguro e idempotente: solo toca registros con exchangeRate = 1; si se corre
 * dos veces, la segunda no modifica nada. NO toca la columna currency.
 *
 * Corrible en cualquier entorno, incluyendo producción / Render.
 *
 * Acciones:
 *   1. Setea lastExchangeRate en todos los usuarios.
 *   2. Setea exchangeRate en Transaction, Recurring e InstallmentGroup
 *      donde exchangeRate = 1 (default de back-compat).
 *
 * Uso (desde backend/):
 *   pnpm backfill:rates
 *
 * Por defecto corre en DRY-RUN: muestra qué haría pero no toca la base de datos.
 * Para ejecutar de verdad, pasar BACKFILL_CONFIRM=1:
 *   BACKFILL_CONFIRM=1 pnpm backfill:rates
 *
 * Cotización configurable (default 1450 ARS/USD):
 *   BACKFILL_RATE=1550 BACKFILL_CONFIRM=1 pnpm backfill:rates
 *
 * En Render (desde el shell del servicio o un one-off job):
 *   BACKFILL_CONFIRM=1 BACKFILL_RATE=1450 node node_modules/tsx/dist/cli.mjs prisma/backfill-rates.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// ── Configuración ──────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[backfill-rates] DATABASE_URL no está definida. Abortando.');
  process.exit(1);
}

const rawRate = process.env.BACKFILL_RATE ?? '1450';
const BACKFILL_RATE = Number(rawRate);
if (!Number.isFinite(BACKFILL_RATE) || BACKFILL_RATE <= 0) {
  console.error(
    `[backfill-rates] BACKFILL_RATE inválido: "${rawRate}". Debe ser un número > 0. Abortando.`,
  );
  process.exit(1);
}

const CONFIRMED = process.env.BACKFILL_CONFIRM === '1';

// ── Cliente Prisma ─────────────────────────────────────────────────────────────

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  if (!CONFIRMED) {
    console.log('');
    console.log('[backfill-rates] DRY-RUN — no se modificará nada.');
    console.log(
      `[backfill-rates] Se aplicaría cotización ${BACKFILL_RATE} ARS/USD a registros con exchangeRate = 1.`,
    );
    console.log('');
    console.log('[backfill-rates] Para ejecutar de verdad:');
    console.log(
      `  BACKFILL_CONFIRM=1 BACKFILL_RATE=${BACKFILL_RATE} pnpm backfill:rates`,
    );
    console.log('');
    console.log('[backfill-rates] Saliendo sin tocar la base de datos.');
    return;
  }

  console.log(
    `[backfill-rates] Iniciando backfill con cotización ${BACKFILL_RATE} ARS/USD...`,
  );

  // 1. Actualizar lastExchangeRate en todos los usuarios
  const usersResult = await prisma.user.updateMany({
    data: { lastExchangeRate: BACKFILL_RATE },
  });
  console.log(`[backfill-rates] Usuarios actualizados: ${usersResult.count}`);

  // 2. Transactions con exchangeRate = 1 (back-compat)
  const txResult = await prisma.transaction.updateMany({
    where: { exchangeRate: 1 },
    data: { exchangeRate: BACKFILL_RATE },
  });
  console.log(
    `[backfill-rates] Transactions actualizadas (exchangeRate 1→${BACKFILL_RATE}): ${txResult.count}`,
  );

  // 3. Recurrings con exchangeRate = 1 (back-compat)
  const recResult = await prisma.recurring.updateMany({
    where: { exchangeRate: 1 },
    data: { exchangeRate: BACKFILL_RATE },
  });
  console.log(
    `[backfill-rates] Recurrings actualizados (exchangeRate 1→${BACKFILL_RATE}): ${recResult.count}`,
  );

  // 4. InstallmentGroups con exchangeRate = 1 (back-compat)
  const instResult = await prisma.installmentGroup.updateMany({
    where: { exchangeRate: 1 },
    data: { exchangeRate: BACKFILL_RATE },
  });
  console.log(
    `[backfill-rates] InstallmentGroups actualizados (exchangeRate 1→${BACKFILL_RATE}): ${instResult.count}`,
  );

  const totalMovimientos = txResult.count + recResult.count + instResult.count;
  console.log(
    `[backfill-rates] Total de movimientos actualizados: ${totalMovimientos}`,
  );
  console.log('[backfill-rates] Backfill completado.');
}

main()
  .catch((err) => {
    console.error('[backfill-rates] Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
