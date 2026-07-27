/**
 * Tests de ExternalRatesSection (/configuracion → General, sección "Datos externos").
 *
 * Verifica:
 * - Cabecera: h2 "Datos externos" + botón "Actualizar datos" (outline, RefreshCw).
 * - Estado de carga: role="status" aria-label "Cargando datos externos"; botón deshabilitado.
 * - Estado de error: mensaje inline --expense-ink en ambas cards (Inflación y Cotizaciones).
 * - Estado cargado:
 *   - Card Inflación: destacado (mes + variación mono) + historial sin duplicar el destacado.
 *   - "Ver meses anteriores" visible solo si hasMore; llama a loadOlderMonths al click;
 *     muestra "Cargando…" cuando isLoadingMore=true.
 *   - Estado sin más historial del año → mensaje "Todavía no hay más datos de {año}.".
 *   - Card Cotizaciones: grilla 2×2 en orden fijo, "—" para valor faltante.
 *   - Pie: "Última actualización" + fuentes.
 * - Botón "Actualizar datos": estado "Actualizando…" + aria-busy cuando isSyncing=true.
 * - Click en "Actualizar datos" dispara syncExternalRates y muestra el toast según outcome
 *   (changed → success, unchanged → info, error → error).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ExternalRatesSection } from "@/app/(app)/configuracion/external-rates-section";
import { ToastProvider } from "@/components/ui/toast";
import type { ExternalRatesSnapshot } from "@/types/external-rates";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-external-rates", () => ({
  useExternalRates: vi.fn(),
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

import { useExternalRates } from "@/hooks/use-external-rates";
import { useToast } from "@/hooks/use-toast";

const mockUseExternalRates = vi.mocked(useExternalRates);
const mockUseToast = vi.mocked(useToast);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function buildSnapshot(overrides?: Partial<ExternalRatesSnapshot>): ExternalRatesSnapshot {
  return {
    ipc: {
      latest: {
        yearMonth: "2026-06",
        monthlyVariation: 1.58,
        indexValue: 120.5,
        fetchedAt: "2026-06-05T10:00:00.000Z",
        source: "apis.datos.gob.ar",
      },
      history: [
        {
          yearMonth: "2026-06",
          monthlyVariation: 1.58,
          indexValue: 120.5,
          fetchedAt: "2026-06-05T10:00:00.000Z",
          source: "apis.datos.gob.ar",
        },
        {
          yearMonth: "2026-05",
          monthlyVariation: 1.2,
          indexValue: 118.6,
          fetchedAt: "2026-05-05T10:00:00.000Z",
          source: "apis.datos.gob.ar",
        },
      ],
      from: "2026-01",
      hasMore: true,
      ...overrides?.ipc,
    },
    fx: {
      month: "2026-06",
      arsOficial: { compra: 1080, venta: 1100, fetchedAt: "2026-06-05T10:00:00.000Z", source: "dolarapi.com" },
      arsBlue: { compra: 1150, venta: 1180, fetchedAt: "2026-06-05T10:00:00.000Z", source: "dolarapi.com" },
      eur: { compra: 1200, venta: 1200, fetchedAt: "2026-06-05T10:00:00.000Z", source: "api.frankfurter.dev" },
      brl: null,
      ...overrides?.fx,
    },
  };
}

const mockLoadOlderMonths = vi.fn();
const mockSyncExternalRates = vi.fn();

function setupHook(overrides: Partial<ReturnType<typeof useExternalRates>> = {}) {
  mockUseExternalRates.mockReturnValue({
    snapshot: buildSnapshot(),
    isLoading: false,
    isError: false,
    isLoadingMore: false,
    hasMore: true,
    loadOlderMonths: mockLoadOlderMonths,
    isSyncing: false,
    syncExternalRates: mockSyncExternalRates,
    ...overrides,
  });
}

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockToastInfo = vi.fn();

function setupToast() {
  mockUseToast.mockReturnValue({
    toast: {
      success: mockToastSuccess,
      error: mockToastError,
      warning: vi.fn(),
      info: mockToastInfo,
    },
    dismiss: vi.fn(),
  });
}

function renderSection() {
  return render(
    <ToastProvider>
      <ExternalRatesSection />
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setupToast();
});

// ─── Cabecera ───────────────────────────────────────────────────────────────

describe("ExternalRatesSection — cabecera", () => {
  it("muestra h2 'Datos externos' y el botón 'Actualizar datos'", () => {
    setupHook();
    renderSection();
    expect(screen.getByRole("heading", { level: 2, name: "Datos externos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actualizar datos externos" })).toBeInTheDocument();
    expect(screen.getByText("Actualizar datos")).toBeInTheDocument();
  });

  it("botón deshabilitado durante la carga inicial", () => {
    setupHook({ isLoading: true, snapshot: undefined });
    renderSection();
    expect(screen.getByRole("button", { name: "Actualizar datos externos" })).toBeDisabled();
  });

  it("estado 'Actualizando…' con aria-busy cuando isSyncing=true", () => {
    setupHook({ isSyncing: true });
    renderSection();
    const button = screen.getByRole("button", { name: "Actualizar datos externos" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Actualizando…")).toBeInTheDocument();
  });
});

// ─── Estado de carga / error ──────────────────────────────────────────────────

describe("ExternalRatesSection — estados de carga y error", () => {
  it("carga inicial: role=status con aria-label 'Cargando datos externos'", () => {
    setupHook({ isLoading: true, snapshot: undefined, hasMore: false });
    renderSection();
    expect(screen.getByRole("status", { name: "Cargando datos externos" })).toBeInTheDocument();
  });

  it("error de carga: mensaje inline en ambas cards", () => {
    setupHook({ isError: true, snapshot: undefined, hasMore: false });
    renderSection();
    const errors = screen.getAllByText(/No se pudieron cargar los datos externos\. Recargá la página\./i);
    expect(errors).toHaveLength(2);
  });
});

// ─── Card Inflación ────────────────────────────────────────────────────────────

describe("ExternalRatesSection — card Inflación", () => {
  it("destacado muestra el mes capitalizado y la variación con %", () => {
    setupHook();
    renderSection();
    expect(screen.getByText("Último dato")).toBeInTheDocument();
    expect(screen.getByText("Junio 2026")).toBeInTheDocument();
    expect(screen.getByText("Variación mensual")).toBeInTheDocument();
    expect(screen.getByText("1,58%")).toBeInTheDocument();
  });

  it("historial no repite el mes del destacado", () => {
    setupHook();
    renderSection();
    // "Junio 2026" aparece una sola vez (el destacado); el historial arranca en Mayo.
    expect(screen.getAllByText("Junio 2026")).toHaveLength(1);
    expect(screen.getByText("Mayo 2026")).toBeInTheDocument();
    expect(screen.getByText("1,2%")).toBeInTheDocument();
  });

  it("'Ver meses anteriores' visible cuando hasMore=true; llama a loadOlderMonths al click", () => {
    setupHook({ hasMore: true });
    renderSection();
    const button = screen.getByRole("button", { name: "Ver meses anteriores" });
    fireEvent.click(button);
    expect(mockLoadOlderMonths).toHaveBeenCalledTimes(1);
  });

  it("'Ver meses anteriores' se desmonta cuando hasMore=false", () => {
    setupHook({ hasMore: false });
    renderSection();
    expect(screen.queryByRole("button", { name: "Ver meses anteriores" })).not.toBeInTheDocument();
  });

  it("muestra 'Cargando…' y deshabilita el botón cuando isLoadingMore=true", () => {
    setupHook({ hasMore: true, isLoadingMore: true });
    renderSection();
    expect(screen.getByText("Cargando…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cargando…" })).toBeDisabled();
  });

  it("sin más historial del año: muestra el mensaje con el año en curso", () => {
    setupHook({
      snapshot: buildSnapshot({
        ipc: {
          latest: buildSnapshot().ipc.latest,
          history: [buildSnapshot().ipc.history[0]], // solo el destacado → historial filtrado queda vacío
          from: "2026-01",
          hasMore: false,
        },
      }),
      hasMore: false,
    });
    renderSection();
    expect(screen.getByText("Todavía no hay más datos de 2026.")).toBeInTheDocument();
  });
});

// ─── Card Cotizaciones ─────────────────────────────────────────────────────────

describe("ExternalRatesSection — card Cotizaciones", () => {
  it("muestra las 4 cotizaciones en el orden fijo con formato $", () => {
    setupHook();
    renderSection();
    expect(screen.getByText("Dólar oficial")).toBeInTheDocument();
    expect(screen.getByText("Dólar blue")).toBeInTheDocument();
    expect(screen.getByText("Euro")).toBeInTheDocument();
    expect(screen.getByText("Real")).toBeInTheDocument();
    expect(screen.getByText("$1.100,00")).toBeInTheDocument();
    expect(screen.getByText("$1.180,00")).toBeInTheDocument();
    expect(screen.getByText("$1.200,00")).toBeInTheDocument();
  });

  it("cotización faltante muestra '—' conservando el rótulo", () => {
    setupHook();
    renderSection();
    expect(screen.getByText("Real")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

// ─── Pie discreto ───────────────────────────────────────────────────────────────

describe("ExternalRatesSection — pie discreto", () => {
  it("muestra última actualización y fuentes", () => {
    setupHook();
    renderSection();
    expect(
      screen.getByText(/Fuentes: INDEC \(inflación\) · dolarapi \(dólar\) · frankfurter \(euro, real\)\./),
    ).toBeInTheDocument();
    expect(screen.getByText(/Última actualización:/)).toBeInTheDocument();
  });

  it("no se renderiza mientras no hay snapshot (carga inicial)", () => {
    setupHook({ isLoading: true, snapshot: undefined, hasMore: false });
    renderSection();
    expect(screen.queryByText(/Última actualización:/)).not.toBeInTheDocument();
  });
});

// ─── Acción "Actualizar datos" → toasts ────────────────────────────────────────

describe("ExternalRatesSection — Actualizar datos (toasts)", () => {
  it("con cambios → toast de éxito 'Datos actualizados.'", async () => {
    mockSyncExternalRates.mockResolvedValue({ outcome: "changed" });
    setupHook();
    renderSection();

    fireEvent.click(screen.getByRole("button", { name: "Actualizar datos externos" }));

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Datos actualizados.");
    });
  });

  it("sin novedades → toast info 'Ya estás al día. No había datos nuevos.'", async () => {
    mockSyncExternalRates.mockResolvedValue({ outcome: "unchanged" });
    setupHook();
    renderSection();

    fireEvent.click(screen.getByRole("button", { name: "Actualizar datos externos" }));

    await waitFor(() => {
      expect(mockToastInfo).toHaveBeenCalledWith("Ya estás al día. No había datos nuevos.");
    });
  });

  it("error → toast de error 'No se pudieron actualizar los datos. Intentá de nuevo.'", async () => {
    mockSyncExternalRates.mockResolvedValue({ outcome: "error" });
    setupHook();
    renderSection();

    fireEvent.click(screen.getByRole("button", { name: "Actualizar datos externos" }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "No se pudieron actualizar los datos. Intentá de nuevo.",
      );
    });
  });
});
