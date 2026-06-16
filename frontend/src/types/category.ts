/**
 * Tipos del dominio de categorías.
 * Reflejan el contrato de la API del backend (/categories).
 * No hay paquete compartido con el backend — el frontend define los suyos.
 */

// ─── Paleta de colores de categoría ──────────────────────────────────────────

/**
 * Matriz de 70 colores para categorías.
 * 7 filas (T1–T7) × 10 columnas (C1–C10).
 * Orden: T1 (claros) arriba → T7 (oscuros) abajo; C1→C10 izq→der.
 * Fuente de verdad del frontend; el backend valida contra la misma lista (case-insensitive).
 */
export const CATEGORY_COLOR_PALETTE: readonly string[] = [
  // T1
  "#DCE7F4", "#F8E2D7", "#E0F1DE", "#ECE4F6", "#FBF3D1", "#D8F0ED", "#F8DEE7", "#E3E8F0", "#F0E0CD", "#DDF1E8",
  // T2
  "#B6CDE9", "#F1C4AE", "#C2E4BF", "#D6C6ED", "#F6E6A6", "#B2E2DB", "#F1BDCC", "#C8D1E1", "#E2C19C", "#BCE4D2",
  // T3
  "#84A9D6", "#E89E78", "#97D08F", "#BFA4E1", "#EFD56F", "#83D2C7", "#E893AB", "#A9B6CD", "#D29F66", "#9BD5B8",
  // T4 — colores base (los que usa el backend para "menos usado")
  "#4F86C6", "#E07B54", "#6DBF67", "#A98BD6", "#E8C84A", "#5BC4B8", "#E06B8B", "#8B9DBF", "#C47D3E", "#7DBF9E",
  // T5
  "#3E6BA3", "#BC6241", "#54A04E", "#8A6BB8", "#C2A52E", "#46A096", "#BD5572", "#71819F", "#A2632C", "#629E81",
  // T6
  "#2E5079", "#8E4A30", "#3E7739", "#674F89", "#917B1F", "#33766F", "#8C3F55", "#546077", "#794927", "#497660",
  // T7
  "#1F3551", "#5F311F", "#284E25", "#443458", "#5F5113", "#214E49", "#5D2A39", "#383F4F", "#502F19", "#304E40",
] as const;

/**
 * Fila T4: los 10 colores base.
 * El backend los usa para asignar el "menos usado"; el frontend los usa para calcular
 * el color predeterminado en la creación (mismo criterio que el backend: menor conteo
 * entre activas; en empate, el primero de T4).
 */
export const CATEGORY_BASE_COLORS: readonly string[] = CATEGORY_COLOR_PALETTE.slice(30, 40) as readonly string[];

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
  /** Color del picker (hex, debe pertenecer a la matriz de 70). Siempre se envía desde el frontend. */
  color?: string;
}

/** Body de PATCH /categories/:id */
export interface UpdateCategoryRequest {
  name?: string;
  scope?: CategoryScope;
  /** Color del picker (hex, debe pertenecer a la matriz de 70). Se envía cuando el usuario cambia el color. */
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
