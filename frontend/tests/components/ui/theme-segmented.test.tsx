/**
 * Tests de ThemeIconToggle (Ola 4 — reemplazo del segmented de labels).
 *
 * El componente ahora es un toggle de iconos (Monitor/Sun/Moon) sin labels visibles.
 * La identidad de cada segmento se da por aria-label, no por texto visible.
 *
 * Verifica:
 * - Renderiza role="radiogroup" con aria-label="Modo de color"
 * - Renderiza 3 segmentos con role="radio" en orden: Sistema · Claro · Oscuro
 * - Cada segmento tiene aria-label correcto (con modo resuelto en Sistema)
 * - aria-checked correcto según el valor activo
 * - Click en un segmento llama onChange con el valor correspondiente
 * - Navegación con ←/→ cicla entre las 3 opciones
 * - disabled=true deshabilita todos los segmentos
 * - Los segmentos NO tienen texto visible (el ícono es el control)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeIconToggle } from "@/components/ui/theme-icon-toggle";
import type { ThemeValue, ResolvedTheme } from "@/hooks/use-theme";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderToggle(
  value: ThemeValue = "system",
  onChange = vi.fn(),
  disabled = false,
  resolvedTheme: ResolvedTheme = "light",
) {
  return render(
    <ThemeIconToggle
      value={value}
      onChange={onChange}
      disabled={disabled}
      resolvedTheme={resolvedTheme}
    />,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ThemeIconToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Estructura y accesibilidad", () => {
    it("renderiza un radiogroup con aria-label='Modo de color'", () => {
      renderToggle();
      expect(screen.getByRole("radiogroup", { name: "Modo de color" })).toBeInTheDocument();
    });

    it("renderiza 3 segmentos con role='radio'", () => {
      renderToggle();
      const radios = screen.getAllByRole("radio");
      expect(radios).toHaveLength(3);
    });

    it("el aria-label de Sistema incluye el modo resuelto cuando es 'light'", () => {
      renderToggle("system", vi.fn(), false, "light");
      expect(
        screen.getByRole("radio", { name: /tema del sistema.*ahora: claro/i }),
      ).toBeInTheDocument();
    });

    it("el aria-label de Sistema incluye el modo resuelto cuando es 'dark'", () => {
      renderToggle("system", vi.fn(), false, "dark");
      expect(
        screen.getByRole("radio", { name: /tema del sistema.*ahora: oscuro/i }),
      ).toBeInTheDocument();
    });

    it("el aria-label de Claro es 'Tema claro'", () => {
      renderToggle();
      expect(screen.getByRole("radio", { name: "Tema claro" })).toBeInTheDocument();
    });

    it("el aria-label de Oscuro es 'Tema oscuro'", () => {
      renderToggle();
      expect(screen.getByRole("radio", { name: "Tema oscuro" })).toBeInTheDocument();
    });

    it("Sistema seleccionado: aria-checked=true solo en Sistema", () => {
      renderToggle("system", vi.fn(), false, "light");
      expect(
        screen.getByRole("radio", { name: /tema del sistema/i }),
      ).toHaveAttribute("aria-checked", "true");
      expect(screen.getByRole("radio", { name: "Tema claro" })).toHaveAttribute("aria-checked", "false");
      expect(screen.getByRole("radio", { name: "Tema oscuro" })).toHaveAttribute("aria-checked", "false");
    });

    it("Claro seleccionado: aria-checked=true solo en Claro", () => {
      renderToggle("light");
      expect(screen.getByRole("radio", { name: "Tema claro" })).toHaveAttribute("aria-checked", "true");
      expect(screen.getByRole("radio", { name: /tema del sistema/i })).toHaveAttribute("aria-checked", "false");
      expect(screen.getByRole("radio", { name: "Tema oscuro" })).toHaveAttribute("aria-checked", "false");
    });

    it("Oscuro seleccionado: aria-checked=true solo en Oscuro", () => {
      renderToggle("dark");
      expect(screen.getByRole("radio", { name: "Tema oscuro" })).toHaveAttribute("aria-checked", "true");
      expect(screen.getByRole("radio", { name: /tema del sistema/i })).toHaveAttribute("aria-checked", "false");
      expect(screen.getByRole("radio", { name: "Tema claro" })).toHaveAttribute("aria-checked", "false");
    });

    it("los segmentos NO tienen texto visible (ícono es el control)", () => {
      renderToggle();
      const radios = screen.getAllByRole("radio");
      radios.forEach((radio) => {
        // El texto content del botón debe estar vacío (solo SVG aria-hidden)
        expect(radio.textContent).toBe("");
      });
    });
  });

  describe("Interacción — click", () => {
    it("click en Oscuro llama onChange con 'dark'", () => {
      const onChange = vi.fn();
      renderToggle("system", onChange);
      fireEvent.click(screen.getByRole("radio", { name: "Tema oscuro" }));
      expect(onChange).toHaveBeenCalledWith("dark");
    });

    it("click en Claro llama onChange con 'light'", () => {
      const onChange = vi.fn();
      renderToggle("system", onChange);
      fireEvent.click(screen.getByRole("radio", { name: "Tema claro" }));
      expect(onChange).toHaveBeenCalledWith("light");
    });

    it("click en Sistema llama onChange con 'system'", () => {
      const onChange = vi.fn();
      renderToggle("dark", onChange, false, "dark");
      fireEvent.click(screen.getByRole("radio", { name: /tema del sistema/i }));
      expect(onChange).toHaveBeenCalledWith("system");
    });
  });

  describe("Navegación con teclado ←/→", () => {
    it("→ desde Sistema pasa a Claro", () => {
      const onChange = vi.fn();
      renderToggle("system", onChange, false, "light");
      fireEvent.keyDown(screen.getByRole("radio", { name: /tema del sistema/i }), { key: "ArrowRight" });
      expect(onChange).toHaveBeenCalledWith("light");
    });

    it("→ desde Claro pasa a Oscuro", () => {
      const onChange = vi.fn();
      renderToggle("light", onChange);
      fireEvent.keyDown(screen.getByRole("radio", { name: "Tema claro" }), { key: "ArrowRight" });
      expect(onChange).toHaveBeenCalledWith("dark");
    });

    it("→ desde Oscuro cicla a Sistema", () => {
      const onChange = vi.fn();
      renderToggle("dark", onChange);
      fireEvent.keyDown(screen.getByRole("radio", { name: "Tema oscuro" }), { key: "ArrowRight" });
      expect(onChange).toHaveBeenCalledWith("system");
    });

    it("← desde Sistema cicla a Oscuro", () => {
      const onChange = vi.fn();
      renderToggle("system", onChange, false, "light");
      fireEvent.keyDown(screen.getByRole("radio", { name: /tema del sistema/i }), { key: "ArrowLeft" });
      expect(onChange).toHaveBeenCalledWith("dark");
    });

    it("← desde Claro pasa a Sistema", () => {
      const onChange = vi.fn();
      renderToggle("light", onChange);
      fireEvent.keyDown(screen.getByRole("radio", { name: "Tema claro" }), { key: "ArrowLeft" });
      expect(onChange).toHaveBeenCalledWith("system");
    });

    it("← desde Oscuro pasa a Claro", () => {
      const onChange = vi.fn();
      renderToggle("dark", onChange);
      fireEvent.keyDown(screen.getByRole("radio", { name: "Tema oscuro" }), { key: "ArrowLeft" });
      expect(onChange).toHaveBeenCalledWith("light");
    });
  });

  describe("Estado disabled", () => {
    it("todos los segmentos están deshabilitados cuando disabled=true", () => {
      renderToggle("system", vi.fn(), true, "light");
      const radios = screen.getAllByRole("radio");
      radios.forEach((radio) => expect(radio).toBeDisabled());
    });

    it("ningún segmento está deshabilitado cuando disabled=false", () => {
      renderToggle("system", vi.fn(), false);
      const radios = screen.getAllByRole("radio");
      radios.forEach((radio) => expect(radio).not.toBeDisabled());
    });
  });

  describe("Iconos — sin clase mono", () => {
    it("los botones de segmento NO tienen la clase 'mono'", () => {
      renderToggle();
      const radios = screen.getAllByRole("radio");
      radios.forEach((radio) => {
        expect(radio.className).not.toContain("mono");
      });
    });
  });
});
