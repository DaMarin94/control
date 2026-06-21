/**
 * Tests de CurrencySegmented (Fase 1.2.4 — 4 monedas: ARS/USD/EUR/BRL).
 *
 * Verifica:
 * - Renderiza los cuatro segmentos ARS, USD, EUR, BRL
 * - El segmento seleccionado tiene aria-checked=true, el resto false
 * - Clic en segmento no seleccionado llama onChange con el código correcto
 * - Teclado: ArrowRight avanza en ciclo (ARS→USD→EUR→BRL→ARS)
 * - Teclado: ArrowLeft retrocede en ciclo (ARS→BRL)
 * - disabled: ningún segmento llama onChange al hacer click
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CurrencySegmented } from "@/components/ui/currency-segmented";
import type { CurrencyCode } from "@/types/settings";

function renderSegmented(value: CurrencyCode, onChange = vi.fn()) {
  return render(
    <CurrencySegmented value={value} onChange={onChange} ariaLabel="Moneda de prueba" />,
  );
}

describe("CurrencySegmented", () => {
  describe("Render básico — 4 monedas", () => {
    it("renderiza los cuatro segmentos ARS, USD, EUR y BRL", () => {
      renderSegmented("ARS");
      expect(screen.getByRole("radio", { name: "ARS" })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "USD" })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "EUR" })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "BRL" })).toBeInTheDocument();
    });

    it("usa el aria-label del radiogroup", () => {
      renderSegmented("ARS");
      expect(screen.getByRole("radiogroup", { name: "Moneda de prueba" })).toBeInTheDocument();
    });

    it("segmento ARS tiene aria-checked=true cuando value=ARS", () => {
      renderSegmented("ARS");
      expect(screen.getByRole("radio", { name: "ARS" })).toHaveAttribute("aria-checked", "true");
      expect(screen.getByRole("radio", { name: "USD" })).toHaveAttribute("aria-checked", "false");
      expect(screen.getByRole("radio", { name: "EUR" })).toHaveAttribute("aria-checked", "false");
      expect(screen.getByRole("radio", { name: "BRL" })).toHaveAttribute("aria-checked", "false");
    });

    it("segmento USD tiene aria-checked=true cuando value=USD", () => {
      renderSegmented("USD");
      expect(screen.getByRole("radio", { name: "USD" })).toHaveAttribute("aria-checked", "true");
      expect(screen.getByRole("radio", { name: "ARS" })).toHaveAttribute("aria-checked", "false");
      expect(screen.getByRole("radio", { name: "EUR" })).toHaveAttribute("aria-checked", "false");
      expect(screen.getByRole("radio", { name: "BRL" })).toHaveAttribute("aria-checked", "false");
    });

    it("segmento EUR tiene aria-checked=true cuando value=EUR", () => {
      renderSegmented("EUR");
      expect(screen.getByRole("radio", { name: "EUR" })).toHaveAttribute("aria-checked", "true");
      expect(screen.getByRole("radio", { name: "ARS" })).toHaveAttribute("aria-checked", "false");
    });

    it("segmento BRL tiene aria-checked=true cuando value=BRL", () => {
      renderSegmented("BRL");
      expect(screen.getByRole("radio", { name: "BRL" })).toHaveAttribute("aria-checked", "true");
      expect(screen.getByRole("radio", { name: "ARS" })).toHaveAttribute("aria-checked", "false");
    });
  });

  describe("Interacción de click", () => {
    it("clic en USD cuando value=ARS llama onChange con 'USD'", () => {
      const onChange = vi.fn();
      renderSegmented("ARS", onChange);
      fireEvent.click(screen.getByRole("radio", { name: "USD" }));
      expect(onChange).toHaveBeenCalledOnce();
      expect(onChange).toHaveBeenCalledWith("USD");
    });

    it("clic en EUR cuando value=ARS llama onChange con 'EUR'", () => {
      const onChange = vi.fn();
      renderSegmented("ARS", onChange);
      fireEvent.click(screen.getByRole("radio", { name: "EUR" }));
      expect(onChange).toHaveBeenCalledOnce();
      expect(onChange).toHaveBeenCalledWith("EUR");
    });

    it("clic en BRL cuando value=ARS llama onChange con 'BRL'", () => {
      const onChange = vi.fn();
      renderSegmented("ARS", onChange);
      fireEvent.click(screen.getByRole("radio", { name: "BRL" }));
      expect(onChange).toHaveBeenCalledOnce();
      expect(onChange).toHaveBeenCalledWith("BRL");
    });

    it("clic en ARS cuando value=USD llama onChange con 'ARS'", () => {
      const onChange = vi.fn();
      renderSegmented("USD", onChange);
      fireEvent.click(screen.getByRole("radio", { name: "ARS" }));
      expect(onChange).toHaveBeenCalledOnce();
      expect(onChange).toHaveBeenCalledWith("ARS");
    });

    it("clic en ARS cuando ya es ARS llama onChange con 'ARS' (sin guard de same-value)", () => {
      const onChange = vi.fn();
      renderSegmented("ARS", onChange);
      fireEvent.click(screen.getByRole("radio", { name: "ARS" }));
      // El componente no filtra same-value; el click dispara onChange
      expect(onChange).toHaveBeenCalledWith("ARS");
    });
  });

  describe("Navegación por teclado — ciclo de 4", () => {
    it("ArrowRight en ARS (índice 0) llama onChange con 'USD' (índice 1)", () => {
      const onChange = vi.fn();
      renderSegmented("ARS", onChange);
      fireEvent.keyDown(screen.getByRole("radio", { name: "ARS" }), { key: "ArrowRight" });
      expect(onChange).toHaveBeenCalledWith("USD");
    });

    it("ArrowRight en USD (índice 1) llama onChange con 'EUR' (índice 2)", () => {
      const onChange = vi.fn();
      renderSegmented("USD", onChange);
      fireEvent.keyDown(screen.getByRole("radio", { name: "USD" }), { key: "ArrowRight" });
      expect(onChange).toHaveBeenCalledWith("EUR");
    });

    it("ArrowRight en EUR (índice 2) llama onChange con 'BRL' (índice 3)", () => {
      const onChange = vi.fn();
      renderSegmented("EUR", onChange);
      fireEvent.keyDown(screen.getByRole("radio", { name: "EUR" }), { key: "ArrowRight" });
      expect(onChange).toHaveBeenCalledWith("BRL");
    });

    it("ArrowRight en BRL (último, índice 3) cicla a ARS (índice 0)", () => {
      const onChange = vi.fn();
      renderSegmented("BRL", onChange);
      fireEvent.keyDown(screen.getByRole("radio", { name: "BRL" }), { key: "ArrowRight" });
      expect(onChange).toHaveBeenCalledWith("ARS");
    });

    it("ArrowLeft en ARS (primero, índice 0) cicla a BRL (último, índice 3)", () => {
      const onChange = vi.fn();
      renderSegmented("ARS", onChange);
      fireEvent.keyDown(screen.getByRole("radio", { name: "ARS" }), { key: "ArrowLeft" });
      expect(onChange).toHaveBeenCalledWith("BRL");
    });

    it("ArrowLeft en USD (índice 1) llama onChange con 'ARS' (índice 0)", () => {
      const onChange = vi.fn();
      renderSegmented("USD", onChange);
      fireEvent.keyDown(screen.getByRole("radio", { name: "USD" }), { key: "ArrowLeft" });
      expect(onChange).toHaveBeenCalledWith("ARS");
    });

    it("ArrowLeft en BRL (índice 3) llama onChange con 'EUR' (índice 2)", () => {
      const onChange = vi.fn();
      renderSegmented("BRL", onChange);
      fireEvent.keyDown(screen.getByRole("radio", { name: "BRL" }), { key: "ArrowLeft" });
      expect(onChange).toHaveBeenCalledWith("EUR");
    });

    it("otras teclas no llaman onChange", () => {
      const onChange = vi.fn();
      renderSegmented("ARS", onChange);
      fireEvent.keyDown(screen.getByRole("radio", { name: "ARS" }), { key: "Enter" });
      fireEvent.keyDown(screen.getByRole("radio", { name: "ARS" }), { key: " " });
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("Estado disabled", () => {
    it("los cuatro botones están deshabilitados cuando disabled=true", () => {
      const onChange = vi.fn();
      render(
        <CurrencySegmented value="ARS" onChange={onChange} disabled={true} />,
      );
      expect(screen.getByRole("radio", { name: "ARS" })).toBeDisabled();
      expect(screen.getByRole("radio", { name: "USD" })).toBeDisabled();
      expect(screen.getByRole("radio", { name: "EUR" })).toBeDisabled();
      expect(screen.getByRole("radio", { name: "BRL" })).toBeDisabled();
    });
  });
});
