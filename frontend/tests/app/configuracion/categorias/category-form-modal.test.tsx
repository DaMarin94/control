/**
 * Tests del modal de creación y edición de categorías.
 * Verifica: validación del formulario, flujo de creación exitosa, flujo 409 activa,
 * flujo 409 reactivable (dispara prompt), edición exitosa, edición con colisión,
 * picker de color (selección, default menos-usado, pre-selección en editar, aleatorio).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryFormModal } from "@/app/(app)/configuracion/categorias/category-form-modal";
import { ToastProvider } from "@/components/ui/toast";
import type { Category } from "@/types/category";
import { CATEGORY_COLOR_PALETTE, CATEGORY_BASE_COLORS } from "@/types/category";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-categories", () => ({
  useCategories: vi.fn(),
}));

import { useCategories } from "@/hooks/use-categories";

const mockUseCategories = vi.mocked(useCategories);

// Primer color del subset base (L3, orden de asignación)
const L3_FIRST = CATEGORY_BASE_COLORS[0]; // "#E23B3B"

const mockCategory: Category = {
  id: "cat-1",
  userId: "user-1",
  name: "Alimentación",
  scope: "BOTH",
  color: L3_FIRST,
  deletedAt: null,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  movementCount: 3,
};

function renderModal(props: {
  category: Category | null;
  onClose?: () => void;
  lockScopeToType?: "EXPENSE" | "INCOME";
  onCreated?: (category: Category) => void;
  /** Categorías activas inyectadas al mock (para testear el cálculo de menos-usado) */
  categories?: Category[];
}) {
  const onClose = props.onClose ?? vi.fn();
  return render(
    <ToastProvider>
      <CategoryFormModal
        category={props.category}
        onClose={onClose}
        lockScopeToType={props.lockScopeToType}
        onCreated={props.onCreated}
      />
    </ToastProvider>,
  );
}

// Helper: configura el mock de useCategories con los parámetros dados
function setupMock({
  categories = [],
  createCategory = vi.fn(),
  updateCategory = vi.fn(),
  reactivateCategory = vi.fn(),
}: {
  categories?: Category[];
  createCategory?: ReturnType<typeof vi.fn>;
  updateCategory?: ReturnType<typeof vi.fn>;
  reactivateCategory?: ReturnType<typeof vi.fn>;
} = {}) {
  mockUseCategories.mockReturnValue({
    categories,
    isLoading: false,
    isError: false,
    error: null,
    createCategory,
    updateCategory,
    deleteCategory: vi.fn(),
    reactivateCategory,
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
    isReactivating: false,
  });
  return { createCategory, updateCategory, reactivateCategory };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("CategoryFormModal", () => {
  const mockCreateCategory = vi.fn();
  const mockUpdateCategory = vi.fn();
  const mockReactivateCategory = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCategories.mockReturnValue({
      categories: [],
      isLoading: false,
      isError: false,
      error: null,
      createCategory: mockCreateCategory,
      updateCategory: mockUpdateCategory,
      deleteCategory: vi.fn(),
      reactivateCategory: mockReactivateCategory,
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
      isReactivating: false,
    });
  });

  // ─── Validación del formulario ───────────────────────────────────────────────

  it("muestra error si el nombre está vacío al intentar crear", async () => {
    const user = userEvent.setup();
    renderModal({ category: null });

    // Limpiar el campo nombre y submitear
    const nameInput = screen.getByLabelText(/nombre/i);
    await user.clear(nameInput);
    await user.click(screen.getByRole("button", { name: /crear categoría/i }));

    await waitFor(() => {
      expect(screen.getByText(/el nombre es requerido/i)).toBeInTheDocument();
    });

    expect(mockCreateCategory).not.toHaveBeenCalled();
  });

  it("renderiza modo crear: título 'Nueva categoría' con campos vacíos", () => {
    renderModal({ category: null });

    expect(screen.getByText(/nueva categoría/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /crear categoría/i })).toBeInTheDocument();
  });

  it("renderiza modo editar: título 'Editar categoría' con campos precargados", () => {
    renderModal({ category: mockCategory });

    expect(screen.getByText(/editar categoría/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Alimentación")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /guardar cambios/i })).toBeInTheDocument();
  });

  // ─── Flujo crear exitoso ─────────────────────────────────────────────────────

  it("flujo crear: llama a createCategory con los datos correctos (incluyendo color) y llama a onClose al éxito", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockCreateCategory.mockResolvedValue({ success: true, category: mockCategory });

    renderModal({ category: null, onClose });

    await user.clear(screen.getByLabelText(/nombre/i));
    await user.type(screen.getByLabelText(/nombre/i), "Alimentación");
    await user.click(screen.getByRole("button", { name: /crear categoría/i }));

    await waitFor(() => {
      expect(mockCreateCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Alimentación",
          scope: "BOTH",
          color: expect.stringMatching(/^#[0-9A-Fa-f]{6}$/),
        }),
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  // ─── Flujo 409 colisión con activa ──────────────────────────────────────────

  it("409 colisión activa: muestra error en el campo nombre sin cerrar el modal", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockCreateCategory.mockResolvedValue({ success: false, nameConflict: true });

    renderModal({ category: null, onClose });

    await user.type(screen.getByLabelText(/nombre/i), "Existente");
    await user.click(screen.getByRole("button", { name: /crear categoría/i }));

    await waitFor(() => {
      expect(screen.getByText(/ya existe una categoría activa con ese nombre/i)).toBeInTheDocument();
    });

    expect(onClose).not.toHaveBeenCalled();
    // El nombre debe conservarse
    expect(screen.getByDisplayValue("Existente")).toBeInTheDocument();
  });

  // ─── Flujo 409 reactivable ───────────────────────────────────────────────────

  it("409 reactivable: muestra el prompt de reactivación con la configuración original", async () => {
    const user = userEvent.setup();
    mockCreateCategory.mockResolvedValue({
      success: false,
      reactivable: {
        id: "cat-deleted-1",
        name: "Alimentación",
        scope: "BOTH",
        color: L3_FIRST,
      },
    });

    renderModal({ category: null });

    await user.type(screen.getByLabelText(/nombre/i), "Alimentación");
    await user.click(screen.getByRole("button", { name: /crear categoría/i }));

    await waitFor(() => {
      // Debe mostrar el prompt de reactivación
      expect(screen.getByText(/categoría eliminada encontrada/i)).toBeInTheDocument();
      // Debe aclarar que se usará la configuración original
      expect(screen.getByText(/configuración original/i)).toBeInTheDocument();
      // Debe mostrar el botón de reactivar
      expect(screen.getByRole("button", { name: /^reactivar$/i })).toBeInTheDocument();
    });
  });

  it("409 reactivable: el prompt hereda el contrato de ModalShell (max-height dvh, no vh — ex-offender)", async () => {
    const user = userEvent.setup();
    mockCreateCategory.mockResolvedValue({
      success: false,
      reactivable: {
        id: "cat-deleted-1",
        name: "Alimentación",
        scope: "BOTH",
        color: L3_FIRST,
      },
    });

    renderModal({ category: null });

    await user.type(screen.getByLabelText(/nombre/i), "Alimentación");
    await user.click(screen.getByRole("button", { name: /crear categoría/i }));

    await waitFor(() => {
      expect(screen.getByText(/categoría eliminada encontrada/i)).toBeInTheDocument();
    });

    const panel = screen.getByRole("dialog").firstElementChild as HTMLElement;
    expect(panel.className).toContain("max-h-[calc(100dvh-48px)]");
    expect(panel.className).not.toMatch(/max-h-\[calc\(100vh/);
    // Antes de consumir ModalShell este diálogo no declaraba max-height ni
    // región de scroll (offender #2, docs/design.md).
    expect(panel.className).toMatch(/overflow-hidden/);
  });

  it("prompt de reactivación: Cancelar vuelve al formulario sin crear nada", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockCreateCategory.mockResolvedValue({
      success: false,
      reactivable: {
        id: "cat-deleted-1",
        name: "Alimentación",
        scope: "BOTH",
        color: L3_FIRST,
      },
    });

    renderModal({ category: null, onClose });

    await user.type(screen.getByLabelText(/nombre/i), "Alimentación");
    await user.click(screen.getByRole("button", { name: /crear categoría/i }));

    await waitFor(() => {
      expect(screen.getByText(/categoría eliminada encontrada/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /cancelar/i }));

    // Debe volver al formulario
    await waitFor(() => {
      expect(screen.getByText(/nueva categoría/i)).toBeInTheDocument();
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(mockReactivateCategory).not.toHaveBeenCalled();
  });

  it("prompt de reactivación: Reactivar llama a reactivateCategory con el id correcto", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockCreateCategory.mockResolvedValue({
      success: false,
      reactivable: {
        id: "cat-deleted-1",
        name: "Alimentación",
        scope: "BOTH",
        color: L3_FIRST,
      },
    });
    mockReactivateCategory.mockResolvedValue({ success: true, category: mockCategory });

    renderModal({ category: null, onClose });

    await user.type(screen.getByLabelText(/nombre/i), "Alimentación");
    await user.click(screen.getByRole("button", { name: /crear categoría/i }));

    await waitFor(() => {
      expect(screen.getByText(/categoría eliminada encontrada/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /^reactivar$/i }));

    await waitFor(() => {
      expect(mockReactivateCategory).toHaveBeenCalledWith("cat-deleted-1");
      expect(onClose).toHaveBeenCalled();
    });
  });

  // ─── Flujo editar exitoso ────────────────────────────────────────────────────

  it("flujo editar: llama a updateCategory con el id y datos correctos (incluyendo color)", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const updated = { ...mockCategory, name: "Comida" };
    mockUpdateCategory.mockResolvedValue({ success: true, category: updated });

    renderModal({ category: mockCategory, onClose });

    const nameInput = screen.getByDisplayValue("Alimentación");
    await user.clear(nameInput);
    await user.type(nameInput, "Comida");
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(mockUpdateCategory).toHaveBeenCalledWith(
        "cat-1",
        expect.objectContaining({ name: "Comida", color: L3_FIRST }),
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("editar 409: muestra error de colisión en el campo nombre", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockUpdateCategory.mockResolvedValue({ success: false, nameConflict: true });

    renderModal({ category: mockCategory, onClose });

    const nameInput = screen.getByDisplayValue("Alimentación");
    await user.clear(nameInput);
    await user.type(nameInput, "Otra Existente");
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(screen.getByText(/ya existe una categoría activa con ese nombre/i)).toBeInTheDocument();
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  // ─── Modo inline (RF-MU-004) ─────────────────────────────────────────────────

  it("modo inline EXPENSE: oculta el botón INCOME y muestra EXPENSE y BOTH", () => {
    renderModal({ category: null, lockScopeToType: "EXPENSE" });

    // El scope picker usa botones (no un select). Con lockScopeToType="EXPENSE" se oculta el botón "Ingreso"
    expect(screen.queryByRole("button", { name: /^ingreso$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^gasto$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^ambos$/i })).toBeInTheDocument();
  });

  it("modo inline INCOME: oculta el botón EXPENSE y muestra INCOME y BOTH", () => {
    renderModal({ category: null, lockScopeToType: "INCOME" });

    // Con lockScopeToType="INCOME" se oculta el botón "Gasto"
    expect(screen.queryByRole("button", { name: /^gasto$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^ingreso$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^ambos$/i })).toBeInTheDocument();
  });

  it("modo inline: al crear con éxito llama a onCreated con la categoría creada y cierra", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onCreated = vi.fn();
    const created = { ...mockCategory, name: "Supermercado", scope: "EXPENSE" as const };
    mockCreateCategory.mockResolvedValue({ success: true, category: created });

    renderModal({ category: null, onClose, lockScopeToType: "EXPENSE", onCreated });

    await user.type(screen.getByLabelText(/nombre/i), "Supermercado");
    await user.click(screen.getByRole("button", { name: /crear categoría/i }));

    await waitFor(() => {
      expect(mockCreateCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Supermercado",
          scope: "EXPENSE",
          color: expect.stringMatching(/^#[0-9A-Fa-f]{6}$/),
        }),
      );
      expect(onCreated).toHaveBeenCalledWith(created);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("modo inline: al reactivar con éxito llama a onCreated con la categoría reactivada y cierra", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onCreated = vi.fn();
    const reactivated = { ...mockCategory, id: "cat-deleted-1" };
    mockCreateCategory.mockResolvedValue({
      success: false,
      reactivable: {
        id: "cat-deleted-1",
        name: "Alimentación",
        scope: "BOTH",
        color: L3_FIRST,
      },
    });
    mockReactivateCategory.mockResolvedValue({ success: true, category: reactivated });

    renderModal({ category: null, onClose, lockScopeToType: "EXPENSE", onCreated });

    await user.type(screen.getByLabelText(/nombre/i), "Alimentación");
    await user.click(screen.getByRole("button", { name: /crear categoría/i }));

    await waitFor(() => {
      expect(screen.getByText(/categoría eliminada encontrada/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /^reactivar$/i }));

    await waitFor(() => {
      expect(mockReactivateCategory).toHaveBeenCalledWith("cat-deleted-1");
      expect(onCreated).toHaveBeenCalledWith(reactivated);
      expect(onClose).toHaveBeenCalled();
    });
  });

  // ─── Picker de color ─────────────────────────────────────────────────────────

  it("muestra el bloque Color con el grid de swatches y el botón Aleatorio", () => {
    renderModal({ category: null });

    // Debe haber una label "Color"
    expect(screen.getByText(/^color$/i)).toBeInTheDocument();
    // Debe haber el botón Aleatorio
    expect(screen.getByRole("button", { name: /aleatorio/i })).toBeInTheDocument();
    // Debe haber el radiogroup de swatches
    expect(screen.getByRole("radiogroup", { name: /seleccionar color/i })).toBeInTheDocument();
    // 40 swatches
    const swatches = screen.getAllByRole("radio");
    expect(swatches).toHaveLength(40);
  });

  it("pre-selecciona el color actual de la categoría en modo editar", () => {
    renderModal({ category: mockCategory });

    // El swatch con aria-label = color de la categoría debe estar seleccionado
    const selectedSwatch = screen.getByRole("radio", { name: L3_FIRST });
    expect(selectedSwatch).toHaveAttribute("aria-checked", "true");
  });

  it("pre-selecciona el primer color del subset base en crear cuando no hay categorías activas (todas en cero → primero del subset base)", () => {
    // Con categories: [] → todos los colores del subset base tienen conteo 0 → el primero gana
    renderModal({ category: null });

    const firstL3Swatch = screen.getByRole("radio", { name: L3_FIRST });
    expect(firstL3Swatch).toHaveAttribute("aria-checked", "true");
  });

  it("pre-selecciona el segundo color del subset base en crear cuando el primero ya está en uso", () => {
    // Inyectar una categoría activa con el primer color del subset base
    const catUsingFirst: Category = {
      ...mockCategory,
      id: "cat-existing",
      color: CATEGORY_BASE_COLORS[0],
    };
    setupMock({ categories: [catUsingFirst] });

    renderModal({ category: null });

    // El segundo color del subset base debe quedar seleccionado
    const secondColor = CATEGORY_BASE_COLORS[1];
    const secondSwatch = screen.getByRole("radio", { name: secondColor });
    expect(secondSwatch).toHaveAttribute("aria-checked", "true");
  });

  it("al hacer clic en un swatch, ese queda seleccionado (aria-checked=true) y el anterior queda deseleccionado", async () => {
    const user = userEvent.setup();
    renderModal({ category: null });

    // El tercer color del subset base (índice 2)
    const targetColor = CATEGORY_BASE_COLORS[2];
    const targetSwatch = screen.getByRole("radio", { name: targetColor });

    await user.click(targetSwatch);

    expect(targetSwatch).toHaveAttribute("aria-checked", "true");

    // El primero (que estaba seleccionado antes) ya no debe estar seleccionado
    const firstSwatch = screen.getByRole("radio", { name: L3_FIRST });
    expect(firstSwatch).toHaveAttribute("aria-checked", "false");
  });

  it("botón Aleatorio selecciona exactamente un swatch de la paleta", async () => {
    const user = userEvent.setup();
    renderModal({ category: null });

    await user.click(screen.getByRole("button", { name: /aleatorio/i }));

    // Exactamente un swatch debe estar seleccionado
    const allSwatches = screen.getAllByRole("radio");
    const selectedSwatches = allSwatches.filter(
      (sw) => sw.getAttribute("aria-checked") === "true",
    );
    expect(selectedSwatches).toHaveLength(1);

    // El color seleccionado (aria-label = hex) debe pertenecer a la paleta
    const selectedColor = selectedSwatches[0].getAttribute("aria-label") ?? "";
    const paletteUppercase = CATEGORY_COLOR_PALETTE.map((c) => c.toUpperCase());
    expect(paletteUppercase).toContain(selectedColor.toUpperCase());
  });

  it("al crear con un color seleccionado manualmente, se envía ese color al backend", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockCreateCategory.mockResolvedValue({ success: true, category: mockCategory });

    renderModal({ category: null, onClose });

    // Elegir el cuarto color del subset base
    const targetColor = CATEGORY_BASE_COLORS[3]; // "#8B4FD4"
    await user.click(screen.getByRole("radio", { name: targetColor }));

    await user.type(screen.getByLabelText(/nombre/i), "Transporte");
    await user.click(screen.getByRole("button", { name: /crear categoría/i }));

    await waitFor(() => {
      expect(mockCreateCategory).toHaveBeenCalledWith(
        expect.objectContaining({ color: targetColor }),
      );
    });
  });

  it("al editar y cambiar de color, se envía el nuevo color al backend", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockUpdateCategory.mockResolvedValue({ success: true, category: mockCategory });

    renderModal({ category: mockCategory, onClose });

    // El color actual es L3_FIRST; cambiar al quinto del subset base
    const newColor = CATEGORY_BASE_COLORS[4]; // "#E8863A"
    await user.click(screen.getByRole("radio", { name: newColor }));

    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(mockUpdateCategory).toHaveBeenCalledWith(
        "cat-1",
        expect.objectContaining({ color: newColor }),
      );
    });
  });
});

// ─── Tests unitarios: getLeastUsedBaseColor ───────────────────────────────────

import { getLeastUsedBaseColor } from "@/types/category";

describe("getLeastUsedBaseColor", () => {
  it("devuelve el primer color del subset base cuando no hay categorías activas", () => {
    expect(getLeastUsedBaseColor([])).toBe(CATEGORY_BASE_COLORS[0]);
  });

  it("devuelve el primer color del subset base cuando todos tienen el mismo conteo", () => {
    const cats = CATEGORY_BASE_COLORS.map((color, i) => ({
      ...mockCategory,
      id: `cat-${i}`,
      color,
    }));
    expect(getLeastUsedBaseColor(cats)).toBe(CATEGORY_BASE_COLORS[0]);
  });

  it("devuelve el color menos usado cuando hay un claro ganador", () => {
    // Usar el primero 3 veces, el segundo 1 vez → el tercero (0 veces) debe ganar
    const cats = [
      { ...mockCategory, id: "a", color: CATEGORY_BASE_COLORS[0] },
      { ...mockCategory, id: "b", color: CATEGORY_BASE_COLORS[0] },
      { ...mockCategory, id: "c", color: CATEGORY_BASE_COLORS[0] },
      { ...mockCategory, id: "d", color: CATEGORY_BASE_COLORS[1] },
    ];
    expect(getLeastUsedBaseColor(cats)).toBe(CATEGORY_BASE_COLORS[2]);
  });

  it("en empate entre múltiples colores de cero usos, devuelve el primero del subset base en orden", () => {
    // Solo el primer color está usado; los demás tienen 0
    const cats = [{ ...mockCategory, id: "a", color: CATEGORY_BASE_COLORS[0] }];
    // El segundo tiene 0 → gana (es el primero en el subset base con 0 usos)
    expect(getLeastUsedBaseColor(cats)).toBe(CATEGORY_BASE_COLORS[1]);
  });

  it("es case-insensitive: cuenta colores en minúsculas o mezclados correctamente", () => {
    const cats = [
      { color: CATEGORY_BASE_COLORS[0].toLowerCase() }, // minúsculas
      { color: CATEGORY_BASE_COLORS[1] },
    ];
    // El tercero tiene 0 → gana
    expect(getLeastUsedBaseColor(cats)).toBe(CATEGORY_BASE_COLORS[2]);
  });

  it("ignora colores que no están en el subset base", () => {
    // Un color fuera del subset base no debería afectar el conteo
    const cats = [
      { color: "#FFFFFF" }, // no está en el subset base
      { color: CATEGORY_BASE_COLORS[0] },
    ];
    // Solo el primero del subset base tiene 1 uso; el segundo tiene 0 → gana el segundo
    expect(getLeastUsedBaseColor(cats)).toBe(CATEGORY_BASE_COLORS[1]);
  });
});
