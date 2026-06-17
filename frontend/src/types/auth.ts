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
