/**
 * Tipos del dominio de autenticación.
 * Reflejan el contrato de la API del backend (/auth/login, /auth/register, /auth/google).
 * No hay paquete compartido con el backend — el frontend define los suyos.
 */

/** Usuario tal como lo devuelve el backend */
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

/**
 * Clave de sección de la vista del mes.
 * Fase 1.1.4: las 3 secciones son reordenables y colapsables.
 */
export type MonthSectionKey = "unicos" | "fijos" | "cuotas";

/**
 * Preferencias de la vista del mes (Fase 1.1.4).
 * - order: orden de las 3 secciones
 * - collapsed: claves de las secciones actualmente colapsadas
 */
export interface MonthSectionsPreferences {
  order: MonthSectionKey[];
  collapsed: MonthSectionKey[];
}

/**
 * Estado de filtro de una sección individual en /mes (Fase 1.2.1).
 * - type: "ALL" = ambos (default), "EXPENSE" = solo gastos, "INCOME" = solo ingresos.
 * - categories: null = todas, [] = ninguna, lista = subconjunto explícito.
 */
export interface MonthListFilterState {
  type: "ALL" | "EXPENSE" | "INCOME";
  categories: string[] | null;
}

/**
 * Filtros por listado en /mes (Fase 1.2.1).
 * Una entrada por sección: unicos, fijos, cuotas.
 */
export interface MonthListFilters {
  unicos: MonthListFilterState;
  fijos: MonthListFilterState;
  cuotas: MonthListFilterState;
}

/**
 * Criterio de orden de la sección Únicos en /mes (Ola 2, Sub-fase C).
 * - "amount" (default): |amountCents| DESC (mayor magnitud arriba).
 * - "date": occurredAt DESC (más reciente arriba); desempate por |amountCents| DESC.
 */
export type UnicosSort = "amount" | "date";

/**
 * Blob de preferencias del usuario.
 * Es un objeto abierto/extensible: en Fase 1.1.0 está vacío ({}).
 * Cada fase posterior agrega sus claves sin cambiar el tipo base.
 * El backend usa semántica de reemplazo completo (PUT sobreescribe, no merge).
 */
export interface UserPreferences {
  /** Fase 1.1.4: orden y estado de colapso de secciones en /mes */
  monthSections?: MonthSectionsPreferences;
  /**
   * Fase 1.1.5: config de las cards de la pantalla /reportes.
   * Ausente/vacío = pantalla vacía (solo "[+]").
   */
  reports?: import("@/types/reports").ReportCardConfig[];
  /**
   * @deprecated Fase 1.2.1: reemplazado por `monthListFilters` (filtros por sección).
   * Se preserva en el tipo para no crashear con blobs existentes, pero ya no se
   * lee ni se escribe desde /mes. Arranque fresco — no se migra su valor.
   */
  monthCategoryFilter?: string[] | null;
  /**
   * Fase 1.2.1: filtros por listado en /mes — uno por sección.
   * Ausente / inválido → default: cada sección con type "ALL" + categories null.
   */
  monthListFilters?: MonthListFilters;
  /**
   * Ola 2 Sub-fase C: orden de la sección Únicos en /mes.
   * Ausente / inválido → default: "amount" (|amountCents| DESC).
   */
  unicosSort?: UnicosSort;
  /**
   * Ola 4: modo de color de la UI.
   * "system" (default ausente) = sigue prefers-color-scheme del dispositivo.
   * "light" / "dark" = forzado independientemente del SO.
   * Ausente equivale a "system".
   */
  theme?: "system" | "light" | "dark";
  /**
   * P2 — Límites y Alertas, Fase 1: límites del usuario (marca visual pasiva).
   * Blob frontend-puro / opaco para el backend, igual que `reports` / `theme`.
   * Ausente/vacío = sin límites configurados (impacto visual nulo, D9).
   */
  limits?: import("@/types/limit").LimitConfig[];
  /**
   * Método de pago por defecto por estructura (RF-PM-007; shape en data-model.md).
   * Un slot por estructura — unico / fijo / cuota — cada uno con el `id` de un
   * método de pago o `null` ("ninguno"). Ausente equivale a los tres en `null`.
   * Exclusividad por estructura: cada slot apunta a lo sumo a un id (un método
   * puede ser default de varias estructuras, pero cada estructura tiene un único método).
   * Prefill solo al CREAR, por estructura, tanto en egresos como en ingresos (nunca
   * en edición ni en movimientos calculados); el id guardado se valida contra los
   * métodos de pago activos en lectura — si no corresponde a ninguno, se trata
   * como `null` (fallback al eliminar un método).
   */
  defaultPaymentMethods?: {
    unico: string | null;
    fijo: string | null;
    cuota: string | null;
  };
  [key: string]: unknown;
}

/** Respuesta de /auth/login, /auth/register y /auth/google */
export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
  /** Blob de preferencias del usuario. Vacío ({}) si el usuario no tiene fila aún. */
  preferences: UserPreferences;
}

/** Body de /auth/register */
export interface RegisterRequest {
  email: string;
  password: string;
}

/** Body de /auth/login */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Body de /auth/google */
export interface GoogleAuthRequest {
  email: string;
  name?: string | null;
  image?: string | null;
  googleId?: string | null;
  idToken?: string | null;
}
