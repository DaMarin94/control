/**
 * Seed de DESARROLLO — solo para la DB local.
 * NO corre en producción (ver la guarda al inicio).
 *
 * Crea:
 * - Un usuario dummy con timezone America/Argentina/Buenos_Aires
 * - Sus 4 categorías con scope BOTH (las mismas que RF-CAT-001 genera en alta real)
 * - Movimientos de ejemplo: únicos, un fijo y un grupo de cuotas
 *
 * IMPORTANTE: Las categorías por defecto en producción se crean en el flujo
 * de alta de usuario (Fase 2), no desde este seed. El seed es solo data de
 * prueba para no programar contra una base vacía.
 */

import * as dotenv from 'dotenv';
dotenv.config();

// Guarda de producción: el seed nunca debe correr en producción
if (process.env.NODE_ENV === 'production') {
  console.error('[seed] El seed no puede correr en producción. Abortando.');
  process.exit(1);
}

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[seed] DATABASE_URL no está definida. Abortando.');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Pool de colores para seed (subset representativo; la lógica de pool real va en Fase 3)
const COLOR_POOL = [
  '#EF4444', // red-500
  '#3B82F6', // blue-500
  '#22C55E', // green-500
  '#F59E0B', // amber-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#14B8A6', // teal-500
  '#F97316', // orange-500
];

async function main() {
  console.log('[seed] Iniciando seed de desarrollo...');

  // --- Usuario dummy ---
  const user = await prisma.user.upsert({
    where: { email: 'dev@control.local' },
    update: {},
    create: {
      email: 'dev@control.local',
      name: 'Usuario Dev',
      timezone: 'America/Argentina/Buenos_Aires',
      // Sin passwordHash: cuenta de solo-desarrollo
    },
  });
  console.log(`[seed] Usuario: ${user.email} (id: ${user.id})`);

  // --- Categorías por defecto (las mismas 4 que RF-CAT-001) ---
  // Se usan upsert para que el seed sea idempotente
  const defaultCategories = [
    { name: 'Consumibles', color: COLOR_POOL[0] },
    { name: 'Tarjeta de crédito', color: COLOR_POOL[1] },
    { name: 'Gastos fijos', color: COLOR_POOL[2] },
    { name: 'Servicios', color: COLOR_POOL[3] },
  ];

  const categories: Array<{ id: string; name: string }> = [];

  for (const cat of defaultCategories) {
    // Buscar si ya existe (sin @@unique en DB, buscamos manualmente)
    const existing = await prisma.category.findFirst({
      where: {
        userId: user.id,
        name: cat.name,
        deletedAt: null,
      },
    });

    if (existing) {
      categories.push(existing);
      console.log(`[seed] Categoría existente: "${cat.name}" (id: ${existing.id})`);
    } else {
      const created = await prisma.category.create({
        data: {
          userId: user.id,
          name: cat.name,
          scope: 'BOTH',
          color: cat.color,
        },
      });
      categories.push(created);
      console.log(`[seed] Categoría creada: "${cat.name}" (id: ${created.id})`);
    }
  }

  const [consumibles, tarjeta, gastosFijos, servicios] = categories;

  // --- Movimientos únicos (transacciones) ---
  // Mes actual: junio 2026
  const transactions = [
    {
      userId: user.id,
      categoryId: consumibles.id,
      type: 'EXPENSE' as const,
      amountCents: 350000, // $3.500,00
      description: 'Super semanal',
      occurredAt: new Date('2026-06-03T10:30:00-03:00'),
      timezone: 'America/Argentina/Buenos_Aires',
    },
    {
      userId: user.id,
      categoryId: tarjeta.id,
      type: 'EXPENSE' as const,
      amountCents: 120000, // $1.200,00
      description: 'Ropa',
      occurredAt: new Date('2026-06-05T15:00:00-03:00'),
      timezone: 'America/Argentina/Buenos_Aires',
    },
    {
      userId: user.id,
      categoryId: consumibles.id,
      type: 'INCOME' as const,
      amountCents: 50000000, // $500.000,00 — sueldo
      description: 'Sueldo junio',
      occurredAt: new Date('2026-06-01T09:00:00-03:00'),
      timezone: 'America/Argentina/Buenos_Aires',
    },
  ];

  for (const tx of transactions) {
    // Chequeo simple de idempotencia: buscar por descripción y fecha
    const existing = await prisma.transaction.findFirst({
      where: {
        userId: user.id,
        description: tx.description,
        occurredAt: tx.occurredAt,
      },
    });
    if (!existing) {
      const created = await prisma.transaction.create({ data: tx });
      console.log(
        `[seed] Transacción: "${tx.description}" $${(tx.amountCents / 100).toFixed(2)} (id: ${created.id})`,
      );
    } else {
      console.log(`[seed] Transacción existente: "${tx.description}"`);
    }
  }

  // --- Movimiento fijo ---
  const existingRecurring = await prisma.recurring.findFirst({
    where: { userId: user.id, description: 'Alquiler' },
  });
  if (!existingRecurring) {
    const recurring = await prisma.recurring.create({
      data: {
        userId: user.id,
        categoryId: gastosFijos.id,
        type: 'EXPENSE',
        amountCents: 30000000, // $300.000,00
        description: 'Alquiler',
        startMonth: '2026-01',
        // deletedFrom: null — activo indefinidamente
      },
    });
    console.log(`[seed] Fijo: "Alquiler" desde 2026-01 (id: ${recurring.id})`);
  } else {
    console.log(`[seed] Fijo existente: "Alquiler"`);
  }

  const existingRecurring2 = await prisma.recurring.findFirst({
    where: { userId: user.id, description: 'Netflix' },
  });
  if (!existingRecurring2) {
    const netflix = await prisma.recurring.create({
      data: {
        userId: user.id,
        categoryId: servicios.id,
        type: 'EXPENSE',
        amountCents: 599, // $5,99 (precio simbólico)
        description: 'Netflix',
        startMonth: '2025-08',
      },
    });
    console.log(`[seed] Fijo: "Netflix" desde 2025-08 (id: ${netflix.id})`);
  } else {
    console.log(`[seed] Fijo existente: "Netflix"`);
  }

  // --- Grupo de cuotas ---
  const existingGroup = await prisma.installmentGroup.findFirst({
    where: { userId: user.id, description: 'Notebook 12 cuotas' },
  });
  if (!existingGroup) {
    const group = await prisma.installmentGroup.create({
      data: {
        userId: user.id,
        categoryId: tarjeta.id,
        type: 'EXPENSE',
        amountCents: 8500000, // $85.000,00 por cuota
        totalInstallments: 12,
        description: 'Notebook 12 cuotas',
        startMonth: '2026-03',
      },
    });
    console.log(
      `[seed] Cuotas: "Notebook 12 cuotas" — $85.000,00 x 12 desde 2026-03 (id: ${group.id})`,
    );
  } else {
    console.log(`[seed] Cuotas existentes: "Notebook 12 cuotas"`);
  }

  console.log('[seed] Seed de desarrollo completado.');
}

main()
  .catch((err) => {
    console.error('[seed] Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
