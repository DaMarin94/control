/**
 * Tests del modal de creación y edición de categorías.
 * Verifica: validación del formulario, flujo de creación exitosa, flujo 409 activa,
 * flujo 409 reactivable (dispara prompt), edición exitosa, edición con colisión.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryFormModal } from "@/app/(app)/categorias/category-form-modal";
import { ToastProvider } from "@/components/ui/toast";
import type { Category } from "@/types/category";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-categories", () => ({
  useCategories: vi.fn(),
}));

import { useCategories } from "@/hooks/use-categories";

const mockUseCategories = vi.mocked(useCategories);

const mockCategory: Category = {
  id: "cat-1",
  userId: "user-1",
  name: "Alimentación",
  scope: "BOTH",
  color: "#FF5733",
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

  it("flujo crear: llama a createCategory con los datos correctos y llama a onClose al éxito", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockCreateCategory.mockResolvedValue({ success: true, category: mockCategory });

    renderModal({ category: null, onClose });

    await user.clear(screen.getByLabelText(/nombre/i));
    await user.type(screen.getByLabelText(/nombre/i), "Alimentación");
    await user.click(screen.getByRole("button", { name: /crear categoría/i }));

    await waitFor(() => {
      expect(mockCreateCategory).toHaveBeenCalledWith({
        name: "Alimentación",
        scope: "BOTH",
      });
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
        color: "#FF5733",
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

  it("prompt de reactivación: Cancelar vuelve al formulario sin crear nada", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockCreateCategory.mockResolvedValue({
      success: false,
      reactivable: {
        id: "cat-deleted-1",
        name: "Alimentación",
        scope: "BOTH",
        color: "#FF5733",
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
        color: "#FF5733",
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

  it("flujo editar: llama a updateCategory con el id y datos correctos", async () => {
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
        expect.objectContaining({ name: "Comida" }),
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

  it("modo inline EXPENSE: oculta la opción INCOME y preselecciona EXPENSE", () => {
    renderModal({ category: null, lockScopeToType: "EXPENSE" });

    const scopeSelect = screen.getByLabelText(/tipo/i) as HTMLSelectElement;
    const optionValues = Array.from(scopeSelect.options).map((o) => o.value);

    // Oculta el tipo opuesto; mantiene EXPENSE y BOTH
    expect(optionValues).toEqual(expect.arrayContaining(["EXPENSE", "BOTH"]));
    expect(optionValues).not.toContain("INCOME");
    // Preselecciona el tipo exacto del movimiento
    expect(scopeSelect.value).toBe("EXPENSE");
  });

  it("modo inline INCOME: oculta la opción EXPENSE y preselecciona INCOME", () => {
    renderModal({ category: null, lockScopeToType: "INCOME" });

    const scopeSelect = screen.getByLabelText(/tipo/i) as HTMLSelectElement;
    const optionValues = Array.from(scopeSelect.options).map((o) => o.value);

    expect(optionValues).toEqual(expect.arrayContaining(["INCOME", "BOTH"]));
    expect(optionValues).not.toContain("EXPENSE");
    expect(scopeSelect.value).toBe("INCOME");
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
      expect(mockCreateCategory).toHaveBeenCalledWith({
        name: "Supermercado",
        scope: "EXPENSE",
      });
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
        color: "#FF5733",
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
});
