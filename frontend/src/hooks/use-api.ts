"use client";

/**
 * Hook que devuelve una capa de API pre-configurada con el Bearer token
 * de la sesión actual. Client Components usan este hook para llamar al backend;
 * nunca leen el token manualmente.
 *
 * Uso:
 *   const { api } = useApi();
 *   await api.get("/movements");
 */

import { useSession } from "next-auth/react";
import { useMemo } from "react";
import { apiRequest, type RequestOptions } from "@/lib/api";

type ApiOptions = Omit<RequestOptions, "method" | "body">;

export function useApi() {
  const { data: session } = useSession();
  const token = session?.accessToken;

  const authenticatedApi = useMemo(
    () => ({
      get<T>(path: string, options?: ApiOptions): Promise<T> {
        return apiRequest<T>(path, { ...options, method: "GET", token });
      },
      post<T>(path: string, body: unknown, options?: ApiOptions): Promise<T> {
        return apiRequest<T>(path, { ...options, method: "POST", body, token });
      },
      put<T>(path: string, body: unknown, options?: ApiOptions): Promise<T> {
        return apiRequest<T>(path, { ...options, method: "PUT", body, token });
      },
      patch<T>(path: string, body: unknown, options?: ApiOptions): Promise<T> {
        return apiRequest<T>(path, { ...options, method: "PATCH", body, token });
      },
      delete<T>(path: string, options?: ApiOptions): Promise<T> {
        return apiRequest<T>(path, { ...options, method: "DELETE", token });
      },
    }),
    [token],
  );

  return { api: authenticatedApi, token };
}
