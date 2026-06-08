/**
 * Tipos que reflejan el contrato de la API del backend.
 * El frontend define sus propios tipos — no hay paquete compartido con el backend.
 * Fuente: docs/technical.md (sección "Formato de respuesta de la API")
 */

/** Sobre de respuesta exitosa */
export interface ApiSuccessResponse<T> {
  success: true;
  statusCode: number;
  data: T;
}

/** Sobre de respuesta de error */
export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  error: {
    message: string;
    timestamp: string;
    path: string;
    /** Datos adicionales opcionales (ej: `{ reactivable: true, category: {...} }` en 409 de categorías) */
    data?: unknown;
  };
}

/** Unión de ambos sobres */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Error normalizado que propaga la capa centralizada de API.
 * La UI lo consume para mostrar mensajes al usuario.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly path?: string;
  public readonly timestamp?: string;
  /** Datos adicionales del error (ej: `{ reactivable: true, category: {...} }` en 409 de categorías) */
  public readonly data?: unknown;

  constructor(
    message: string,
    statusCode: number,
    options?: { path?: string; timestamp?: string; data?: unknown },
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.path = options?.path;
    this.timestamp = options?.timestamp;
    this.data = options?.data;
  }

  /** Determina si es un error del cliente (4xx) */
  isClientError(): boolean {
    return this.statusCode >= 400 && this.statusCode < 500;
  }

  /** Determina si es un error del servidor (5xx) o de red */
  isServerError(): boolean {
    return this.statusCode >= 500;
  }
}
