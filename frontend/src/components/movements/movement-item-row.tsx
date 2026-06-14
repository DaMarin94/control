"use client";

/**
 * Fila de un movimiento en la lista del mes (RF-VM-001).
 *
 * Re-estilado con tokens del DS "Precise Ledger" (Fase 3).
 *
 * Layout: grid 40px 1fr auto auto
 *   1. Ícono 40×40 tintado (expense-soft/expense-ink o income-soft/income-ink)
 *   2. Texto: nombre + sub-línea (categoría · tipo · [mensual para fijos])
 *   3. Fecha en mono (DD Mmm); en fijos "Mensual"; en cuotas "Cuota X/N" + sub "cuota X/Y"
 *   4. Monto mono 15.5px (gastos con −$, ingresos con +$ en income-ink)
 *
 * Acciones editar/borrar: aparecen en hover de la fila (opacity 0→1).
 */

import { type MovementItem } from "@/types/movement";
import { formatCurrency, formatDate } from "@/lib/format";
import { ArrowDown, ArrowUp, Repeat, Pencil, Trash2 } from "lucide-react";

interface MovementItemRowProps {
  movement: MovementItem;
  onEdit: (movement: MovementItem) => void;
  onDelete: (movement: MovementItem) => void;
}

export function MovementItemRow({ movement, onEdit, onDelete }: MovementItemRowProps) {
  const isExpense = movement.type === "EXPENSE";
  const isFijo = movement.origin === "fijo";
  const isCuota = movement.origin === "cuota";

  // Fecha formateada "02 Jun" (solo para únicos)
  const dateFormatted =
    !isFijo && !isCuota && movement.occurredAt && movement.timezone
      ? formatDate(movement.occurredAt, movement.timezone)
      : null;

  // Monto: gastos con −$, ingresos con +$
  const amountFormatted = formatCurrency(movement.amountCents);
  const amountDisplay = isExpense ? `−${amountFormatted}` : `+${amountFormatted}`;

  // Ícono y clases de color por tipo
  const IconComponent = isExpense ? ArrowDown : ArrowUp;
  const iconBg = isExpense ? "bg-expense-soft" : "bg-income-soft";
  const iconColor = isExpense ? "text-expense-ink" : "text-income-ink";

  // Sublínea: "Categoría · tipo · [repeat mensual]"
  const typeLabel = isExpense ? "gasto" : "ingreso";
  const categoryName = movement.category.name;

  // Cuota label: "Cuota X/N"
  const installmentLabel =
    isCuota && movement.installment
      ? `Cuota ${movement.installment.number}/${movement.installment.total}`
      : null;

  return (
    <div
      className="group relative grid items-center gap-[14px] px-[18px] cursor-pointer transition-colors duration-[120ms] hover:bg-panel-2 [&+&]:border-t [&+&]:border-hair"
      style={{ gridTemplateColumns: "40px 1fr auto auto", padding: `var(--row-pad) 18px` }}
    >
      {/* Col 1: Ícono tintado */}
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] ${iconBg} ${iconColor}`}
        aria-hidden="true"
      >
        <IconComponent size={19} strokeWidth={2.2} />
      </span>

      {/* Col 2: Nombre + sublínea */}
      <div className="min-w-0">
        <b className="block text-[14.5px] font-semibold tracking-[-0.01em] text-ink leading-snug truncate">
          {movement.description ?? categoryName}
        </b>
        <span className="flex items-center gap-[7px] text-[12.5px] text-muted flex-wrap">
          <span>{categoryName}</span>
          <span
            className="inline-block h-[3px] w-[3px] rounded-full bg-faint shrink-0"
            aria-hidden="true"
          />
          <span>{typeLabel}</span>
          {isFijo && (
            <>
              <span
                className="inline-block h-[3px] w-[3px] rounded-full bg-faint shrink-0"
                aria-hidden="true"
              />
              <span className="inline-flex items-center gap-[4px]">
                <Repeat size={12} className="opacity-60" aria-hidden="true" />
                mensual
              </span>
            </>
          )}
        </span>
      </div>

      {/* Col 3: Fecha / tipo de cuota */}
      <div className="text-right">
        <span className="block text-[12.5px] text-muted mono whitespace-nowrap">
          {isFijo ? "Mensual" : isCuota ? (installmentLabel ?? "") : (dateFormatted ?? "")}
        </span>
        {isCuota && installmentLabel && (
          <span className="block text-[11px] text-muted mono mt-[1px]">
            {/* sub-línea de cuota vacía — el label ya es "Cuota X/N" */}
          </span>
        )}
      </div>

      {/* Col 4: Monto mono */}
      <span
        className={`text-[15.5px] font-semibold text-right min-w-[100px] mono ${
          isExpense ? "text-ink" : "text-income-ink"
        }`}
      >
        {amountDisplay}
      </span>

      {/* Acciones editar/borrar: aparecen al hover de la fila */}
      <div
        className="absolute right-[18px] top-1/2 -translate-y-1/2 flex gap-1 opacity-0 transition-opacity duration-[140ms] group-hover:opacity-100"
      >
        <button
          type="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onEdit(movement);
          }}
          aria-label={`Editar ${movement.description ?? categoryName}`}
          className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-transparent bg-transparent text-muted transition-colors duration-[140ms] hover:border-line hover:bg-panel-3 hover:text-ink focus-visible:opacity-100 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
        >
          <Pencil size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(movement);
          }}
          aria-label={`Eliminar ${movement.description ?? categoryName}`}
          className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-transparent bg-transparent text-muted transition-colors duration-[140ms] hover:border-expense hover:bg-expense-soft hover:text-expense-ink focus-visible:opacity-100 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--expense-soft)]"
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
