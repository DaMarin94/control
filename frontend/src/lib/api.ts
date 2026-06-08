/**
 * Capa centralizada de llamadas al backend.
 * Ningún componente llama a fetch directamente — todo pasa por aquí.
 *
 * Comportamiento:
 * - En éxito: desenvuelve `data` del sobre { success, statusCode, data } y lo retorna.
 * - En error: loggea (nivel error) y propaga un ApiError normalizado.
 * - El JWT se adjunta como Authorization: Bearer <token> cuando se provee.
 *
 * Uso desde Server Components: usar `apiServer` (obtiene el token de la sesión del servidor).
 * Uso desde Client Components: pasar el token obtenido de useSession() via options.token,
 *   o usar el hook `useApi` que lo hace automáticamente.
 */

import { ApiError, type ApiResponse } from "@/types/api";
import { createLogger } from "@/lib/logger";

const logger = createLogger("ApiClient");

export interface RequestOptions extends Omit<RequestInit, "body"> {
  /** JWT del backend para adjuntar como Bearer token */
  token?: string;
  /** Body del request (se serializa a JSON automáticamente) */
  body?: unknown;
}

/**
 * Función principal del cliente de API.
 * Recibe un path relativo (ej: "/movements") y options.
 * La URL base se lee de NEXT_PUBLIC_API_URL.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, body, headers: customHeaders, ...fetchOptions } = options;

  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) {
    throw new ApiError("NEXT_PUBLIC_API_URL no está configurada", 500);
  }

  const url = `${baseUrl}${path}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...customHeaders,
  };

  // Adjuntar JWT si está disponible — NUNCA loggear el token completo
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    logger.debug("Request con autenticación", { path, method: fetchOptions.method ?? "GET" });
  }

  logger.debug("Iniciando request", {
    path,
    method: fetchOptions.method ?? "GET",
    hasBody: body !== undefined,
  });

  let response: Response;

  try {
    response = await fetch(url, {
      ...fetchOptions,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkError) {
    // Error de red (backend caído, sin conexión, etc.)
    const message =
      networkError instanceof Error ? networkError.message : "Error de red desconocido";

    logger.error("Error de red al contactar el backend", {
      path,
      error: message,
    });

    throw new ApiError(`No se pudo conectar con el servidor: ${message}`, 503);
  }

  let parsed: ApiResponse<T>;

  try {
    parsed = (await response.json()) as ApiResponse<T>;
  } catch {
    logger.error("Respuesta del backend no es JSON válido", {
      path,
      status: response.status,
    });

    throw new ApiError("Respuesta inválida del servidor", response.status);
  }

  if (!parsed.success) {
    const errorBody = parsed.error;

    logger.error("Error recibido del backend", {
      path,
      statusCode: parsed.statusCode,
      errorMessage: errorBody.message,
    });

    throw new ApiError(errorBody.message, parsed.statusCode, {
      path: errorBody.path,
      timestamp: errorBody.timestamp,
      data: errorBody.data,
    });
  }

  logger.debug("Request completado exitosamente", {
    path,
    statusCode: parsed.statusCode,
  });

  return parsed.data;
}

/**
 * Helpers con métodos HTTP explícitos para mayor legibilidad.
 */
export const api = {
  get<T>(path: string, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return apiRequest<T>(path, { ...options, method: "GET" });
  },

  post<T>(path: string, body: unknown, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return apiRequest<T>(path, { ...options, method: "POST", body });
  },

  put<T>(path: string, body: unknown, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return apiRequest<T>(path, { ...options, method: "PUT", body });
  },

  patch<T>(path: string, body: unknown, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return apiRequest<T>(path, { ...options, method: "PATCH", body });
  },

  delete<T>(path: string, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return apiRequest<T>(path, { ...options, method: "DELETE" });
  },
};
