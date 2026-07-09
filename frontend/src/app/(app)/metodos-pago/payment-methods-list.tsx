"use client";

/**
 * Lista de métodos de pago activos con acciones de editar y eliminar.
 * Espejo 1:1 de categories-list.tsx (RF-PM-001..006); lo propio de esta pantalla
 * es que la identidad visual es un ÍCONO (no un color) y el tipo va como chip neutro
 * (docs/design.md, §Métodos de pago — render en la lista).
 *
 * Layout:
 *   - Header: eyebrow "Configuración" + h1 "Métodos de pago" + botón "+ Nuevo método de pago"
 *   - Bajada explicativa
 *   - Lista: filas [tile ícono] [nombre] [chip tipo] [contador] [predeterminado] [acciones]
 *
 * Maneja estados: cargando, vacío, con datos.
 * Abre los modales de editar y eliminar.
 *
 * "Predeterminado" es un indicador de SOLO LECTURA de la feature "Método de pago
 * predeterminado por estructura" (RF-PM-007; spec visual en docs/design.md). La
 * edición vive en PaymentMethodFormModal (kebab → Editar) — ver
 * default-payment-method-cell.tsx.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { Pencil, Trash2 } from "lucide-react";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { usePreferences } from "@/hooks/use-preferences";
import { PaymentMethodIcon } from "@/components/ui/payment-method-icon";
import { type PaymentMethod, PAYMENT_METHOD_TYPE_LABELS } from "@/types/payment-method";
import { PaymentMethodFormModal } from "./payment-method-form-modal";
import { DeletePaymentMethodDialog } from "./delete-payment-method-dialog";
import { SkeletonLine, SkeletonBlock } from "@/components/ui/skeleton";
import {
  DefaultPaymentMethodCell,
  EMPTY_DEFAULT_PAYMENT_METHOD_SLOTS,
  type DefaultPaymentMethodSlots,
} from "./default-payment-method-cell";

// ─── Componente principal ─────────────────────────────────────────────────────

export function PaymentMethodsList() {
  const { paymentMethods, isLoading, isError } = usePaymentMethods();
  const { preferences } = usePreferences();

  // Modal de creación/edición: null = cerrado; PaymentMethod = editar ese; "new" = crear
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | "new" | null>(null);
  // Diálogo de confirmación de eliminación
  const [deletingMethod, setDeletingMethod] = useState<PaymentMethod | null>(null);

  const defaultPaymentMethods: DefaultPaymentMethodSlots =
    preferences.defaultPaymentMethods ?? EMPTY_DEFAULT_PAYMENT_METHOD_SLOTS;

  // ─── Estados de carga / error ─────────────────────────────────────────────

  if (isLoading) {
    return (
      <div role="status" aria-label="Cargando métodos de pago">
        {/* Header skeleton */}
        <div className="flex items-end justify-between gap-5 mb-6">
          <div className="flex flex-col gap-2">
            <SkeletonLine height={12} width={96} />
            <SkeletonLine height={32} width={200} />
          </div>
          <SkeletonBlock height={40} width={188} radius="ctl" />
        </div>

        {/* Lista fantasma: 4 filas que replican la estructura de la fila real */}
        <div className="bg-panel border border-line rounded-card overflow-hidden shadow-[var(--shadow-sm)]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="grid items-center gap-4 px-5 py-[15px] [&+div]:border-t [&+div]:border-hair"
              style={{ gridTemplateColumns: "34px 1fr auto auto" }}
            >
              {/* Tile de ícono (34×34, radio r-ctl igual al tile real) */}
              <SkeletonBlock height={34} width={34} radius="ctl" />
              {/* Nombre */}
              <SkeletonLine height={15} width="55%" />
              {/* Chip de tipo */}
              <SkeletonLine height={16} width={64} />
              {/* Contador */}
              <SkeletonLine height={12} width={80} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-expense-ink">
          No se pudieron cargar los métodos de pago. Recargá la página.
        </p>
      </div>
    );
  }

  const count = paymentMethods?.length ?? 0;

  return (
    <>
      {/* ── Header .phead ── */}
      <div className="flex items-end justify-between gap-5 mb-2 flex-wrap">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted mb-[6px]">
            Configuración
          </p>
          <h1 className="text-[32px] font-bold tracking-[-0.02em] leading-[1.05] text-ink m-0">
            Métodos de pago
          </h1>
        </div>
        <Button size="default" onClick={() => setEditingMethod("new")}>
          + Nuevo método de pago
        </Button>
      </div>

      {/* ── Bajada ── */}
      <p className="text-[14px] text-muted mb-6">
        <span className="mono font-semibold text-ink">{count}</span>{" "}
        {count === 1 ? "método de pago activo" : "métodos de pago activos"}. Asociá un
        método a tus movimientos para saber <b className="font-semibold text-ink">con qué</b>{" "}
        pagaste o cobraste.
      </p>

      {/* ── Lista o estado vacío ── */}
      {!paymentMethods || paymentMethods.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-panel-2 py-12 text-center">
          <p className="text-[15px] font-semibold text-ink">No tenés métodos de pago activos.</p>
          <p className="mt-1 text-[13px] text-muted">
            Creá uno para asociarlo a tus movimientos.
          </p>
          <Button
            variant="ghost"
            className="mt-4"
            onClick={() => setEditingMethod("new")}
          >
            Crear primer método de pago
          </Button>
        </div>
      ) : (
        <div className="bg-panel border border-line rounded-card overflow-hidden shadow-[var(--shadow-sm)]">
          <ul role="list" className="divide-y-0">
            {paymentMethods.map((method) => (
              <PaymentMethodRow
                key={method.id}
                method={method}
                defaultPaymentMethods={defaultPaymentMethods}
                onEdit={() => setEditingMethod(method)}
                onDelete={() => setDeletingMethod(method)}
              />
            ))}
          </ul>
        </div>
      )}

      {/* Modal de creación / edición */}
      {editingMethod !== null && (
        <PaymentMethodFormModal
          paymentMethod={editingMethod === "new" ? null : editingMethod}
          onClose={() => setEditingMethod(null)}
        />
      )}

      {/* Diálogo de confirmación de eliminación */}
      {deletingMethod !== null && (
        <DeletePaymentMethodDialog
          paymentMethod={deletingMethod}
          onClose={() => setDeletingMethod(null)}
        />
      )}
    </>
  );
}

// ─── Fila de método de pago ────────────────────────────────────────────────────

interface PaymentMethodRowProps {
  method: PaymentMethod;
  defaultPaymentMethods: DefaultPaymentMethodSlots;
  onEdit: () => void;
  onDelete: () => void;
}

function PaymentMethodRow({
  method,
  defaultPaymentMethods,
  onEdit,
  onDelete,
}: PaymentMethodRowProps) {
  const movementLabel =
    method.movementCount === 0
      ? "Sin movimientos"
      : method.movementCount === 1
        ? "1 movimiento"
        : `${method.movementCount} movimientos`;

  return (
    <li
      className="group grid items-center gap-4 px-5 py-[15px] transition-colors duration-[120ms] hover:bg-panel-2 [&+li]:border-t [&+li]:border-hair"
      style={{ gridTemplateColumns: "34px 1fr auto auto auto auto" }}
    >
      {/* Tile de ícono — analogía del swatch de color de categorías */}
      <span
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-ctl bg-panel-3 border border-line text-ink-2"
        aria-hidden="true"
      >
        <PaymentMethodIcon icon={method.icon} size={18} />
      </span>

      {/* Nombre */}
      <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink truncate">
        {method.name}
      </span>

      {/* Chip de tipo — neutro (no semántico, no marca) */}
      <span className="inline-flex items-center rounded-chip bg-panel-3 text-muted px-[9px] py-[3px] text-[11.5px] font-semibold tracking-[0.04em]">
        {PAYMENT_METHOD_TYPE_LABELS[method.type]}
      </span>

      {/* Contador */}
      <span className="text-[12.5px] text-muted whitespace-nowrap">{movementLabel}</span>

      {/* Predeterminado — indicador de solo-lectura (edición vía kebab → Editar) */}
      <DefaultPaymentMethodCell method={method} defaultPaymentMethods={defaultPaymentMethods} />

      {/* Acciones (visibles en hover) — KebabMenu por portal+fixed (overflow-hidden de tarjeta) */}
      <KebabMenu
        ariaLabel={`Acciones de ${method.name}`}
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        items={[
          {
            label: "Editar",
            icon: Pencil,
            onSelect: onEdit,
          },
          {
            label: "Eliminar",
            icon: Trash2,
            danger: true,
            onSelect: onDelete,
          },
        ]}
      />
    </li>
  );
}
