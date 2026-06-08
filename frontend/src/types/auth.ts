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

/** Respuesta de /auth/login y /auth/register */
export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
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
