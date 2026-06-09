"use client";

/**
 * Fila de un movimiento en la lista del mes (RF-VM-001).
 *
 * Muestra: tipo (gasto/ingreso), monto, categoría (nombre + color),
 * descripción (si tiene), origen (badge "Único" / "Fijo" / "Cuotas"),
 * fecha/hora (solo para únicos — fijos y cuotas tienen occurredAt null).
 *
 * Cambios en Fase 7:
 * - origin === "cuota": badge "Cuotas" y muestra "Cuota X/N" usando installment.number/total.
 * - Para cuotas no se muestran fecha/hora (occurredAt es null — no llamar formatDate/formatTime).
 * - Mantiene intactos únicos (fecha·hora) y fijos ("Mensual").
 */

import { Button } from "@/components/ui/button";
import { type MovementItem } from "@/types/movement";
import { formatCurrency, formatDate, formatTime } from "@/lib/format";

interface MovementItemRowProps {
  movement: MovementItem;
  onEdit: (movement: MovementItem) => void;
  onDelete: (movement: MovementItem) => void;
}

export function MovementItemRow({ movement, onEdit, onDelete }: MovementItemRowProps) {
  const isExpense = movement.type === "EXPENSE";
  const typeLabel = isExpense ? "Gasto" : "Ingreso";
  const amountFormatted = formatCurrency(movement.amountCents);

  const isFijo = movement.origin === "fijo";
  const isCuota = movement.origin === "cuota";

  // Fecha y hora solo para únicos (occurredAt y timezone son strings para "unico")
  const dateFormatted =
    !isFijo && !isCuota && movement.occurredAt && movement.timezone
      ? formatDate(movement.occurredAt, movement.timezone)
      : null;
  const timeFormatted =
    !isFijo && !isCuota && movement.occurredAt && movement.timezone
      ? formatTime(movement.occurredAt, movement.timezone)
      : null;

  // Badge de origen
  const originLabel = isFijo ? "Fijo" : isCuota ? "Cuotas" : "Único";

  // Texto de cuota "X/N" para origin === "cuota" (RF-MC-001: cada cuota muestra su número y total)
  const installmentLabel =
    isCuota && movement.installment
      ? `Cuota ${movement.installment.number}/${movement.installment.total}`
      : null;

  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card px-4 py-3">
      {/* Indicador de color de categoría */}
      <div
        className="mt-1 h-3 w-3 shrink-0 rounded-full"
        style={{ backgroundColor: movement.category.color }}
        aria-hidden="true"
      />

      {/* Contenido principal */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          {/* Monto y tipo */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-base font-semibold ${
                isExpense
                  ? "text-red-600 dark:text-red-400"
                  : "text-green-600 dark:text-green-400"
              }`}
            >
              {isExpense ? "-" : "+"}
              {amountFormatted}
            </span>
            <span className="text-xs text-muted-foreground">{typeLabel}</span>
            {/* Badge de origen */}
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {originLabel}
            </span>
          </div>

          {/* Acciones */}
          <div className="flex shrink-0 gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(movement)}
              aria-label={`Editar movimiento${movement.description ? `: ${movement.description}` : ""}`}
            >
              Editar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(movement)}
              aria-label={`Eliminar movimiento${movement.description ? `: ${movement.description}` : ""}`}
              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            >
              Eliminar
            </Button>
          </div>
        </div>

        {/* Categoría */}
        <p className="mt-0.5 text-sm text-foreground">{movement.category.name}</p>

        {/* Descripción (si tiene) */}
        {movement.description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{movement.description}</p>
        )}

        {/* Fecha y hora (únicos) / "Mensual" (fijos) / "Cuota X/N" (cuotas) */}
        <p className="mt-1 text-xs text-muted-foreground">
          {isFijo ? (
            "Mensual"
          ) : isCuota ? (
            installmentLabel
          ) : dateFormatted && timeFormatted ? (
            `${dateFormatted} · ${timeFormatted}`
          ) : null}
        </p>
      </div>
    </div>
  );
}
