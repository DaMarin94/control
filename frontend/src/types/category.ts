/**
 * Tipos del dominio de categorías.
 * Reflejan el contrato de la API del backend (/categories).
 * No hay paquete compartido con el backend — el frontend define los suyos.
 */

/** Scope posible de una categoría */
export type CategoryScope = "BOTH" | "EXPENSE" | "INCOME";

/** Etiquetas legibles del scope para mostrar en la UI */
export const SCOPE_LABELS: Record<CategoryScope, string> = {
  BOTH: "Ambos",
  EXPENSE: "Gasto",
  INCOME: "Ingreso",
};

/** Opciones de scope para el selector */
export const SCOPE_OPTIONS: { value: CategoryScope; label: string }[] = [
  { value: "BOTH", label: "Ambos" },
  { value: "EXPENSE", label: "Gasto" },
  { value: "INCOME", label: "Ingreso" },
];

/**
 * Categoría tal como la devuelve el backend.
 * GET /categories → data: Category[]
 * POST /categories → data: Category
 * PATCH /categories/:id → data: Category
 * POST /categories/:id/reactivate → data: Category
 */
export interface Category {
  id: string;
  userId: string;
  name: string;
  scope: CategoryScope;
  color: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  movementCount: number;
}

/** Body de POST /categories */
export interface CreateCategoryRequest {
  name: string;
  scope?: CategoryScope;
}

/** Body de PATCH /categories/:id */
export interface UpdateCategoryRequest {
  name?: string;
  scope?: CategoryScope;
}

/**
 * Datos de la categoría reactivable que viene en error.data del 409.
 * Solo presente cuando error.data.reactivable === true.
 */
export interface ReactivableCategory {
  id: string;
  name: string;
  scope: CategoryScope;
  color: string;
}

/** Shape de error.data cuando hay una colisión con categoría eliminada (reactivable) */
export interface ReactivableErrorData {
  reactivable: true;
  category: ReactivableCategory;
}

/** Type guard para verificar si error.data es de tipo ReactivableErrorData */
export function isReactivableError(data: unknown): data is ReactivableErrorData {
  return (
    typeof data === "object" &&
    data !== null &&
    "reactivable" in data &&
    (data as ReactivableErrorData).reactivable === true &&
    "category" in data &&
    typeof (data as ReactivableErrorData).category === "object"
  );
}
