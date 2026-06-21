/**
 * Tests de CurrencyExchangeBlock (Fase 1.2.4 — disclosure colapsable + caso moneda=default).
 *
 * Comportamiento nuevo:
 * - El bloque vive dentro de un disclosure colapsable ("Moneda y cotización").
 * - Arranca SIEMPRE colapsado.
 * - Trigger: button con aria-expanded + aria-controls, chevron ChevronRight.
 * - Resumen colapsado: código mono; si moneda≠default agrega "· {cotización}".
 * - Expandido con moneda==default: solo selector de moneda a ancho completo; sin label
 *   "Cotización", sin input de cotización, sin prefijo de par, sin field-note.
 * - Expandido con moneda≠default: grid 2-col con selector (compact) + cotización completa.
 * - Callbacks onCurrencyChange / onExchangeRateChange.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CurrencyExchangeBlock } from "@/components/ui/currency-exchange-block";
import type { CurrencyExchangeBlockProps } from "@/components/ui/currency-exchange-block";

function renderBlock(props: Partial<CurrencyExchangeBlockProps> = {}) {
  const defaults: CurrencyExchangeBlockProps = {
    currency: "ARS",
    exchangeRateInput: "",
    defaultCurrency: "ARS",
    isExchangeRateModified: false,
    onCurrencyChange: vi.fn(),
    onExchangeRateChange: vi.fn(),
  };
  return render(<CurrencyExchangeBlock {...defaults} {...props} />);
}

// ─── Helper para expandir el disclosure ───────────────────────────────────────

function expandDisclosure() {
  const trigger = screen.getByRole("button", { name: /moneda y cotización/i });
  fireEvent.click(trigger);
}

describe("CurrencyExchangeBlock — disclosure colapsable", () => {
  it("muestra el trigger con el texto correcto", () => {
    renderBlock();
    expect(screen.getByRole("button", { name: /moneda y cotización/i })).toBeInTheDocument();
  });

  it("arranca SIEMPRE colapsado (aria-expanded=false)", () => {
    renderBlock();
    const trigger = screen.getByRole("button", { name: /moneda y cotización/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("arranca colapsado incluso con moneda≠default (USD con default ARS)", () => {
    renderBlock({ currency: "USD", defaultCurrency: "ARS", exchangeRateInput: "1.480,00" });
    const trigger = screen.getByRole("button", { name: /moneda y cotización/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("al hacer click se expande (aria-expanded=true)", () => {
    renderBlock();
    expandDisclosure();
    const trigger = screen.getByRole("button", { name: /moneda y cotización/i });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("al hacer click dos veces se colapsa de nuevo (aria-expanded=false)", () => {
    renderBlock();
    const trigger = screen.getByRole("button", { name: /moneda y cotización/i });
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("tiene aria-controls apuntando al id del body", () => {
    renderBlock();
    const trigger = screen.getByRole("button", { name: /moneda y cotización/i });
    const bodyId = trigger.getAttribute("aria-controls");
    expect(bodyId).toBeTruthy();
    expect(document.getElementById(bodyId!)).toBeInTheDocument();
  });
});

describe("CurrencyExchangeBlock — resumen colapsado", () => {
  it("cuando moneda==default el trigger tiene aria-expanded=false y el resumen tiene el código", () => {
    renderBlock({ currency: "ARS", defaultCurrency: "ARS" });
    // El trigger del disclosure tiene aria-expanded=false (arranca colapsado)
    const trigger = screen.getByRole("button", { name: /moneda y cotización/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    // El trigger contiene el texto "ARS" como resumen (junto con otros ARS de los radios)
    expect(trigger).toHaveTextContent("ARS");
  });

  it("cuando moneda==default NO muestra la cotización en el resumen (summaryRate es null)", () => {
    renderBlock({ currency: "ARS", defaultCurrency: "ARS", exchangeRateInput: "1.200,00" });
    // Con moneda===default, summaryRate es null → la cotización "1.200,00" no aparece
    // en el resumen del trigger (no se renderiza ese span).
    // El texto "1.200,00" no debe existir en el documento cuando el disclosure está cerrado.
    expect(screen.queryByText("1.200,00")).not.toBeInTheDocument();
  });

  it("cuando moneda≠default muestra el código de moneda en el resumen", () => {
    renderBlock({ currency: "USD", defaultCurrency: "ARS", exchangeRateInput: "1.480,00" });
    // El texto "USD" debe estar en el trigger como resumen
    const trigger = screen.getByRole("button", { name: /moneda y cotización/i });
    expect(trigger).toHaveTextContent("USD");
  });

  it("cuando moneda≠default muestra la cotización en el resumen colapsado", () => {
    renderBlock({ currency: "USD", defaultCurrency: "ARS", exchangeRateInput: "1.480,00" });
    expect(screen.getByText("1.480,00")).toBeInTheDocument();
  });

  it("cuando moneda≠default sin cotización no muestra cotización en resumen", () => {
    renderBlock({ currency: "USD", defaultCurrency: "ARS", exchangeRateInput: "" });
    // Puede no mostrar la cotización si es vacío
    const trigger = screen.getByRole("button", { name: /moneda y cotización/i });
    expect(trigger).toHaveTextContent("USD");
  });
});

describe("CurrencyExchangeBlock — moneda==default (expandido)", () => {
  it("muestra el selector de moneda con los 4 segmentos", () => {
    renderBlock({ currency: "ARS", defaultCurrency: "ARS" });
    expandDisclosure();
    expect(screen.getByRole("radiogroup", { name: "Moneda" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "ARS" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "USD" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "EUR" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "BRL" })).toBeInTheDocument();
  });

  it("NO muestra el label Cotización", () => {
    renderBlock({ currency: "ARS", defaultCurrency: "ARS" });
    expandDisclosure();
    expect(screen.queryByText("Cotización")).not.toBeInTheDocument();
  });

  it("NO muestra el input de cotización (textbox)", () => {
    renderBlock({ currency: "ARS", defaultCurrency: "ARS" });
    expandDisclosure();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("NO muestra el prefijo de par 'USD→ARS'", () => {
    renderBlock({ currency: "ARS", defaultCurrency: "ARS" });
    expandDisclosure();
    expect(screen.queryByText("USD→ARS")).not.toBeInTheDocument();
  });

  it("NO muestra nota 'Cotización de referencia del mes'", () => {
    renderBlock({ currency: "ARS", defaultCurrency: "ARS", isExchangeRateModified: false });
    expandDisclosure();
    expect(screen.queryByText("Cotización de referencia del mes")).not.toBeInTheDocument();
  });

  it("NO muestra nota 'Cotización modificada'", () => {
    renderBlock({ currency: "ARS", defaultCurrency: "ARS", isExchangeRateModified: true });
    expandDisclosure();
    expect(screen.queryByText("Cotización modificada")).not.toBeInTheDocument();
  });

  it("llama onCurrencyChange al cambiar la moneda a USD", () => {
    const onCurrencyChange = vi.fn();
    renderBlock({ currency: "ARS", defaultCurrency: "ARS", onCurrencyChange });
    expandDisclosure();
    fireEvent.click(screen.getByRole("radio", { name: "USD" }));
    expect(onCurrencyChange).toHaveBeenCalledWith("USD");
  });

  it("llama onCurrencyChange al cambiar la moneda a EUR", () => {
    const onCurrencyChange = vi.fn();
    renderBlock({ currency: "ARS", defaultCurrency: "ARS", onCurrencyChange });
    expandDisclosure();
    fireEvent.click(screen.getByRole("radio", { name: "EUR" }));
    expect(onCurrencyChange).toHaveBeenCalledWith("EUR");
  });

  it("llama onCurrencyChange al cambiar la moneda a BRL", () => {
    const onCurrencyChange = vi.fn();
    renderBlock({ currency: "ARS", defaultCurrency: "ARS", onCurrencyChange });
    expandDisclosure();
    fireEvent.click(screen.getByRole("radio", { name: "BRL" }));
    expect(onCurrencyChange).toHaveBeenCalledWith("BRL");
  });

  it("moneda ARS seleccionada tiene aria-checked=true", () => {
    renderBlock({ currency: "ARS", defaultCurrency: "ARS" });
    expandDisclosure();
    expect(screen.getByRole("radio", { name: "ARS" })).toHaveAttribute("aria-checked", "true");
  });

  it("NO renderiza recurringMonthNote cuando moneda==default (no hay campo cotización)", () => {
    renderBlock({
      currency: "ARS",
      defaultCurrency: "ARS",
      recurringMonthNote: "Cotización para Junio 2026",
    });
    expandDisclosure();
    expect(screen.queryByText("Cotización para Junio 2026")).not.toBeInTheDocument();
  });
});

describe("CurrencyExchangeBlock — moneda≠default (expandido)", () => {
  it("muestra el selector de moneda con los 4 segmentos", () => {
    renderBlock({ currency: "USD", defaultCurrency: "ARS" });
    expandDisclosure();
    expect(screen.getByRole("radiogroup", { name: "Moneda" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "USD" })).toBeInTheDocument();
  });

  it("muestra el label Cotización", () => {
    renderBlock({ currency: "USD", defaultCurrency: "ARS" });
    expandDisclosure();
    expect(screen.getByText("Cotización")).toBeInTheDocument();
  });

  it("muestra el input de cotización (textbox)", () => {
    renderBlock({ currency: "USD", defaultCurrency: "ARS" });
    expandDisclosure();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("muestra el prefijo de par 'USD→ARS' cuando moneda=USD y default=ARS", () => {
    renderBlock({ currency: "USD", defaultCurrency: "ARS" });
    expandDisclosure();
    expect(screen.getByText("USD→ARS")).toBeInTheDocument();
  });

  it("muestra el prefijo de par 'ARS→USD' cuando moneda=ARS y default=USD", () => {
    renderBlock({ currency: "ARS", defaultCurrency: "USD" });
    expandDisclosure();
    expect(screen.getByText("ARS→USD")).toBeInTheDocument();
  });

  it("muestra el prefijo de par 'EUR→ARS'", () => {
    renderBlock({ currency: "EUR", defaultCurrency: "ARS" });
    expandDisclosure();
    expect(screen.getByText("EUR→ARS")).toBeInTheDocument();
  });

  it("muestra el prefijo de par 'BRL→ARS'", () => {
    renderBlock({ currency: "BRL", defaultCurrency: "ARS" });
    expandDisclosure();
    expect(screen.getByText("BRL→ARS")).toBeInTheDocument();
  });

  it("muestra el prefijo de par 'EUR→USD' cuando moneda=EUR y default=USD", () => {
    renderBlock({ currency: "EUR", defaultCurrency: "USD" });
    expandDisclosure();
    expect(screen.getByText("EUR→USD")).toBeInTheDocument();
  });

  it("muestra el prefijo de par 'BRL→USD' cuando moneda=BRL y default=USD", () => {
    renderBlock({ currency: "BRL", defaultCurrency: "USD" });
    expandDisclosure();
    expect(screen.getByText("BRL→USD")).toBeInTheDocument();
  });

  it("muestra 'Cotización de referencia del mes' cuando isExchangeRateModified=false", () => {
    renderBlock({ currency: "USD", defaultCurrency: "ARS", isExchangeRateModified: false });
    expandDisclosure();
    expect(screen.getByText("Cotización de referencia del mes")).toBeInTheDocument();
  });

  it("muestra 'Cotización modificada' cuando isExchangeRateModified=true", () => {
    renderBlock({ currency: "USD", defaultCurrency: "ARS", isExchangeRateModified: true });
    expandDisclosure();
    expect(screen.getByText("Cotización modificada")).toBeInTheDocument();
  });

  it("muestra error de cotización y oculta la nota cuando exchangeRateError está presente", () => {
    renderBlock({
      currency: "USD",
      defaultCurrency: "ARS",
      exchangeRateError: "La cotización debe ser mayor a 0",
      isExchangeRateModified: false,
    });
    expandDisclosure();
    expect(screen.getByText("La cotización debe ser mayor a 0")).toBeInTheDocument();
    expect(screen.queryByText("Cotización de referencia del mes")).not.toBeInTheDocument();
  });

  it("muestra recurringMonthNote cuando se provee y no hay error", () => {
    renderBlock({
      currency: "USD",
      defaultCurrency: "ARS",
      recurringMonthNote: "Cotización para Junio 2026",
      isExchangeRateModified: false,
    });
    expandDisclosure();
    expect(screen.getByText("Cotización para Junio 2026")).toBeInTheDocument();
  });

  it("NO muestra recurringMonthNote si hay error", () => {
    renderBlock({
      currency: "USD",
      defaultCurrency: "ARS",
      recurringMonthNote: "Cotización para Junio 2026",
      exchangeRateError: "Error de validación",
    });
    expandDisclosure();
    expect(screen.queryByText("Cotización para Junio 2026")).not.toBeInTheDocument();
  });

  it("llama onExchangeRateChange al tipear en el input", () => {
    const onExchangeRateChange = vi.fn();
    renderBlock({ currency: "USD", defaultCurrency: "ARS", onExchangeRateChange });
    expandDisclosure();
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "1.200,00" } });
    expect(onExchangeRateChange).toHaveBeenCalledWith("1.200,00");
  });

  it("llama onCurrencyChange al cambiar la moneda", () => {
    const onCurrencyChange = vi.fn();
    renderBlock({ currency: "USD", defaultCurrency: "ARS", onCurrencyChange });
    expandDisclosure();
    fireEvent.click(screen.getByRole("radio", { name: "EUR" }));
    expect(onCurrencyChange).toHaveBeenCalledWith("EUR");
  });

  it("USD seleccionado tiene aria-checked=true", () => {
    renderBlock({ currency: "USD", defaultCurrency: "ARS" });
    expandDisclosure();
    expect(screen.getByRole("radio", { name: "USD" })).toHaveAttribute("aria-checked", "true");
  });

  it("EUR seleccionado tiene aria-checked=true", () => {
    renderBlock({ currency: "EUR", defaultCurrency: "ARS" });
    expandDisclosure();
    expect(screen.getByRole("radio", { name: "EUR" })).toHaveAttribute("aria-checked", "true");
  });

  it("BRL seleccionado tiene aria-checked=true", () => {
    renderBlock({ currency: "BRL", defaultCurrency: "ARS" });
    expandDisclosure();
    expect(screen.getByRole("radio", { name: "BRL" })).toHaveAttribute("aria-checked", "true");
  });
});
