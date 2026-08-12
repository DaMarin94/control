/**
 * Tests de RecurringSkipScopeModal (RF-MF-005, docs/design.md §"Modal de
 * alcance de la anulación de un fijo").
 *
 * Cubre:
 * - Preselección del alcance "Solo este mes" (radio checked + foco inicial).
 * - Recálculo de las opciones de "Hasta" al mover "Desde" (arrastre y clamp
 *   por largo máximo), con frecuencia NO mensual (trimestral).
 * - Conteo de apariciones reales dentro del rango (frecuencia trimestral).
 * - Estado de cero apariciones: primario deshabilitado, sin togglear color.
 * - Los dos verbos (anular/des-anular): alcance "este mes" (toggle, sin
 *   `action`) y alcance rango (`action: "skip" | "unskip"` explícito).
 * - Toast de éxito: ausente en "este mes", presente (y con el copy correcto)
 *   en rango.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RecurringSkipScopeModal } from "@/components/movements/recurring-skip-scope-modal";
import type { MovementItem } from "@/types/movement";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-recurring", () => ({
  useRecurring: vi.fn(),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({
    toast: {
      success: mockToastSuccess,
      error: mockToastError,
      warning: vi.fn(),
      info: vi.fn(),
    },
  })),
}));

import { useRecurring } from "@/hooks/use-recurring";

const mockUseRecurring = vi.mocked(useRecurring);
const mockSkipRecurring = vi.fn();
const mockSkipRecurringRange = vi.fn();

// ─── Fixture ──────────────────────────────────────────────────────────────────
//
// Fijo TRIMESTRAL (frequency=3), arranque Ene 2025, sin fin — mismo fijo de
// referencia del checklist visual de docs/design.md. viewMonth = Abr 2026,
// que ES una aparición real (precondición del RF: el ítem solo se lista, y
// por lo tanto el kebab solo se ofrece, en meses de aparición).

const fijoTrimestral: MovementItem = {
  id: "rec-1",
  origin: "fijo",
  type: "EXPENSE",
  amountCents: 150000,
  description: "Seguro del auto",
  occurredAt: null,
  timezone: null,
  installment: null,
  frequency: 3,
  startMonth: "2025-01",
  endMonth: null,
  chainId: "chain-1",
  skipped: false,
  category: { id: "cat-1", name: "Seguros", color: "#FF5733", scope: "EXPENSE" },
  paymentMethod: null,
  autoDebit: null,
  calculated: null,
  hasCalculated: false,
  currency: "ARS",
  exchangeRate: 1,
  convertedAmountCents: 150000,
  simulated: false,
  calculatedChildren: [],
};

const fijoTrimestralAnulado: MovementItem = { ...fijoTrimestral, skipped: true };

const VIEW_MONTH = "2026-04";

function renderModal(movement: MovementItem = fijoTrimestral, onClose = vi.fn()) {
  return render(
    <RecurringSkipScopeModal movement={movement} viewMonth={VIEW_MONTH} onClose={onClose} />,
  );
}

function openRangeScope() {
  fireEvent.click(screen.getByRole("radio", { name: /un rango de meses/i }));
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockUseRecurring.mockReturnValue({
    createRecurring: vi.fn(),
    updateRecurring: vi.fn(),
    deleteRecurring: vi.fn(),
    skipRecurring: mockSkipRecurring,
    skipRecurringRange: mockSkipRecurringRange,
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
    isSkipping: false,
    isSkippingRange: false,
  });
});

// ─── Preselección de "este mes" ───────────────────────────────────────────────

describe("RecurringSkipScopeModal — preselección de 'este mes'", () => {
  it("el radio 'Solo este mes' arranca marcado (aria-checked=true)", () => {
    renderModal();
    const radioMonth = screen.getByRole("radio", { name: /solo este mes/i });
    expect(radioMonth).toHaveAttribute("aria-checked", "true");
  });

  it("el radio 'Un rango de meses' arranca NO marcado", () => {
    renderModal();
    const radioRange = screen.getByRole("radio", { name: /un rango de meses/i });
    expect(radioRange).toHaveAttribute("aria-checked", "false");
  });

  it("el foco inicial cae en el radio 'Solo este mes' (no en el botón primario)", () => {
    renderModal();
    const radioMonth = screen.getByRole("radio", { name: /solo este mes/i });
    expect(document.activeElement).toBe(radioMonth);
  });

  it("con la opción 'este mes' elegida, el bloque de rango NO está en el DOM (sin <select>)", () => {
    renderModal();
    expect(document.querySelectorAll("select").length).toBe(0);
  });

  it("el sub del radio 'Solo este mes' muestra el mes visualizado con nombre", () => {
    renderModal();
    const radioMonth = screen.getByRole("radio", { name: /solo este mes/i });
    expect(radioMonth).toHaveTextContent("Abril 2026");
  });
});

// ─── Recálculo de "Hasta" al mover "Desde" (frecuencia trimestral) ───────────

describe("RecurringSkipScopeModal — recálculo de 'Hasta' al mover 'Desde'", () => {
  it("al elegir 'Un rango de meses' aparecen los 2 <select>, Desde = Hasta = mes visualizado", () => {
    renderModal();
    openRangeScope();

    const desde = screen.getByLabelText("Desde") as HTMLSelectElement;
    const hasta = screen.getByLabelText("Hasta") as HTMLSelectElement;
    expect(desde.value).toBe(VIEW_MONTH);
    expect(hasta.value).toBe(VIEW_MONTH);
  });

  it("mover 'Desde' a un mes POSTERIOR al 'Hasta' vigente arrastra 'Hasta' junto con él", () => {
    renderModal();
    openRangeScope();

    const desde = screen.getByLabelText("Desde") as HTMLSelectElement;
    const hasta = screen.getByLabelText("Hasta") as HTMLSelectElement;

    fireEvent.change(desde, { target: { value: "2026-08" } });

    expect(desde.value).toBe("2026-08");
    expect(hasta.value).toBe("2026-08");
    expect(screen.getByText(/el .hasta. se movió junto con el .desde./i)).toBeInTheDocument();
  });

  it("mover 'Desde' hacia atrás de forma que el rango supere 24 meses clampea 'Hasta' al máximo", () => {
    renderModal();
    openRangeScope();

    const desde = screen.getByLabelText("Desde") as HTMLSelectElement;
    const hasta = screen.getByLabelText("Hasta") as HTMLSelectElement;

    // Desde = Hasta = 2026-04 al abrir el rango. Llevar Hasta al máximo
    // representable desde ese Desde: 2026-04 + 23 meses = 2028-03.
    fireEvent.change(hasta, { target: { value: "2028-03" } });
    expect(hasta.value).toBe("2028-03");

    // Mover Desde 3 meses atrás (2026-01) reduce el techo de "Hasta" a
    // 2026-01 + 23 = 2027-12 — el valor vigente (2028-03) queda afuera.
    fireEvent.change(desde, { target: { value: "2026-01" } });

    expect(desde.value).toBe("2026-01");
    expect(hasta.value).toBe("2027-12");
    expect(screen.getByText(/el .hasta. se ajustó al máximo de 24 meses/i)).toBeInTheDocument();
  });

  it("la nota de límite está siempre presente (copy base antes de cualquier ajuste)", () => {
    renderModal();
    openRangeScope();
    expect(
      screen.getByText(/hasta 24 meses por operación/i),
    ).toBeInTheDocument();
  });

  it("volver a interactuar con un selector restaura el copy base tras un ajuste", () => {
    renderModal();
    openRangeScope();

    const desde = screen.getByLabelText("Desde") as HTMLSelectElement;
    fireEvent.change(desde, { target: { value: "2026-08" } });
    expect(screen.getByText(/se movió junto con/i)).toBeInTheDocument();

    // Cualquier cambio de "Hasta" vuelve al copy base.
    const hasta = screen.getByLabelText("Hasta") as HTMLSelectElement;
    fireEvent.change(hasta, { target: { value: hasta.value } });
    expect(screen.getByText(/hasta 24 meses por operación/i)).toBeInTheDocument();
  });
});

// ─── Conteo de apariciones — frecuencia NO mensual (trimestral) ──────────────

describe("RecurringSkipScopeModal — conteo de apariciones (frecuencia trimestral)", () => {
  it("un rango de un solo mes de aparición dice 'Se anula una aparición: {mes}'", () => {
    renderModal();
    openRangeScope();
    // Desde = Hasta = 2026-04 (aparición real) por default.
    expect(
      screen.getByText((_, el) => el?.textContent === "Se anula una aparición: Abr 2026.", {
        selector: "p",
      }),
    ).toBeInTheDocument();
  });

  it("un rango con varias apariciones reales dice 'Se anulan N apariciones, entre X y Y' (no cuenta los meses sin aparición)", () => {
    renderModal();
    openRangeScope();

    const desde = screen.getByLabelText("Desde") as HTMLSelectElement;
    const hasta = screen.getByLabelText("Hasta") as HTMLSelectElement;
    // 2026-03 a 2026-12 (10 meses de calendario) — solo Abr/Jul/Oct son
    // apariciones reales del trimestral anclado en Ene 2025 (RN-016).
    fireEvent.change(desde, { target: { value: "2026-03" } });
    fireEvent.change(hasta, { target: { value: "2026-12" } });

    expect(
      screen.getByText(
        (_, el) => el?.textContent === "Se anulan 3 apariciones, entre Abr 2026 y Oct 2026.",
        { selector: "p" },
      ),
    ).toBeInTheDocument();
  });

  it("la caja de resultado tiene aria-live='polite'", () => {
    renderModal();
    openRangeScope();
    const resultBox = screen.getByText(/se anula/i).closest("[aria-live]");
    expect(resultBox).toHaveAttribute("aria-live", "polite");
  });
});

// ─── Estado de cero apariciones ───────────────────────────────────────────────

describe("RecurringSkipScopeModal — estado de cero apariciones", () => {
  function selectZeroAppearanceRange() {
    const desde = screen.getByLabelText("Desde") as HTMLSelectElement;
    const hasta = screen.getByLabelText("Hasta") as HTMLSelectElement;
    // Feb–Mar 2026: ninguna aparición del trimestral anclado en Ene 2025.
    fireEvent.change(desde, { target: { value: "2026-02" } });
    fireEvent.change(hasta, { target: { value: "2026-03" } });
  }

  it("muestra el copy neutro de cero apariciones, mencionando nombre y frecuencia", () => {
    renderModal();
    openRangeScope();
    selectZeroAppearanceRange();

    expect(
      screen.getByText(/el rango no incluye ninguna aparición/i),
    ).toBeInTheDocument();
    // El nombre y la frecuencia aparecen dos veces: en la caja de identidad
    // (§2.2) y de nuevo dentro del copy de cero apariciones (§3.2).
    expect(screen.getAllByText("Seguro del auto").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("trimestral").length).toBeGreaterThanOrEqual(2);
  });

  it("el botón primario queda deshabilitado con aria-describedby a la caja de resultado", () => {
    renderModal();
    openRangeScope();
    selectZeroAppearanceRange();

    const confirmBtn = screen.getByRole("button", { name: /^anular$/i });
    expect(confirmBtn).toBeDisabled();
    expect(confirmBtn).toHaveAttribute("aria-describedby");
  });

  it("el botón primario NUNCA está deshabilitado en el alcance 'Solo este mes'", () => {
    renderModal();
    // Sigue en el alcance "este mes" (preseleccionado) — no hay forma de
    // llegar a cero apariciones en ese alcance (precondición del RF).
    const confirmBtn = screen.getByRole("button", { name: /^anular$/i });
    expect(confirmBtn).not.toBeDisabled();
  });

  it("confirmar en cero apariciones no invoca ninguna mutación (no-op silencioso evitado)", () => {
    renderModal();
    openRangeScope();
    selectZeroAppearanceRange();

    const confirmBtn = screen.getByRole("button", { name: /^anular$/i });
    fireEvent.click(confirmBtn);

    expect(mockSkipRecurringRange).not.toHaveBeenCalled();
  });
});

// ─── Los dos verbos: anular / des-anular ─────────────────────────────────────

describe("RecurringSkipScopeModal — verbo 'Anular' (movimiento activo)", () => {
  it("título del modal es 'Anular apariciones'", () => {
    renderModal(fijoTrimestral);
    expect(screen.getByRole("heading", { name: /anular apariciones/i })).toBeInTheDocument();
  });

  it("botón primario dice 'Anular'", () => {
    renderModal(fijoTrimestral);
    expect(screen.getByRole("button", { name: /^anular$/i })).toBeInTheDocument();
  });

  it("confirmar 'este mes' llama a skipRecurring(id, viewMonth) — sin action, es un toggle", async () => {
    mockSkipRecurring.mockResolvedValue({ success: true, skipped: true });
    const onClose = vi.fn();
    renderModal(fijoTrimestral, onClose);

    fireEvent.click(screen.getByRole("button", { name: /^anular$/i }));

    await waitFor(() => {
      expect(mockSkipRecurring).toHaveBeenCalledWith("rec-1", VIEW_MONTH);
      expect(onClose).toHaveBeenCalled();
    });
    expect(mockSkipRecurringRange).not.toHaveBeenCalled();
  });

  it("confirmar un rango llama a skipRecurringRange con action='skip' (fijo activo)", async () => {
    mockSkipRecurringRange.mockResolvedValue({ success: true, affectedCount: 1 });
    renderModal(fijoTrimestral);
    openRangeScope();

    fireEvent.click(screen.getByRole("button", { name: /^anular$/i }));

    await waitFor(() => {
      expect(mockSkipRecurringRange).toHaveBeenCalledWith("rec-1", {
        from: VIEW_MONTH,
        to: VIEW_MONTH,
        action: "skip",
      });
    });
  });
});

describe("RecurringSkipScopeModal — verbo 'Des-anular' (movimiento anulado)", () => {
  it("título del modal es 'Des-anular apariciones'", () => {
    renderModal(fijoTrimestralAnulado);
    expect(screen.getByRole("heading", { name: /des-anular apariciones/i })).toBeInTheDocument();
  });

  it("botón primario dice 'Des-anular'", () => {
    renderModal(fijoTrimestralAnulado);
    expect(screen.getByRole("button", { name: /^des-anular$/i })).toBeInTheDocument();
  });

  it("confirmar 'este mes' llama a skipRecurring(id, viewMonth) igual que al anular (mismo toggle)", async () => {
    mockSkipRecurring.mockResolvedValue({ success: true, skipped: false });
    const onClose = vi.fn();
    renderModal(fijoTrimestralAnulado, onClose);

    fireEvent.click(screen.getByRole("button", { name: /^des-anular$/i }));

    await waitFor(() => {
      expect(mockSkipRecurring).toHaveBeenCalledWith("rec-1", VIEW_MONTH);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("confirmar un rango llama a skipRecurringRange con action='unskip' (fijo anulado)", async () => {
    mockSkipRecurringRange.mockResolvedValue({ success: true, affectedCount: 1 });
    renderModal(fijoTrimestralAnulado);
    openRangeScope();

    fireEvent.click(screen.getByRole("button", { name: /^des-anular$/i }));

    await waitFor(() => {
      expect(mockSkipRecurringRange).toHaveBeenCalledWith("rec-1", {
        from: VIEW_MONTH,
        to: VIEW_MONTH,
        action: "unskip",
      });
    });
  });
});

// ─── Toast: ausente en "este mes", presente en rango ─────────────────────────

describe("RecurringSkipScopeModal — toast de éxito por alcance", () => {
  it("alcance 'este mes': éxito sin toast (el efecto se ve en la fila)", async () => {
    mockSkipRecurring.mockResolvedValue({ success: true, skipped: true });
    renderModal(fijoTrimestral);

    fireEvent.click(screen.getByRole("button", { name: /^anular$/i }));

    await waitFor(() => {
      expect(mockSkipRecurring).toHaveBeenCalled();
    });
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it("alcance rango: éxito CON toast, singular sin numeral", async () => {
    mockSkipRecurringRange.mockResolvedValue({ success: true, affectedCount: 1 });
    renderModal(fijoTrimestral);
    openRangeScope();

    fireEvent.click(screen.getByRole("button", { name: /^anular$/i }));

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Anulada una aparición de ‘Seguro del auto’: Abr 2026.",
      );
    });
  });

  it("alcance rango: éxito CON toast, plural con N", async () => {
    mockSkipRecurringRange.mockResolvedValue({ success: true, affectedCount: 3 });
    renderModal(fijoTrimestral);
    openRangeScope();

    const desde = screen.getByLabelText("Desde") as HTMLSelectElement;
    const hasta = screen.getByLabelText("Hasta") as HTMLSelectElement;
    fireEvent.change(desde, { target: { value: "2026-03" } });
    fireEvent.change(hasta, { target: { value: "2026-12" } });

    fireEvent.click(screen.getByRole("button", { name: /^anular$/i }));

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Anuladas 3 apariciones de ‘Seguro del auto’.",
      );
    });
  });

  it("alcance rango: toast espejo con 'Des-anuladas' cuando el fijo está anulado", async () => {
    mockSkipRecurringRange.mockResolvedValue({ success: true, affectedCount: 1 });
    renderModal(fijoTrimestralAnulado);
    openRangeScope();

    fireEvent.click(screen.getByRole("button", { name: /^des-anular$/i }));

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Des-anulada una aparición de ‘Seguro del auto’: Abr 2026.",
      );
    });
  });
});

// ─── Error ────────────────────────────────────────────────────────────────────

describe("RecurringSkipScopeModal — error", () => {
  it("ante error del backend, el modal queda abierto (no llama a onClose)", async () => {
    mockSkipRecurring.mockResolvedValue({ success: false, error: "Boom" });
    const onClose = vi.fn();
    renderModal(fijoTrimestral, onClose);

    fireEvent.click(screen.getByRole("button", { name: /^anular$/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Boom");
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
