/**
 * Tests del hook useTheme (Ola 4).
 *
 * Verifica:
 * - theme devuelve "system" cuando la clave está ausente en el blob
 * - theme devuelve el valor guardado cuando está presente ("light" / "dark" / "system")
 * - resolvedTheme es "light" cuando theme="light"
 * - resolvedTheme es "dark" cuando theme="dark"
 * - resolvedTheme se deriva de matchMedia cuando theme="system"
 * - setTheme llama a setPreferences con el blob completo (merge)
 * - setTheme aplica applyTheme al DOM (data-theme)
 * - isSaving refleja el estado de mutación de usePreferences
 * - tras refresh (prefs cargadas desde backend), theme y resolvedTheme reflejan el blob real
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTheme } from "@/hooks/use-theme";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: vi.fn(),
}));

import { usePreferences } from "@/hooks/use-preferences";

const mockUsePreferences = vi.mocked(usePreferences);
const mockSetPreferences = vi.fn();

function setupPrefs(prefs: Record<string, unknown> = {}, isSaving = false) {
  mockUsePreferences.mockReturnValue({
    preferences: prefs,
    isLoading: false,
    isError: false,
    error: null,
    setPreferences: mockSetPreferences,
    isSaving,
  } as ReturnType<typeof usePreferences>);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useTheme", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset dataset
    document.documentElement.removeAttribute("data-theme");
    // Reset localStorage
    try { localStorage.removeItem("control:theme"); } catch { /* no-op */ }
    // matchMedia mock siempre devuelve false (light) por defecto (ver setup.ts)
  });

  describe("theme — valor guardado", () => {
    it("devuelve 'system' cuando la clave está ausente", () => {
      setupPrefs({});
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe("system");
    });

    it("devuelve 'light' cuando theme='light' en el blob", () => {
      setupPrefs({ theme: "light" });
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe("light");
    });

    it("devuelve 'dark' cuando theme='dark' en el blob", () => {
      setupPrefs({ theme: "dark" });
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe("dark");
    });

    it("devuelve 'system' cuando theme='system' en el blob", () => {
      setupPrefs({ theme: "system" });
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe("system");
    });
  });

  describe("resolvedTheme — modo efectivo", () => {
    it("resuelve 'light' cuando theme='light'", () => {
      setupPrefs({ theme: "light" });
      const { result } = renderHook(() => useTheme());
      expect(result.current.resolvedTheme).toBe("light");
    });

    it("resuelve 'dark' cuando theme='dark'", () => {
      setupPrefs({ theme: "dark" });
      const { result } = renderHook(() => useTheme());
      expect(result.current.resolvedTheme).toBe("dark");
    });

    it("resuelve 'light' con system cuando matchMedia devuelve false (mock de setup)", () => {
      // El mock de setup devuelve matches: false → sistema en claro
      setupPrefs({ theme: "system" });
      const { result } = renderHook(() => useTheme());
      expect(result.current.resolvedTheme).toBe("light");
    });

    it("resuelve 'dark' con system cuando matchMedia devuelve true (sistema oscuro)", () => {
      // Sobreescribir matchMedia para este test
      const original = window.matchMedia;
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: (query: string) => ({
          matches: query.includes("dark"),
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }),
      });

      setupPrefs({ theme: "system" });
      const { result } = renderHook(() => useTheme());
      expect(result.current.resolvedTheme).toBe("dark");

      // Restaurar
      Object.defineProperty(window, "matchMedia", { writable: true, value: original });
    });
  });

  describe("isSaving", () => {
    it("devuelve false cuando usePreferences no está salvando", () => {
      setupPrefs({}, false);
      const { result } = renderHook(() => useTheme());
      expect(result.current.isSaving).toBe(false);
    });

    it("devuelve true cuando usePreferences está salvando", () => {
      setupPrefs({}, true);
      const { result } = renderHook(() => useTheme());
      expect(result.current.isSaving).toBe(true);
    });
  });

  describe("setTheme", () => {
    it("llama setPreferences con el blob completo mergeado", async () => {
      const existingPrefs = { unicosSort: "amount" as const };
      mockSetPreferences.mockResolvedValue({ success: true, preferences: { ...existingPrefs, theme: "dark" } });
      setupPrefs(existingPrefs);

      const { result } = renderHook(() => useTheme());

      await act(async () => {
        await result.current.setTheme("dark");
      });

      expect(mockSetPreferences).toHaveBeenCalledWith({
        ...existingPrefs,
        theme: "dark",
      });
    });

    it("aplica data-theme='dark' al DOM al setear 'dark'", async () => {
      mockSetPreferences.mockResolvedValue({ success: true, preferences: { theme: "dark" } });
      setupPrefs({});

      const { result } = renderHook(() => useTheme());

      await act(async () => {
        await result.current.setTheme("dark");
      });

      expect(document.documentElement.dataset.theme).toBe("dark");
    });

    it("aplica data-theme='light' al DOM al setear 'light'", async () => {
      mockSetPreferences.mockResolvedValue({ success: true, preferences: { theme: "light" } });
      setupPrefs({});

      const { result } = renderHook(() => useTheme());

      await act(async () => {
        await result.current.setTheme("light");
      });

      expect(document.documentElement.dataset.theme).toBe("light");
    });

    it("actualiza el mirror de localStorage al setear el tema", async () => {
      mockSetPreferences.mockResolvedValue({ success: true, preferences: { theme: "dark" } });
      setupPrefs({});

      const { result } = renderHook(() => useTheme());

      await act(async () => {
        await result.current.setTheme("dark");
      });

      expect(localStorage.getItem("control:theme")).toBe("dark");
    });

    it("devuelve { success: true } cuando setPreferences tiene éxito", async () => {
      mockSetPreferences.mockResolvedValue({ success: true, preferences: { theme: "light" } });
      setupPrefs({});

      const { result } = renderHook(() => useTheme());

      let setResult: Awaited<ReturnType<typeof result.current.setTheme>>;
      await act(async () => {
        setResult = await result.current.setTheme("light");
      });

      expect(setResult!.success).toBe(true);
    });

    it("devuelve { success: false } cuando setPreferences falla", async () => {
      mockSetPreferences.mockResolvedValue({
        success: false,
        error: "No se pudo guardar.",
      });
      setupPrefs({});

      const { result } = renderHook(() => useTheme());

      let setResult: Awaited<ReturnType<typeof result.current.setTheme>>;
      await act(async () => {
        setResult = await result.current.setTheme("dark");
      });

      expect(setResult!.success).toBe(false);
    });
  });

  // ─── Escenario refresh: prefs cargadas desde backend ─────────────────────────
  // Simula que usePreferences resolvió el blob real del backend tras un refresh
  // (el fix en use-preferences con initialDataUpdatedAt=0 dispara el fetch).
  // useTheme es un consumidor reactivo: cuando usePreferences cambia de {} a {theme:"dark"},
  // theme y resolvedTheme deben actualizarse.

  describe("tras refresh — blob del backend", () => {
    it("refleja theme='dark' cuando usePreferences actualiza el blob desde el backend", async () => {
      // Simular el estado inicial: prefs vacías (sesión en loading → initialData={})
      setupPrefs({});
      const { result, rerender } = renderHook(() => useTheme());

      expect(result.current.theme).toBe("system");

      // Simular que usePreferences terminó el fetch y tiene el blob real
      setupPrefs({ theme: "dark" });
      rerender();

      await waitFor(() => {
        expect(result.current.theme).toBe("dark");
      });
    });

    it("refleja resolvedTheme='dark' cuando el blob del backend tiene theme='dark'", async () => {
      setupPrefs({});
      const { result, rerender } = renderHook(() => useTheme());

      expect(result.current.resolvedTheme).toBe("light"); // system + matchMedia=false → light

      setupPrefs({ theme: "dark" });
      rerender();

      await waitFor(() => {
        expect(result.current.resolvedTheme).toBe("dark");
      });
    });

    it("aplica data-theme='dark' al DOM cuando el blob del backend tiene theme='dark'", async () => {
      setupPrefs({});
      const { rerender } = renderHook(() => useTheme());

      // Prefs del backend llegan
      setupPrefs({ theme: "dark" });
      rerender();

      await waitFor(() => {
        expect(document.documentElement.dataset.theme).toBe("dark");
      });
    });

    it("refleja theme='light' cuando el blob del backend tiene theme='light'", async () => {
      setupPrefs({});
      const { result, rerender } = renderHook(() => useTheme());

      setupPrefs({ theme: "light" });
      rerender();

      await waitFor(() => {
        expect(result.current.theme).toBe("light");
        expect(result.current.resolvedTheme).toBe("light");
      });
    });
  });
});
