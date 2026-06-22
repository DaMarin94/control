"use client";

/**
 * useTheme — Ola 4: modo de color de la UI.
 *
 * Construido sobre usePreferences. Expone:
 *   - `theme`         : el valor guardado en el blob ("system" | "light" | "dark").
 *                       Ausente en el blob → "system" (default).
 *   - `resolvedTheme` : "light" | "dark" — el modo efectivo según el valor y el SO.
 *   - `setTheme`      : persiste la clave `theme` en el blob (merge manual),
 *                       actualiza el mirror localStorage y aplica data-theme al DOM.
 *
 * Flujo de sincronización:
 *   1. Al montar, la clave `theme` del blob (sesión / DB) es la fuente canónica.
 *   2. Se refleja en localStorage ("control:theme") como mirror de boot.
 *   3. document.documentElement.dataset.theme se setea con el modo resuelto.
 *   4. Con theme="system" se suscribe a cambios de prefers-color-scheme en vivo.
 *
 * El script anti-flash en layout.tsx usa ese mirror para evitar FOUC en el boot.
 * La fuente canónica (DB) prevalece una vez que la sesión carga.
 */

import { useEffect, useCallback, useRef } from "react";
import { usePreferences } from "@/hooks/use-preferences";
import type { UserPreferences } from "@/types/auth";

export type ThemeValue = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const THEME_STORAGE_KEY = "control:theme";

/** Resuelve el modo efectivo dado un valor de preferencia y el estado del sistema. */
function resolveTheme(theme: ThemeValue, systemDark: boolean): ResolvedTheme {
  if (theme === "dark") return "dark";
  if (theme === "light") return "light";
  return systemDark ? "dark" : "light";
}

/** Lee prefers-color-scheme del sistema de forma segura (SSR-safe). */
function getSystemDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Aplica el tema resuelto al DOM y actualiza el mirror de localStorage. */
function applyTheme(resolved: ResolvedTheme, value: ThemeValue) {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = resolved;
  }
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      // localStorage puede estar bloqueado (modo incógnito estricto, etc.)
    }
  }
}

export function useTheme() {
  const { preferences, setPreferences, isSaving } = usePreferences();

  const theme: ThemeValue = (preferences.theme as ThemeValue | undefined) ?? "system";
  const systemDark = getSystemDark();
  const resolvedTheme: ResolvedTheme = resolveTheme(theme, systemDark);

  // Ref para acceder al theme actual en el listener sin recrearlo
  const themeRef = useRef(theme);
  themeRef.current = theme;

  // Aplica el tema al DOM y sincroniza el mirror cuando cambia el valor o monta
  useEffect(() => {
    const resolved = resolveTheme(themeRef.current, getSystemDark());
    applyTheme(resolved, themeRef.current);
  }, [theme]);

  // Suscripción en vivo a cambios de prefers-color-scheme cuando theme="system"
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");

    function onSystemChange(e: MediaQueryListEvent) {
      if (themeRef.current === "system") {
        const resolved = e.matches ? "dark" : "light";
        applyTheme(resolved, "system");
      }
    }

    mq.addEventListener("change", onSystemChange);
    return () => mq.removeEventListener("change", onSystemChange);
  }, []);

  const setTheme = useCallback(
    async (newTheme: ThemeValue): Promise<{ success: boolean; error?: string }> => {
      // Aplica optimísticamente antes de persistir (transición de color inmediata)
      const resolved = resolveTheme(newTheme, getSystemDark());
      applyTheme(resolved, newTheme);

      const newPreferences: UserPreferences = { ...preferences, theme: newTheme };
      return setPreferences(newPreferences);
    },
    [preferences, setPreferences],
  );

  return {
    /** Valor guardado en el blob: "system" | "light" | "dark". Default ausente = "system". */
    theme,
    /** Modo efectivo resuelto: "light" | "dark". */
    resolvedTheme,
    /** Persiste la preferencia + aplica al DOM + actualiza mirror. */
    setTheme,
    /** true mientras hay una mutación de preferencias en vuelo. */
    isSaving,
  };
}
