/**
 * Tests de CurrencyExchangeFields — sub-bloque "Moneda y cotización" (contenido
 * plano, SIN disclosure propio). Extraído de CurrencyExchangeBlock al agrupar
 * moneda+cotización y método de pago dentro del disclosure único "Más opciones"
 * (docs/design.md §4 "Disclosure 'Más opciones' del form").
 *
 * Como el componente ya no tiene disclosure propio, el contenido está SIEMPRE
 * renderizado (no hace falta expandir nada); el disclosure que lo envuelve es
 * responsabilidad de <MoreOptionsSection> (ver more-options-section.test.tsx).
 *
 * Comportamiento cubierto:
 * - moneda==default: solo selector de moneda a ancho completo; sin label
 *   "Cotización", sin input de cotización, sin prefijo de par, sin field-note.
 * - moneda≠default: grid 2-col con selector (compact) + cotización completa.
 * - Callbacks onCurrencyChange / onExchangeRateChange.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CurrencyExchangeFields } from "@/components/ui/currency-exchange-fields";
import type { CurrencyExchangeFieldsProps } from "@/components/ui/currency-exchange-fields";

function renderFields(props: Partial<CurrencyExchangeFieldsProps> = {}) {
  const defaults: CurrencyExchangeFieldsProps = {
    currency: "ARS",
    exchangeRateInput: "",
    defaultCurrency: "ARS",
    isExchangeRateModified: false,
    onCurrencyChange: vi.fn(),
    onExchangeRateChange: vi.fn(),
  };
  return render(<CurrencyExchangeFields {...defaults} {...props} />);
}

describe("CurrencyExchangeFields — moneda==default", () => {
  it("muestra el selector de moneda con los 4 segmentos", () => {
    renderFields({ currency: "ARS", defaultCurrency: "ARS" });
    expect(screen.getByRole("radiogroup", { name: "Moneda" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "ARS" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "USD" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "EUR" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "BRL" })).toBeInTheDocument();
  });

  it("NO muestra el label Cotización", () => {
    renderFields({ currency: "ARS", defaultCurrency: "ARS" });
    expect(screen.queryByText("Cotización")).not.toBeInTheDocument();
  });

  it("NO muestra el input de cotización (textbox)", () => {
    renderFields({ currency: "ARS", defaultCurrency: "ARS" });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("NO muestra el prefijo de par 'USD→ARS'", () => {
    renderFields({ currency: "ARS", defaultCurrency: "ARS" });
    expect(screen.queryByText("USD→ARS")).not.toBeInTheDocument();
  });

  it("NO muestra nota 'Cotización de referencia del mes'", () => {
    renderFields({ currency: "ARS", defaultCurrency: "ARS", isExchangeRateModified: false });
    expect(screen.queryByText("Cotización de referencia del mes")).not.toBeInTheDocument();
  });

  it("NO muestra nota 'Cotización modificada'", () => {
    renderFields({ currency: "ARS", defaultCurrency: "ARS", isExchangeRateModified: true });
    expect(screen.queryByText("Cotización modificada")).not.toBeInTheDocument();
  });

  it("llama onCurrencyChange al cambiar la moneda a USD", () => {
    const onCurrencyChange = vi.fn();
    renderFields({ currency: "ARS", defaultCurrency: "ARS", onCurrencyChange });
    fireEvent.click(screen.getByRole("radio", { name: "USD" }));
    expect(onCurrencyChange).toHaveBeenCalledWith("USD");
  });

  it("llama onCurrencyChange al cambiar la moneda a EUR", () => {
    const onCurrencyChange = vi.fn();
    renderFields({ currency: "ARS", defaultCurrency: "ARS", onCurrencyChange });
    fireEvent.click(screen.getByRole("radio", { name: "EUR" }));
    expect(onCurrencyChange).toHaveBeenCalledWith("EUR");
  });

  it("llama onCurrencyChange al cambiar la moneda a BRL", () => {
    const onCurrencyChange = vi.fn();
    renderFields({ currency: "ARS", defaultCurrency: "ARS", onCurrencyChange });
    fireEvent.click(screen.getByRole("radio", { name: "BRL" }));
    expect(onCurrencyChange).toHaveBeenCalledWith("BRL");
  });

  it("moneda ARS seleccionada tiene aria-checked=true", () => {
    renderFields({ currency: "ARS", defaultCurrency: "ARS" });
    expect(screen.getByRole("radio", { name: "ARS" })).toHaveAttribute("aria-checked", "true");
  });

  it("NO renderiza recurringMonthNote cuando moneda==default (no hay campo cotización)", () => {
    renderFields({
      currency: "ARS",
      defaultCurrency: "ARS",
      recurringMonthNote: "Cotización para Junio 2026",
    });
    expect(screen.queryByText("Cotización para Junio 2026")).not.toBeInTheDocument();
  });
});

describe("CurrencyExchangeFields — moneda≠default", () => {
  it("muestra el selector de moneda con los 4 segmentos", () => {
    renderFields({ currency: "USD", defaultCurrency: "ARS" });
    expect(screen.getByRole("radiogroup", { name: "Moneda" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "USD" })).toBeInTheDocument();
  });

  it("muestra el label Cotización", () => {
    renderFields({ currency: "USD", defaultCurrency: "ARS" });
    expect(screen.getByText("Cotización")).toBeInTheDocument();
  });

  it("muestra el input de cotización (textbox)", () => {
    renderFields({ currency: "USD", defaultCurrency: "ARS" });
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("muestra el prefijo de par 'USD→ARS' cuando moneda=USD y default=ARS", () => {
    renderFields({ currency: "USD", defaultCurrency: "ARS" });
    expect(screen.getByText("USD→ARS")).toBeInTheDocument();
  });

  it("muestra el prefijo de par 'ARS→USD' cuando moneda=ARS y default=USD", () => {
    renderFields({ currency: "ARS", defaultCurrency: "USD" });
    expect(screen.getByText("ARS→USD")).toBeInTheDocument();
  });

  it("muestra el prefijo de par 'EUR→ARS'", () => {
    renderFields({ currency: "EUR", defaultCurrency: "ARS" });
    expect(screen.getByText("EUR→ARS")).toBeInTheDocument();
  });

  it("muestra el prefijo de par 'BRL→ARS'", () => {
    renderFields({ currency: "BRL", defaultCurrency: "ARS" });
    expect(screen.getByText("BRL→ARS")).toBeInTheDocument();
  });

  it("muestra el prefijo de par 'EUR→USD' cuando moneda=EUR y default=USD", () => {
    renderFields({ currency: "EUR", defaultCurrency: "USD" });
    expect(screen.getByText("EUR→USD")).toBeInTheDocument();
  });

  it("muestra el prefijo de par 'BRL→USD' cuando moneda=BRL y default=USD", () => {
    renderFields({ currency: "BRL", defaultCurrency: "USD" });
    expect(screen.getByText("BRL→USD")).toBeInTheDocument();
  });

  it("muestra 'Cotización de referencia del mes' cuando isExchangeRateModified=false", () => {
    renderFields({ currency: "USD", defaultCurrency: "ARS", isExchangeRateModified: false });
    expect(screen.getByText("Cotización de referencia del mes")).toBeInTheDocument();
  });

  it("muestra 'Cotización modificada' cuando isExchangeRateModified=true", () => {
    renderFields({ currency: "USD", defaultCurrency: "ARS", isExchangeRateModified: true });
    expect(screen.getByText("Cotización modificada")).toBeInTheDocument();
  });

  it("muestra error de cotización y oculta la nota cuando exchangeRateError está presente", () => {
    renderFields({
      currency: "USD",
      defaultCurrency: "ARS",
      exchangeRateError: "La cotización debe ser mayor a 0",
      isExchangeRateModified: false,
    });
    expect(screen.getByText("La cotización debe ser mayor a 0")).toBeInTheDocument();
    expect(screen.queryByText("Cotización de referencia del mes")).not.toBeInTheDocument();
  });

  it("muestra recurringMonthNote cuando se provee y no hay error", () => {
    renderFields({
      currency: "USD",
      defaultCurrency: "ARS",
      recurringMonthNote: "Cotización para Junio 2026",
      isExchangeRateModified: false,
    });
    expect(screen.getByText("Cotización para Junio 2026")).toBeInTheDocument();
  });

  it("NO muestra recurringMonthNote si hay error", () => {
    renderFields({
      currency: "USD",
      defaultCurrency: "ARS",
      recurringMonthNote: "Cotización para Junio 2026",
      exchangeRateError: "Error de validación",
    });
    expect(screen.queryByText("Cotización para Junio 2026")).not.toBeInTheDocument();
  });

  it("llama onExchangeRateChange al tipear en el input", () => {
    const onExchangeRateChange = vi.fn();
    renderFields({ currency: "USD", defaultCurrency: "ARS", onExchangeRateChange });
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "1.200,00" } });
    expect(onExchangeRateChange).toHaveBeenCalledWith("1.200,00");
  });

  it("llama onCurrencyChange al cambiar la moneda", () => {
    const onCurrencyChange = vi.fn();
    renderFields({ currency: "USD", defaultCurrency: "ARS", onCurrencyChange });
    fireEvent.click(screen.getByRole("radio", { name: "EUR" }));
    expect(onCurrencyChange).toHaveBeenCalledWith("EUR");
  });

  it("USD seleccionado tiene aria-checked=true", () => {
    renderFields({ currency: "USD", defaultCurrency: "ARS" });
    expect(screen.getByRole("radio", { name: "USD" })).toHaveAttribute("aria-checked", "true");
  });

  it("EUR seleccionado tiene aria-checked=true", () => {
    renderFields({ currency: "EUR", defaultCurrency: "ARS" });
    expect(screen.getByRole("radio", { name: "EUR" })).toHaveAttribute("aria-checked", "true");
  });

  it("BRL seleccionado tiene aria-checked=true", () => {
    renderFields({ currency: "BRL", defaultCurrency: "ARS" });
    expect(screen.getByRole("radio", { name: "BRL" })).toHaveAttribute("aria-checked", "true");
  });
});
