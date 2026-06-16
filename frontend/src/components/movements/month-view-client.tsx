"use client";

/**
 * Vista del mes — Client Component (RF-VM-001/002/003/004).
 *
 * Re-estilado con tokens del DS "Precise Ledger" (Fase 3).
 * Fase 1.1.3 (revisado 2026-06-16): PeriodNav es el grid de 3 columnas;
 * flechas gigantes laterales en ≥941px; pill stepper compacto en ≤940px.
 * Fase 1.1.4 (2026-06-16): P5 acordeón + P6 reordenar secciones.
 *   - Las 3 secciones (Únicos / Fijos / Cuotas) se muestran SIEMPRE.
 *   - Cada sección es colapsable/expandible individualmente (acordeón).
 *   - El orden de secciones es configurable por drag (modo orden con dnd-kit).
 *   - Estado persistido en preferences.monthSections (blob de preferencias).
 *   - Cambios aplicados optimistamente; persistencia en background.
 *
 * Layout:
 *   - PeriodNav (grid 3 col: auto | minmax(0,1120px) | auto):
 *       Columnas laterales: celdas de flecha ‹ / ›, ocultas en ≤940px.
 *       Columna central: contenido con px-10, max-w controlado por el grid.
 *   - Header dentro de la columna central (.phead en ≥941px / stepper en ≤940px):
 *       Desktop: eyebrow "Tu mes" + H1 período "Junio 2026" + sub-línea estado.
 *       Mobile:  pill stepper compacto (‹ rótulo ›).
 *       Siempre: botón "Ordenar secciones" / "Listo" + botón "+ Nuevo movimiento" a la derecha.
 *   - Totales: grid 1fr 1fr 1.1fr (Gastos / Ingresos / mini-balance).
 *   - Grupos Únicos / Fijos / Cuotas: AccordionSection + SortableSection.
 *   - Filas: .mov (ícono, nombre, fecha, monto).
 *
 * Lógica preservada intacta (hooks, router, mappers, handlers de editar/eliminar).
 */

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ArrowUpDown, Check } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { useMovements } from "@/hooks/use-movements";
import { usePreferences } from "@/hooks/use-preferences";
import { SortableSection } from "@/components/ui/sortable-section";
import { AccordionSection } from "@/components/ui/accordion-section";
import { MovementItemRow } from "@/components/movements/movement-item-row";
import { TransactionModal } from "@/components/movements/transaction-modal";
import { DeleteTransactionDialog } from "@/components/movements/delete-transaction-dialog";
import { DeleteRecurringDialog } from "@/components/movements/delete-recurring-dialog";
import { DeleteInstallmentDialog } from "@/components/movements/delete-installment-dialog";
import { NewTransactionButton } from "@/components/movements/new-transaction-button";
import { PeriodNav } from "@/components/ui/period-nav";
import {
  formatCurrency,
  formatMonthLabel,
  prevMonth,
  nextMonth,
  getCurrentMonth,
} from "@/lib/format";
import type { MovementItem } from "@/types/movement";
import type { Transaction } from "@/types/transaction";
import type { Recurring } from "@/types/recurring";
import type { InstallmentGroup } from "@/types/installment";
import type { MonthSectionKey, MonthSectionsPreferences } from "@/types/auth";

// ─── Constantes de sección ────────────────────────────────────────────────────

const ALL_SECTION_KEYS: MonthSectionKey[] = ["unicos", "fijos", "cuotas"];

const SECTION_LABELS: Record<MonthSectionKey, string> = {
  unicos: "Únicos",
  fijos: "Fijos",
  cuotas: "Cuotas",
};

const SECTION_EMPTY_COPY: Record<MonthSectionKey, string> = {
  unicos: "Sin movimientos únicos",
  fijos: "Sin fijos",
  cuotas: "Sin cuotas",
};

// ─── Normalización de preferencias (back-compat) ─────────────────────────────

/**
 * Normaliza el objeto monthSections de preferencias para garantizar back-compat.
 * - Si no existe, devuelve defaults.
 * - Si order tiene claves desconocidas o faltantes, normaliza contra ALL_SECTION_KEYS.
 * - Si collapsed tiene claves desconocidas, las filtra.
 */
function normalizeMonthSections(
  raw: MonthSectionsPreferences | undefined,
): { order: MonthSectionKey[]; collapsed: MonthSectionKey[] } {
  const defaultOrder: MonthSectionKey[] = ["unicos", "fijos", "cuotas"];
  const defaultCollapsed: MonthSectionKey[] = [];

  if (!raw) {
    return { order: defaultOrder, collapsed: defaultCollapsed };
  }

  // Normalizar order: mantener las conocidas en el orden dado, agregar las faltantes al final
  const knownSet = new Set<MonthSectionKey>(ALL_SECTION_KEYS);
  const filteredOrder = (raw.order ?? []).filter((k): k is MonthSectionKey =>
    knownSet.has(k as MonthSectionKey),
  );
  const inOrder = new Set(filteredOrder);
  const missingKeys = ALL_SECTION_KEYS.filter((k) => !inOrder.has(k));
  const order: MonthSectionKey[] = [...filteredOrder, ...missingKeys];

  // Normalizar collapsed: solo claves conocidas
  const collapsed = (raw.collapsed ?? []).filter((k): k is MonthSectionKey =>
    knownSet.has(k as MonthSectionKey),
  );

  return { order, collapsed };
}

// ─── Mapeo MovementItem → Transaction (únicos) ─────────────────────────────────

function movementItemToTransaction(item: MovementItem): Transaction {
  const occurredAt = item.occurredAt ?? "";
  const timezone = item.timezone ?? "";

  return {
    id: item.id,
    userId: "",
    categoryId: item.category.id,
    type: item.type,
    amountCents: item.amountCents,
    description: item.description,
    occurredAt,
    timezone,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    category: item.category,
  };
}

// ─── Mapeo MovementItem → Recurring (fijos) ────────────────────────────────────

function movementItemToRecurring(item: MovementItem): Recurring {
  return {
    id: item.id,
    userId: "",
    categoryId: item.category.id,
    type: item.type,
    amountCents: item.amountCents,
    description: item.description,
    startMonth: getCurrentMonth(), // Relleno válido para el schema (no se envía en PATCH)
    deletedFrom: null,
    frequency: item.frequency ?? "MONTHLY",
    createdAt: "",
    updatedAt: "",
    category: item.category,
  };
}

// ─── Mapeo MovementItem → InstallmentGroup (cuotas) ──────────────────────────

function movementItemToInstallment(item: MovementItem): InstallmentGroup {
  return {
    id: item.id,
    userId: "",
    categoryId: item.category.id,
    type: "EXPENSE",
    amountCents: item.amountCents,
    totalInstallments: item.installment?.total ?? 1,
    startMonth: item.installment?.startMonth ?? "",
    description: item.description,
    createdAt: "",
    updatedAt: "",
    category: item.category,
  };
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface MonthViewClientProps {
  month: string;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function MonthViewClient({ month }: MonthViewClientProps) {
  const router = useRouter();
  const { data, isLoading, isError } = useMovements(month);
  const { preferences, setPreferences } = usePreferences();

  // Estado de modales para únicos
  const [editingUnico, setEditingUnico] = useState<MovementItem | null>(null);
  const [deletingUnico, setDeletingUnico] = useState<MovementItem | null>(null);

  // Estado de modales para fijos
  const [editingFijo, setEditingFijo] = useState<MovementItem | null>(null);
  const [deletingFijo, setDeletingFijo] = useState<MovementItem | null>(null);

  // Estado de modales para cuotas
  const [editingCuota, setEditingCuota] = useState<MovementItem | null>(null);
  const [deletingCuota, setDeletingCuota] = useState<MovementItem | null>(null);

  // ── Estado de acordeón y orden (Fase 1.1.4) ───────────────────────────────

  // Normalizar desde preferencias (back-compat)
  const savedSections = normalizeMonthSections(
    preferences.monthSections as MonthSectionsPreferences | undefined,
  );

  // Estado local optimista: se actualiza inmediatamente, persiste en background
  const [sectionOrder, setSectionOrder] = useState<MonthSectionKey[]>(
    savedSections.order,
  );
  const [collapsedSections, setCollapsedSections] = useState<
    Set<MonthSectionKey>
  >(new Set(savedSections.collapsed));

  // Modo orden (drag activo)
  const [isOrderMode, setIsOrderMode] = useState(false);

  // Id de la sección que se está arrastrando (para el DragOverlay)
  const [activeId, setActiveId] = useState<MonthSectionKey | null>(null);

  // Sincronizar con preferencias cuando lleguen del servidor (primer mount / refetch)
  // Solo sincronizamos si el usuario no está en modo orden (para no interrumpir el drag)
  const [hasSynced, setHasSynced] = useState(false);
  useEffect(() => {
    if (!hasSynced && preferences.monthSections !== undefined) {
      const normalized = normalizeMonthSections(
        preferences.monthSections as MonthSectionsPreferences | undefined,
      );
      setSectionOrder(normalized.order);
      setCollapsedSections(new Set(normalized.collapsed));
      setHasSynced(true);
    }
  }, [preferences.monthSections, hasSynced]);

  // ── Configuración de sensores dnd-kit ────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Activar drag solo tras 8px de movimiento (evita confundir click con drag)
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // ── Datos de movimientos ──────────────────────────────────────────────────

  const totals = data?.totals;
  const unicos = data?.movements.unicos ?? [];
  const fijos = data?.movements.fijos ?? [];
  const cuotas = data?.movements.cuotas ?? [];

  const monthLabel = formatMonthLabel(month);
  const labelParts = monthLabel.split(" ");
  const mesName = labelParts[0]
    ? labelParts[0].charAt(0).toUpperCase() + labelParts[0].slice(1)
    : "";
  const yearName = labelParts[1] ?? "";

  const isCurrentMonth = month === getCurrentMonth();

  // ── Navegación ────────────────────────────────────────────────────────────

  function goToPrevMonth() {
    router.push(`/mes?month=${prevMonth(month)}`);
  }

  function goToNextMonth() {
    router.push(`/mes?month=${nextMonth(month)}`);
  }

  // ── Handlers editar/eliminar ──────────────────────────────────────────────

  function handleEdit(movement: MovementItem) {
    if (movement.origin === "fijo") {
      setEditingFijo(movement);
    } else if (movement.origin === "cuota") {
      setEditingCuota(movement);
    } else {
      setEditingUnico(movement);
    }
  }

  function handleDelete(movement: MovementItem) {
    if (movement.origin === "fijo") {
      setDeletingFijo(movement);
    } else if (movement.origin === "cuota") {
      setDeletingCuota(movement);
    } else {
      setDeletingUnico(movement);
    }
  }

  // ── Subtotales por grupo ──────────────────────────────────────────────────

  function groupSubtotal(items: MovementItem[]): number {
    return items.reduce((acc, m) => {
      return acc + (m.type === "EXPENSE" ? -m.amountCents : m.amountCents);
    }, 0);
  }

  function formatSubtotal(cents: number): string {
    const abs = formatCurrency(Math.abs(cents));
    if (cents > 0) return `+${abs}`;
    if (cents < 0) return `−${abs}`;
    return abs;
  }

  // ── Mapa de ítems por sección ─────────────────────────────────────────────

  const sectionItems: Record<MonthSectionKey, MovementItem[]> = {
    unicos,
    fijos,
    cuotas,
  };

  // ── Toggle colapso (Fase 1.1.4 P5) ───────────────────────────────────────

  const handleToggleCollapse = useCallback(
    (key: MonthSectionKey) => {
      setCollapsedSections((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        // Persistir en background (merge manual)
        const collapsed = Array.from(next);
        void setPreferences({
          ...preferences,
          monthSections: { order: sectionOrder, collapsed },
        });
        return next;
      });
    },
    [preferences, sectionOrder, setPreferences],
  );

  // ── Modo orden (Fase 1.1.4 P6) ───────────────────────────────────────────

  function handleEnterOrderMode() {
    setIsOrderMode(true);
  }

  function handleExitOrderMode() {
    setIsOrderMode(false);
  }

  // ── Handlers drag dnd-kit ─────────────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as MonthSectionKey);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    setSectionOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as MonthSectionKey);
      const newIndex = prev.indexOf(over.id as MonthSectionKey);
      if (oldIndex === -1 || newIndex === -1) return prev;

      const next = arrayMove(prev, oldIndex, newIndex);

      // Persistir en background (merge manual)
      const collapsed = Array.from(collapsedSections);
      void setPreferences({
        ...preferences,
        monthSections: { order: next, collapsed },
      });

      return next;
    });
  }

  // ── Totales ───────────────────────────────────────────────────────────────

  const expenseCents = totals?.expenseCents ?? 0;
  const incomeCents = totals?.incomeCents ?? 0;
  const balanceCents = totals?.balanceCents ?? 0;

  const periodLabel = `${mesName} ${yearName}`;
  const statusLabel = isCurrentMonth ? "Mes en curso" : "Histórico";

  // ── Render de la sección activa en el DragOverlay ─────────────────────────

  function renderOverlay(id: MonthSectionKey) {
    const items = sectionItems[id];
    const isCollapsed = collapsedSections.has(id);
    const label = SECTION_LABELS[id];

    return (
      <div
        style={{
          transform: "scale(1.02)",
          opacity: 0.95,
          boxShadow: "var(--shadow-lg)",
          borderRadius: "var(--r-card)",
          background: "var(--panel)",
        }}
      >
        <AccordionSection
          id={`overlay-${id}`}
          label={label}
          count={items.length}
          subtotal={formatSubtotal(groupSubtotal(items))}
          isCollapsed={isCollapsed}
          onToggle={() => {}}
          isOrderMode={true}
          showGripHandle={true}
        >
          {items.length === 0 ? (
            <SectionEmpty sectionKey={id} />
          ) : (
            <SectionList items={items} viewMonth={month} onEdit={handleEdit} onDelete={handleDelete} />
          )}
        </AccordionSection>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PeriodNav
      prevLabel="Mes anterior"
      nextLabel="Mes siguiente"
      onPrev={goToPrevMonth}
      onNext={goToNextMonth}
      canGoPrev={true}
      canGoNext={true}
    >
      <div className="px-10 space-y-0">
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-end justify-between gap-5 mb-6 flex-wrap">

          {/* Bloque de título — desktop (≥941px) */}
          <div className="hidden [@media(min-width:941px)]:flex flex-col gap-0">
            <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">
              Tu mes
            </span>
            <h1 className="text-[32px] font-bold tracking-[-0.02em] leading-none text-ink mt-0.5 mb-1">
              {periodLabel}
            </h1>
            <span className="text-[12.5px] font-medium text-muted">
              {statusLabel}
            </span>
          </div>

          {/* Stepper compacto — mobile (≤940px) */}
          {/*
           * aria-hidden: en jsdom (tests, sin breakpoints CSS) este bloque
           * y las flechas de PeriodNav coexisten en el DOM. El aria-hidden
           * hace que los botones del stepper compacto queden fuera del árbol
           * de accesibilidad, evitando duplicados en getByRole.
           * En el browser, la clase hidden/@media ya lo oculta visualmente.
           */}
          <div aria-hidden="true" className="[@media(min-width:941px)]:hidden inline-flex items-center gap-0.5 bg-panel border border-line rounded-pill px-1 py-1 shadow-[var(--shadow-sm)]">
            <button
              onClick={goToPrevMonth}
              aria-label="Mes anterior"
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-panel-2 hover:text-ink transition-colors duration-[140ms] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <div className="min-w-[124px] text-center px-1">
              <span className="block text-[14.5px] font-semibold text-ink">
                {mesName} {yearName}
              </span>
              <span className="block text-[11px] font-medium text-muted tracking-[0.02em] -mt-0.5">
                {statusLabel}
              </span>
            </div>
            <button
              onClick={goToNextMonth}
              aria-label="Mes siguiente"
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-panel-2 hover:text-ink transition-colors duration-[140ms] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>

          {/* Acciones del header: "Ordenar secciones" / "Listo" + "+ Nuevo movimiento" */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Botón Ordenar secciones / Listo */}
            {isOrderMode ? (
              <button
                type="button"
                onClick={handleExitOrderMode}
                className={[
                  // Primario índigo (señala modo activo)
                  "inline-flex items-center gap-1.5 px-3 py-2",
                  "text-[13px] font-semibold text-white",
                  "rounded-[var(--r-ctl)]",
                  "bg-accent hover:bg-accent-press",
                  "transition-colors duration-[140ms]",
                  "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
                  "shadow-[var(--shadow-sm),inset_0_1px_0_oklch(1_0_0_/_0.2)]",
                  "hover:shadow-[var(--shadow-md)]",
                ].join(" ")}
              >
                <Check size={15} aria-hidden="true" />
                Listo
              </button>
            ) : (
              <button
                type="button"
                onClick={handleEnterOrderMode}
                className={[
                  // Ghost del DS
                  "inline-flex items-center gap-1.5 px-3 py-2",
                  "text-[13px] font-semibold text-ink-2",
                  "rounded-[var(--r-ctl)]",
                  "bg-panel border border-line",
                  "hover:bg-panel-2 hover:text-ink",
                  "transition-colors duration-[140ms]",
                  "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
                ].join(" ")}
                aria-label="Ordenar secciones"
              >
                <ArrowUpDown size={15} aria-hidden="true" />
                Ordenar secciones
              </button>
            )}

            {/* Botón "+ Nuevo movimiento" — deshabilitado en modo orden */}
            <div className={isOrderMode ? "opacity-45 pointer-events-none cursor-default" : ""}>
              <NewTransactionButton label="+ Nuevo movimiento" defaultMonth={month} />
            </div>
          </div>
        </div>

        {/* ── Totales / error / loading ── */}
        {isLoading ? (
          <div className="grid gap-[var(--gap)] mb-6" style={{ gridTemplateColumns: "1fr 1fr 1.1fr" }} aria-label="Cargando totales" role="status">
            <div className="h-[90px] animate-pulse rounded-card bg-panel-3" />
            <div className="h-[90px] animate-pulse rounded-card bg-panel-3" />
            <div className="h-[90px] animate-pulse rounded-card bg-panel-3" />
          </div>
        ) : isError ? (
          <div
            role="alert"
            className="mb-6 rounded-card border border-expense bg-expense-soft px-4 py-3 text-sm text-expense-ink"
          >
            No se pudo cargar el mes. Intentá recargar la página.
          </div>
        ) : (
          <>
            {/* Tarjetas de totales compactas: grid 1fr 1fr 1.1fr */}
            <div
              className="grid gap-[var(--gap)] mb-6"
              style={{ gridTemplateColumns: "1fr 1fr 1.1fr" }}
            >
              {/* Gastos */}
              <div className="bg-panel border border-line rounded-card shadow-[var(--shadow-sm)] flex flex-col gap-[6px]" style={{ padding: "16px 18px" }}>
                <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Gastos
                </div>
                <div className="text-[23px] font-semibold tracking-[-0.02em] leading-none mono text-ink">
                  {formatCurrency(expenseCents)}
                </div>
              </div>

              {/* Ingresos */}
              <div className="bg-panel border border-line rounded-card shadow-[var(--shadow-sm)] flex flex-col gap-[6px]" style={{ padding: "16px 18px" }}>
                <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Ingresos
                </div>
                <div className="text-[23px] font-semibold tracking-[-0.02em] leading-none mono text-income-ink">
                  {formatCurrency(incomeCents)}
                </div>
              </div>

              {/* Mini-balance */}
              <div
                className="rounded-card relative overflow-hidden text-white shadow-[var(--shadow-md)] flex flex-col gap-[6px]"
                style={{
                  padding: "16px 18px",
                  background: "linear-gradient(135deg, var(--accent-press), var(--accent))",
                }}
              >
                <div className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-white/70">
                  Balance
                </div>
                <div className="text-[28px] font-semibold tracking-[-0.02em] leading-none mono">
                  {balanceCents >= 0
                    ? `+ ${formatCurrency(balanceCents)}`
                    : `− ${formatCurrency(Math.abs(balanceCents))}`}
                </div>
              </div>
            </div>

            {/* ── Lista agrupada por origen — con acordeón y reordenamiento ── */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sectionOrder}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-[30px] mt-1">
                  {sectionOrder.map((key) => {
                    const items = sectionItems[key];
                    const label = SECTION_LABELS[key];
                    const isCollapsed = collapsedSections.has(key);

                    return (
                      <SortableSection
                        key={key}
                        id={key}
                        label={label}
                        count={items.length}
                        subtotal={formatSubtotal(groupSubtotal(items))}
                        isCollapsed={isCollapsed}
                        onToggle={() => handleToggleCollapse(key)}
                        isOrderMode={isOrderMode}
                      >
                        {/* Contenido de la sección: lista o empty inline */}
                        {items.length === 0 ? (
                          <SectionEmpty sectionKey={key} />
                        ) : (
                          // Atenuación opcional del contenido en modo orden
                          <div className={isOrderMode ? "opacity-70" : ""}>
                            <SectionList
                              items={items}
                              viewMonth={month}
                              onEdit={handleEdit}
                              onDelete={handleDelete}
                            />
                          </div>
                        )}
                      </SortableSection>
                    );
                  })}
                </div>
              </SortableContext>

              {/* DragOverlay — ítem levantado con sombra de elevación */}
              <DragOverlay>
                {activeId ? renderOverlay(activeId) : null}
              </DragOverlay>
            </DndContext>
          </>
        )}
      </div>

      {/* ── Modal editar único ── */}
      {editingUnico && (
        <TransactionModal
          mode="edit-single"
          transaction={movementItemToTransaction(editingUnico)}
          onClose={() => setEditingUnico(null)}
        />
      )}

      {/* ── Diálogo eliminar único ── */}
      {deletingUnico && (
        <DeleteTransactionDialog
          transaction={movementItemToTransaction(deletingUnico)}
          onClose={() => setDeletingUnico(null)}
        />
      )}

      {/* ── Modal editar fijo ── */}
      {editingFijo && (
        <TransactionModal
          mode="edit-fixed"
          recurring={movementItemToRecurring(editingFijo)}
          onClose={() => setEditingFijo(null)}
          viewMonth={month}
        />
      )}

      {/* ── Diálogo eliminar fijo ── */}
      {deletingFijo && (
        <DeleteRecurringDialog
          movement={deletingFijo}
          onClose={() => setDeletingFijo(null)}
          viewMonth={month}
        />
      )}

      {/* ── Modal editar cuota ── */}
      {editingCuota && (
        <TransactionModal
          mode="edit-installment"
          installment={movementItemToInstallment(editingCuota)}
          onClose={() => setEditingCuota(null)}
        />
      )}

      {/* ── Diálogo eliminar cuota ── */}
      {deletingCuota && (
        <DeleteInstallmentDialog
          movement={deletingCuota}
          onClose={() => setDeletingCuota(null)}
        />
      )}
    </PeriodNav>
  );
}

// ─── Sub-componentes auxiliares ───────────────────────────────────────────────

/** Estado vacío inline de una sección (Fase 1.1.4 D) */
function SectionEmpty({ sectionKey }: { sectionKey: MonthSectionKey }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-panel-2 px-6 py-6 text-center">
      <p className="text-[12.5px] font-medium text-muted">
        {SECTION_EMPTY_COPY[sectionKey]}
      </p>
    </div>
  );
}

/** Lista de ítems de una sección */
interface SectionListProps {
  items: MovementItem[];
  viewMonth: string;
  onEdit: (m: MovementItem) => void;
  onDelete: (m: MovementItem) => void;
}

function SectionList({ items, viewMonth, onEdit, onDelete }: SectionListProps) {
  return (
    <div className="bg-panel border border-line rounded-card overflow-hidden shadow-[var(--shadow-sm)]">
      {items.map((item) => (
        <MovementItemRow
          key={item.id}
          movement={item}
          viewMonth={viewMonth}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
