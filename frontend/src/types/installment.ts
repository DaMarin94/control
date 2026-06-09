/**
 * Tipos del dominio de movimientos en cuotas.
 * Reflejan el contrato de la API del backend (Fase 7).
 *
 * InstallmentGroup es el grupo padre que define monto, cantidad y mes de inicio.
 * No hay paquete compartido con el backend — el frontend define los suyos.
 */

import type { CategoryScope } from "@/types/category";

/** Categoría embebida en la respuesta de un grupo de cuotas */
export interface InstallmentCategory {
  id: string;
  name: string;
  color: string;
  scope: CategoryScope;
}

/**
 * Grupo de cuotas tal como lo devuelve el backend.
 * POST /installments → data: InstallmentGroup (201)
 * PATCH /installments/:id → data: InstallmentGroup (200)
 *
 * El type es siempre "EXPENSE" en v1 (RF-MC-001 — cuotas solo Gasto).
 */
export interface InstallmentGroup {
  id: string;
  userId: string;
  categoryId: string;
  /** Siempre "EXPENSE" en v1 */
  type: "EXPENSE";
  /** Monto de cada cuota en centavos enteros (no el total de la compra) */
  amountCents: number;
  /** Cantidad total de cuotas (entero > 0) */
  totalInstallments: number;
  /** Mes de inicio del grupo en formato YYYY-MM */
  startMonth: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  /** Categoría embebida en la respuesta */
  category: InstallmentCategory;
}

/**
 * Body de POST /installments.
 * type es siempre "EXPENSE" — el front no ofrece selector de tipo (RF-MC-001).
 */
export interface CreateInstallmentRequest {
  /** Siempre "EXPENSE" en v1 */
  type: "EXPENSE";
  /** Monto de cada cuota en centavos enteros > 0 */
  amountCents: number;
  /** Cantidad total de cuotas (entero > 0) */
  totalInstallments: number;
  /** Mes de inicio en formato YYYY-MM (default: mes actual del navegador) */
  startMonth: string;
  categoryId: string;
  description?: string;
}

/**
 * Body de PATCH /installments/:id.
 * type NO se envía (no es editable).
 * description: null para limpiar el campo; undefined = no cambiar.
 */
export interface UpdateInstallmentRequest {
  amountCents?: number;
  totalInstallments?: number;
  startMonth?: string;
  categoryId?: string;
  description?: string | null;
}
