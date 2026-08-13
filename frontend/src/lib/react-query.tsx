"use client";

/**
 * Provider de React Query (TanStack Query).
 * Montado en el root layout para que toda la app tenga acceso al QueryClient.
 * Server-state: caché, loading/error, invalidación al mutar.
 *
 * Manejo centralizado de 401 (RF-AUTH):
 * Cuando el backend responde 401 (JWT inválido/expirado), la sesión de
 * NextAuth queda "viva" pero cada llamada al backend falla. QueryCache y
 * MutationCache interceptan CUALQUIER error de CUALQUIER query/mutation acá,
 * en un único punto — evita repetir el chequeo en cada hook de datos.
 * Ante un 401: toast + signOut → /login. Guardado con un flag a nivel de
 * módulo porque el token expirado hace fallar varias queries en simultáneo
 * y solo debe dispararse una vez (un toast, un signOut, no un loop).
 *
 * Por qué el 401 NUNCA reintenta (gotcha de TanStack Query):
 * Reintentar un 401 es inútil — el token seguirá siendo inválido — pero
 * además es activamente dañino: entre el primer fallo y el reintento
 * programado, TanStack Query espera `retryDelay` (~1s) y, si en ese
 * instante la pestaña no está visible (`document.visibilityState !==
 * "visible"` — p.ej. Chrome "occlusion" al taparla con otra ventana), el
 * retryer queda "paused" indefinidamente hasta que la pestaña vuelve a
 * estar visible. Mientras está paused, la query NUNCA transiciona a
 * "error" → QueryCache.onError no dispara → sin toast, sin signOut, y la
 * pantalla queda colgada en skeleton. Excluir el 401 de `retry` evita la
 * ventana de espera por completo: el error se propaga en el mismo tick.
 */

import { QueryCache, QueryClient, QueryClientProvider, MutationCache } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { signOut } from "next-auth/react";
import { ApiError } from "@/types/api";
import { emitToast } from "@/components/ui/toast";

/** Guard a nivel de módulo: el 401 solo se maneja una vez por sesión de página. */
let sessionExpiredHandled = false;

function handleUnauthorized(): void {
  if (sessionExpiredHandled) return;

  // Defensivo: el 401 solo puede ocurrir en páginas autenticadas, pero por
  // las dudas no disparamos toast/redirect si ya estamos en /login.
  if (typeof window !== "undefined" && window.location.pathname === "/login") return;

  sessionExpiredHandled = true;

  emitToast("error", "Tu sesión expiró, volvé a entrar.");
  void signOut({ callbackUrl: "/login" });
}

function handleQueryOrMutationError(error: unknown): void {
  if (error instanceof ApiError && error.statusCode === 401) {
    handleUnauthorized();
  }
}

/**
 * Fábrica del QueryClient — separada del componente para poder instanciarla
 * directamente en tests sin montar el árbol de providers.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({ onError: handleQueryOrMutationError }),
    mutationCache: new MutationCache({ onError: handleQueryOrMutationError }),
    defaultOptions: {
      queries: {
        // Tiempo que los datos se consideran frescos antes de refetch (1 min)
        staleTime: 60 * 1000,
        // Reintentos en error: solo 1 vez (no martillar al backend), EXCEPTO
        // en un 401 — ver comentario arriba del porqué no reintenta nunca.
        retry: (failureCount, error) =>
          error instanceof ApiError && error.statusCode === 401 ? false : failureCount < 1,
        // No refetch al recuperar el foco de la ventana en desarrollo
        refetchOnWindowFocus: process.env.NODE_ENV === "production",
      },
      mutations: {
        // Sin reintentos en mutaciones (evitar doble-submit)
        retry: 0,
      },
    },
  });
}

interface ReactQueryProviderProps {
  children: ReactNode;
}

export function ReactQueryProvider({ children }: ReactQueryProviderProps) {
  // useState garantiza que cada request del servidor tenga su propio QueryClient
  const [queryClient] = useState(createQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
