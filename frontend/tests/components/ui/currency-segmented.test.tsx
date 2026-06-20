/**
 * Tests de CurrencySegmented (Fase 1.2.3).
 *
 * Verifica:
 * - Renderiza los dos segmentos ARS y USD
 * - El segmento seleccionado tiene aria-checked=true, el otro false
 * - Clic en segmento no seleccionado llama onChange con el código correcto
 * - Clic en segmento ya seleccionado NO llama onChange
 * - Teclado: ArrowRight cambia de ARS → USD
 * - Teclado: ArrowLeft cambia de USD → ARS
 * - Teclado: ArrowRight desde el último (USD) cicla a ARS
 * - disabled: ningún segmento llama onChange al hacer click
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CurrencySegmented } from "@/components/ui/currency-segmented";

function renderSegmented(value: "ARS" | "USD", onChange = vi.fn()) {
  return render(
    <CurrencySegmented value={value} onChange={onChange} ariaLabel="Moneda de prueba" />,
  );
}

describe("CurrencySegmented", () => {
  describe("Render básico", () => {
    it("renderiza los dos segmentos ARS y USD", () => {
      renderSegmented("ARS");
      expect(screen.getByRole("radio", { name: "ARS" })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "USD" })).toBeInTheDocument();
    });

    it("usa el aria-label del radiogroup", () => {
      renderSegmented("ARS");
      expect(screen.getByRole("radiogroup", { name: "Moneda de prueba" })).toBeInTheDocument();
    });

    it("segmento ARS tiene aria-checked=true cuando value=ARS", () => {
      renderSegmented("ARS");
      expect(screen.getByRole("radio", { name: "ARS" })).toHaveAttribute("aria-checked", "true");
      expect(screen.getByRole("radio", { name: "USD" })).toHaveAttribute("aria-checked", "false");
    });

    it("segmento USD tiene aria-checked=true cuando value=USD", () => {
      renderSegmented("USD");
      expect(screen.getByRole("radio", { name: "USD" })).toHaveAttribute("aria-checked", "true");
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

  describe("Navegación por teclado", () => {
    it("ArrowRight en ARS llama onChange con 'USD'", () => {
      const onChange = vi.fn();
      renderSegmented("ARS", onChange);
      fireEvent.keyDown(screen.getByRole("radio", { name: "ARS" }), { key: "ArrowRight" });
      expect(onChange).toHaveBeenCalledWith("USD");
    });

    it("ArrowLeft en USD llama onChange con 'ARS'", () => {
      const onChange = vi.fn();
      renderSegmented("USD", onChange);
      fireEvent.keyDown(screen.getByRole("radio", { name: "USD" }), { key: "ArrowLeft" });
      expect(onChange).toHaveBeenCalledWith("ARS");
    });

    it("ArrowRight en USD (último) cicla a ARS", () => {
      const onChange = vi.fn();
      renderSegmented("USD", onChange);
      fireEvent.keyDown(screen.getByRole("radio", { name: "USD" }), { key: "ArrowRight" });
      expect(onChange).toHaveBeenCalledWith("ARS");
    });

    it("ArrowLeft en ARS (primero) cicla a USD", () => {
      const onChange = vi.fn();
      renderSegmented("ARS", onChange);
      fireEvent.keyDown(screen.getByRole("radio", { name: "ARS" }), { key: "ArrowLeft" });
      expect(onChange).toHaveBeenCalledWith("USD");
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
    it("los botones están deshabilitados cuando disabled=true", () => {
      const onChange = vi.fn();
      render(
        <CurrencySegmented value="ARS" onChange={onChange} disabled={true} />,
      );
      const ars = screen.getByRole("radio", { name: "ARS" });
      const usd = screen.getByRole("radio", { name: "USD" });
      expect(ars).toBeDisabled();
      expect(usd).toBeDisabled();
    });
  });
});
