"use client";

/**
 * Vista del mes — Client Component (RF-VM-001/002/003/004).
 *
 * Re-estilado con tokens del DS "Precise Ledger" (Fase 3).
 * Fase 1.1.3 (revisado 2026-06-16): PeriodNav es el grid de 3 columnas;
 * flechas gigantes laterales en amplio (≥--bp-wide); pill stepper compacto en compacto (<--bp-wide).
 * Fase 1.1.4 (2026-06-16): P5 acordeón + P6 reordenar secciones.
 *   - Las 3 secciones (Únicos / Fijos / Cuotas) se muestran SIEMPRE.
 *   - Cada sección es colapsable/expandible individualmente (acordeón).
 *   - El orden de secciones es configurable por drag (modo orden con dnd-kit).
 *   - Estado persistido en preferences.monthSections (blob de preferencias).
 *   - Cambios aplicados optimistamente; persistencia en background.
 * Fase 1.2.1 (2026-06-19): filtros por sección (tipo + categoría).
 *   - Filtro de categorías por pantalla ELIMINADO del header.
 *   - Cada sección tiene su propio SectionFilterButton (disparador icon-only).
 *   - Filtrado en el FRONTEND (el fetch trae todo el mes sin filtro de backend).
 *   - Totales recalculados desde lo visible (suma de gastos/ingresos visibles).
 *   - Estado persistido en preferences.monthListFilters.
 *
 * Layout:
 *   - PeriodNav (overlay, sin grid — ver docstring de period-nav.tsx):
 *       Bloque de contenido: max-w-[1120px] mx-auto (PeriodNav) + px-10
 *       py-[34px] pb-20 (acá, este div) = mismo mecanismo canónico que las
 *       otras cinco pantallas, mismo ancho a igual viewport.
 *       Flechas ‹ / ›: overlay absolute respecto de PeriodNav, ocultas en
 *       compacto (ancho de contenido <941px), NO reservan ancho de columna.
 *       El régimen amplio/compacto se mide con CONTAINER QUERY sobre <main>
 *       (`@wide:`/`@max-wide:`), no con media query de viewport — ver
 *       docs/design.md §"Ancho de contenido de página" y la nota en period-nav.tsx.
 *   - Header dentro de la columna central (.phead en amplio / stepper en compacto, ambos por `@wide:`/`@max-wide:`):
 *       Desktop: eyebrow "Tu mes" + H1 período "Junio 2026" + sub-línea estado.
 *       Mobile:  pill stepper compacto (‹ rótulo ›).
 *       Siempre: botón "Ordenar secciones" / "Listo" + botón "+ Nuevo movimiento" a la derecha.
 *   - Totales: grid 1fr 1fr 1.1fr (Gastos / Ingresos / mini-balance).
 *   - Grupos Únicos / Fijos / Cuotas: SortableSection (envuelve AccordionSection).
 *   - Filas: .mov (ícono, nombre, fecha, monto).
 *
 * Lógica preservada intacta (hooks, router, mappers, handlers de editar/eliminar).
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ArrowUpDown, Check, ArrowRight, ArrowLeft } from "lucide-react";
import { SectionSortButton } from "@/components/ui/section-sort-button";
import {
  MonthJumpPanel,
  MonthJumpTriggerDesktop,
  MonthJumpTriggerMobile,
  useMonthJump,
} from "./month-jump-popover";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  MeasuringStrategy,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { useApi } from "@/hooks/use-api";
import { useMovements } from "@/hooks/use-movements";
import { usePreferences } from "@/hooks/use-preferences";
import { useSettings } from "@/hooks/use-settings";
import { useLimits } from "@/hooks/use-limits";
import { evaluateLimits } from "@/lib/limits/evaluate";
import { computeCategoryExpenseTotalsCents, evaluateItemLimitMark } from "@/lib/limits/apply-month";
import {
  LimitMarkAdorner,
  LimitGlyph,
  limitBoldClass,
  limitTintClass,
  limitRingCardClass,
  limitRingInlineClass,
} from "@/components/limits/limit-mark";
import { describeLimitMark } from "@/lib/limits/evaluate";
import { SortableSection } from "@/components/ui/sortable-section";
import { SkeletonBlock, SkeletonLine, SkeletonCircle, SkeletonPill } from "@/components/ui/skeleton";
import { SectionFilterButton } from "@/components/ui/section-filter-popover";
import type { SectionFilterType } from "@/components/ui/section-filter-popover";
import { MovementItemRow } from "@/components/movements/movement-item-row";
import { TransactionModal } from "@/components/movements/transaction-modal";
import { DeleteTransactionDialog } from "@/components/movements/delete-transaction-dialog";
import { DeleteRecurringDialog } from "@/components/movements/delete-recurring-dialog";
import { DeleteInstallmentDialog } from "@/components/movements/delete-installment-dialog";
import { NewTransactionButton } from "@/components/movements/new-transaction-button";
import { PeriodNav } from "@/components/ui/period-nav";
import { CurrencyChip } from "@/components/ui/currency-chip";
import {
  formatCurrency,
  formatMonthLabel,
  prevMonth,
  nextMonth,
  getCurrentMonth,
} from "@/lib/format";
import { sumMovementTotals, groupSubtotalCents, sortUnicosBySort } from "@/lib/movements";
import { cn } from "@/lib/utils";
import type { MovementItem } from "@/types/movement";
import type { LimitConfig } from "@/types/limit";
import type { Transaction } from "@/types/transaction";
import type { Recurring } from "@/types/recurring";
import type { InstallmentGroup } from "@/types/installment";
import type {
  MonthSectionKey,
  MonthSectionsPreferences,
  MonthListFilters,
  MonthListFilterState,
  UnicosSort,
} from "@/types/auth";

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

// ─── Default de filtros de sección ───────────────────────────────────────────

const DEFAULT_SECTION_FILTER: MonthListFilterState = {
  type: "ALL",
  categories: null,
};

const DEFAULT_LIST_FILTERS: MonthListFilters = {
  unicos: { ...DEFAULT_SECTION_FILTER },
  fijos: { ...DEFAULT_SECTION_FILTER },
  cuotas: { ...DEFAULT_SECTION_FILTER },
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

/**
 * Normaliza el objeto monthListFilters para garantizar back-compat.
 * - Si no existe o tiene forma inválida, devuelve defaults.
 * - Garantiza que las 3 secciones estén presentes con valores válidos.
 */
function normalizeMonthListFilters(raw: unknown): MonthListFilters {
  const validTypes = new Set(["ALL", "EXPENSE", "INCOME"]);

  function normalizeSection(section: unknown): MonthListFilterState {
    if (!section || typeof section !== "object") return { ...DEFAULT_SECTION_FILTER };
    const s = section as Record<string, unknown>;
    const type = validTypes.has(s.type as string)
      ? (s.type as SectionFilterType)
      : "ALL";
    const categories =
      s.categories === null
        ? null
        : Array.isArray(s.categories) &&
            s.categories.every((id) => typeof id === "string")
          ? (s.categories as string[])
          : null;
    return { type, categories };
  }

  if (!raw || typeof raw !== "object") return { ...DEFAULT_LIST_FILTERS };
  const r = raw as Record<string, unknown>;
  return {
    unicos: normalizeSection(r.unicos),
    fijos: normalizeSection(r.fijos),
    cuotas: normalizeSection(r.cuotas),
  };
}

// ─── Normalización de unicosSort (Ola 2, Sub-fase C) ─────────────────────────

/**
 * Normaliza el valor de unicosSort del blob de preferencias.
 * Back-compat: ausente o inválido → "amount" (default).
 */
function normalizeUnicosSort(raw: unknown): UnicosSort {
  if (raw === "amount" || raw === "date") return raw;
  return "amount";
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
    currency: item.currency,
    exchangeRate: item.exchangeRate,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    category: item.category,
    paymentMethodId: item.paymentMethod?.id ?? null,
    paymentMethod: item.paymentMethod,
    autoDebit: item.autoDebit,
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
    frequency: item.frequency ?? 1,
    currency: item.currency,
    exchangeRate: item.exchangeRate,
    createdAt: "",
    updatedAt: "",
    category: item.category,
    paymentMethodId: item.paymentMethod?.id ?? null,
    paymentMethod: item.paymentMethod,
    autoDebit: item.autoDebit,
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
    currency: item.currency,
    exchangeRate: item.exchangeRate,
    createdAt: "",
    updatedAt: "",
    category: item.category,
    paymentMethodId: item.paymentMethod?.id ?? null,
    paymentMethod: item.paymentMethod,
    autoDebit: item.autoDebit,
  };
}

// ─── Filtrado de ítems por tipo y categorías ──────────────────────────────────

function applyFilter(items: MovementItem[], filter: MonthListFilterState): MovementItem[] {
  let result = items;

  // Filtro por tipo
  if (filter.type !== "ALL") {
    result = result.filter((m) => m.type === filter.type);
  }

  // Filtro por categorías
  if (filter.categories !== null) {
    const catSet = new Set(filter.categories);
    result = result.filter((m) => catSet.has(m.category.id));
  }

  return result;
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface MonthViewClientProps {
  month: string;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function MonthViewClient({ month }: MonthViewClientProps) {
  const router = useRouter();
  const { preferences, setPreferences } = usePreferences();

  // ── Fetch sin filtro de backend (Fase 1.2.1) ─────────────────────────────
  // El filtrado se hace en el frontend; el hook trae todo el mes.
  const { isAuthenticated } = useApi();
  const { data, isLoading, isError } = useMovements(month);
  const { defaultCurrency } = useSettings();
  // P2 — Fase 1: límites del usuario (marca visual pasiva). [] = cero impacto (D9).
  const { limits } = useLimits();

  // Estado de modales para únicos
  const [editingUnico, setEditingUnico] = useState<MovementItem | null>(null);
  const [deletingUnico, setDeletingUnico] = useState<MovementItem | null>(null);

  // Estado de modales para fijos
  const [editingFijo, setEditingFijo] = useState<MovementItem | null>(null);
  const [deletingFijo, setDeletingFijo] = useState<MovementItem | null>(null);

  // Estado de modales para cuotas
  const [editingCuota, setEditingCuota] = useState<MovementItem | null>(null);
  const [deletingCuota, setDeletingCuota] = useState<MovementItem | null>(null);

  // Estado de modales para calculados (Fase 1.1.7)
  const [creatingCalculated, setCreatingCalculated] = useState<MovementItem | null>(null);
  const [editingCalculated, setEditingCalculated] = useState<MovementItem | null>(null);
  // Calculado de origen único/cuota: confirmación directa sin opciones de mes
  const [deletingCalculatedSimple, setDeletingCalculatedSimple] = useState<MovementItem | null>(null);

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

  // Id de la sección que se está arrastrando (para feedback del ítem activo)
  const [activeId, setActiveId] = useState<MonthSectionKey | null>(null);

  // Estado de colapso previo al entrar en modo orden (para restaurar al salir)
  const [collapsedBeforeOrderMode, setCollapsedBeforeOrderMode] = useState<Set<MonthSectionKey> | null>(null);

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

  // ── Estado de filtros por sección (Fase 1.2.1) ───────────────────────────

  // Normalizar desde preferencias (back-compat: si no existe → defaults)
  const savedListFilters = normalizeMonthListFilters(preferences.monthListFilters);

  // Estado local optimista: responde inmediato, persiste en background
  const [listFilters, setListFilters] = useState<MonthListFilters>(savedListFilters);

  // Sincronizar con preferencias cuando lleguen del servidor (solo primer mount)
  const [hasSyncedFilters, setHasSyncedFilters] = useState(false);
  useEffect(() => {
    if (!hasSyncedFilters && preferences.monthListFilters !== undefined) {
      setListFilters(normalizeMonthListFilters(preferences.monthListFilters));
      setHasSyncedFilters(true);
    }
  }, [preferences.monthListFilters, hasSyncedFilters]);

  // Ref para evitar useCallback con dependencia ciclica sobre listFilters
  const listFiltersRef = useRef(listFilters);
  useEffect(() => {
    listFiltersRef.current = listFilters;
  }, [listFilters]);

  // ── Orden de únicos (Ola 2, Sub-fase C) ──────────────────────────────────

  // Normalizar desde preferencias (back-compat: ausente → "amount")
  const [unicosSort, setUnicosSort] = useState<UnicosSort>(
    normalizeUnicosSort(preferences.unicosSort),
  );

  // Sincronizar con preferencias cuando lleguen del servidor (solo primer mount)
  const [hasSyncedSort, setHasSyncedSort] = useState(false);
  useEffect(() => {
    if (!hasSyncedSort && preferences.unicosSort !== undefined) {
      setUnicosSort(normalizeUnicosSort(preferences.unicosSort));
      setHasSyncedSort(true);
    }
  }, [preferences.unicosSort, hasSyncedSort]);

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

  // ── Datos brutos de movimientos ───────────────────────────────────────────

  const rawUnicos = data?.movements.unicos ?? [];
  const rawFijos = data?.movements.fijos ?? [];
  const rawCuotas = data?.movements.cuotas ?? [];

  // ── Universo de categorías por sección (P2_b, Ola 2) ─────────────────────
  // Derivado de los movimientos CRUDOS (antes de applyFilter) para que la lista
  // sea estable y no se achique al filtrar. Deduplicado por category.id.
  // Solo categorías PRESENTES en la sección; NO usa useCategories().

  function extractSectionCategories(
    items: MovementItem[],
  ): { id: string; name: string; color: string }[] {
    const seen = new Set<string>();
    const result: { id: string; name: string; color: string }[] = [];
    for (const item of items) {
      if (!seen.has(item.category.id)) {
        seen.add(item.category.id);
        result.push({
          id: item.category.id,
          name: item.category.name,
          color: item.category.color,
        });
      }
    }
    return result;
  }

  const unicosCategories = extractSectionCategories(rawUnicos);
  const fijosCategories = extractSectionCategories(rawFijos);
  const cuotasCategories = extractSectionCategories(rawCuotas);

  const sectionCategoriesMap: Record<
    MonthSectionKey,
    { id: string; name: string; color: string }[]
  > = {
    unicos: unicosCategories,
    fijos: fijosCategories,
    cuotas: cuotasCategories,
  };

  // ── Filtrado en el frontend (Fase 1.2.1) ─────────────────────────────────

  // El orden de únicos se aplica DESPUÉS del filtro (Ola 2, Sub-fase C).
  const unicos = sortUnicosBySort(applyFilter(rawUnicos, listFilters.unicos), unicosSort);
  const fijos = applyFilter(rawFijos, listFilters.fijos);
  const cuotas = applyFilter(rawCuotas, listFilters.cuotas);

  // ── Totales recalculados desde lo visible ─────────────────────────────────
  // RN-019: usa Math.abs(convertedAmountCents) por bucket de type (Fase 1.2.3).
  // convertedAmountCents es el monto en la moneda default del usuario (backend).
  // Los calculados EXPENSE tienen convertedAmountCents negativo; Math.abs() lo
  // normaliza. sumMovementTotals encapsula esta regla en lib/movements.ts.

  const unicosTotals = sumMovementTotals(unicos);
  const fijosTotals = sumMovementTotals(fijos);
  const cuotasTotals = sumMovementTotals(cuotas);

  const expenseCents =
    unicosTotals.expense + fijosTotals.expense + cuotasTotals.expense;
  const incomeCents =
    unicosTotals.income + fijosTotals.income + cuotasTotals.income;
  const balanceCents = incomeCents - expenseCents;

  const monthLabel = formatMonthLabel(month);
  const labelParts = monthLabel.split(" ");
  const mesName = labelParts[0]
    ? labelParts[0].charAt(0).toUpperCase() + labelParts[0].slice(1)
    : "";
  const yearName = labelParts[1] ?? "";

  const isCurrentMonth = month === getCurrentMonth();

  // ── P2 — Fase 1: marca visual pasiva de límites ───────────────────────────
  // Anclajes de nivel-mes: mes.total.gasto / mes.total.ingreso / mes.balance.
  // Valor emitido = número puro en pesos (sin moneda, D3), igual al que muestra
  // la pantalla (cents / 100). Con `limits` vacío, evaluateLimits siempre
  // devuelve null → cero impacto (restricción rectora).
  const expenseLimitMark = evaluateLimits({
    limits,
    anchorKey: "mes.total.gasto",
    value: expenseCents / 100,
    isCurrentMonth,
  });
  const incomeLimitMark = evaluateLimits({
    limits,
    anchorKey: "mes.total.ingreso",
    value: incomeCents / 100,
    isCurrentMonth,
  });
  const balanceLimitMark = evaluateLimits({
    limits,
    anchorKey: "mes.balance",
    value: balanceCents / 100,
    isCurrentMonth,
  });

  // mes.categoria.gastoMes — dato derivado (D2): gasto por categoría en el mes,
  // sobre los movimientos CRUDOS (sin filtros de listado, no es un total de sección).
  const categoryExpenseTotalsCents = computeCategoryExpenseTotalsCents([
    ...rawUnicos,
    ...rawFijos,
    ...rawCuotas,
  ]);

  // ── Navegación ────────────────────────────────────────────────────────────

  function goToPrevMonth() {
    router.push(`/mes?month=${prevMonth(month)}`);
  }

  function goToNextMonth() {
    router.push(`/mes?month=${nextMonth(month)}`);
  }

  function goToCurrentMonth() {
    router.push(`/mes?month=${getCurrentMonth()}`);
  }

  // ── Handlers editar/eliminar ──────────────────────────────────────────────

  function handleEdit(movement: MovementItem) {
    // Si el ítem es un calculado (cualquier origen), abrir el modal de edición de calculado.
    // Los calculados se editan siempre por PATCH /:endpoint/:id/calculated (Fase 1.1.8).
    if (movement.calculated) {
      setEditingCalculated(movement);
      return;
    }
    // Ítem no calculado: enrutar por origen
    if (movement.origin === "fijo") {
      setEditingFijo(movement);
    } else if (movement.origin === "cuota") {
      setEditingCuota(movement);
    } else {
      setEditingUnico(movement);
    }
  }

  /** Abre el form de "crear calculado" con el ítem fijo seleccionado como origen */
  function handleCreateCalculated(movement: MovementItem) {
    setCreatingCalculated(movement);
  }

  function handleDelete(movement: MovementItem) {
    // Calculados: enrutar por tipo de origen del calculado.
    if (movement.calculated) {
      if (movement.calculated.sourceType === "fijo") {
        // Calculado de fijo → DeleteRecurringDialog (variant="fijo" default, con opciones de mes).
        setDeletingFijo(movement);
      } else {
        // Calculado de único o cuota → confirmación directa sin opciones de mes.
        setDeletingCalculatedSimple(movement);
      }
      return;
    }
    // No-calculados: enrutar por origen
    if (movement.origin === "fijo") {
      setDeletingFijo(movement);
    } else if (movement.origin === "cuota") {
      setDeletingCuota(movement);
    } else {
      setDeletingUnico(movement);
    }
  }

  // ── Subtotales por grupo ──────────────────────────────────────────────────
  // groupSubtotalCents delega a sumMovementTotals para respetar RN-019.

  // Símbolo de la moneda default en totales/subtotales (todos en la default del usuario)
  function formatSubtotal(cents: number): string {
    const abs = formatCurrency(Math.abs(cents), defaultCurrency);
    if (cents > 0) return `+${abs}`;
    if (cents < 0) return `−${abs}`;
    return abs;
  }

  // ── Mapa de ítems por sección (ya filtrados) ──────────────────────────────

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

  // ── Handler de filtros por sección (Fase 1.2.1) ───────────────────────────

  const handleSectionTypeChange = useCallback(
    (key: MonthSectionKey, type: SectionFilterType) => {
      setListFilters((prev) => {
        const next: MonthListFilters = {
          ...prev,
          [key]: { ...prev[key], type },
        };
        // Persistir en background (merge manual)
        void setPreferences({
          ...preferences,
          monthListFilters: next,
        });
        return next;
      });
    },
    [preferences, setPreferences],
  );

  const handleSectionCategoriesChange = useCallback(
    (key: MonthSectionKey, ids: string[] | null) => {
      setListFilters((prev) => {
        const next: MonthListFilters = {
          ...prev,
          [key]: { ...prev[key], categories: ids },
        };
        // Persistir en background (merge manual)
        void setPreferences({
          ...preferences,
          monthListFilters: next,
        });
        return next;
      });
    },
    [preferences, setPreferences],
  );

  // ── Toggle orden de únicos (Ola 2, Sub-fase C) ───────────────────────────

  const handleToggleUnicosSort = useCallback(() => {
    setUnicosSort((prev) => {
      const next: UnicosSort = prev === "amount" ? "date" : "amount";
      // Persistir en background (merge manual con el resto de preferencias)
      void setPreferences({
        ...preferences,
        unicosSort: next,
      });
      return next;
    });
  }, [preferences, setPreferences]);

  // ── Modo orden (Fase 1.1.4 P6, revisado Fase 1.2.0) ──────────────────────

  function handleEnterOrderMode() {
    // Guardar el estado de colapso actual para restaurarlo al salir
    setCollapsedBeforeOrderMode(new Set(collapsedSections));
    // Colapsar todas las secciones visualmente (transitorio, no persiste)
    setCollapsedSections(new Set(ALL_SECTION_KEYS));
    setIsOrderMode(true);
  }

  function handleExitOrderMode() {
    // Restaurar el estado de colapso previo al modo orden
    if (collapsedBeforeOrderMode !== null) {
      setCollapsedSections(collapsedBeforeOrderMode);
      setCollapsedBeforeOrderMode(null);
    }
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

  const periodLabel = `${mesName} ${yearName}`;
  const statusLabel = isCurrentMonth ? "Mes en curso" : "Histórico";

  // ── Link "Ir al mes en curso" — recentrado temporal (spec docs/design.md) ─
  // Solo se renderiza cuando isCurrentMonth === false (render condicional por
  // display, no visibility:hidden — evita un target de foco fantasma).
  // Se reutiliza la misma referencia de JSX en el bloque desktop y en el
  // bloque mobile (ambos siempre montados; el breakpoint activo se resuelve
  // por CSS), igual que CurrencyChip.
  // Dirección de la flecha: comparación lexicográfica de YYYY-MM alcanza.
  // Mes visualizado en el pasado (< mes en curso) → ArrowRight, mes visualizado
  // en el futuro (> mes en curso) → ArrowLeft. La flecha es SIEMPRE leading
  // (primer hijo): solo cambia el sentido del glifo, nunca su posición.
  const currentMonth = getCurrentMonth();
  const isPastMonth = month < currentMonth;
  const goToCurrentMonthButton = !isCurrentMonth ? (
    <button
      type="button"
      onClick={goToCurrentMonth}
      className={cn(
        "inline-flex items-center gap-[5px] whitespace-nowrap cursor-pointer",
        "text-[12.5px] font-medium text-muted",
        "hover:text-ink-2 hover:underline hover:underline-offset-[2px]",
        "transition-colors duration-[140ms]",
        "rounded-[var(--r-chip)]",
        "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)] focus-visible:underline focus-visible:underline-offset-[2px]",
      )}
    >
      {isPastMonth ? (
        <ArrowRight size={13} aria-hidden="true" />
      ) : (
        <ArrowLeft size={13} aria-hidden="true" />
      )}
      Ir al mes en curso
    </button>
  ) : null;

  // ── Selector de salto mes/año (Ola 1, P4) ────────────────────────────────

  const monthJump = useMonthJump({
    currentMonth: month,
    onNavigate: (ym: string) => router.push(`/mes?month=${ym}`),
  });

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
      <div className="px-10 py-[34px] pb-20 space-y-0">
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-end justify-between gap-5 mb-6 flex-wrap">

          {/* Bloque de título — amplio (ancho de contenido ≥941px, container query sobre <main>) */}
          <div className="hidden @wide:flex flex-col gap-0">
            {/* Fila del eyebrow: label + chip de moneda default (a la derecha del eyebrow).
                Quedan FUERA del disparador (per spec §1). */}
            <div className="flex items-center gap-[10px] mb-0.5">
              <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">
                Tu mes
              </span>
              <CurrencyChip currency={defaultCurrency} />
            </div>
            {/* H1 envuelto en disparador — sin el link "Ir al mes en curso"
                (spec §4: reversión de la iteración anterior, vuelve a su
                estado pre-feature, solo el trigger). */}
            <div className="mt-0.5 mb-1 flex items-center">
              <MonthJumpTriggerDesktop
                periodLabel={periodLabel}
                isOpen={monthJump.isOpen}
                onClick={monthJump.toggle}
                triggerRef={monthJump.triggerRefDesktop}
              />
            </div>
            {/* Sub-label estado + link "Ir al mes en curso" (spec §4/§5).
                Sin min-h: la fila mide lo mismo con y sin link (misma caja
                tipográfica de 12.5px en ambos estados — cero-impacto real). */}
            <div className="flex items-center gap-[8px]">
              <span className="text-[12.5px] font-medium text-muted">
                {statusLabel}
              </span>
              {!isCurrentMonth && (
                <>
                  <span className="text-[12.5px] text-faint" aria-hidden="true">
                    ·
                  </span>
                  {goToCurrentMonthButton}
                </>
              )}
            </div>
          </div>

          {/* Stepper compacto — compacto (ancho de contenido <941px, container query sobre <main>) */}
          {/*
           * El contenedor flex envuelve el stepper pill (aria-hidden, evita
           * duplicados en jsdom) y el CurrencyChip accesible (fuera del aria-hidden).
           * El chip va a la derecha del stepper (gap-[10px]); si no entra, flex-wrap
           * lo baja a su propia línea alineado a la derecha (spec).
           */}
          <div className="@wide:hidden flex items-center gap-[10px] flex-wrap">
            {/*
             * Pill stepper — aria-hidden para evitar duplicados de botones en jsdom.
             * El disparador accesible del selector mes/año es el botón desktop (que
             * existe en el DOM aunque esté oculto por CSS en mobile).
             */}
            <div aria-hidden="true" className="inline-flex items-center gap-0.5 bg-panel border border-line rounded-pill px-1 py-1 shadow-[var(--shadow-sm)]">
              <button
                onClick={goToPrevMonth}
                aria-label="Mes anterior"
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-panel-2 hover:text-ink transition-colors duration-[140ms] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              {/* Centro del pill: ahora es el disparador del selector de salto */}
              <MonthJumpTriggerMobile
                mesName={mesName}
                yearName={yearName}
                statusLabel={statusLabel}
                isOpen={monthJump.isOpen}
                onClick={monthJump.toggle}
                triggerRef={monthJump.triggerRefMobile}
              />
              <button
                onClick={goToNextMonth}
                aria-label="Mes siguiente"
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-panel-2 hover:text-ink transition-colors duration-[140ms] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
            {/* Chip de moneda — accesible, a la derecha del pill */}
            <CurrencyChip currency={defaultCurrency} />
            {/* Link "Ir al mes en curso" — fuera del pill aria-hidden, último
                hijo de la fila (spec §4: estabilidad lateral del pill/chip). */}
            {goToCurrentMonthButton}
          </div>

          {/* Acciones del header: "Ordenar secciones" / "Listo" + "+ Nuevo movimiento" */}
          {/* Nota: el filtro de categorías por pantalla fue eliminado en Fase 1.2.1.
              Cada sección tiene su propio SectionFilterButton en la cabecera del acordeón. */}
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
        {/*
         * Skeleton solo en carga inicial (Ola 1, corrección):
         * - Si ya hay `data` (aunque sea stale) nunca se muestra el skeleton,
         *   evitando el flash al colapsar/expandir/reordenar secciones
         *   (esas acciones persisten preferencias y pueden provocar un refetch
         *   que pone isLoading=true brevemente aunque los datos ya estén presentes).
         * - El guard !isAuthenticated cubre el caso de sesión aún resolviendo
         *   (Auth.js status="loading" → isAuthenticated=false → query disabled →
         *   React Query devuelve data=undefined sin isLoading=true).
         */}
        {(!data && (!isAuthenticated || isLoading)) ? (
          <>
            {/* Skeleton de totales — mismo template que el bloque real (ver más abajo),
                para que no salte al aterrizar. */}
            <div
              className="grid grid-cols-1 @wide:grid-cols-[1fr_1fr_1.1fr] gap-[var(--gap)] mb-6"
              aria-label="Cargando totales"
              role="status"
            >
              <SkeletonBlock height={90} className="min-w-0" />
              <SkeletonBlock height={90} className="min-w-0" />
              <SkeletonBlock height={90} className="order-first @wide:order-none min-w-0" />
            </div>

            {/* Skeleton de las 3 secciones (Únicos / Fijos / Cuotas) — Ola 1, P5.
                Imita el layout real: cabecera fantasma imitando .ghead + tarjeta-lista
                con 3 filas fantasma que replican el grid del MovementItemRow. */}
            <div
              role="status"
              aria-label="Cargando movimientos"
              className="space-y-[30px] mt-1"
            >
              {(["Únicos", "Fijos", "Cuotas"] as const).map((label) => (
                <div key={label}>
                  {/* ─ Cabecera fantasma (imita .ghead) ─ */}
                  <div className="flex items-center gap-[8px] pb-[10px] px-1">
                    {/* Chevron fantasma */}
                    <SkeletonBlock height={16} width={16} radius="ctl" className="shrink-0" />
                    {/* Rótulo de sección */}
                    <SkeletonLine height={13} width={80} />
                    {/* Pill contador */}
                    <SkeletonPill height={16} width={26} className="shrink-0" />
                    {/* Divisor flex */}
                    <div className="flex-1" aria-hidden="true" />
                    {/* Subtotal mono */}
                    <SkeletonLine height={13} width={72} />
                  </div>

                  {/* ─ Tarjeta-lista con 3 filas fantasma ─
                      Chrome estable (bg-panel border rounded-card shadow) presente ya. */}
                  <div className="bg-panel border border-line rounded-card shadow-[var(--shadow-sm)] overflow-hidden">
                    {([0, 1, 2] as const).map((i) => (
                      <div key={i}>
                        {/* Fila fantasma — replica grid MovementItemRow:
                            40px 1fr auto auto auto, padding var(--row-pad) 18px */}
                        <div
                          className="flex items-center gap-[10px]"
                          style={{ padding: "14px 18px" }}
                        >
                          {/* Col 1: ícono circular 40px */}
                          <SkeletonCircle diameter={40} />
                          {/* Col 2: nombre + meta apiladas */}
                          <div className="flex flex-col gap-[6px] flex-1 min-w-0">
                            <SkeletonLine height={14.5} width="60%" />
                            <SkeletonLine height={12.5} width="40%" />
                          </div>
                          {/* Col 3: fecha */}
                          <SkeletonLine height={12.5} width={52} className="shrink-0" />
                          {/* Col 4: monto */}
                          <SkeletonLine height={15.5} width={84} className="shrink-0" />
                        </div>
                        {/* Divisor entre filas (no en la última) */}
                        {i < 2 && (
                          <div aria-hidden="true" className="mx-[18px] h-px bg-hair" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : isError ? (
          <div
            role="alert"
            className="mb-6 rounded-card border border-expense bg-expense-soft px-4 py-3 text-sm text-expense-ink"
          >
            No se pudo cargar el mes. Intentá recargar la página.
          </div>
        ) : (
          <>
            {/* Tarjetas de totales compactas: grid 1fr 1fr 1.1fr en amplio (ancho de
                contenido ≥941px, container query sobre <main> — `@wide:`, no `wide:`
                de viewport: con el sidebar abierto el contenido puede ser angosto
                aunque el viewport sea ancho), 1 columna en compacto — docs/design.md
                §Contención responsive.
                min-w-0 en los items desactiva el piso de min-content de las columnas fr
                (si no, la cifra de dinero fuerza un ancho mínimo y el hero de Balance
                se aplasta). Mismo template que el skeleton de arriba. */}
            <div className="grid grid-cols-1 @wide:grid-cols-[1fr_1fr_1.1fr] gap-[var(--gap)] mb-6">
              {/* Gastos — mes.total.gasto (P2, Fase 1: marca visual pasiva) */}
              <div
                className={cn(
                  "bg-panel border border-line rounded-card shadow-[var(--shadow-sm)] flex flex-col gap-[6px] min-w-0",
                  limitRingCardClass(expenseLimitMark?.effect),
                )}
                style={{ padding: "16px 18px" }}
              >
                <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Gastos
                </div>
                <div className="inline-flex items-center gap-[7px]">
                  <LimitMarkAdorner mark={expenseLimitMark} glyphSize={15} />
                  <span
                    className={cn(
                      "text-[23px] tracking-[-0.02em] leading-none mono text-ink",
                      limitBoldClass(expenseLimitMark?.effect) ?? "font-semibold",
                      limitTintClass(expenseLimitMark?.effect),
                    )}
                  >
                    {formatCurrency(expenseCents, defaultCurrency)}
                  </span>
                </div>
              </div>

              {/* Ingresos — mes.total.ingreso (tint NO ofrecido: monto tipado income-ink) */}
              <div
                className={cn(
                  "bg-panel border border-line rounded-card shadow-[var(--shadow-sm)] flex flex-col gap-[6px] min-w-0",
                  limitRingCardClass(incomeLimitMark?.effect),
                )}
                style={{ padding: "16px 18px" }}
              >
                <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Ingresos
                </div>
                <div className="inline-flex items-center gap-[7px]">
                  <LimitMarkAdorner mark={incomeLimitMark} glyphSize={15} />
                  <span
                    className={cn(
                      "text-[23px] tracking-[-0.02em] leading-none mono text-income-ink",
                      limitBoldClass(incomeLimitMark?.effect) ?? "font-semibold",
                    )}
                  >
                    {formatCurrency(incomeCents, defaultCurrency)}
                  </span>
                </div>
              </div>

              {/* Mini-balance — mes.balance (tint NO ofrecido: bloque de acento con signo) */}
              <div
                className={cn(
                  "rounded-card relative overflow-hidden text-white shadow-[var(--shadow-md)] flex flex-col gap-[6px] min-w-0 order-first @wide:order-none",
                  limitRingCardClass(balanceLimitMark?.effect, "--shadow-md"),
                )}
                style={{
                  padding: "16px 18px",
                  background: "linear-gradient(135deg, var(--accent-press), var(--accent))",
                }}
              >
                <div className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-white/70">
                  Balance
                </div>
                <div className="inline-flex items-center gap-[7px]">
                  <LimitMarkAdorner mark={balanceLimitMark} glyphSize={15} />
                  <span
                    className={cn(
                      "text-[28px] tracking-[-0.02em] leading-none mono",
                      limitBoldClass(balanceLimitMark?.effect) ?? "font-semibold",
                    )}
                  >
                    {balanceCents >= 0
                      ? `+ ${formatCurrency(balanceCents, defaultCurrency)}`
                      : `− ${formatCurrency(Math.abs(balanceCents), defaultCurrency)}`}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Lista agrupada por origen — con acordeón y reordenamiento ── */}
            {/*
             * modifiers: restrictToVerticalAxis + restrictToParentElement (Fase 1.2.0).
             * El drag se restringe al eje Y y al contenedor padre.
             * Sin DragOverlay: el ítem activo se desliza in-place (no flota).
             */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              // Re-medir rects durante el drag. Junto con el colapso instantáneo
              // en modo orden (noTransition en AccordionSection), elimina el bug
              // de achatamiento: dnd-kit no usa medidas obsoletas de secciones
              // expandidas al calcular los transforms durante el drag.
              measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
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
                    const filter = listFilters[key];

                    // P2 — Fase 1: marca visual pasiva de límites por sección
                    // (mes.seccion.subtotal / mes.seccion.conteo, refinamiento por sección).
                    const subtotalMark = evaluateLimits({
                      limits,
                      anchorKey: "mes.seccion.subtotal",
                      value: groupSubtotalCents(items) / 100,
                      refinement: { section: key },
                      isCurrentMonth,
                    });
                    const conteoMark = evaluateLimits({
                      limits,
                      anchorKey: "mes.seccion.conteo",
                      value: items.length,
                      refinement: { section: key },
                      isCurrentMonth,
                    });

                    return (
                      <SortableSection
                        key={key}
                        id={key}
                        label={label}
                        count={items.length}
                        subtotal={formatSubtotal(groupSubtotalCents(items))}
                        isCollapsed={isCollapsed}
                        onToggle={() => handleToggleCollapse(key)}
                        isOrderMode={isOrderMode}
                        isActive={activeId === key}
                        subtotalAdornment={<LimitMarkAdorner mark={subtotalMark} glyphSize={13} />}
                        subtotalClassName={cn(
                          limitBoldClass(subtotalMark?.effect),
                          limitTintClass(subtotalMark?.effect),
                          limitRingInlineClass(subtotalMark?.effect),
                        )}
                        countAdornment={
                          conteoMark?.effect === "glyph" ? (
                            <LimitGlyph tooltip={describeLimitMark(conteoMark)} size={12} />
                          ) : null
                        }
                        countClassName={
                          conteoMark?.effect === "badge" ? "bg-warning-soft text-warning-ink" : undefined
                        }
                        filterSlot={
                          // Únicos: [control de orden] [filtro] (gap-1 entre ambos)
                          // Fijos / Cuotas: solo [filtro] (sin control de orden)
                          <div className="flex items-center gap-1">
                            {key === "unicos" && (
                              <SectionSortButton
                                sort={unicosSort}
                                onToggle={handleToggleUnicosSort}
                              />
                            )}
                            <SectionFilterButton
                              sectionKey={key}
                              sectionLabel={label}
                              sectionCategories={sectionCategoriesMap[key]}
                              selectedType={filter.type}
                              selectedCategories={filter.categories}
                              onTypeChange={(type) => handleSectionTypeChange(key, type)}
                              onCategoriesChange={(ids) => handleSectionCategoriesChange(key, ids)}
                            />
                          </div>
                        }
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
                              onCreateCalculated={handleCreateCalculated}
                              limits={limits}
                              categoryExpenseTotalsCents={categoryExpenseTotalsCents}
                              isCurrentMonth={isCurrentMonth}
                            />
                          </div>
                        )}
                      </SortableSection>
                    );
                  })}
                </div>
              </SortableContext>
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
          editingSkipped={editingUnico.skipped}
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
          editingSkipped={editingFijo.skipped}
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
          editingSkipped={editingCuota.skipped}
        />
      )}

      {/* ── Diálogo eliminar cuota ── */}
      {deletingCuota && (
        <DeleteInstallmentDialog
          movement={deletingCuota}
          onClose={() => setDeletingCuota(null)}
        />
      )}

      {/* ── Diálogo eliminar calculado de único/cuota (confirmación directa) ── */}
      {deletingCalculatedSimple && (
        <DeleteRecurringDialog
          movement={deletingCalculatedSimple}
          onClose={() => setDeletingCalculatedSimple(null)}
          viewMonth={month}
          variant="calculated-simple"
        />
      )}

      {/* ── Modal crear calculado (Fase 1.1.7 — RF-MCALC-001) ── */}
      {creatingCalculated && (
        <TransactionModal
          mode="create-calculated"
          calculated={creatingCalculated}
          onClose={() => setCreatingCalculated(null)}
          viewMonth={month}
        />
      )}

      {/* ── Modal editar calculado (Fase 1.1.7 — RF-MCALC-006) ── */}
      {editingCalculated && (
        <TransactionModal
          mode="edit-calculated"
          calculated={editingCalculated}
          onClose={() => setEditingCalculated(null)}
          viewMonth={month}
        />
      )}

      {/* ── Selector de salto mes/año (Ola 1, P4) ── */}
      {monthJump.isOpen && (
        <MonthJumpPanel {...monthJump.panelProps} />
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
  /** Handler para "Crear movimiento desde este" (solo para fijos NO calculados) */
  onCreateCalculated?: (m: MovementItem) => void;
  /** P2 — Fase 1: límites del usuario, para evaluar la marca de cada ítem (mes.item.monto / mes.categoria.gastoMes). */
  limits: LimitConfig[];
  categoryExpenseTotalsCents: Map<string, number>;
  isCurrentMonth: boolean;
}

function SectionList({
  items,
  viewMonth,
  onEdit,
  onDelete,
  onCreateCalculated,
  limits,
  categoryExpenseTotalsCents,
  isCurrentMonth,
}: SectionListProps) {
  return (
    <div className="bg-panel border border-line rounded-card overflow-hidden shadow-[var(--shadow-sm)]">
      {items.map((item) => (
        <MovementItemRow
          key={item.id}
          movement={item}
          viewMonth={viewMonth}
          onEdit={onEdit}
          onDelete={onDelete}
          onCreateCalculated={onCreateCalculated}
          limitMark={evaluateItemLimitMark(item, limits, categoryExpenseTotalsCents, isCurrentMonth)}
        />
      ))}
    </div>
  );
}
