"use client";

/**
 * ThemeProvider — Ola 4.
 *
 * Monta el hook useTheme en el árbol de providers para que el tema se
 * sincronice desde el blob de preferencias (sesión / DB) hacia el DOM
 * tan pronto como la sesión carga, sin requerir que cada página lo llame
 * explícitamente.
 *
 * Solo efecto: sincronizar data-theme en el primer render autenticado.
 * No expone contexto propio: los consumidores llaman a useTheme() directamente.
 */

import { useTheme } from "@/hooks/use-theme";

function ThemeSyncer() {
  // useTheme tiene sus propios useEffect que aplican el tema al DOM
  // cuando las preferencias cambian (sesión, cambio explícito, sistema).
  useTheme();
  return null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ThemeSyncer />
      {children}
    </>
  );
}
