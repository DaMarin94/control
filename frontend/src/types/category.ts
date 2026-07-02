/**
 * Tipos del dominio de categorías.
 * Reflejan el contrato de la API del backend (/categories).
 * No hay paquete compartido con el backend — el frontend define los suyos.
 */

// ─── Paleta de colores de categoría ──────────────────────────────────────────

/**
 * Matriz de 40 colores para categorías.
 * 5 filas (L1–L5) × 8 columnas (C1–C8).
 * Orden: L1 (clara) arriba → L5 (oscura) abajo; C1→C8 izq→der (rojo, naranja, oro, verde, teal, azul, violeta, magenta).
 * Fuente de verdad del frontend; el backend valida contra la misma lista (case-insensitive).
 */
export const CATEGORY_COLOR_PALETTE: readonly string[] = [
  // L1
  "#F7C8C8", "#F9DDC8", "#F7EBC5", "#C6E6D1", "#BFE6E9", "#C8DBF6", "#DFCEF3", "#F4CCE4",
  // L2
  "#EE8D8D", "#F2B98D", "#EFD686", "#8ACB9F", "#7ACBD1", "#8DB4ED", "#BC99E6", "#E996C7",
  // L3 — fila base (los que usa el backend para "menos usado")
  "#E23B3B", "#E8863A", "#E3B92E", "#35A65A", "#1AA5B0", "#3B7DE0", "#8B4FD4", "#D94A9E",
  // L4
  "#9E2929", "#A25E29", "#9F8220", "#25743F", "#12747B", "#29589D", "#613794", "#98346F",
  // L5
  "#6C1C1C", "#6F401C", "#6D5916", "#19502B", "#0C4F54", "#1C3C6C", "#432666", "#68244C",
] as const;

/**
 * Subset base (fila L3): los 8 colores base, en el orden de asignación (salteado por la
 * rueda para máxima separación entre las primeras categorías creadas, no el orden espectral
 * de la fila). NO se deriva por slice de CATEGORY_COLOR_PALETTE: el orden difiere del flat.
 * El backend los usa para asignar el "menos usado"; el frontend los usa para calcular
 * el color predeterminado en la creación (mismo criterio que el backend: menor conteo
 * entre activas; en empate, el primero de este array).
 */
export const CATEGORY_BASE_COLORS: readonly string[] = [
  "#E23B3B", "#1AA5B0", "#E3B92E", "#8B4FD4", "#E8863A", "#3B7DE0", "#35A65A", "#D94A9E",
] as const;

/**
 * Calcula el color "menos usado" de la fila T4 mirando las categorías activas.
 * Criterio idéntico al del backend (`assignColor`):
 * - contar cuántas categorías activas usan cada color de T4
 * - elegir el de menor conteo
 * - en empate: el que aparece primero en T4
 */
export function getLeastUsedBaseColor(activeCategories: { color: string }[]): string {
  const counts = new Map<string, number>(
    CATEGORY_BASE_COLORS.map((c) => [c.toUpperCase(), 0]),
  );
  for (const cat of activeCategories) {
    const key = cat.color.toUpperCase();
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  let leastColor = CATEGORY_BASE_COLORS[0];
  let leastCount = counts.get(leastColor.toUpperCase()) ?? 0;
  for (const color of CATEGORY_BASE_COLORS) {
    const count = counts.get(color.toUpperCase()) ?? 0;
    if (count < leastCount) {
      leastCount = count;
      leastColor = color;
    }
  }
  return leastColor;
}

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
  /** Color del picker (hex, debe pertenecer a la matriz de 40). Siempre se envía desde el frontend. */
  color?: string;
}

/** Body de PATCH /categories/:id */
export interface UpdateCategoryRequest {
  name?: string;
  scope?: CategoryScope;
  /** Color del picker (hex, debe pertenecer a la matriz de 40). Se envía cuando el usuario cambia el color. */
  color?: string;
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
