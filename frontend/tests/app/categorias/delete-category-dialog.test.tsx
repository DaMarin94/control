/**
 * Tests del diálogo de confirmación de eliminación de categoría.
 * Verifica: renderizado, cancelar (no llama delete), confirmar (llama delete y cierra).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteCategoryDialog } from "@/app/categorias/delete-category-dialog";
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

function renderDialog(category: Category, onClose: () => void = vi.fn()) {
  return render(
    <ToastProvider>
      <DeleteCategoryDialog category={category} onClose={onClose} />
    </ToastProvider>,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("DeleteCategoryDialog", () => {
  const mockDeleteCategory = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCategories.mockReturnValue({
      categories: [],
      isLoading: false,
      isError: false,
      error: null,
      createCategory: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: mockDeleteCategory,
      reactivateCategory: vi.fn(),
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
      isReactivating: false,
    });
  });

  it("muestra el nombre de la categoría a eliminar y las acciones", () => {
    renderDialog(mockCategory);

    expect(screen.getByText(/Alimentación/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancelar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^eliminar$/i })).toBeInTheDocument();
  });

  it("Cancelar: no llama a deleteCategory y llama a onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog(mockCategory, onClose);

    await user.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(mockDeleteCategory).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("Confirmar: llama a deleteCategory con el id correcto y onClose al éxito", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockDeleteCategory.mockResolvedValue({ success: true });

    renderDialog(mockCategory, onClose);

    await user.click(screen.getByRole("button", { name: /^eliminar$/i }));

    await waitFor(() => {
      expect(mockDeleteCategory).toHaveBeenCalledWith("cat-1");
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("error al eliminar: llama a onClose y no queda bloqueado", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockDeleteCategory.mockResolvedValue({
      success: false,
      error: "No se pudo eliminar la categoría.",
    });

    renderDialog(mockCategory, onClose);

    await user.click(screen.getByRole("button", { name: /^eliminar$/i }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("muestra cantidad de movimientos si movementCount > 0", () => {
    renderDialog(mockCategory); // movementCount: 3

    expect(screen.getByText(/3 movimientos asociados/i)).toBeInTheDocument();
  });

  it("no muestra info de movimientos si movementCount es 0", () => {
    const emptyCategory = { ...mockCategory, movementCount: 0 };
    renderDialog(emptyCategory);

    expect(screen.queryByText(/movimientos asociados/i)).not.toBeInTheDocument();
  });
});
