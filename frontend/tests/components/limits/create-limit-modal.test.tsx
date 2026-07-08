/**
 * Tests de la rama ACTIVA del modal de creación de límites (P2 — Fase 2).
 *
 * Cubre:
 * - Selector de naturaleza (pasiva/activa): "Activa" habilitada solo si la key
 *   admite esa naturaleza (las 7 keys `mes.*`); deshabilitada para keys de reporte.
 * - Rama activa: se omiten alcance temporal y efecto visual (D20).
 * - Operadores restringidos por polaridad del anclaje (D12): techo → gt/gte,
 *   piso → lt/lte.
 * - Al cambiar de key se resetea la naturaleza a "passive".
 * - Submit en rama activa: `create()` recibe `nature: "active"`, SIN
 *   `temporalScope` ni `effect`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateLimitModal } from "@/components/limits/create-limit-modal";
import { ToastProvider } from "@/components/ui/toast";

vi.mock("@/hooks/use-limits", () => ({
  useLimits: vi.fn(),
}));

vi.mock("@/hooks/use-categories", () => ({
  useCategories: vi.fn(() => ({ categories: [], isLoading: false, isError: false })),
}));

import { useLimits } from "@/hooks/use-limits";

const mockUseLimits = vi.mocked(useLimits);
const mockCreate = vi.fn();

function renderModal(onClose = vi.fn()) {
  return render(
    <ToastProvider>
      <CreateLimitModal onClose={onClose} />
    </ToastProvider>,
  );
}

async function selectAnchor(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByLabelText(/dato a observar/i));
  const listbox = await screen.findByRole("listbox", { name: /dato a observar/i });
  await user.click(within(listbox).getByRole("option", { name: new RegExp(label, "i") }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseLimits.mockReturnValue({
    limits: [],
    isLoading: false,
    isSaving: false,
    create: mockCreate,
    remove: vi.fn(),
    setEnabled: vi.fn(),
  });
  mockCreate.mockResolvedValue({ success: true });
});

describe("CreateLimitModal — selector de naturaleza (P2, Fase 2)", () => {
  it("con una key `mes.*` (admite activa), el radio 'Activa' está habilitado", async () => {
    const user = userEvent.setup();
    renderModal();

    await selectAnchor(user, "Gasto del mes");

    const activeRadio = screen.getByRole("radio", { name: /^activa$/i });
    expect(activeRadio).not.toBeDisabled();
  });

  it("con una key de reporte (no admite activa), el radio 'Activa' está deshabilitado", async () => {
    const user = userEvent.setup();
    renderModal();

    await selectAnchor(user, "Gasto de un mes \\(serie anual\\)");

    const activeRadio = screen.getByRole("radio", { name: /^activa$/i });
    expect(activeRadio).toBeDisabled();
  });

  it("clickear 'Activa' deshabilitada no cambia la naturaleza (queda en Pasiva)", async () => {
    const user = userEvent.setup();
    renderModal();

    await selectAnchor(user, "Gasto de un mes \\(serie anual\\)");
    await user.click(screen.getByRole("radio", { name: /^activa$/i }));

    // Efecto visual sigue presente (rama pasiva vigente)
    expect(screen.getByText(/efecto visual/i)).toBeInTheDocument();
  });

  it("al cambiar de key se resetea la naturaleza a 'passive'", async () => {
    const user = userEvent.setup();
    renderModal();

    await selectAnchor(user, "Gasto del mes");
    await user.click(screen.getByRole("radio", { name: /^activa$/i }));
    expect(screen.queryByText(/efecto visual/i)).not.toBeInTheDocument();

    // Cambiar a otra key mes.* — la naturaleza vuelve a "passive"
    await selectAnchor(user, "Ingreso del mes");
    expect(screen.getByText(/efecto visual/i)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^pasiva$/i })).toHaveAttribute("aria-checked", "true");
  });
});

describe("CreateLimitModal — rama activa: omite alcance temporal y efecto (D20)", () => {
  it("al elegir 'Activa' desaparecen 'Alcance temporal' y 'Efecto visual'", async () => {
    const user = userEvent.setup();
    renderModal();

    await selectAnchor(user, "Gasto del mes");
    expect(screen.getByText(/alcance temporal/i)).toBeInTheDocument();
    expect(screen.getByText(/efecto visual/i)).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /^activa$/i }));

    expect(screen.queryByText(/alcance temporal/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/efecto visual/i)).not.toBeInTheDocument();
  });
});

describe("CreateLimitModal — operadores restringidos por polaridad (D12)", () => {
  it("key techo (mes.total.gasto) en rama activa ofrece solo mayor que / mayor o igual que", async () => {
    const user = userEvent.setup();
    renderModal();

    await selectAnchor(user, "Gasto del mes");
    await user.click(screen.getByRole("radio", { name: /^activa$/i }));

    const operatorSelect = screen.getByLabelText(/condición/i) as HTMLSelectElement;
    const optionTexts = Array.from(operatorSelect.options).map((o) => o.text);
    expect(optionTexts).toEqual(["> mayor que", "≥ mayor o igual que"]);
  });

  it("key piso (mes.balance) en rama activa ofrece solo menor que / menor o igual que", async () => {
    const user = userEvent.setup();
    renderModal();

    await selectAnchor(user, "Balance del mes");
    await user.click(screen.getByRole("radio", { name: /^activa$/i }));

    const operatorSelect = screen.getByLabelText(/condición/i) as HTMLSelectElement;
    const optionTexts = Array.from(operatorSelect.options).map((o) => o.text);
    expect(optionTexts).toEqual(["< menor que", "≤ menor o igual que"]);
  });

  it("mes.total.ingreso (piso, cierre D12) en rama activa ofrece menor que / menor o igual que", async () => {
    const user = userEvent.setup();
    renderModal();

    await selectAnchor(user, "Ingreso del mes");
    await user.click(screen.getByRole("radio", { name: /^activa$/i }));

    const operatorSelect = screen.getByLabelText(/condición/i) as HTMLSelectElement;
    const optionTexts = Array.from(operatorSelect.options).map((o) => o.text);
    expect(optionTexts).toEqual(["< menor que", "≤ menor o igual que"]);
  });
});

describe("CreateLimitModal — submit en rama activa", () => {
  it("llama a create() con nature='active', SIN temporalScope ni effect", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(onClose);

    await selectAnchor(user, "Gasto del mes");
    await user.click(screen.getByRole("radio", { name: /^activa$/i }));

    await user.type(screen.getByLabelText(/umbral/i), "300000");
    await user.click(screen.getByRole("button", { name: /crear límite/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          anchorKey: "mes.total.gasto",
          operator: "gt",
          threshold: 300000,
          nature: "active",
        }),
      );
    });

    const payload = mockCreate.mock.calls[0]![0];
    expect(payload).not.toHaveProperty("temporalScope");
    expect(payload).not.toHaveProperty("effect");
    expect(onClose).toHaveBeenCalled();
  });

  it("llama a create() con nature='passive' cuando se deja la rama pasiva (comportamiento vigente)", async () => {
    const user = userEvent.setup();
    renderModal();

    await selectAnchor(user, "Gasto del mes");
    await user.type(screen.getByLabelText(/umbral/i), "300000");
    await user.click(screen.getByRole("button", { name: /crear límite/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          anchorKey: "mes.total.gasto",
          nature: "passive",
          temporalScope: "all",
        }),
      );
    });
    const payload = mockCreate.mock.calls[0]![0];
    expect(payload).toHaveProperty("effect");
  });
});

describe("CreateLimitModal — umbral: signo válido según unit (catalog-driven)", () => {
  it("unit='money' (Gasto del mes): un umbral negativo muestra error inline y bloquea el submit", async () => {
    const user = userEvent.setup();
    renderModal();

    await selectAnchor(user, "Gasto del mes");
    await user.type(screen.getByLabelText(/umbral/i), "-5");

    expect(screen.getByText(/el umbral debe ser mayor a 0/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /crear límite/i })).toBeDisabled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("unit='signed-money' (Balance del mes): un umbral negativo es válido (sin error, submit habilitado)", async () => {
    const user = userEvent.setup();
    renderModal();

    await selectAnchor(user, "Balance del mes");
    await user.type(screen.getByLabelText(/umbral/i), "-5000");

    expect(screen.queryByText(/el umbral debe ser mayor a 0/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /crear límite/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ anchorKey: "mes.balance", threshold: -5000 }),
      );
    });
  });

  it("unit='count' (Cantidad de ítems de una sección): 0 muestra error inline y bloquea el submit", async () => {
    const user = userEvent.setup();
    renderModal();

    await selectAnchor(user, "Cantidad de ítems de una sección");
    await user.selectOptions(screen.getByLabelText(/sección/i), "unicos");
    await user.type(screen.getByLabelText(/umbral/i), "0");

    expect(
      screen.getByText(/la cantidad debe ser un entero mayor o igual a 1/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /crear límite/i })).toBeDisabled();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
