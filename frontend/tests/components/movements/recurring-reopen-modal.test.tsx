/**
 * Tests de RecurringReopenModal (RF-MF-008, docs/design.md §"Reabrir un fijo
 * terminado"). Mes en curso simulado: Sep 2026.
 *
 * Cubre: encuadre (título, identidad, stepper con piso, nota de piso, monto
 * precargado, foco inicial), caja de consecuencia (líneas 1/2/3, recálculo
 * con X, skeleton mientras llega el preview), reemplazos obligatorios (solo si
 * se exigen; validación al enviar; "Sin método de pago" como decisión válida),
 * payload (reemplazos solo cuando se requieren), toast con Deshacer y error.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RecurringReopenModal } from "@/components/movements/recurring-reopen-modal";
import type { MovementItem } from "@/types/movement";
import type { ReopenPreview } from "@/types/recurring";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/format", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/format")>();
  return { ...actual, getCurrentMonth: vi.fn(() => "2026-09") };
});

vi.mock("@/hooks/use-reopen-preview", () => ({ useReopenPreview: vi.fn() }));
vi.mock("@/hooks/use-reopen-recurring", () => ({ useReopenRecurring: vi.fn() }));
vi.mock("@/hooks/use-categories", () => ({ useCategories: vi.fn() }));
vi.mock("@/hooks/use-payment-methods", () => ({ usePaymentMethods: vi.fn() }));
vi.mock("@/hooks/use-history", () => ({
  useUndoHistory: vi.fn(() => ({ undo: vi.fn(), isUndoing: false })),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const stableToast = { success: mockToastSuccess, error: mockToastError, warning: vi.fn(), info: vi.fn() };
vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({ toast: stableToast })),
}));

import { useReopenPreview } from "@/hooks/use-reopen-preview";
import { useReopenRecurring } from "@/hooks/use-reopen-recurring";
import { useCategories } from "@/hooks/use-categories";
import { usePaymentMethods } from "@/hooks/use-payment-methods";

const mockUsePreview = vi.mocked(useReopenPreview);
const mockUseReopen = vi.mocked(useReopenRecurring);
const mockUseCategories = vi.mocked(useCategories);
const mockUsePaymentMethods = vi.mocked(usePaymentMethods);
const mockReopenRecurring = vi.fn();

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const cat = { id: "cat-1", name: "Salud", color: "#FF5733", scope: "EXPENSE" as const };

/** Gimnasio: mensual, Mar 2024 – Jun 2026 (endMonth = Jul 2026). */
const gimnasio: MovementItem = {
  id: "rec-1",
  origin: "fijo",
  type: "EXPENSE",
  amountCents: 150000,
  description: "Gimnasio",
  occurredAt: null,
  timezone: null,
  installment: null,
  frequency: 1,
  startMonth: "2024-03",
  endMonth: "2026-07",
  chainId: "chain-1",
  skipped: false,
  category: cat,
  paymentMethod: null,
  autoDebit: null,
  calculated: null,
  hasCalculated: false,
  currency: "ARS",
  exchangeRate: 1,
  convertedAmountCents: 150000,
  simulated: false,
  calculatedChildren: [],
  evolutionAvailable: false,
};

const basePreview: ReopenPreview = {
  chainId: "chain-1",
  endMonth: "2026-07",
  minReopenMonth: "2026-09",
  amountCents: 150000,
  currency: "ARS",
  category: { id: "cat-1", name: "Salud", color: "#FF5733", deleted: false },
  paymentMethod: null,
  requiresCategory: false,
  requiresPaymentMethod: false,
  mirrors: [],
};

const deletedCat = { id: "c9", name: "Impuestos", color: "#000", deleted: true };
const activeCat = { id: "c8", name: "Tasas", color: "#000", deleted: false };

function setPreview(preview: ReopenPreview | undefined, isError = false) {
  mockUsePreview.mockReturnValue({ data: preview, isError } as unknown as ReturnType<typeof useReopenPreview>);
}

function renderModal(movement: MovementItem = gimnasio, onClose = vi.fn()) {
  render(<RecurringReopenModal movement={movement} onClose={onClose} />);
  return { onClose };
}

function resultBox(): HTMLElement {
  return document.getElementById("reopen-result")!;
}

beforeEach(() => {
  vi.clearAllMocks();
  setPreview(basePreview);
  mockReopenRecurring.mockResolvedValue({ success: true, historyEntryId: "hist-1" });
  mockUseReopen.mockReturnValue({ reopenRecurring: mockReopenRecurring, isReopening: false });
  mockUseCategories.mockReturnValue({
    categories: [
      { id: "cat-2", name: "Deportes", scope: "EXPENSE" },
      { id: "cat-3", name: "Sueldo", scope: "INCOME" },
      { id: "cat-4", name: "Varios", scope: "BOTH" },
    ],
  } as unknown as ReturnType<typeof useCategories>);
  mockUsePaymentMethods.mockReturnValue({
    paymentMethods: [{ id: "pm-2", name: "Visa" }],
  } as unknown as ReturnType<typeof usePaymentMethods>);
});

// ─── Default ──────────────────────────────────────────────────────────────────

describe("RecurringReopenModal — default", () => {
  it("título, identidad con vigencia (fin = mes anterior a endMonth) y bajada", () => {
    renderModal();
    expect(screen.getByRole("heading", { name: "Reabrir movimiento fijo" })).toBeInTheDocument();
    expect(screen.getByText("Gimnasio")).toBeInTheDocument();
    expect(screen.getByText("Mar 2024 – Jun 2026")).toBeInTheDocument();
    expect(screen.getByText(/vuelve a aparecer desde el mes que elijas/i)).toBeInTheDocument();
  });

  it("el stepper arranca en el piso (mes en curso) con ‹ apagado y › activo", () => {
    renderModal();
    expect(screen.getByText("Septiembre 2026", { selector: "span[aria-live]" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mes anterior" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Mes siguiente" })).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("No puede ser anterior al mes en curso.")).toBeInTheDocument();
  });

  it("› avanza y ‹ vuelve, sin pasar del piso", () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));
    expect(screen.getByText("Octubre 2026", { selector: "span[aria-live]" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mes anterior" })).toHaveAttribute("aria-disabled", "false");
    fireEvent.click(screen.getByRole("button", { name: "Mes anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Mes anterior" }));
    expect(screen.getByText("Septiembre 2026", { selector: "span[aria-live]" })).toBeInTheDocument();
  });

  it("fin a futuro: el piso es endMonth y la nota lo explica; sin relleno", () => {
    setPreview({ ...basePreview, endMonth: "2026-12", minReopenMonth: "2026-12" });
    renderModal({ ...gimnasio, endMonth: "2026-12" });
    expect(screen.getByText("Diciembre 2026", { selector: "span[aria-live]" })).toBeInTheDocument();
    expect(
      screen.getByText("Lo más temprano es Dic 2026, el mes siguiente a su último mes."),
    ).toBeInTheDocument();
    expect(resultBox()).not.toHaveTextContent(/se anula/i);
  });

  it("monto precargado con el último monto y foco inicial en el input Monto", () => {
    renderModal();
    const input = screen.getByLabelText(/monto/i);
    expect(input).toHaveValue("1500");
    expect(input).toHaveFocus();
    expect(screen.getByText(/Rige desde Sept 2026\. Los meses anteriores conservan el monto/)).toBeInTheDocument();
  });

  it("footer: Cancelar y 'Reabrir' habilitado", () => {
    renderModal();
    expect(screen.getByRole("button", { name: "Reabrir" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  });

  it("Cancelar cierra sin reabrir", () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalled();
    expect(mockReopenRecurring).not.toHaveBeenCalled();
  });
});

// ─── Caja de consecuencia ─────────────────────────────────────────────────────

describe("RecurringReopenModal — caja de consecuencia", () => {
  it("línea 1 con la frecuencia y línea 2 con el relleno (2 apariciones Jul–Ago)", () => {
    renderModal();
    expect(resultBox()).toHaveAttribute("aria-live", "polite");
    expect(resultBox()).toHaveTextContent("Desde Sept 2026 aparece cada mes, sin fecha de fin.");
    expect(resultBox()).toHaveTextContent("Se anulan 2 apariciones, entre Jul 2026 y Ago 2026");
  });

  it("al subir X el relleno se recalcula (3 apariciones, Jul–Sep)", () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));
    expect(resultBox()).toHaveTextContent("Desde Oct 2026 aparece");
    expect(resultBox()).toHaveTextContent("Se anulan 3 apariciones, entre Jul 2026 y Sept 2026");
    expect(screen.getByText(/Rige desde Oct 2026/)).toBeInTheDocument();
  });

  it("una sola aparición: frase singular sin numeral", () => {
    renderModal({ ...gimnasio, endMonth: "2026-08" });
    expect(resultBox()).toHaveTextContent("Se anula una aparición: Ago 2026.");
  });

  it("frecuencia > 1 sin aparición en el hueco: no hay línea de relleno", () => {
    // Trimestral desde Mar 2024 (Jun, Sep, Dic…): el hueco [Jul, Ago] no tiene ninguna aparición.
    renderModal({ ...gimnasio, frequency: 3 });
    expect(resultBox()).toHaveTextContent("aparece cada tres meses");
    expect(resultBox()).not.toHaveTextContent(/se anula/i);
  });

  it("calculados en espejo: plural con nombres", () => {
    setPreview({
      ...basePreview,
      mirrors: [
        { chainId: "m1", description: "IVA", category: activeCat, requiresCategory: false },
        { chainId: "m2", description: null, category: activeCat, requiresCategory: false },
      ],
    });
    renderModal();
    expect(resultBox()).toHaveTextContent("También se reabren 2 calculados: IVA, Tasas.");
  });

  it("un calculado: frase singular", () => {
    setPreview({
      ...basePreview,
      mirrors: [{ chainId: "m1", description: "IVA", category: activeCat, requiresCategory: false }],
    });
    renderModal();
    expect(resultBox()).toHaveTextContent("También se reabre el calculado IVA.");
  });

  it("sin preview: abre con lo que tiene, primario deshabilitado y caja en aria-busy", () => {
    setPreview(undefined);
    renderModal();
    const primary = screen.getByRole("button", { name: "Reabrir" });
    expect(primary).toBeDisabled();
    expect(primary).toHaveAttribute("aria-describedby", "reopen-result");
    expect(resultBox()).toHaveAttribute("aria-busy", "true");
    expect(resultBox()).toHaveTextContent("Desde Sept 2026 aparece cada mes");
  });

  it("si el preview falla: cierra y avisa con toast de error", () => {
    setPreview(undefined, true);
    const { onClose } = renderModal();
    expect(mockToastError).toHaveBeenCalledWith("No se pudo preparar la reapertura.");
    expect(onClose).toHaveBeenCalled();
  });
});

// ─── Confirmar ────────────────────────────────────────────────────────────────

describe("RecurringReopenModal — confirmar", () => {
  it("envía solo currentMonth/reopenMonth/amountCents si no hay reemplazos requeridos", async () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Reabrir" }));
    await waitFor(() => expect(mockReopenRecurring).toHaveBeenCalled());
    expect(mockReopenRecurring).toHaveBeenCalledWith("rec-1", {
      currentMonth: "2026-09",
      reopenMonth: "2026-09",
      amountCents: 150000,
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("toast 'Reabierto: ‘{Nombre}’.' con Deshacer e identidad de grupo = chainId", async () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Reabrir" }));
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
    const [message, options] = mockToastSuccess.mock.calls[0]!;
    expect(message).toBe("Reabierto: ‘Gimnasio’.");
    expect(options.groupId).toBe("chain-1");
    expect(options.action.label).toBe("Deshacer");
  });

  it("monto editado y X movido viajan en el payload (coma decimal a centavos)", async () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));
    fireEvent.change(screen.getByLabelText(/monto/i), { target: { value: "2000,50" } });
    fireEvent.click(screen.getByRole("button", { name: "Reabrir" }));
    await waitFor(() => expect(mockReopenRecurring).toHaveBeenCalled());
    expect(mockReopenRecurring.mock.calls[0]![1]).toMatchObject({ reopenMonth: "2026-10", amountCents: 200050 });
  });

  it("monto vacío: error en el campo, foco en él y no se envía", async () => {
    renderModal();
    const input = screen.getByLabelText(/monto/i);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Reabrir" }));
    expect(await screen.findByText("Ingresá un monto mayor a 0")).toBeInTheDocument();
    expect(input).toHaveFocus();
    expect(mockReopenRecurring).not.toHaveBeenCalled();
  });

  it("Enter en el input Monto confirma", async () => {
    renderModal();
    fireEvent.keyDown(screen.getByLabelText(/monto/i), { key: "Enter" });
    await waitFor(() => expect(mockReopenRecurring).toHaveBeenCalled());
  });

  it("error al reabrir: toast de error y el modal queda abierto", async () => {
    mockReopenRecurring.mockResolvedValue({ success: false, error: "x" });
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Reabrir" }));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith("No se pudo reabrir el movimiento."));
    expect(onClose).not.toHaveBeenCalled();
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it("en curso: el primario dice 'Reabriendo…' y está deshabilitado", () => {
    mockUseReopen.mockReturnValue({ reopenRecurring: mockReopenRecurring, isReopening: true });
    renderModal();
    expect(screen.getByRole("button", { name: "Reabriendo…" })).toBeDisabled();
  });
});

// ─── Reemplazos ───────────────────────────────────────────────────────────────

describe("RecurringReopenModal — reemplazos obligatorios", () => {
  it("sin dados de baja el bloque no existe", () => {
    renderModal();
    expect(screen.queryByText("Elegí reemplazos")).not.toBeInTheDocument();
  });

  it("categoría dada de baja: select sin preselección, solo activas del tipo, nota 'Antes' y foco", () => {
    setPreview({
      ...basePreview,
      requiresCategory: true,
      category: { id: "cat-1", name: "Salud", color: "#FF5733", deleted: true },
    });
    renderModal();
    expect(screen.getByText("Elegí reemplazos")).toBeInTheDocument();
    const select = screen.getByLabelText(/categoría/i) as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual([
      "Elegí una categoría activa",
      "Deportes",
      "Varios",
    ]);
    expect(screen.getByText(/Antes:/)).toHaveTextContent("Antes: Salud, dada de baja.");
    expect(select).toHaveFocus();
  });

  it("confirmar con reemplazo vacío: error en el select y foco; al elegir se limpia y se envía", async () => {
    setPreview({
      ...basePreview,
      requiresCategory: true,
      category: { id: "cat-1", name: "Salud", color: "#FF5733", deleted: true },
    });
    renderModal();
    const select = screen.getByLabelText(/categoría/i) as HTMLSelectElement;
    fireEvent.click(screen.getByRole("button", { name: "Reabrir" }));
    expect(await screen.findByText("Elegí una categoría.")).toBeInTheDocument();
    expect(select).toHaveFocus();
    expect(mockReopenRecurring).not.toHaveBeenCalled();

    fireEvent.change(select, { target: { value: "cat-2" } });
    expect(screen.queryByText("Elegí una categoría.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reabrir" }));
    await waitFor(() => expect(mockReopenRecurring).toHaveBeenCalled());
    expect(mockReopenRecurring.mock.calls[0]![1]).toMatchObject({ categoryId: "cat-2" });
    expect(mockReopenRecurring.mock.calls[0]![1]).not.toHaveProperty("paymentMethodId");
  });

  it("método dado de baja: 'Sin método de pago' es una decisión válida y viaja como null", async () => {
    setPreview({
      ...basePreview,
      requiresPaymentMethod: true,
      paymentMethod: { id: "pm-1", name: "Débito viejo", icon: "card", deleted: true },
    });
    renderModal();
    const select = screen.getByLabelText(/método de pago/i) as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual([
      "Elegí un método",
      "Sin método de pago",
      "Visa",
    ]);
    expect(screen.getByText("Antes: Débito viejo, dado de baja.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reabrir" }));
    expect(await screen.findByText("Elegí un método de pago.")).toBeInTheDocument();

    fireEvent.change(select, { target: { value: "__none__" } });
    fireEvent.click(screen.getByRole("button", { name: "Reabrir" }));
    await waitFor(() => expect(mockReopenRecurring).toHaveBeenCalled());
    expect(mockReopenRecurring.mock.calls[0]![1]).toMatchObject({ paymentMethodId: null });
  });

  it("calculado con categoría dada de baja: grupo solo con Categoría y payload calculatedCategories", async () => {
    setPreview({
      ...basePreview,
      requiresPaymentMethod: true,
      paymentMethod: { id: "pm-1", name: "Débito viejo", icon: "card", deleted: true },
      mirrors: [
        { chainId: "m1", description: "IVA", category: deletedCat, requiresCategory: true },
        { chainId: "m2", description: "Otro", category: activeCat, requiresCategory: false },
      ],
    });
    renderModal();
    // El calculado con reemplazo tiene su grupo "↳ IVA"; el de categoría activa ("Otro") no.
    expect(screen.getByText("IVA", { selector: "p.font-semibold" })).toBeInTheDocument();
    expect(screen.queryByText("Otro", { selector: "p.font-semibold" })).not.toBeInTheDocument();
    // Un calculado nunca lleva Método de pago: un único select de método (el del fijo).
    expect(screen.getAllByLabelText(/método de pago/i)).toHaveLength(1);

    fireEvent.change(screen.getByLabelText(/método de pago/i), { target: { value: "pm-2" } });
    const mirrorSelect = screen.getByLabelText(/categoría/i) as HTMLSelectElement;
    // Calculado: sin chequeo de scope → todas las categorías activas.
    expect(Array.from(mirrorSelect.options).map((o) => o.textContent)).toEqual([
      "Elegí una categoría activa",
      "Deportes",
      "Sueldo",
      "Varios",
    ]);
    fireEvent.change(mirrorSelect, { target: { value: "cat-3" } });
    fireEvent.click(screen.getByRole("button", { name: "Reabrir" }));
    await waitFor(() => expect(mockReopenRecurring).toHaveBeenCalled());
    expect(mockReopenRecurring.mock.calls[0]![1]).toMatchObject({
      paymentMethodId: "pm-2",
      calculatedCategories: [{ chainId: "m1", categoryId: "cat-3" }],
    });
  });
});

// ─── Moneda ───────────────────────────────────────────────────────────────────

describe("RecurringReopenModal — fijo en otra moneda", () => {
  it("el prefijo del monto muestra la moneda del fijo y no hay campo de cotización", () => {
    setPreview({ ...basePreview, currency: "USD", amountCents: 5000 });
    renderModal({ ...gimnasio, currency: "USD", exchangeRate: 1200, amountCents: 5000 });
    expect(screen.getByText("US$")).toBeInTheDocument();
    expect(screen.queryByLabelText(/cotización/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/monto/i)).toHaveValue("50");
  });
});
