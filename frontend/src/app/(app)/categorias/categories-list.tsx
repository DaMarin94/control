"use client";

/**
 * Lista de categorías activas con acciones de editar y eliminar.
 * Maneja estados: cargando, vacío, con datos.
 * Abre los modales de editar y eliminar.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCategories } from "@/hooks/use-categories";
import { type Category, SCOPE_LABELS } from "@/types/category";
import { CategoryFormModal } from "./category-form-modal";
import { DeleteCategoryDialog } from "./delete-category-dialog";
import { cn } from "@/lib/utils";

export function CategoriesList() {
  const { categories, isLoading, isError } = useCategories();

  // Modal de creación/edición: null = cerrado; Category = editar esa; "new" = crear
  const [editingCategory, setEditingCategory] = useState<Category | "new" | null>(null);
  // Diálogo de confirmación de eliminación
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

  // ─── Estados de carga / error ─────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">Cargando categorías...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-destructive">
          No se pudieron cargar las categorías. Recargá la página.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Encabezado con botón de nueva categoría */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categorías</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Organizá tus movimientos por categoría.
          </p>
        </div>
        <Button onClick={() => setEditingCategory("new")}>Nueva categoría</Button>
      </div>

      {/* Lista o estado vacío */}
      {!categories || categories.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm font-medium text-foreground">No tenés categorías activas.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Creá una para empezar a organizar tus movimientos.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setEditingCategory("new")}
          >
            Crear primera categoría
          </Button>
        </div>
      ) : (
        <div className="mt-6 rounded-lg border">
          <ul role="list" className="divide-y">
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

// ─── Fila de categoría ────────────────────────────────────────────────────────

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

  const scopeLabel = SCOPE_LABELS[category.scope];

  return (
    <li className="flex items-center gap-4 px-4 py-3">
      {/* Indicador de color */}
      <span
        className={cn("h-4 w-4 shrink-0 rounded-full border")}
        style={{ backgroundColor: category.color }}
        aria-label={`Color: ${category.color}`}
      />

      {/* Nombre y detalles */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{category.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {scopeLabel} &middot; {movementLabel}
        </p>
      </div>

      {/* Acciones */}
      <div className="flex shrink-0 gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          aria-label={`Editar categoría ${category.name}`}
        >
          Editar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          aria-label={`Eliminar categoría ${category.name}`}
          className="text-destructive hover:text-destructive"
        >
          Eliminar
        </Button>
      </div>
    </li>
  );
}
