"use client";

/**
 * Provider de React Query (TanStack Query).
 * Montado en el root layout para que toda la app tenga acceso al QueryClient.
 * Server-state: caché, loading/error, invalidación al mutar.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

interface ReactQueryProviderProps {
  children: ReactNode;
}

export function ReactQueryProvider({ children }: ReactQueryProviderProps) {
  // useState garantiza que cada request del servidor tenga su propio QueryClient
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Tiempo que los datos se consideran frescos antes de refetch (1 min)
            staleTime: 60 * 1000,
            // Reintentos en error: solo 1 vez (no martillar al backend)
            retry: 1,
            // No refetch al recuperar el foco de la ventana en desarrollo
            refetchOnWindowFocus: process.env.NODE_ENV === "production",
          },
          mutations: {
            // Sin reintentos en mutaciones (evitar doble-submit)
            retry: 0,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
