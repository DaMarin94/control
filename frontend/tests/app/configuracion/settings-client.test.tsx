/**
 * Tests de SettingsClient (/configuracion).
 *
 * Verifica:
 * Tarjeta 1 — Moneda por defecto:
 * - Estado de carga: muestra skeleton (sin el segmented de moneda)
 * - Estado de error: muestra mensaje de error
 * - Estado cargado: muestra el segmented con los 4 segmentos y defaultCurrency correcto
 * - Cambiar la moneda llama updateSettings con la nueva moneda (ARS, USD, EUR, BRL)
 * - Toast de éxito al guardar correctamente
 * - Toast de error si la mutación falla
 * - isSaving: el segmented de moneda está deshabilitado mientras se guarda
 *
 * Nota: El control de Apariencia (modo de color) se mudó al sidebar.
 * Sus tests viven en tests/components/layout/app-sidebar.test.tsx
 * y tests/components/ui/theme-segmented.test.tsx.
 *
 * Nota: La sección "Datos externos" (debajo de la tarjeta de Moneda) tiene sus
 * propios tests en tests/app/configuracion/external-rates-section.test.tsx.
 * Acá se mockea `useExternalRates` (usa useApi/useSession internamente) para
 * que este archivo siga probando solo la tarjeta de Moneda de forma aislada.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SettingsClient } from "@/app/(app)/configuracion/settings-client";
import { ToastProvider } from "@/components/ui/toast";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-settings", () => ({
  useSettings: vi.fn(),
}));

vi.mock("@/hooks/use-external-rates", () => ({
  useExternalRates: vi.fn(() => ({
    snapshot: undefined,
    isLoading: true,
    isError: false,
    isLoadingMore: false,
    hasMore: false,
    loadOlderMonths: vi.fn(),
    isSyncing: false,
    syncExternalRates: vi.fn(),
  })),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    },
  })),
}));

import { useSettings } from "@/hooks/use-settings";
import { useToast } from "@/hooks/use-toast";

const mockUseSettings = vi.mocked(useSettings);
const mockUseToast = vi.mocked(useToast);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderSettings() {
  return render(
    <ToastProvider>
      <SettingsClient />
    </ToastProvider>,
  );
}

// ─── Setup base ───────────────────────────────────────────────────────────────

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockUpdateSettings = vi.fn();

function setupMocks({
  settingsOverrides = {},
}: {
  settingsOverrides?: Partial<ReturnType<typeof useSettings>>;
} = {}) {
  mockUseSettings.mockReturnValue({
    settings: { defaultCurrency: "ARS", lastExchangeRate: null },
    defaultCurrency: "ARS",
    lastExchangeRate: null,
    isLoading: false,
    isError: false,
    updateSettings: mockUpdateSettings,
    isSaving: false,
    ...settingsOverrides,
  });

  mockUseToast.mockReturnValue({
    toast: {
      success: mockToastSuccess,
      error: mockToastError,
      warning: vi.fn(),
      info: vi.fn(),
    },
    dismiss: vi.fn(),
  });
}

// ─── Tests — Tarjeta 1: Moneda por defecto ────────────────────────────────────

describe("SettingsClient — Moneda por defecto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Estado de carga", () => {
    it("muestra skeleton mientras isLoading=true (sin el radiogroup de moneda)", () => {
      setupMocks({ settingsOverrides: { isLoading: true } });
      renderSettings();
      // El segmented de moneda no debe estar presente
      expect(
        screen.queryByRole("radiogroup", { name: /moneda por defecto/i }),
      ).not.toBeInTheDocument();
      // El skeleton existe como aria-hidden
      const skeletons = document.querySelectorAll("[aria-hidden='true']");
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe("Estado de error", () => {
    it("muestra mensaje de error cuando isError=true", () => {
      setupMocks({ settingsOverrides: { isError: true, isLoading: false } });
      renderSettings();
      expect(
        screen.getByText(/no se pudo cargar la configuración/i),
      ).toBeInTheDocument();
    });
  });

  describe("Estado cargado — 4 segmentos", () => {
    it("muestra el segmented con los 4 segmentos (ARS, USD, EUR, BRL)", () => {
      setupMocks({ settingsOverrides: { defaultCurrency: "ARS" } });
      renderSettings();
      const radiogroup = screen.getByRole("radiogroup", { name: /moneda por defecto/i });
      expect(radiogroup).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "ARS" })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "USD" })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "EUR" })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "BRL" })).toBeInTheDocument();
    });

    it("ARS seleccionado: aria-checked=true solo en ARS", () => {
      setupMocks({ settingsOverrides: { defaultCurrency: "ARS" } });
      renderSettings();
      expect(screen.getByRole("radio", { name: "ARS" })).toHaveAttribute("aria-checked", "true");
      expect(screen.getByRole("radio", { name: "USD" })).toHaveAttribute("aria-checked", "false");
      expect(screen.getByRole("radio", { name: "EUR" })).toHaveAttribute("aria-checked", "false");
      expect(screen.getByRole("radio", { name: "BRL" })).toHaveAttribute("aria-checked", "false");
    });

    it("USD seleccionado: aria-checked=true solo en USD", () => {
      setupMocks({
        settingsOverrides: {
          defaultCurrency: "USD",
          settings: { defaultCurrency: "USD", lastExchangeRate: 1200 },
        },
      });
      renderSettings();
      expect(screen.getByRole("radio", { name: "USD" })).toHaveAttribute("aria-checked", "true");
      expect(screen.getByRole("radio", { name: "ARS" })).toHaveAttribute("aria-checked", "false");
    });

    it("EUR seleccionado: aria-checked=true solo en EUR", () => {
      setupMocks({
        settingsOverrides: {
          defaultCurrency: "EUR",
          settings: { defaultCurrency: "EUR", lastExchangeRate: null },
        },
      });
      renderSettings();
      expect(screen.getByRole("radio", { name: "EUR" })).toHaveAttribute("aria-checked", "true");
      expect(screen.getByRole("radio", { name: "ARS" })).toHaveAttribute("aria-checked", "false");
    });

    it("BRL seleccionado: aria-checked=true solo en BRL", () => {
      setupMocks({
        settingsOverrides: {
          defaultCurrency: "BRL",
          settings: { defaultCurrency: "BRL", lastExchangeRate: null },
        },
      });
      renderSettings();
      expect(screen.getByRole("radio", { name: "BRL" })).toHaveAttribute("aria-checked", "true");
      expect(screen.getByRole("radio", { name: "ARS" })).toHaveAttribute("aria-checked", "false");
    });
  });

  describe("Cambiar la moneda", () => {
    it("llama updateSettings con 'USD' al hacer click en USD", async () => {
      mockUpdateSettings.mockResolvedValue({ success: true });
      setupMocks({ settingsOverrides: { defaultCurrency: "ARS" } });
      renderSettings();

      fireEvent.click(screen.getByRole("radio", { name: "USD" }));

      await waitFor(() => {
        expect(mockUpdateSettings).toHaveBeenCalledWith({ defaultCurrency: "USD" });
      });
    });

    it("llama updateSettings con 'EUR' al hacer click en EUR", async () => {
      mockUpdateSettings.mockResolvedValue({ success: true });
      setupMocks({ settingsOverrides: { defaultCurrency: "ARS" } });
      renderSettings();

      fireEvent.click(screen.getByRole("radio", { name: "EUR" }));

      await waitFor(() => {
        expect(mockUpdateSettings).toHaveBeenCalledWith({ defaultCurrency: "EUR" });
      });
    });

    it("llama updateSettings con 'BRL' al hacer click en BRL", async () => {
      mockUpdateSettings.mockResolvedValue({ success: true });
      setupMocks({ settingsOverrides: { defaultCurrency: "ARS" } });
      renderSettings();

      fireEvent.click(screen.getByRole("radio", { name: "BRL" }));

      await waitFor(() => {
        expect(mockUpdateSettings).toHaveBeenCalledWith({ defaultCurrency: "BRL" });
      });
    });

    it("muestra toast de éxito al guardar correctamente", async () => {
      mockUpdateSettings.mockResolvedValue({ success: true });
      setupMocks({ settingsOverrides: { defaultCurrency: "ARS" } });
      renderSettings();

      fireEvent.click(screen.getByRole("radio", { name: "USD" }));

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("Moneda por defecto actualizada.");
      });
    });

    it("muestra toast de error si updateSettings falla", async () => {
      mockUpdateSettings.mockResolvedValue({
        success: false,
        error: "No se pudo guardar la configuración.",
      });
      setupMocks({ settingsOverrides: { defaultCurrency: "ARS" } });
      renderSettings();

      fireEvent.click(screen.getByRole("radio", { name: "USD" }));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("No se pudo guardar la configuración.");
      });
    });
  });

  describe("Estado isSaving — moneda", () => {
    it("todos los segmentos de moneda están deshabilitados mientras isSaving=true", () => {
      setupMocks({ settingsOverrides: { isSaving: true } });
      renderSettings();
      expect(screen.getByRole("radio", { name: "ARS" })).toBeDisabled();
      expect(screen.getByRole("radio", { name: "USD" })).toBeDisabled();
      expect(screen.getByRole("radio", { name: "EUR" })).toBeDisabled();
      expect(screen.getByRole("radio", { name: "BRL" })).toBeDisabled();
    });
  });
});
