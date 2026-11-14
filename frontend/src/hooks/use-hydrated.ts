"use client";

/**
 * useHydrated — false en SSR y en el render de hidratación; true en cualquier
 * render posterior del cliente.
 *
 * Por qué useSyncExternalStore y no useState+useEffect: en un render
 * puramente cliente (navegación blanda) devuelve true YA en el primer render,
 * así que no introduce un flash. Solo durante la hidratación usa el snapshot de
 * servidor (false) y re-renderiza enseguida con true.
 *
 * Uso: gates de UI que dependen de estado que el cliente puede tener antes que
 * el SSR (caché de React Query poblada por otro componente mientras el boundary
 * de Suspense todavía no hidrató) → el primer render debe coincidir con el HTML.
 */

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
