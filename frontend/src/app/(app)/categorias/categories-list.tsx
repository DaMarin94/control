"use client";

/**
 * Lista de categorías activas con acciones de editar y eliminar.
 * Re-estilado con tokens del DS "Precise Ledger" (Fase 3).
 *
 * Layout:
 *   - Header: eyebrow "Configuración" + h1 "Categorías" + botón "+ Nueva categoría"
 *   - Bajada explicativa
 *   - Lista .cat-list: filas .catrow (swatch · nombre · contador · badge scope · acciones en hover)
 *
 * Maneja estados: cargando, vacío, con datos.
 * Abre los modales de editar y eliminar.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { Pencil, Trash2 } from "lucide-react";
import { useCategories } from "@/hooks/use-categories";
import { type Category, SCOPE_LABELS } from "@/types/category";
import { CategoryFormModal } from "./category-form-modal";
import { DeleteCategoryDialog } from "./delete-category-dialog";
import { cn } from "@/lib/utils";
import { SkeletonLine, SkeletonBlock } from "@/components/ui/skeleton";

// ─── Scope badge ──────────────────────────────────────────────────────────────

type ScopeVariant = "BOTH" | "EXPENSE" | "INCOME";

const SCOPE_BADGE_CLASSES: Record<ScopeVariant, string> = {
  BOTH: "bg-accent-soft text-accent-ink",
  EXPENSE: "bg-expense-soft text-expense-ink",
  INCOME: "bg-income-soft text-income-ink",
};

function ScopeBadge({ scope }: { scope: ScopeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[6px]",
        "text-[11.5px] font-semibold tracking-[0.02em] leading-[1.4]",
        "px-[9px] py-[3px] rounded-chip",
        SCOPE_BADGE_CLASSES[scope],
      )}
    >
      {/* Punto de color */}
      <span className="inline-block h-[6px] w-[6px] rounded-full bg-current shrink-0" aria-hidden="true" />
      {SCOPE_LABELS[scope]}
    </span>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function CategoriesList() {
  const { categories, isLoading, isError } = useCategories();

  // Modal de creación/edición: null = cerrado; Category = editar esa; "new" = crear
  const [editingCategory, setEditingCategory] = useState<Category | "new" | null>(null);
  // Diálogo de confirmación de eliminación
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

  // ─── Estados de carga / error ─────────────────────────────────────────────

  if (isLoading) {
    return (
      <div role="status" aria-label="Cargando categorías">
        {/* Header skeleton */}
        <div className="flex items-end justify-between gap-5 mb-6">
          <div className="flex flex-col gap-2">
            {/* Eyebrow ~12px, ~96px */}
            <SkeletonLine height={12} width={96} />
            {/* H1 ~32px, ~144px */}
            <SkeletonLine height={32} width={144} />
          </div>
          {/* Botón "+ Nueva categoría" ~40×144 */}
          <SkeletonBlock height={40} width={144} radius="ctl" />
        </div>

        {/* Lista fantasma: 6 filas que replican la estructura del catrow */}
        <div className="bg-panel border border-line rounded-card overflow-hidden shadow-[var(--shadow-sm)]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="grid items-center gap-4 px-5 py-[15px] [&+div]:border-t [&+div]:border-hair"
              style={{ gridTemplateColumns: "16px 1fr auto" }}
            >
              {/* Swatch de color (14×14, radio 5px igual al swatch real) */}
              <SkeletonBlock height={14} width={14} radius="custom" className="rounded-[5px]" />
              {/* Nombre de categoría */}
              <SkeletonLine height={15} width="55%" />
              {/* Uso / contador */}
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
          No se pudieron cargar las categorías. Recargá la página.
        </p>
      </div>
    );
  }

  const count = categories?.length ?? 0;

  return (
    <>
      {/* ── Header .phead ── */}
      <div className="flex items-end justify-between gap-5 mb-2 flex-wrap">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted mb-[6px]">
            Configuración
          </p>
          <h1 className="text-[32px] font-bold tracking-[-0.02em] leading-[1.05] text-ink m-0">
            Categorías
          </h1>
        </div>
        <Button size="default" onClick={() => setEditingCategory("new")}>
          + Nueva categoría
        </Button>
      </div>

      {/* ── Bajada ── */}
      <p className="text-[14px] text-muted mb-6">
        <span className="mono font-semibold text-ink">{count}</span>{" "}
        {count === 1 ? "categoría activa" : "categorías activas"}. El{" "}
        <b className="font-semibold text-ink">alcance</b> define en qué tipo de movimiento
        aparece cada una al cargar.
      </p>

      {/* ── Lista o estado vacío ── */}
      {!categories || categories.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-panel-2 py-12 text-center">
          <p className="text-[15px] font-semibold text-ink">No tenés categorías activas.</p>
          <p className="mt-1 text-[13px] text-muted">
            Creá una para empezar a organizar tus movimientos.
          </p>
          <Button
            variant="ghost"
            className="mt-4"
            onClick={() => setEditingCategory("new")}
          >
            Crear primera categoría
          </Button>
        </div>
      ) : (
        <div className="bg-panel border border-line rounded-card overflow-hidden shadow-[var(--shadow-sm)]">
          <ul role="list" className="divide-y-0">
            {categories.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                onEdit={() => setEditingCategory(category)}
                onDelete={() => setDeletingCategory(category)}
              />
            ))}
          </ul>
        </div>
      )}

      {/* Modal de creación / edición */}
      {editingCategory !== null && (
        <CategoryFormModal
          category={editingCategory === "new" ? null : editingCategory}
          onClose={() => setEditingCategory(null)}
        />
      )}

      {/* Diálogo de confirmación de eliminación */}
      {deletingCategory !== null && (
        <DeleteCategoryDialog
          category={deletingCategory}
          onClose={() => setDeletingCategory(null)}
        />
      )}
    </>
  );
}

// ─── Fila de categoría (.catrow) ──────────────────────────────────────────────

interface CategoryRowProps {
  category: Category;
  onEdit: () => void;
  onDelete: () => void;
}

function CategoryRow({ category, onEdit, onDelete }: CategoryRowProps) {
  const movementLabel =
    category.movementCount === 0
      ? "Sin movimientos"
      : category.movementCount === 1
        ? "1 movimiento"
        : `${category.movementCount} movimientos`;

  return (
    <li
      className="group grid items-center gap-4 px-5 py-[15px] transition-colors duration-[120ms] hover:bg-panel-2 [&+li]:border-t [&+li]:border-hair"
      style={{ gridTemplateColumns: "16px 1fr auto auto auto" }}
    >
      {/* Swatch de color */}
      <span
        className="h-[14px] w-[14px] shrink-0 rounded-[5px]"
        style={{ backgroundColor: category.color }}
        aria-label={`Color: ${category.color}`}
      />

      {/* Nombre */}
      <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink truncate">
        {category.name}
      </span>

      {/* Contador */}
      <span className="text-[12.5px] text-muted whitespace-nowrap">{movementLabel}</span>

      {/* Badge de alcance */}
      <ScopeBadge scope={category.scope as ScopeVariant} />

      {/* Acciones (visibles en hover) — KebabMenu por portal+fixed (overflow-hidden de tarjeta) */}
      <KebabMenu
        ariaLabel={`Acciones de ${category.name}`}
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
