/**
 * Fixtures tipados de `UseQueryResult` (TanStack Query) para mockear hooks de
 * datos (`useXxx` construidos sobre `useQuery`) en tests de componentes.
 *
 * `UseQueryResult` es una unión discriminada de ~7 variantes con ~20
 * propiedades derivadas (`isLoadingError`, `isRefetchError`, `dataUpdatedAt`,
 * `promise`, etc.). Mockear un objeto parcial y castearlo a la fuerza
 * (`as UseQueryResult<...>`) rompe en `tsc` porque el objeto parcial no
 * "overlapea" lo suficiente con ningún miembro de la unión. Estos helpers
 * arman el shape completo para los 3 estados que los tests de componentes
 * necesitan (success / loading / error), evitando repetir las ~20
 * propiedades — y el cast — en cada sitio de uso.
 */
import { vi } from "vitest";
import type { UseQueryResult } from "@tanstack/react-query";

/** Propiedades derivadas de `UseQueryResult` con un valor neutro por defecto. */
function baseFields() {
  return {
    dataUpdatedAt: 0,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    errorUpdateCount: 0,
    isFetched: true,
    isFetchedAfterMount: true,
    isFetching: false,
    isInitialLoading: false,
    isPaused: false,
    isRefetching: false,
    isStale: false,
    isEnabled: true,
    promise: Promise.resolve() as Promise<unknown>,
  };
}

/** Mock de un `UseQueryResult` en estado "success" (con datos). */
export function mockQuerySuccess<TData, TError = Error>(
  data: TData,
  overrides: Partial<UseQueryResult<TData, TError>> = {},
): UseQueryResult<TData, TError> {
  return {
    ...baseFields(),
    data,
    error: null,
    isError: false,
    isPending: false,
    isLoading: false,
    isLoadingError: false,
    isRefetchError: false,
    isSuccess: true,
    isPlaceholderData: false,
    status: "success",
    fetchStatus: "idle",
    refetch: vi.fn(),
    ...overrides,
    // El objeto es un miembro de una unión discriminada (~7 variantes); el
    // spread de `overrides` ensancha el literal y pierde el discriminante
    // exacto para `tsc`. El shape en sí es completo y válido — ver el
    // comentario del módulo.
  } as UseQueryResult<TData, TError>;
}

/** Mock de un `UseQueryResult` en estado "loading"/"pending" (primer fetch en curso). */
export function mockQueryLoading<TData, TError = Error>(
  overrides: Partial<UseQueryResult<TData, TError>> = {},
): UseQueryResult<TData, TError> {
  return {
    ...baseFields(),
    data: undefined,
    error: null,
    isError: false,
    isPending: true,
    isLoading: true,
    isLoadingError: false,
    isRefetchError: false,
    isSuccess: false,
    isPlaceholderData: false,
    status: "pending",
    fetchStatus: "fetching",
    isFetching: true,
    refetch: vi.fn(),
    ...overrides,
  } as UseQueryResult<TData, TError>;
}

/** Mock de un `UseQueryResult` en estado "error" (falló el primer fetch, sin datos previos). */
export function mockQueryError<TData, TError = Error>(
  error: TError,
  overrides: Partial<UseQueryResult<TData, TError>> = {},
): UseQueryResult<TData, TError> {
  return {
    ...baseFields(),
    data: undefined,
    error,
    isError: true,
    isPending: false,
    isLoading: false,
    isLoadingError: true,
    isRefetchError: false,
    isSuccess: false,
    isPlaceholderData: false,
    status: "error",
    fetchStatus: "idle",
    refetch: vi.fn(),
    ...overrides,
  } as UseQueryResult<TData, TError>;
}
