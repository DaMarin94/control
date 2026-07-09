/**
 * Tests del modal de creación y edición de métodos de pago.
 * Verifica: validación (nombre, tipo obligatorio sin preselección), flujo de creación
 * exitosa, flujo 409 activo, flujo 409 reactivable (dispara prompt), edición exitosa,
 * edición con colisión, campos condicionales por tipo, icon-picker, y la sección
 * "Predeterminado para" (RF-PM-007 — la edición del default vive acá, ver
 * docs/design.md §"Predeterminado por estructura — configuración en el modal…").
 * Espejo de tests/app/categorias/category-form-modal.test.tsx.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentMethodFormModal } from "@/app/(app)/metodos-pago/payment-method-form-modal";
import { ToastProvider } from "@/components/ui/toast";
import type { PaymentMethod } from "@/types/payment-method";
import type { UserPreferences } from "@/types/auth";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-payment-methods", () => ({
  usePaymentMethods: vi.fn(),
}));

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: vi.fn(),
}));

import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { usePreferences } from "@/hooks/use-preferences";

const mockUsePaymentMethods = vi.mocked(usePaymentMethods);
const mockUsePreferences = vi.mocked(usePreferences);

const mockCreditMethod: PaymentMethod = {
  id: "pm-1",
  userId: "user-1",
  name: "Visa Banco Nación",
  type: "CREDIT",
  icon: "visa",
  closingDay: 15,
  paymentDay: 10,
  deletedAt: null,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  movementCount: 3,
};

const mockCashMethod: PaymentMethod = {
  id: "pm-2",
  userId: "user-1",
  name: "Efectivo",
  type: "CASH",
  icon: "cash",
  closingDay: null,
  paymentDay: null,
  deletedAt: null,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  movementCount: 1,
};

function renderModal(props: {
  paymentMethod: PaymentMethod | null;
  onClose?: () => void;
}) {
  const onClose = props.onClose ?? vi.fn();
  return render(
    <ToastProvider>
      <PaymentMethodFormModal paymentMethod={props.paymentMethod} onClose={onClose} />
    </ToastProvider>,
  );
}

function mockPreferences(
  preferences: UserPreferences,
  setPreferences = vi.fn().mockResolvedValue({ success: true }),
) {
  mockUsePreferences.mockReturnValue({
    preferences,
    setPreferences,
    isSaving: false,
    isLoading: false,
    isError: false,
    error: null,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PaymentMethodFormModal", () => {
  const mockCreatePaymentMethod = vi.fn();
  const mockUpdatePaymentMethod = vi.fn();
  const mockReactivatePaymentMethod = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePaymentMethods.mockReturnValue({
      paymentMethods: [mockCreditMethod, mockCashMethod],
      isLoading: false,
      isError: false,
      error: null,
      createPaymentMethod: mockCreatePaymentMethod,
      updatePaymentMethod: mockUpdatePaymentMethod,
      deletePaymentMethod: vi.fn(),
      reactivatePaymentMethod: mockReactivatePaymentMethod,
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
      isReactivating: false,
    });
    mockPreferences({});
  });

  // ─── Validación del formulario ───────────────────────────────────────────────

  it("muestra error si el nombre está vacío al intentar crear", async () => {
    const user = userEvent.setup();
    renderModal({ paymentMethod: null });

    await user.click(screen.getByRole("button", { name: /crear método de pago/i }));

    await waitFor(() => {
      expect(screen.getByText(/el nombre es requerido/i)).toBeInTheDocument();
    });

    expect(mockCreatePaymentMethod).not.toHaveBeenCalled();
  });

  it("muestra error si no se elige un tipo al intentar crear", async () => {
    const user = userEvent.setup();
    renderModal({ paymentMethod: null });

    await user.type(screen.getByLabelText(/nombre/i), "Efectivo");
    await user.click(screen.getByRole("button", { name: /crear método de pago/i }));

    await waitFor(() => {
      expect(screen.getByText(/elegí un tipo/i)).toBeInTheDocument();
    });

    expect(mockCreatePaymentMethod).not.toHaveBeenCalled();
  });

  it("renderiza modo crear: título 'Nuevo método de pago', sin tipo preseleccionado", () => {
    renderModal({ paymentMethod: null });

    expect(screen.getByText(/nuevo método de pago/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /crear método de pago/i })).toBeInTheDocument();
    // Ninguno de los tres botones de tipo debe estar en estado seleccionado (border-accent)
    const credito = screen.getByRole("button", { name: /^crédito$/i });
    expect(credito.className).not.toMatch(/border-accent/);
  });

  it("renderiza modo editar: título 'Editar método de pago' con campos precargados", () => {
    renderModal({ paymentMethod: mockCreditMethod });

    expect(screen.getByText(/editar método de pago/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Visa Banco Nación")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /guardar cambios/i })).toBeInTheDocument();
  });

  // ─── Campos condicionales por tipo ───────────────────────────────────────────

  it("tipo Crédito: muestra día de cierre y día de cobro", async () => {
    const user = userEvent.setup();
    renderModal({ paymentMethod: null });

    await user.click(screen.getByRole("button", { name: /^crédito$/i }));

    expect(screen.getByLabelText(/día de cierre/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/día de cobro/i)).toBeInTheDocument();
    expect(screen.queryByText(/débito automático/i)).not.toBeInTheDocument();
  });

  it("tipo Débito: no muestra campos condicionales (idéntico a Efectivo)", async () => {
    const user = userEvent.setup();
    renderModal({ paymentMethod: null });

    await user.click(screen.getByRole("button", { name: /^débito$/i }));

    expect(screen.queryByLabelText(/día de cierre/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/débito automático/i)).not.toBeInTheDocument();
  });

  it("tipo Efectivo: no muestra campos condicionales", async () => {
    const user = userEvent.setup();
    renderModal({ paymentMethod: null });

    await user.click(screen.getByRole("button", { name: /^efectivo$/i }));

    expect(screen.queryByLabelText(/día de cierre/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/débito automático/i)).not.toBeInTheDocument();
  });

  // ─── Flujo crear exitoso ─────────────────────────────────────────────────────

  it("flujo crear (Efectivo): llama a createPaymentMethod con los datos correctos y cierra", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockCreatePaymentMethod.mockResolvedValue({ success: true, paymentMethod: mockCreditMethod });

    renderModal({ paymentMethod: null, onClose });

    await user.type(screen.getByLabelText(/nombre/i), "Billetera");
    await user.click(screen.getByRole("button", { name: /^efectivo$/i }));
    await user.click(screen.getByRole("button", { name: /crear método de pago/i }));

    await waitFor(() => {
      expect(mockCreatePaymentMethod).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Billetera",
          type: "CASH",
          icon: "card",
        }),
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("flujo crear (Crédito con días): envía closingDay y paymentDay", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockCreatePaymentMethod.mockResolvedValue({ success: true, paymentMethod: mockCreditMethod });

    renderModal({ paymentMethod: null, onClose });

    await user.type(screen.getByLabelText(/nombre/i), "Visa Banco Nación");
    await user.click(screen.getByRole("button", { name: /^crédito$/i }));
    await user.type(screen.getByLabelText(/día de cierre/i), "15");
    await user.type(screen.getByLabelText(/día de cobro/i), "10");
    await user.click(screen.getByRole("button", { name: /crear método de pago/i }));

    await waitFor(() => {
      expect(mockCreatePaymentMethod).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Visa Banco Nación",
          type: "CREDIT",
          closingDay: 15,
          paymentDay: 10,
        }),
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  // ─── Flujo 409 colisión con activo ───────────────────────────────────────────

  it("409 colisión activa: muestra error en el campo nombre sin cerrar el modal", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockCreatePaymentMethod.mockResolvedValue({ success: false, nameConflict: true });

    renderModal({ paymentMethod: null, onClose });

    await user.type(screen.getByLabelText(/nombre/i), "Existente");
    await user.click(screen.getByRole("button", { name: /^efectivo$/i }));
    await user.click(screen.getByRole("button", { name: /crear método de pago/i }));

    await waitFor(() => {
      expect(screen.getByText(/ya existe un método de pago activo con ese nombre/i)).toBeInTheDocument();
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("Existente")).toBeInTheDocument();
  });

  // ─── Flujo 409 reactivable ────────────────────────────────────────────────────

  it("409 reactivable: muestra el prompt de reactivación con la configuración original", async () => {
    const user = userEvent.setup();
    mockCreatePaymentMethod.mockResolvedValue({
      success: false,
      reactivable: {
        id: "pm-deleted-1",
        name: "Visa Banco Nación",
        type: "CREDIT",
        icon: "visa",
      },
    });

    renderModal({ paymentMethod: null });

    await user.type(screen.getByLabelText(/nombre/i), "Visa Banco Nación");
    await user.click(screen.getByRole("button", { name: /^crédito$/i }));
    await user.click(screen.getByRole("button", { name: /crear método de pago/i }));

    await waitFor(() => {
      expect(screen.getByText(/método de pago eliminado encontrado/i)).toBeInTheDocument();
      expect(screen.getByText(/configuración original/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^reactivar$/i })).toBeInTheDocument();
    });
  });

  it("prompt de reactivación: Cancelar vuelve al formulario sin crear nada", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockCreatePaymentMethod.mockResolvedValue({
      success: false,
      reactivable: {
        id: "pm-deleted-1",
        name: "Visa Banco Nación",
        type: "CREDIT",
        icon: "visa",
      },
    });

    renderModal({ paymentMethod: null, onClose });

    await user.type(screen.getByLabelText(/nombre/i), "Visa Banco Nación");
    await user.click(screen.getByRole("button", { name: /^crédito$/i }));
    await user.click(screen.getByRole("button", { name: /crear método de pago/i }));

    await waitFor(() => {
      expect(screen.getByText(/método de pago eliminado encontrado/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /cancelar/i }));

    await waitFor(() => {
      expect(screen.getByText(/nuevo método de pago/i)).toBeInTheDocument();
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(mockReactivatePaymentMethod).not.toHaveBeenCalled();
  });

  it("prompt de reactivación: Reactivar llama a reactivatePaymentMethod con el id correcto", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockCreatePaymentMethod.mockResolvedValue({
      success: false,
      reactivable: {
        id: "pm-deleted-1",
        name: "Visa Banco Nación",
        type: "CREDIT",
        icon: "visa",
      },
    });
    mockReactivatePaymentMethod.mockResolvedValue({ success: true, paymentMethod: mockCreditMethod });

    renderModal({ paymentMethod: null, onClose });

    await user.type(screen.getByLabelText(/nombre/i), "Visa Banco Nación");
    await user.click(screen.getByRole("button", { name: /^crédito$/i }));
    await user.click(screen.getByRole("button", { name: /crear método de pago/i }));

    await waitFor(() => {
      expect(screen.getByText(/método de pago eliminado encontrado/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /^reactivar$/i }));

    await waitFor(() => {
      expect(mockReactivatePaymentMethod).toHaveBeenCalledWith("pm-deleted-1");
      expect(onClose).toHaveBeenCalled();
    });
  });

  // ─── Flujo editar exitoso ─────────────────────────────────────────────────────

  it("flujo editar: llama a updatePaymentMethod con el id y datos correctos", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const updated = { ...mockCreditMethod, name: "Visa Banco Galicia" };
    mockUpdatePaymentMethod.mockResolvedValue({ success: true, paymentMethod: updated });

    renderModal({ paymentMethod: mockCreditMethod, onClose });

    const nameInput = screen.getByDisplayValue("Visa Banco Nación");
    await user.clear(nameInput);
    await user.type(nameInput, "Visa Banco Galicia");
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(mockUpdatePaymentMethod).toHaveBeenCalledWith(
        "pm-1",
        expect.objectContaining({ name: "Visa Banco Galicia", type: "CREDIT" }),
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("editar: al cambiar de Crédito a Débito, no envía días ni autoDebit (no es campo del método)", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockUpdatePaymentMethod.mockResolvedValue({ success: true, paymentMethod: mockCreditMethod });

    renderModal({ paymentMethod: mockCreditMethod, onClose });

    await user.click(screen.getByRole("button", { name: /^débito$/i }));
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      const call = mockUpdatePaymentMethod.mock.calls[0][1];
      expect(call.type).toBe("DEBIT");
      expect(call.closingDay).toBeUndefined();
      expect(call.paymentDay).toBeUndefined();
      expect(call.autoDebit).toBeUndefined();
    });
  });

  it("editar 409: muestra error de colisión en el campo nombre", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockUpdatePaymentMethod.mockResolvedValue({ success: false, nameConflict: true });

    renderModal({ paymentMethod: mockCreditMethod, onClose });

    const nameInput = screen.getByDisplayValue("Visa Banco Nación");
    await user.clear(nameInput);
    await user.type(nameInput, "Otra Existente");
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(screen.getByText(/ya existe un método de pago activo con ese nombre/i)).toBeInTheDocument();
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  // ─── Icon picker ──────────────────────────────────────────────────────────────

  it("muestra el bloque Ícono con el grid de celdas y SIN botón Aleatorio", () => {
    renderModal({ paymentMethod: null });

    expect(screen.getByText(/^ícono$/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /aleatorio/i })).not.toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: /seleccionar ícono/i })).toBeInTheDocument();
    // 12 claves del set curado (7 genéricos + 5 marcas)
    const cells = screen.getAllByRole("radio");
    expect(cells).toHaveLength(12);
  });

  it("arranca con 'card' pre-seleccionado en crear", () => {
    renderModal({ paymentMethod: null });

    const cardCell = screen.getByRole("radio", { name: "card" });
    expect(cardCell).toHaveAttribute("aria-checked", "true");
  });

  it("pre-selecciona el ícono actual del método en editar", () => {
    renderModal({ paymentMethod: mockCreditMethod }); // icon: "visa"

    const visaCell = screen.getByRole("radio", { name: "visa" });
    expect(visaCell).toHaveAttribute("aria-checked", "true");
  });

  it("al hacer clic en una celda de ícono, esa queda seleccionada y la anterior se deselecciona", async () => {
    const user = userEvent.setup();
    renderModal({ paymentMethod: null });

    const walletCell = screen.getByRole("radio", { name: "wallet" });
    await user.click(walletCell);

    expect(walletCell).toHaveAttribute("aria-checked", "true");
    const cardCell = screen.getByRole("radio", { name: "card" });
    expect(cardCell).toHaveAttribute("aria-checked", "false");
  });

  it("al crear con un ícono seleccionado manualmente, se envía ese ícono al backend", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockCreatePaymentMethod.mockResolvedValue({ success: true, paymentMethod: mockCreditMethod });

    renderModal({ paymentMethod: null, onClose });

    await user.click(screen.getByRole("radio", { name: "mastercard" }));
    await user.type(screen.getByLabelText(/nombre/i), "Mastercard Banco");
    await user.click(screen.getByRole("button", { name: /^crédito$/i }));
    await user.click(screen.getByRole("button", { name: /crear método de pago/i }));

    await waitFor(() => {
      expect(mockCreatePaymentMethod).toHaveBeenCalledWith(
        expect.objectContaining({ icon: "mastercard" }),
      );
    });
  });

  // ─── Sección "Predeterminado para" (RF-PM-007) ───────────────────────────────

  it("sección 'Predeterminado para': label, ayuda y 3 checkboxes destildados al crear", () => {
    renderModal({ paymentMethod: null });

    expect(screen.getByText("Predeterminado para")).toBeInTheDocument();
    expect(
      screen.getByText(/se prellena al crear un movimiento de esta estructura/i),
    ).toBeInTheDocument();

    expect(screen.getByRole("checkbox", { name: "Únicos" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByRole("checkbox", { name: "Fijos" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByRole("checkbox", { name: "Cuotas" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("editar: arranca reflejando el estado actual (tildado sin nota en su propio slot; nota 'Hoy:' en el ajeno)", () => {
    mockPreferences({
      defaultPaymentMethods: { unico: mockCreditMethod.id, fijo: mockCashMethod.id, cuota: null },
    });
    renderModal({ paymentMethod: mockCreditMethod });

    const unico = screen.getByRole("checkbox", { name: "Únicos" });
    expect(unico).toHaveAttribute("aria-checked", "true");
    expect(within(unico).queryByText(/^Hoy:/)).not.toBeInTheDocument();

    const fijo = screen.getByRole("checkbox", { name: "Fijos" });
    expect(fijo).toHaveAttribute("aria-checked", "false");
    expect(within(fijo).getByText(`Hoy: ${mockCashMethod.name}`)).toBeInTheDocument();

    const cuota = screen.getByRole("checkbox", { name: "Cuotas" });
    expect(cuota).toHaveAttribute("aria-checked", "false");
    expect(within(cuota).queryByText(/^Hoy:/)).not.toBeInTheDocument();
  });

  it("tildar un slot tomado por otro método hace desaparecer la nota 'Hoy:' en esta sesión (antes de guardar)", async () => {
    const user = userEvent.setup();
    mockPreferences({
      defaultPaymentMethods: { unico: null, fijo: mockCashMethod.id, cuota: null },
    });
    renderModal({ paymentMethod: mockCreditMethod });

    const fijo = screen.getByRole("checkbox", { name: "Fijos" });
    expect(within(fijo).getByText(`Hoy: ${mockCashMethod.name}`)).toBeInTheDocument();

    await user.click(fijo);

    expect(fijo).toHaveAttribute("aria-checked", "true");
    expect(within(fijo).queryByText(/^Hoy:/)).not.toBeInTheDocument();
  });

  it("editar: tildar un slot tomado por otro método y guardar escribe el blob con exclusividad", async () => {
    const user = userEvent.setup();
    const setPreferences = vi.fn().mockResolvedValue({ success: true });
    mockPreferences(
      { defaultPaymentMethods: { unico: mockCreditMethod.id, fijo: mockCashMethod.id, cuota: null } },
      setPreferences,
    );
    mockUpdatePaymentMethod.mockResolvedValue({ success: true, paymentMethod: mockCreditMethod });

    renderModal({ paymentMethod: mockCreditMethod });

    await user.click(screen.getByRole("checkbox", { name: "Fijos" }));
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(setPreferences).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultPaymentMethods: {
            unico: mockCreditMethod.id,
            fijo: mockCreditMethod.id,
            cuota: null,
          },
        }),
      );
    });
  });

  it("editar: destildar el propio slot lo libera (null) al guardar", async () => {
    const user = userEvent.setup();
    const setPreferences = vi.fn().mockResolvedValue({ success: true });
    mockPreferences(
      { defaultPaymentMethods: { unico: mockCreditMethod.id, fijo: null, cuota: null } },
      setPreferences,
    );
    mockUpdatePaymentMethod.mockResolvedValue({ success: true, paymentMethod: mockCreditMethod });

    renderModal({ paymentMethod: mockCreditMethod });

    await user.click(screen.getByRole("checkbox", { name: "Únicos" }));
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(setPreferences).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultPaymentMethods: { unico: null, fijo: null, cuota: null },
        }),
      );
    });
  });

  it("editar: sin tocar la sección de default, guardar NO reescribe el blob de preferencias", async () => {
    const user = userEvent.setup();
    const setPreferences = vi.fn().mockResolvedValue({ success: true });
    mockPreferences(
      { defaultPaymentMethods: { unico: mockCreditMethod.id, fijo: null, cuota: null } },
      setPreferences,
    );
    mockUpdatePaymentMethod.mockResolvedValue({ success: true, paymentMethod: mockCreditMethod });

    renderModal({ paymentMethod: mockCreditMethod });

    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(mockUpdatePaymentMethod).toHaveBeenCalled();
    });
    expect(setPreferences).not.toHaveBeenCalled();
  });

  it("crear: tildar 'Únicos' y crear el método asigna el default DESPUÉS de crear, con el id recién devuelto", async () => {
    const user = userEvent.setup();
    const setPreferences = vi.fn().mockResolvedValue({ success: true });
    mockPreferences(
      { defaultPaymentMethods: { unico: null, fijo: null, cuota: null } },
      setPreferences,
    );
    const created: PaymentMethod = { ...mockCreditMethod, id: "pm-new", name: "Nuevo Método" };
    mockCreatePaymentMethod.mockResolvedValue({ success: true, paymentMethod: created });

    renderModal({ paymentMethod: null });

    await user.type(screen.getByLabelText(/nombre/i), "Nuevo Método");
    await user.click(screen.getByRole("button", { name: /^crédito$/i }));
    await user.click(screen.getByRole("checkbox", { name: "Únicos" }));
    await user.click(screen.getByRole("button", { name: /crear método de pago/i }));

    await waitFor(() => {
      expect(mockCreatePaymentMethod).toHaveBeenCalled();
      expect(setPreferences).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultPaymentMethods: { unico: "pm-new", fijo: null, cuota: null },
        }),
      );
    });
  });

  it("crear sin tildar ningún checkbox no reescribe el blob de defaults", async () => {
    const user = userEvent.setup();
    const setPreferences = vi.fn().mockResolvedValue({ success: true });
    mockPreferences({}, setPreferences);
    mockCreatePaymentMethod.mockResolvedValue({ success: true, paymentMethod: mockCreditMethod });

    renderModal({ paymentMethod: null });

    await user.type(screen.getByLabelText(/nombre/i), "Billetera");
    await user.click(screen.getByRole("button", { name: /^efectivo$/i }));
    await user.click(screen.getByRole("button", { name: /crear método de pago/i }));

    await waitFor(() => {
      expect(mockCreatePaymentMethod).toHaveBeenCalled();
    });
    expect(setPreferences).not.toHaveBeenCalled();
  });

  it("dispara un toast `info` de reasignación (además del `success` de CRUD) cuando el guardado desplaza a otro método", async () => {
    const user = userEvent.setup();
    const setPreferences = vi.fn().mockResolvedValue({ success: true });
    mockPreferences(
      { defaultPaymentMethods: { unico: mockCreditMethod.id, fijo: mockCashMethod.id, cuota: null } },
      setPreferences,
    );
    mockUpdatePaymentMethod.mockResolvedValue({ success: true, paymentMethod: mockCreditMethod });

    renderModal({ paymentMethod: mockCreditMethod });

    await user.click(screen.getByRole("checkbox", { name: "Fijos" }));
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(screen.getByText(/método de pago actualizado correctamente/i)).toBeInTheDocument();
      expect(
        screen.getAllByText(`‘${mockCreditMethod.name}’ ahora es el predeterminado de Fijos.`)
          .length,
      ).toBeGreaterThan(0);
    });
  });

  it("NO dispara toast info cuando el guardado asigna un slot que estaba libre (sin desplazamiento)", async () => {
    const user = userEvent.setup();
    const setPreferences = vi.fn().mockResolvedValue({ success: true });
    mockPreferences(
      { defaultPaymentMethods: { unico: mockCreditMethod.id, fijo: null, cuota: null } },
      setPreferences,
    );
    mockUpdatePaymentMethod.mockResolvedValue({ success: true, paymentMethod: mockCreditMethod });

    renderModal({ paymentMethod: mockCreditMethod });

    await user.click(screen.getByRole("checkbox", { name: "Fijos" }));
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(screen.getByText(/método de pago actualizado correctamente/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/ahora es el predeterminado de/i)).not.toBeInTheDocument();
  });

  it("toast consolidado (uno solo, no uno por estructura) cuando desplaza más de una estructura del mismo método", async () => {
    const user = userEvent.setup();
    const setPreferences = vi.fn().mockResolvedValue({ success: true });
    mockPreferences(
      { defaultPaymentMethods: { unico: mockCashMethod.id, fijo: mockCashMethod.id, cuota: null } },
      setPreferences,
    );
    mockUpdatePaymentMethod.mockResolvedValue({ success: true, paymentMethod: mockCreditMethod });

    renderModal({ paymentMethod: mockCreditMethod });

    await user.click(screen.getByRole("checkbox", { name: "Únicos" }));
    await user.click(screen.getByRole("checkbox", { name: "Fijos" }));
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(
        screen.getAllByText(
          `‘${mockCreditMethod.name}’ ahora es el predeterminado de Únicos y Fijos.`,
        ).length,
      ).toBeGreaterThan(0);
    });
  });
});
