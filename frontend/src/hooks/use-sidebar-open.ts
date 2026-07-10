"use client";

/**
 * useSidebarOpen — estado abierto/cerrado del sidebar global (RF-NAV-002).
 *
 * Construido sobre usePreferences, mismo patrón que useTheme:
 *   - La clave canónica en el blob de preferencias es `sidebarOpen` (boolean).
 *     Ausente → default `true` (abierto).
 *   - `toggleSidebar` aplica el nuevo estado de forma OPTIMISTA en estado local
 *     de React (dispara la transición al instante, sin esperar la red) y
 *     persiste en background con reemplazo total del blob (`{ ...preferences,
 *     sidebarOpen: next }`), igual que el resto de las claves (`theme`,
 *     `reports`, etc.).
 *
 * Carga inicial sin flash (docs/design.md §"Carga inicial sin flash"):
 * `initialOpen` viene server-rendered desde `(app)/layout.tsx` — ese Server
 * Component ya llama a `auth()` (para el email) y lee `session.preferences.
 * sidebarOpen` de la misma pasada, sin pedidos extra. Al usarlo como valor
 * inicial de este estado, el primer HTML que manda el servidor YA refleja el
 * sidebar abierto/cerrado correcto, y la hidratación coincide — sin salto.
 * Es el mecanismo análogo al anti-FOUC del modo de color, pero resuelto a
 * nivel de árbol de React (estructura de layout) en vez de atributo de
 * `<html>` (aquí no hace falta tocar el DOM antes del primer paint como sí
 * hace falta para el color, porque el propio HTML server-rendered ya trae la
 * estructura correcta).
 */

import { useCallback, useState } from "react";
import { usePreferences } from "@/hooks/use-preferences";
import type { UserPreferences } from "@/types/auth";

/** Default de la preferencia `sidebarOpen` (RF-NAV-002): el sidebar arranca abierto. */
export const SIDEBAR_OPEN_DEFAULT = true;

export function useSidebarOpen(initialOpen: boolean) {
  const [sidebarOpen, setSidebarOpenState] = useState(initialOpen);
  const { preferences, setPreferences, isSaving } = usePreferences();

  const toggleSidebar = useCallback(() => {
    setSidebarOpenState((current) => {
      const next = !current;
      const newPreferences: UserPreferences = { ...preferences, sidebarOpen: next };
      void setPreferences(newPreferences);
      return next;
    });
  }, [preferences, setPreferences]);

  return {
    /** Estado abierto/cerrado actual (optimista — no espera la persistencia). */
    sidebarOpen,
    /** Alterna abierto ↔ cerrado; persiste en background. */
    toggleSidebar,
    /** true mientras hay una mutación de preferencias en vuelo. */
    isSaving,
  };
}
