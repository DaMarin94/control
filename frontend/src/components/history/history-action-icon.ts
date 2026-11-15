import { CalendarSync, Pencil, Trash2, type LucideIcon } from "lucide-react";
import type { HistoryAction } from "@/types/history";

/**
 * Glifo de cada operación de historial — el MISMO que su acción en el kebab de
 * `/mes` (un concepto, un glifo): Editar → `Pencil`, Eliminar → `Trash2`,
 * Reabrir → `CalendarSync` (docs/design.md "Reabrir un fijo terminado" §7.1).
 */
export const HISTORY_ACTION_ICON: Record<HistoryAction, LucideIcon> = {
  EDIT: Pencil,
  DELETE: Trash2,
  REOPEN: CalendarSync,
};
