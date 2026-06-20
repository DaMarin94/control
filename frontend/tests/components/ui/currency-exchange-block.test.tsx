/**
 * Tests de CurrencyExchangeBlock (Fase 1.2.3 — fix cotización siempre visible).
 *
 * Verifica:
 * - El campo cotización se muestra SIEMPRE (también cuando currency === defaultCurrency)
 * - Prefijo de par correcto en cada caso (cross-rate y mono-moneda)
 * - Nota "Último cambio usado" cuando isExchangeRateModified=false
 * - Nota "Cotización modificada" cuando isExchangeRateModified=true
 * - Error de cotización reemplaza la nota y muestra el mensaje de error
 * - onCurrencyChange se llama al cambiar moneda
 * - onExchangeRateChange se llama al tipear en el input de cotización
 * - recurringMonthNote aparece cuando se provee (sin restricción de moneda)
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

describe("CurrencyExchangeBlock", () => {
  describe("Modo mono-moneda (currency === defaultCurrency) — campo SIEMPRE visible", () => {
    it("muestra el selector de moneda", () => {
      renderBlock({ currency: "ARS", defaultCurrency: "ARS" });
      expect(screen.getByRole("radiogroup", { name: "Moneda" })).toBeInTheDocument();
    });

    it("muestra el campo de cotización (nunca se oculta)", () => {
      renderBlock({ currency: "ARS", defaultCurrency: "ARS" });
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("muestra el label Cotización", () => {
      renderBlock({ currency: "ARS", defaultCurrency: "ARS" });
      expect(screen.getByText("Cotización")).toBeInTheDocument();
    });

    it("muestra el prefijo de par 'USD→ARS' cuando default=ARS y moneda=ARS (la otra moneda)", () => {
      renderBlock({ currency: "ARS", defaultCurrency: "ARS" });
      expect(screen.getByText("USD→ARS")).toBeInTheDocument();
    });

    it("muestra el prefijo de par 'ARS→USD' cuando default=USD y moneda=USD (la otra moneda)", () => {
      renderBlock({ currency: "USD", defaultCurrency: "USD" });
      expect(screen.getByText("ARS→USD")).toBeInTheDocument();
    });

    it("muestra 'Último cambio usado' cuando isExchangeRateModified=false", () => {
      renderBlock({ currency: "ARS", defaultCurrency: "ARS", isExchangeRateModified: false });
      expect(screen.getByText("Último cambio usado")).toBeInTheDocument();
    });

    it("muestra 'Cotización modificada' cuando isExchangeRateModified=true", () => {
      renderBlock({ currency: "ARS", defaultCurrency: "ARS", isExchangeRateModified: true });
      expect(screen.getByText("Cotización modificada")).toBeInTheDocument();
    });

    it("muestra error de cotización cuando exchangeRateError está presente", () => {
      renderBlock({
        currency: "ARS",
        defaultCurrency: "ARS",
        exchangeRateError: "Ingresá una cotización mayor a 0",
        isExchangeRateModified: false,
      });
      expect(screen.getByText("Ingresá una cotización mayor a 0")).toBeInTheDocument();
      expect(screen.queryByText("Último cambio usado")).not.toBeInTheDocument();
    });

    it("llama onExchangeRateChange al tipear en el input (moneda==default)", () => {
      const onExchangeRateChange = vi.fn();
      renderBlock({ currency: "ARS", defaultCurrency: "ARS", onExchangeRateChange });
      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "1.200,00" } });
      expect(onExchangeRateChange).toHaveBeenCalledWith("1.200,00");
    });
  });

  describe("Modo cross-rate (currency !== defaultCurrency)", () => {
    it("muestra el campo cotización con label", () => {
      renderBlock({ currency: "USD", defaultCurrency: "ARS" });
      expect(screen.getByText("Cotización")).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("muestra el prefijo de par 'USD→ARS'", () => {
      renderBlock({ currency: "USD", defaultCurrency: "ARS" });
      expect(screen.getByText("USD→ARS")).toBeInTheDocument();
    });

    it("muestra el prefijo de par 'ARS→USD' cuando default=USD y moneda=ARS", () => {
      renderBlock({ currency: "ARS", defaultCurrency: "USD" });
      expect(screen.getByText("ARS→USD")).toBeInTheDocument();
    });

    it("muestra 'Último cambio usado' cuando isExchangeRateModified=false", () => {
      renderBlock({ currency: "USD", defaultCurrency: "ARS", isExchangeRateModified: false });
      expect(screen.getByText("Último cambio usado")).toBeInTheDocument();
    });

    it("muestra 'Cotización modificada' cuando isExchangeRateModified=true", () => {
      renderBlock({ currency: "USD", defaultCurrency: "ARS", isExchangeRateModified: true });
      expect(screen.getByText("Cotización modificada")).toBeInTheDocument();
    });

    it("muestra error y oculta la nota cuando exchangeRateError está presente", () => {
      renderBlock({
        currency: "USD",
        defaultCurrency: "ARS",
        exchangeRateError: "La cotización debe ser mayor a 0",
        isExchangeRateModified: false,
      });
      expect(screen.getByText("La cotización debe ser mayor a 0")).toBeInTheDocument();
      expect(screen.queryByText("Último cambio usado")).not.toBeInTheDocument();
    });

    it("muestra la nota de fijo (recurringMonthNote) cuando se provee", () => {
      renderBlock({
        currency: "USD",
        defaultCurrency: "ARS",
        recurringMonthNote: "Cotización para Junio 2026",
        isExchangeRateModified: false,
      });
      expect(screen.getByText("Cotización para Junio 2026")).toBeInTheDocument();
    });

    it("NO muestra recurringMonthNote si hay error", () => {
      renderBlock({
        currency: "USD",
        defaultCurrency: "ARS",
        recurringMonthNote: "Cotización para Junio 2026",
        exchangeRateError: "Error de validación",
      });
      expect(screen.queryByText("Cotización para Junio 2026")).not.toBeInTheDocument();
    });

    it("llama onExchangeRateChange al tipear en el input", () => {
      const onExchangeRateChange = vi.fn();
      renderBlock({ currency: "USD", defaultCurrency: "ARS", onExchangeRateChange });
      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "1.200,00" } });
      expect(onExchangeRateChange).toHaveBeenCalledWith("1.200,00");
    });
  });

  describe("recurringMonthNote — visible también en mono-moneda", () => {
    it("muestra recurringMonthNote cuando currency === defaultCurrency (campo siempre visible)", () => {
      renderBlock({
        currency: "ARS",
        defaultCurrency: "ARS",
        recurringMonthNote: "Cotización para Junio 2026",
        isExchangeRateModified: false,
      });
      expect(screen.getByText("Cotización para Junio 2026")).toBeInTheDocument();
    });
  });

  describe("Callbacks de moneda", () => {
    it("llama onCurrencyChange al cambiar la moneda", () => {
      const onCurrencyChange = vi.fn();
      renderBlock({ currency: "ARS", defaultCurrency: "ARS", onCurrencyChange });
      // Clic en USD
      fireEvent.click(screen.getByRole("radio", { name: "USD" }));
      expect(onCurrencyChange).toHaveBeenCalledWith("USD");
    });
  });
});
