/**
 * seed-reference-rates.ts — Carga inicial de cotizaciones de referencia (Fase 1.2.4)
 *
 * Carga las cotizaciones de referencia mensuales ARS/USD, BRL/USD y EUR/USD
 * para los 18 meses de 2025-01 a 2026-06.
 *
 * La tabla ReferenceRate almacena: rate = unidades de la moneda por 1 USD (pivote USD).
 * USD no tiene filas (rate_USD = 1 implícito por definición del pivote).
 *
 * Es idempotente: usa upsert por (currency, yearMonth). Se puede correr dos veces
 * sin efecto secundario.
 *
 * Corrible en cualquier entorno, incluyendo producción / Render.
 *
 * Uso (desde backend/):
 *   pnpm seed:rates
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient, Currency } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// ── Datos de cotizaciones de referencia ────────────────────────────────────────

// Formato: [yearMonth, ARS/USD, BRL/USD, EUR/USD]
// rate = unidades de cada moneda por 1 USD (pivote USD).
// USD no se guarda (implícito rate=1 por ser el pivote).
const RATES_DATA: Array<{ yearMonth: string; ars: number; brl: number; eur: number }> = [
  { yearMonth: '2025-01', ars: 1046,   brl: 6.05, eur: 0.966 },
  { yearMonth: '2025-02', ars: 1061,   brl: 5.76, eur: 0.960 },
  { yearMonth: '2025-03', ars: 1070,   brl: 5.77, eur: 0.927 },
  { yearMonth: '2025-04', ars: 1130,   brl: 5.78, eur: 0.891 },
  { yearMonth: '2025-05', ars: 1155,   brl: 5.67, eur: 0.887 },
  { yearMonth: '2025-06', ars: 1180,   brl: 5.55, eur: 0.868 },
  { yearMonth: '2025-07', ars: 1270,   brl: 5.53, eur: 0.855 },
  { yearMonth: '2025-08', ars: 1320,   brl: 5.45, eur: 0.859 },
  { yearMonth: '2025-09', ars: 1400,   brl: 5.37, eur: 0.852 },
  { yearMonth: '2025-10', ars: 1440,   brl: 5.39, eur: 0.859 },
  { yearMonth: '2025-11', ars: 1420,   brl: 5.34, eur: 0.865 },
  { yearMonth: '2025-12', ars: 1450,   brl: 5.46, eur: 0.854 },
  { yearMonth: '2026-01', ars: 1447,   brl: 5.35, eur: 0.852 },
  { yearMonth: '2026-02', ars: 1408,   brl: 5.21, eur: 0.845 },
  { yearMonth: '2026-03', ars: 1390,   brl: 5.24, eur: 0.864 },
  { yearMonth: '2026-04', ars: 1390,   brl: 5.05, eur: 0.856 },
  { yearMonth: '2026-05', ars: 1395,   brl: 4.99, eur: 0.856 },
  { yearMonth: '2026-06', ars: 1432,   brl: 5.11, eur: 0.865 },
];

// ── Función reutilizable exportada ─────────────────────────────────────────────

interface RateRow {
  currency: Currency;
  yearMonth: string;
  rate: number;
}

function buildRows(): RateRow[] {
  const rows: RateRow[] = [];
  for (const d of RATES_DATA) {
    rows.push({ currency: Currency.ARS, yearMonth: d.yearMonth, rate: d.ars });
    rows.push({ currency: Currency.BRL, yearMonth: d.yearMonth, rate: d.brl });
    rows.push({ currency: Currency.EUR, yearMonth: d.yearMonth, rate: d.eur });
  }
  return rows;
}

/**
 * Inserta/actualiza las cotizaciones de referencia en la tabla ReferenceRate.
 * Recibe un PrismaClient ya inicializado (no hace connect/disconnect).
 * Devuelve el número de filas tocadas.
 */
export async function seedReferenceRates(prisma: PrismaClient): Promise<number> {
  const rows = buildRows();
  let upserted = 0;
  for (const r of rows) {
    await prisma.referenceRate.upsert({
      where: {
        currency_yearMonth: {
          currency: r.currency,
          yearMonth: r.yearMonth,
        },
      },
      update: {
        rate: r.rate,
      },
      create: {
        currency: r.currency,
        yearMonth: r.yearMonth,
        rate: r.rate,
      },
    });
    upserted++;
  }
  return upserted;
}

// ── Entrypoint standalone (pnpm seed:rates) ────────────────────────────────────
// Se ejecuta solo cuando el archivo es el punto de entrada directo (no cuando
// otro módulo lo importa para reusar seedReferenceRates).

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('[seed-rates] DATABASE_URL no está definida. Abortando.');
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('[seed-rates] Insertando/actualizando cotizaciones de referencia...');
    const upserted = await seedReferenceRates(prisma);
    console.log(`[seed-rates] Completado. Filas insertadas/actualizadas: ${upserted}`);
    console.log('[seed-rates] USD no se guarda (rate_USD = 1 implícito por ser el pivote).');
  } catch (err) {
    console.error('[seed-rates] Error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// tsx transpila a CJS, por lo que require.main === module detecta el entrypoint
if (require.main === module) {
  main();
}
