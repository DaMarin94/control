import { Prisma } from '@prisma/client';

/**
 * Filtro de borrado lógico (RF-HIST-006 / RN-026).
 *
 * `Transaction`, `Recurring` e `InstallmentGroup` tienen todos un campo `deletedAt`
 * (Módulo 3.14 — Historial de cambios). Un registro con `deletedAt != null` está
 * eliminado y NO debe aparecer en NINGUNA lectura de negocio (listados, totales,
 * reportes, selectores, contadores — RF-HIST-006).
 *
 * Este es el ÚNICO punto de verdad del filtro: se usa en TODOS los repositorios que
 * leen Transaction/Recurring/InstallmentGroup (transactions, recurring, installments,
 * movements) para no repetir `deletedAt: null` copiado a mano en cada query, que es
 * fácil de olvidar y NO tira error si falta — solo infla totales/reportes en silencio.
 *
 * NO usar en el módulo `history` (undo/reaper): esas rutas necesitan leer/mutar
 * registros YA eliminados a propósito, y acceden a Prisma directamente (bypass
 * intencional, documentado en cada call site).
 */
export const NOT_DELETED = { deletedAt: null } as const;

/**
 * Fragmentos SQL equivalentes a NOT_DELETED, para las queries `$queryRaw`
 * (Prisma no permite pasar el objeto de filtro ORM a raw SQL). Un fragmento por
 * alias de tabla ya usado en el codebase: t = Transaction, r = Recurring,
 * ig = InstallmentGroup. Componer con `${NOT_DELETED_TRANSACTION_SQL}` dentro
 * del template de `$queryRaw` (Prisma soporta fragmentos `Prisma.sql` anidados).
 */
export const NOT_DELETED_TRANSACTION_SQL = Prisma.sql`t."deletedAt" IS NULL`;
export const NOT_DELETED_RECURRING_SQL = Prisma.sql`r."deletedAt" IS NULL`;
export const NOT_DELETED_INSTALLMENT_SQL = Prisma.sql`ig."deletedAt" IS NULL`;
