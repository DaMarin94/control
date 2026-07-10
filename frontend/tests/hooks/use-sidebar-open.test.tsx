/**
 * Tests del hook useSidebarOpen (RF-NAV-002).
 *
 * Verifica:
 * - sidebarOpen arranca en el valor de `initialOpen` (server-rendered, anti-flash).
 * - toggleSidebar invierte el estado local de forma optimista (sin esperar la red).
 * - toggleSidebar persiste en el blob de preferencias con reemplazo total
 *   ({ ...preferences, sidebarOpen: next }), mismo patrón que useTheme.
 * - isSaving refleja el estado de mutación de usePreferences.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSidebarOpen } from "@/hooks/use-sidebar-open";

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

describe("useSidebarOpen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetPreferences.mockResolvedValue({ success: true, preferences: {} });
  });

  it("arranca en el valor de initialOpen=true (default abierto)", () => {
    setupPrefs({});
    const { result } = renderHook(() => useSidebarOpen(true));
    expect(result.current.sidebarOpen).toBe(true);
  });

  it("arranca en el valor de initialOpen=false (server-rendered cerrado)", () => {
    setupPrefs({ sidebarOpen: false });
    const { result } = renderHook(() => useSidebarOpen(false));
    expect(result.current.sidebarOpen).toBe(false);
  });

  it("toggleSidebar invierte sidebarOpen de forma optimista (true → false)", () => {
    setupPrefs({});
    const { result } = renderHook(() => useSidebarOpen(true));

    act(() => {
      result.current.toggleSidebar();
    });

    expect(result.current.sidebarOpen).toBe(false);
  });

  it("toggleSidebar invierte sidebarOpen de forma optimista (false → true)", () => {
    setupPrefs({ sidebarOpen: false });
    const { result } = renderHook(() => useSidebarOpen(false));

    act(() => {
      result.current.toggleSidebar();
    });

    expect(result.current.sidebarOpen).toBe(true);
  });

  it("toggleSidebar persiste el blob completo con reemplazo total (merge del llamador)", () => {
    const existingPrefs = { theme: "dark" as const };
    setupPrefs(existingPrefs);
    const { result } = renderHook(() => useSidebarOpen(true));

    act(() => {
      result.current.toggleSidebar();
    });

    expect(mockSetPreferences).toHaveBeenCalledWith({
      ...existingPrefs,
      sidebarOpen: false,
    });
  });

  it("un segundo toggle vuelve al estado original", () => {
    setupPrefs({});
    const { result } = renderHook(() => useSidebarOpen(true));

    act(() => {
      result.current.toggleSidebar();
    });
    expect(result.current.sidebarOpen).toBe(false);

    act(() => {
      result.current.toggleSidebar();
    });
    expect(result.current.sidebarOpen).toBe(true);
  });

  describe("isSaving", () => {
    it("devuelve false cuando usePreferences no está salvando", () => {
      setupPrefs({}, false);
      const { result } = renderHook(() => useSidebarOpen(true));
      expect(result.current.isSaving).toBe(false);
    });

    it("devuelve true cuando usePreferences está salvando", () => {
      setupPrefs({}, true);
      const { result } = renderHook(() => useSidebarOpen(true));
      expect(result.current.isSaving).toBe(true);
    });
  });
});
