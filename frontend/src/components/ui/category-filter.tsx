"use client";

/**
 * Componente compartido de filtro de categorías — Fase 1.1.6.
 *
 * Exporta:
 *   - CategoryFilterPopover: popover portaleado a body con checklist de categorías.
 *   - FilterButton: botón disparador que refleja el estado del filtro.
 *
 * Semántica de selección (3 estados):
 *   - null   = todas las categorías (default — no se serializa param en la URL).
 *   - []     = ninguna categoría (se serializa como &categories= vacío).
 *   - lista  = subconjunto explícito (se serializa como &categories=id1,id2).
 *
 * El popover usa createPortal hacia document.body (patrón estándar del DS).
 * Guard SSR obligatorio: mounted + useEffect para evitar hydration mismatch.
 *
 * Nota sobre toggleAll:
 *   - Cuando todas están tildadas → onSelectionChange([]) para señalar "ninguna".
 *   - Cuando no todas están tildadas → onSelectionChange(null) para señalar "todas".
 * El consumidor NO debe cambiar esta lógica de emisión.
 */

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { SlidersHorizontal } from "lucide-react";
import { useCategories } from "@/hooks/use-categories";
import { cn } from "@/lib/utils";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface PopoverCategoryItem {
  id: string;
  name: string;
  color: string;
}

// ─── CategoryFilterPopover ────────────────────────────────────────────────────

export interface CategoryFilterPopoverProps {
  /** Ids de categorías seleccionadas. null = todas. [] = ninguna. */
  selectedIds: string[] | null;
  onSelectionChange: (ids: string[] | null) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

export function CategoryFilterPopover({
  selectedIds,
  onSelectionChange,
  onClose,
  anchorRef,
}: CategoryFilterPopoverProps) {
  const { categories } = useCategories();
  const popoverRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, right: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calcular posición anclada al botón disparador
  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 6,
      left: rect.left,
      right: window.innerWidth - rect.right,
    });
  }, [anchorRef]);

  // Cerrar al hacer clic fuera o al presionar Esc
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose, anchorRef]);

  const allCategories: PopoverCategoryItem[] = (categories ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
  }));

  // Calcular selección actual normalizada.
  // null = todas; [] = ninguna; lista = subconjunto.
  // En el popover, [] se trata visualmente como "ninguna marcada".
  const effectiveIds: Set<string> =
    selectedIds === null
      ? new Set(allCategories.map((c) => c.id))
      : new Set(selectedIds.filter((id) => allCategories.some((c) => c.id === id)));

  const allSelected = allCategories.length > 0 && allCategories.every((c) => effectiveIds.has(c.id));

  function toggleCategory(id: string) {
    const newSet = new Set(effectiveIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    // Si están todas tildadas → null (default); si no → lista explícita
    // (puede ser [] si se deseleccionó la última)
    const newList = allCategories
      .map((c) => c.id)
      .filter((cid) => newSet.has(cid));
    if (newList.length === allCategories.length) {
      onSelectionChange(null);
    } else {
      onSelectionChange(newList);
    }
  }

  function toggleAll() {
    if (allSelected) {
      // Destildar todas → [] (ninguna — el backend retorna vacío)
      onSelectionChange([]);
    } else {
      // Tildar todas → null (= todas)
      onSelectionChange(null);
    }
  }

  if (!mounted) return null;

  const popoverContent = (
    <div
      ref={popoverRef}
      className="fixed z-50 w-[260px] rounded-ctl border border-line bg-panel shadow-[var(--shadow-lg)] animate-modal-pop"
      style={{
        top: position.top,
        right: position.right,
      }}
      role="dialog"
      aria-label="Filtrar categorías"
    >
      {/* Header fijo */}
      <div className="flex items-center justify-between border-b border-hair px-3 py-[10px]">
        <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">
          Mostrar categorías
        </span>
        <button
          type="button"
          onClick={toggleAll}
          className="text-[12px] font-semibold text-accent-ink hover:underline focus-visible:outline-none"
        >
          {allSelected ? "Ninguna" : "Todas"}
        </button>
      </div>

      {/* Lista scrollable */}
      <div className="max-h-[280px] overflow-y-auto">
        {allCategories.length === 0 ? (
          <p className="px-3 py-4 text-center text-[12.5px] text-muted">
            No tenés categorías.
          </p>
        ) : (
          allCategories.map((cat) => {
            const checked = effectiveIds.has(cat.id);
            return (
              <div
                key={cat.id}
                className="flex cursor-pointer items-center gap-[10px] px-3 py-2 hover:bg-panel-2"
                onClick={() => toggleCategory(cat.id)}
                role="checkbox"
                aria-checked={checked}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    toggleCategory(cat.id);
                  }
                }}
              >
                {/* Checkbox visual */}
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-[140ms]",
                    checked
                      ? "border-accent bg-accent"
                      : "border-line-strong bg-panel"
                  )}
                  aria-hidden="true"
                >
                  {checked && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>

                {/* Swatch de color */}
                <span
                  className="h-[10px] w-[10px] shrink-0 rounded-[3px]"
                  style={{ backgroundColor: cat.color }}
                  aria-hidden="true"
                />

                {/* Nombre */}
                <span className={cn("text-[13px] font-medium", checked ? "text-ink" : "text-ink-2")}>
                  {cat.name}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return createPortal(popoverContent, document.body);
}

// ─── FilterButton ─────────────────────────────────────────────────────────────

export interface FilterButtonProps {
  selectedIds: string[] | null;
  totalCategories: number;
  isOpen: boolean;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  onClick: () => void;
}

export function FilterButton({
  selectedIds,
  totalCategories,
  isOpen,
  buttonRef,
  onClick,
}: FilterButtonProps) {
  // Calcular estado del filtro
  const isFiltered =
    selectedIds !== null &&
    (selectedIds.length < totalCategories || selectedIds.length === 0);
  const selectedCount = selectedIds === null ? totalCategories : selectedIds.length;
  const showCount = isFiltered;

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      aria-label="Filtrar categorías"
      aria-expanded={isOpen}
      className={cn(
        "flex items-center gap-[6px] rounded-ctl px-[9px] py-[5px]",
        "text-[12.5px] font-semibold transition-colors duration-[140ms]",
        "border border-transparent focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
        isOpen
          ? "bg-panel-2 text-ink"
          : isFiltered
            ? "text-ink hover:bg-panel-2"
            : "text-ink-2 hover:bg-panel-2 hover:text-ink",
      )}
    >
      <SlidersHorizontal size={15} aria-hidden="true" />
      <span>
        {showCount ? (
          <>
            {"Categorías · "}
            <span className="mono">{selectedCount}</span>
          </>
        ) : (
          "Categorías"
        )}
      </span>
      {/* Punto indicador de filtro activo */}
      {isFiltered && (
        <span
          className="h-[6px] w-[6px] rounded-full bg-accent"
          aria-hidden="true"
        />
      )}
    </button>
  );
}
