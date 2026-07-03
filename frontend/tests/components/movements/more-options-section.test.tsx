/**
 * Tests de MoreOptionsSection — disclosure único "Más opciones" del form de
 * movimiento (P4), que agrupa moneda+cotización y método de pago + su checkbox
 * condicional "Débito automático" (docs/design.md §4 "Disclosure 'Más opciones'
 * del form — moneda+cotización + método de pago").
 *
 * Cubre:
 * - Trigger "Más opciones" con aria-expanded/aria-controls, arranca colapsado.
 * - Resumen colapsado combinado: moneda (siempre) + método (solo si hay uno elegido).
 * - Cuerpo expandido: sub-bloque moneda+cotización, divisor, sub-bloque método +
 *   checkbox "Débito automático" condicional.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MoreOptionsSection } from "@/components/movements/more-options-section";
import type { MoreOptionsSectionProps } from "@/components/movements/more-options-section";
import type { PaymentMethod } from "@/types/payment-method";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-payment-methods", () => ({
  usePaymentMethods: vi.fn(),
}));

import { usePaymentMethods } from "@/hooks/use-payment-methods";
const mockUsePaymentMethods = vi.mocked(usePaymentMethods);

const mockDebitMethod: PaymentMethod = {
  id: "pm-debit-1",
  userId: "user-1",
  name: "Débito Banco Nación",
  type: "DEBIT",
  icon: "card",
  closingDay: null,
  paymentDay: null,
  deletedAt: null,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  movementCount: 0,
};

const mockCreditMethod: PaymentMethod = {
  id: "pm-credit-1",
  userId: "user-1",
  name: "Visa Banco Nación",
  type: "CREDIT",
  icon: "visa",
  closingDay: 15,
  paymentDay: 10,
  deletedAt: null,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  movementCount: 0,
};

function mockPaymentMethodsReturn(paymentMethods: PaymentMethod[]) {
  mockUsePaymentMethods.mockReturnValue({
    paymentMethods,
    isLoading: false,
    isError: false,
    error: null,
    createPaymentMethod: vi.fn(),
    updatePaymentMethod: vi.fn(),
    deletePaymentMethod: vi.fn(),
    reactivatePaymentMethod: vi.fn(),
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
    isReactivating: false,
  });
}

// ─── Helper: wrapper controlado ────────────────────────────────────────────────

type PartialProps = Partial<
  Pick<
    MoreOptionsSectionProps,
    "currency" | "defaultCurrency" | "exchangeRateInput" | "paymentMethodId" | "autoDebit"
  >
>;

function ControlledMoreOptionsSection(initial: PartialProps) {
  const [currency, setCurrency] = useState(initial.currency ?? "ARS");
  const [exchangeRateInput, setExchangeRateInput] = useState(initial.exchangeRateInput ?? "");
  const [paymentMethodId, setPaymentMethodId] = useState(initial.paymentMethodId ?? "");
  const [autoDebit, setAutoDebit] = useState(initial.autoDebit ?? false);

  return (
    <MoreOptionsSection
      idPrefix="tx"
      currency={currency}
      exchangeRateInput={exchangeRateInput}
      defaultCurrency={initial.defaultCurrency ?? "ARS"}
      isExchangeRateModified={false}
      onCurrencyChange={setCurrency}
      onExchangeRateChange={setExchangeRateInput}
      paymentMethodId={paymentMethodId}
      onPaymentMethodChange={setPaymentMethodId}
      autoDebit={autoDebit}
      onAutoDebitChange={setAutoDebit}
    />
  );
}

function renderSection(props: PartialProps = {}) {
  return render(<ControlledMoreOptionsSection {...props} />);
}

function getTrigger() {
  return screen.getByRole("button", { name: /más opciones/i });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("MoreOptionsSection — trigger y disclosure", () => {
  it("muestra el trigger con el texto 'Más opciones'", () => {
    mockPaymentMethodsReturn([]);
    renderSection();
    expect(getTrigger()).toBeInTheDocument();
  });

  it("arranca SIEMPRE colapsado (aria-expanded=false)", () => {
    mockPaymentMethodsReturn([]);
    renderSection();
    expect(getTrigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("arranca colapsado incluso con moneda≠default y método elegido", () => {
    mockPaymentMethodsReturn([mockDebitMethod]);
    renderSection({ currency: "USD", defaultCurrency: "ARS", paymentMethodId: "pm-debit-1" });
    expect(getTrigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("al hacer click se expande (aria-expanded=true)", () => {
    mockPaymentMethodsReturn([]);
    renderSection();
    fireEvent.click(getTrigger());
    expect(getTrigger()).toHaveAttribute("aria-expanded", "true");
  });

  it("al hacer click dos veces se colapsa de nuevo", () => {
    mockPaymentMethodsReturn([]);
    renderSection();
    fireEvent.click(getTrigger());
    fireEvent.click(getTrigger());
    expect(getTrigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("tiene aria-controls apuntando al id del body", () => {
    mockPaymentMethodsReturn([]);
    renderSection();
    const bodyId = getTrigger().getAttribute("aria-controls");
    expect(bodyId).toBeTruthy();
    expect(document.getElementById(bodyId!)).toBeInTheDocument();
  });
});

describe("MoreOptionsSection — resumen colapsado combinado", () => {
  it("moneda=default, sin método → 'ARS'", () => {
    mockPaymentMethodsReturn([]);
    renderSection({ currency: "ARS", defaultCurrency: "ARS" });
    expect(getTrigger()).toHaveTextContent("ARS");
    // sin método: no hay nombre de método en el resumen
    expect(screen.queryByText("Débito Banco Nación")).not.toBeInTheDocument();
  });

  it("moneda=default, con método → 'ARS │ [glifo] Visa'", () => {
    mockPaymentMethodsReturn([mockCreditMethod]);
    renderSection({ currency: "ARS", defaultCurrency: "ARS", paymentMethodId: "pm-credit-1" });
    expect(getTrigger()).toHaveTextContent("ARS");
    expect(getTrigger()).toHaveTextContent("Visa Banco Nación");
  });

  it("moneda≠default, sin método → 'USD · 1.480,00'", () => {
    mockPaymentMethodsReturn([]);
    renderSection({ currency: "USD", defaultCurrency: "ARS", exchangeRateInput: "1.480,00" });
    expect(getTrigger()).toHaveTextContent("USD");
    expect(screen.getByText("1.480,00")).toBeInTheDocument();
  });

  it("moneda≠default, con método → 'USD · 1.480,00 │ [glifo] Visa'", () => {
    mockPaymentMethodsReturn([mockCreditMethod]);
    renderSection({
      currency: "USD",
      defaultCurrency: "ARS",
      exchangeRateInput: "1.480,00",
      paymentMethodId: "pm-credit-1",
    });
    expect(getTrigger()).toHaveTextContent("USD");
    expect(screen.getByText("1.480,00")).toBeInTheDocument();
    expect(getTrigger()).toHaveTextContent("Visa Banco Nación");
  });

  it("el débito automático NO aparece en el resumen (segmento del trigger)", () => {
    mockPaymentMethodsReturn([mockDebitMethod]);
    renderSection({ paymentMethodId: "pm-debit-1", autoDebit: true });
    // El checkbox vive en el cuerpo del disclosure (fuera del trigger, aunque siga
    // en el DOM colapsado); el resumen del trigger en sí no debe mencionarlo.
    expect(within(getTrigger()).queryByText(/débito automático/i)).not.toBeInTheDocument();
  });

  it("al expandir, el resumen colapsado desaparece", () => {
    mockPaymentMethodsReturn([mockCreditMethod]);
    renderSection({ currency: "USD", defaultCurrency: "ARS", paymentMethodId: "pm-credit-1" });
    fireEvent.click(getTrigger());
    // El texto "Visa Banco Nación" sigue existiendo (ahora en el Select expandido),
    // pero el resumen colapsado ya no se renderiza como hijo directo del trigger.
    expect(getTrigger()).not.toHaveTextContent("USD · ");
  });
});

describe("MoreOptionsSection — cuerpo expandido", () => {
  it("muestra el sub-bloque de moneda (selector ARS/USD/EUR/BRL)", () => {
    mockPaymentMethodsReturn([]);
    renderSection();
    fireEvent.click(getTrigger());
    expect(screen.getByRole("radiogroup", { name: "Moneda" })).toBeInTheDocument();
  });

  it("muestra el selector de método de pago con label 'Método de pago (opcional)'", () => {
    mockPaymentMethodsReturn([]);
    renderSection();
    fireEvent.click(getTrigger());
    expect(screen.getByText("Método de pago")).toBeInTheDocument();
    expect(screen.getByText("(opcional)")).toBeInTheDocument();
  });

  it("NO muestra el checkbox 'Débito automático' cuando no hay método elegido", () => {
    mockPaymentMethodsReturn([mockDebitMethod, mockCreditMethod]);
    renderSection();
    fireEvent.click(getTrigger());
    expect(screen.queryByText(/débito automático/i)).not.toBeInTheDocument();
  });

  it("NO muestra el checkbox cuando el método elegido es de tipo Crédito", () => {
    mockPaymentMethodsReturn([mockCreditMethod]);
    renderSection({ paymentMethodId: "pm-credit-1" });
    fireEvent.click(getTrigger());
    expect(screen.queryByText(/débito automático/i)).not.toBeInTheDocument();
  });

  it("muestra el checkbox cuando el método elegido es de tipo Débito", () => {
    mockPaymentMethodsReturn([mockDebitMethod]);
    renderSection({ paymentMethodId: "pm-debit-1" });
    fireEvent.click(getTrigger());
    expect(screen.getByText(/débito automático/i)).toBeInTheDocument();
  });

  it("cambiar el método de pago a uno de tipo Débito muestra el checkbox en vivo", async () => {
    const user = userEvent.setup();
    mockPaymentMethodsReturn([mockDebitMethod, mockCreditMethod]);
    renderSection();
    fireEvent.click(getTrigger());

    expect(screen.queryByText(/débito automático/i)).not.toBeInTheDocument();

    await user.click(screen.getByLabelText(/método de pago/i));
    await user.click(screen.getByRole("option", { name: /débito banco nación/i }));

    expect(screen.getByText(/débito automático/i)).toBeInTheDocument();
  });

  it("tildar el checkbox invoca onAutoDebitChange", async () => {
    const user = userEvent.setup();
    mockPaymentMethodsReturn([mockDebitMethod]);
    renderSection({ paymentMethodId: "pm-debit-1" });
    fireEvent.click(getTrigger());

    const checkbox = screen.getByRole("checkbox", { name: /débito automático/i });
    expect(checkbox).toHaveAttribute("aria-checked", "false");
    await user.click(checkbox);
    expect(checkbox).toHaveAttribute("aria-checked", "true");
  });
});
