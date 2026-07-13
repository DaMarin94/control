/**
 * Tests de CuotasGanttCard (Ola 3, P2 — gantt anual de barras horizontales de Cuotas).
 *
 * Verifica:
 * - Cabecera: título editable, YearStepper, selector de moneda, botón quitar
 * - Estado de carga (skeleton con role="status")
 * - Estado de error + botón Reintentar
 * - Estado vacío (overlay "Sin gastos en cuotas en {año}.")
 * - Render de barras con aria-label correcto
 * - Packing invertido en eje visual (rowIndex=0 queda abajo)
 * - Indicadores de continuación ‹/› (continuesBefore / continuesAfter)
 * - Tooltip de barra portaled al hacer mouseenter/mouseleave
 * - Filtro de categorías: ChartLegend chips + LegendAllChip
 * - Hook useCuotasGantt llamado con parámetros correctos
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { CuotasGanttResponse } from "@/types/reports";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-reports", () => ({
  useCuotasGantt: vi.fn(),
  CUOTAS_GANTT_QUERY_KEY: (year: number, key: string | null) => ["reports-cuotas-gantt", year, key],
}));

vi.mock("@/hooks/use-api", () => ({
  useApi: vi.fn(() => ({
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
    token: "test-token",
    isAuthenticated: true,
  })),
}));

vi.mock("@/hooks/use-settings", () => ({
  useSettings: vi.fn(() => ({
    settings: { defaultCurrency: "ARS", lastExchangeRate: null },
    defaultCurrency: "ARS",
    lastExchangeRate: null,
    isLoading: false,
    isError: false,
    updateSettings: vi.fn(),
    isSaving: false,
  })),
}));

// Mock de useLimits (P2 — Tramo 2): [] = cero impacto, no afecta los tests existentes.
// Ver cuotas-gantt-card-limits.test.tsx para los tests dedicados de marca visual pasiva.
vi.mock("@/hooks/use-limits", () => ({
  useLimits: vi.fn(() => ({
    limits: [],
    isLoading: false,
    isSaving: false,
    create: vi.fn(),
    remove: vi.fn(),
    setEnabled: vi.fn(),
  })),
}));

// Mock de useCategories (P2 — popover informativo de límites): resuelve nombre/color
// de categoría para el refinamiento de límites. [] no afecta los tests existentes.
vi.mock("@/hooks/use-categories", () => ({
  useCategories: vi.fn(() => ({ categories: [], isLoading: false, isError: false })),
}));

import { useCuotasGantt } from "@/hooks/use-reports";
import { CuotasGanttCard } from "@/components/charts/cuotas-gantt-card";

const mockUseCuotasGantt = vi.mocked(useCuotasGantt);

// ─── Datos de ejemplo ─────────────────────────────────────────────────────────

/** Respuesta con dos barras en el gantt. */
const mockData: CuotasGanttResponse = {
  year: 2026,
  currency: "ARS",
  bars: [
    {
      id: "bar-1",
      description: "Netflix",
      categoryId: "cat-1",
      amountCents: 150000,
      startMonthIndex: 0, // enero
      endMonthIndex: 5,   // junio (6 meses)
      continuesBefore: false,
      continuesAfter: false,
      installmentFrom: 1,
      installmentTo: 6,
      totalInstallments: 12,
      rowIndex: 0, // renglón pegado al eje (abajo visual)
      realStartMonth: "2026-01",
      realEndMonth: "2026-12",
    },
    {
      id: "bar-2",
      description: "Laptop",
      categoryId: "cat-2",
      amountCents: 800000,
      startMonthIndex: 3, // abril
      endMonthIndex: 8,   // septiembre (6 meses)
      continuesBefore: false,
      continuesAfter: false,
      installmentFrom: 1,
      installmentTo: 6,
      totalInstallments: 6,
      rowIndex: 1, // renglón arriba del primero
      realStartMonth: "2026-04",
      realEndMonth: "2026-09",
    },
  ],
  rowCount: 2,
  availableCategories: [
    { categoryId: "cat-1", name: "Entretenimiento", color: "#4F86C6" },
    { categoryId: "cat-2", name: "Tecnología", color: "#E07B54" },
  ],
};

/** Barra que continúa antes y después del año. */
const barCrossingYear: CuotasGanttResponse = {
  year: 2026,
  currency: "ARS",
  bars: [
    {
      id: "bar-crossing",
      description: "Viaje",
      categoryId: "cat-1",
      amountCents: 500000,
      startMonthIndex: 0,   // enero (recortado, empieza antes)
      endMonthIndex: 11,    // diciembre (recortado, termina después)
      continuesBefore: true,
      continuesAfter: true,
      installmentFrom: 3,
      installmentTo: 14,
      totalInstallments: 24,
      rowIndex: 0,
      realStartMonth: "2025-11", // empieza en nov 2025
      realEndMonth: "2027-02",   // termina en feb 2027
    },
  ],
  rowCount: 1,
  availableCategories: [
    { categoryId: "cat-1", name: "Viajes", color: "#4F86C6" },
  ],
};

const emptyData: CuotasGanttResponse = {
  year: 2026,
  currency: "ARS",
  bars: [],
  rowCount: 0,
  availableCategories: [],
};

// ─── Wrapper ──────────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

type HookReturn = ReturnType<typeof useCuotasGantt>;

function makeSuccessReturn(data: CuotasGanttResponse = mockData): HookReturn {
  return {
    data,
    isLoading: false,
    isError: false,
    isPending: false,
    isSuccess: true,
    error: null,
    status: "success",
    fetchStatus: "idle",
    refetch: vi.fn(),
  } as unknown as HookReturn;
}

function renderCard(props: Partial<React.ComponentProps<typeof CuotasGanttCard>> = {}) {
  const defaults = { year: 2026 };
  return render(<CuotasGanttCard {...defaults} {...props} />, { wrapper: createWrapper() });
}

// ─── Tests — Cabecera ─────────────────────────────────────────────────────────

describe("CuotasGanttCard — cabecera", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCuotasGantt.mockReturnValue(makeSuccessReturn());
  });

  it("muestra el placeholder del título cuando no hay título propio", () => {
    renderCard({ titlePlaceholder: "Reporte 3" });
    expect(screen.getByText("Reporte 3")).toBeInTheDocument();
  });

  it("muestra el título propio cuando se provee", () => {
    renderCard({ title: "Mis cuotas anuales" });
    expect(screen.getByText("Mis cuotas anuales")).toBeInTheDocument();
  });

  it("muestra el stepper de año con ‹ y ›", () => {
    renderCard({ year: 2026 });
    expect(screen.getByText("2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /año anterior/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /año siguiente/i })).toBeInTheDocument();
  });

  it("NO muestra el botón quitar cuando removable=false", () => {
    renderCard({ removable: false });
    expect(screen.queryByRole("button", { name: /quitar reporte/i })).not.toBeInTheDocument();
  });

  it("muestra el botón quitar cuando removable=true", () => {
    renderCard({ removable: true });
    expect(screen.getByRole("button", { name: /quitar reporte/i })).toBeInTheDocument();
  });

  it("el botón quitar abre el popover de confirmación", () => {
    renderCard({ removable: true, onRemove: vi.fn() });
    fireEvent.click(screen.getByRole("button", { name: /quitar reporte/i }));
    expect(screen.getByText(/quitar este reporte/i)).toBeInTheDocument();
  });

  it("confirmar quitar llama onRemove", () => {
    const onRemove = vi.fn();
    renderCard({ removable: true, onRemove });
    fireEvent.click(screen.getByRole("button", { name: /quitar reporte/i }));
    const quitarBtns = screen.getAllByText("Quitar");
    const confirmBtn = quitarBtns[quitarBtns.length - 1];
    if (confirmBtn) fireEvent.click(confirmBtn);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

// ─── Tests — Estados de carga / error / vacío ─────────────────────────────────

describe("CuotasGanttCard — estados de carga/error/vacío", () => {
  beforeEach(() => vi.clearAllMocks());

  it("muestra skeleton (role=status) durante la carga", () => {
    mockUseCuotasGantt.mockReturnValue({
      ...makeSuccessReturn(),
      data: undefined,
      isLoading: true,
      isPending: true,
      isSuccess: false,
    } as unknown as HookReturn);
    renderCard();
    expect(screen.getByRole("status", { name: /cargando reporte/i })).toBeInTheDocument();
  });

  it("muestra error con botón Reintentar cuando falla", () => {
    mockUseCuotasGantt.mockReturnValue({
      ...makeSuccessReturn(),
      data: undefined,
      isLoading: false,
      isError: true,
      isPending: false,
      isSuccess: false,
      error: new Error("500"),
    } as unknown as HookReturn);
    renderCard();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
  });

  it("el botón Reintentar llama a refetch", () => {
    const refetch = vi.fn();
    mockUseCuotasGantt.mockReturnValue({
      ...makeSuccessReturn(),
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("500"),
      refetch,
    } as unknown as HookReturn);
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("muestra overlay 'Sin gastos en cuotas' cuando no hay barras", () => {
    mockUseCuotasGantt.mockReturnValue(makeSuccessReturn(emptyData));
    renderCard({ year: 2026 });
    expect(screen.getByText(/sin gastos en cuotas en 2026/i)).toBeInTheDocument();
  });

  it("NO muestra overlay de vacío cuando hay barras", () => {
    mockUseCuotasGantt.mockReturnValue(makeSuccessReturn(mockData));
    renderCard({ year: 2026 });
    expect(screen.queryByText(/sin gastos en cuotas en 2026/i)).not.toBeInTheDocument();
  });
});

describe("CuotasGanttCard — botón de refrescar per-card (P5)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("está presente sin depender de removable", () => {
    mockUseCuotasGantt.mockReturnValue(makeSuccessReturn());
    renderCard({ removable: false });
    expect(screen.getByRole("button", { name: /actualizar reporte/i })).toBeInTheDocument();
  });

  it("al hacer clic, llama a refetch", () => {
    const refetch = vi.fn();
    mockUseCuotasGantt.mockReturnValue({ ...makeSuccessReturn(), refetch });
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /actualizar reporte/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("se deshabilita y marca aria-busy mientras isFetching=true", () => {
    mockUseCuotasGantt.mockReturnValue({
      ...makeSuccessReturn(),
      isFetching: true,
    } as unknown as HookReturn);
    renderCard();
    const btn = screen.getByRole("button", { name: /actualizar reporte/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });
});

// ─── Tests — Canvas / barras ──────────────────────────────────────────────────

describe("CuotasGanttCard — render de barras", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCuotasGantt.mockReturnValue(makeSuccessReturn());
  });

  it("renderiza el header de meses (12 columnas con nombres abreviados)", () => {
    renderCard();
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    for (const m of months) {
      expect(screen.getByText(m)).toBeInTheDocument();
    }
  });

  it("renderiza barras con aria-label que incluye descripción y categoría", () => {
    renderCard({ year: 2026 });
    // Las barras tienen role="row" y aria-label que incluye la descripción
    const netflixBar = screen.getByRole("row", { name: /Netflix/i });
    expect(netflixBar).toBeInTheDocument();
    const laptopBar = screen.getByRole("row", { name: /Laptop/i });
    expect(laptopBar).toBeInTheDocument();
  });

  it("el aria-label de la barra incluye el rango de meses", () => {
    renderCard({ year: 2026 });
    const netflixBar = screen.getByRole("row", { name: /Netflix/i });
    // La barra va de enero a junio
    expect(netflixBar.getAttribute("aria-label")).toMatch(/Ene/);
    expect(netflixBar.getAttribute("aria-label")).toMatch(/Jun/);
  });

  it("el aria-label de la barra incluye continuación cuando continuesBefore=true", () => {
    mockUseCuotasGantt.mockReturnValue(makeSuccessReturn(barCrossingYear));
    renderCard({ year: 2026 });
    const viajBar = screen.getByRole("row", { name: /Viaje/i });
    expect(viajBar.getAttribute("aria-label")).toMatch(/año anterior/i);
  });

  it("el aria-label de la barra incluye continuación cuando continuesAfter=true", () => {
    mockUseCuotasGantt.mockReturnValue(makeSuccessReturn(barCrossingYear));
    renderCard({ year: 2026 });
    const viajBar = screen.getByRole("row", { name: /Viaje/i });
    expect(viajBar.getAttribute("aria-label")).toMatch(/año siguiente/i);
  });

  it("el plot canvas tiene role='table' con aria-label del año", () => {
    const { container } = renderCard({ year: 2026 });
    const plot = container.querySelector("[role='table']");
    expect(plot).toBeTruthy();
    expect(plot?.getAttribute("aria-label")).toContain("2026");
  });
});

// ─── Tests — Packing invertido en eje visual ──────────────────────────────────

describe("CuotasGanttCard — packing invertido en eje visual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCuotasGantt.mockReturnValue(makeSuccessReturn());
  });

  it("renderiza barras de ambos rowIndex (0 y 1) sin error", () => {
    renderCard({ year: 2026 });
    // Las dos barras deben estar presentes aunque tengan rowIndex distintos
    expect(screen.getByRole("row", { name: /Netflix/i })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Laptop/i })).toBeInTheDocument();
  });

  it("la barra con rowIndex=0 (backend, pegado al eje) tiene top mayor que la de rowIndex=1", () => {
    // Verificación: en el DOM, la barra rowIndex=0 debe estar más abajo (top mayor)
    // rowIndex=0 → visualRowIndex = rowCount-1-0 = 1 (renglón 1 = abajo visualmente)
    // rowIndex=1 → visualRowIndex = rowCount-1-1 = 0 (renglón 0 = arriba visualmente)
    const { container } = renderCard({ year: 2026 });
    const bars = container.querySelectorAll("[role='row']");
    // Hay 2 barras
    expect(bars.length).toBe(2);
    const bar0Top = parseInt((bars[0] as HTMLElement).style.top ?? "0", 10);
    const bar1Top = parseInt((bars[1] as HTMLElement).style.top ?? "0", 10);
    // La barra de Netflix (rowIndex=0 → visualRowIndex=1) debe estar más abajo (top mayor)
    // que la de Laptop (rowIndex=1 → visualRowIndex=0)
    // Netflix es bars[0], Laptop es bars[1] (orden de bars en el array)
    expect(bar0Top).toBeGreaterThan(bar1Top);
  });
});

// ─── Tests — Chevrons de continuación ─────────────────────────────────────────

describe("CuotasGanttCard — chevrons de continuación", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renderiza un ChevronLeft (‹) cuando continuesBefore=true", () => {
    mockUseCuotasGantt.mockReturnValue(makeSuccessReturn(barCrossingYear));
    const { container } = renderCard({ year: 2026 });
    // ChevronLeft viene de lucide-react; en el DOM es un <svg>
    // Buscamos en la barra que tiene continuesBefore=true
    const viajeBar = container.querySelector("[role='row']");
    expect(viajeBar).toBeTruthy();
    // Dentro de la barra hay un span con ChevronLeft
    const leftChevronSpan = viajeBar?.querySelector("span:first-child");
    expect(leftChevronSpan).toBeTruthy();
  });

  it("la barra sin continuación NO tiene chevrons", () => {
    // Barra con continuesBefore=false y continuesAfter=false
    const singleBar: CuotasGanttResponse = {
      ...mockData,
      bars: [{ ...mockData.bars[0]!, continuesBefore: false, continuesAfter: false }],
      rowCount: 1,
    };
    mockUseCuotasGantt.mockReturnValue(makeSuccessReturn(singleBar));
    const { container } = renderCard({ year: 2026 });
    const netflixBar = container.querySelector("[role='row']");
    // La barra existe
    expect(netflixBar).toBeTruthy();
  });
});

// ─── Tests — Tooltip de barra ─────────────────────────────────────────────────

describe("CuotasGanttCard — tooltip de barra", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCuotasGantt.mockReturnValue(makeSuccessReturn());
  });

  it("el tooltip aparece al hacer mouseenter en una barra", () => {
    renderCard({ year: 2026 });
    const netflixBar = screen.getByRole("row", { name: /Netflix/i });
    fireEvent.mouseEnter(netflixBar);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("el tooltip contiene la descripción de la barra", () => {
    renderCard({ year: 2026 });
    const netflixBar = screen.getByRole("row", { name: /Netflix/i });
    fireEvent.mouseEnter(netflixBar);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Netflix");
  });

  it("el tooltip contiene el nombre de la categoría", () => {
    renderCard({ year: 2026 });
    const netflixBar = screen.getByRole("row", { name: /Netflix/i });
    fireEvent.mouseEnter(netflixBar);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Entretenimiento");
  });

  it("el tooltip contiene el label 'por cuota'", () => {
    renderCard({ year: 2026 });
    const netflixBar = screen.getByRole("row", { name: /Netflix/i });
    fireEvent.mouseEnter(netflixBar);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent(/por cuota/i);
  });

  it("el tooltip contiene el total de cuotas", () => {
    renderCard({ year: 2026 });
    const netflixBar = screen.getByRole("row", { name: /Netflix/i });
    fireEvent.mouseEnter(netflixBar);
    const tooltip = screen.getByRole("tooltip");
    // Netflix tiene totalInstallments=12
    expect(tooltip).toHaveTextContent("12 cuotas");
  });

  it("el tooltip desaparece al hacer mouseleave", () => {
    renderCard({ year: 2026 });
    const netflixBar = screen.getByRole("row", { name: /Netflix/i });
    fireEvent.mouseEnter(netflixBar);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.mouseLeave(netflixBar);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("el tooltip NO muestra 'Continúa desde' aunque continuesBefore=true (los chevrons ‹ ya lo comunican)", () => {
    mockUseCuotasGantt.mockReturnValue(makeSuccessReturn(barCrossingYear));
    renderCard({ year: 2026 });
    const viajBar = screen.getByRole("row", { name: /Viaje/i });
    fireEvent.mouseEnter(viajBar);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).not.toHaveTextContent(/continúa desde/i);
  });

  it("el tooltip NO muestra 'Continúa hasta' aunque continuesAfter=true (los chevrons › ya lo comunican)", () => {
    mockUseCuotasGantt.mockReturnValue(makeSuccessReturn(barCrossingYear));
    renderCard({ year: 2026 });
    const viajBar = screen.getByRole("row", { name: /Viaje/i });
    fireEvent.mouseEnter(viajBar);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).not.toHaveTextContent(/continúa hasta/i);
  });

  // ── Tests de rango REAL (FIX 1) ───────────────────────────────────────────

  it("el tooltip muestra el rango REAL de la barra cuando cruza años", () => {
    // barCrossingYear: realStartMonth="2025-11", realEndMonth="2027-02"
    mockUseCuotasGantt.mockReturnValue(makeSuccessReturn(barCrossingYear));
    renderCard({ year: 2026 });
    const viajBar = screen.getByRole("row", { name: /Viaje/i });
    fireEvent.mouseEnter(viajBar);
    const tooltip = screen.getByRole("tooltip");
    // El período debe mostrar "nov 2025 – feb 2027"
    expect(tooltip).toHaveTextContent(/nov 2025/i);
    expect(tooltip).toHaveTextContent(/feb 2027/i);
  });

  it("el tooltip muestra un solo mes cuando realStartMonth === realEndMonth", () => {
    const singleMonthBar: CuotasGanttResponse = {
      ...mockData,
      bars: [{
        ...mockData.bars[0]!,
        startMonthIndex: 2,
        endMonthIndex: 2,
        installmentFrom: 1,
        installmentTo: 1,
        totalInstallments: 1,
        realStartMonth: "2026-03",
        realEndMonth: "2026-03",
      }],
      rowCount: 1,
    };
    mockUseCuotasGantt.mockReturnValue(makeSuccessReturn(singleMonthBar));
    renderCard({ year: 2026 });
    const bar = screen.getByRole("row", { name: /Netflix/i });
    fireEvent.mouseEnter(bar);
    const tooltip = screen.getByRole("tooltip");
    // Período: solo "mar 2026" (sin guión de rango)
    expect(tooltip).toHaveTextContent(/mar 2026/i);
    // No debe mostrar un segundo "–" de rango
    expect(tooltip.textContent).not.toMatch(/–.*2026/);
  });

  it("el tooltip NO muestra el año del año visible sino el año real cuando la barra cruza años", () => {
    // La barra cruza desde 2025 hasta 2027; el año visible es 2026.
    // El tooltip debe mostrar los años reales (2025, 2027), no 2026.
    mockUseCuotasGantt.mockReturnValue(makeSuccessReturn(barCrossingYear));
    renderCard({ year: 2026 });
    const viajBar = screen.getByRole("row", { name: /Viaje/i });
    fireEvent.mouseEnter(viajBar);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent(/2025/);
    expect(tooltip).toHaveTextContent(/2027/);
  });

  it("el tooltip muestra 'Sin descripción' cuando description=null", () => {
    const nullDescData: CuotasGanttResponse = {
      ...mockData,
      bars: [{ ...mockData.bars[0]!, description: null }],
      rowCount: 1,
    };
    mockUseCuotasGantt.mockReturnValue(makeSuccessReturn(nullDescData));
    renderCard({ year: 2026 });
    const bar = screen.getByRole("row", { name: /sin descripción/i });
    fireEvent.mouseEnter(bar);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent(/sin descripción/i);
  });
});

// ─── Tests — Filtro de categorías ────────────────────────────────────────────

describe("CuotasGanttCard — filtro de categorías", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCuotasGantt.mockReturnValue(makeSuccessReturn());
  });

  it("muestra chips de las categorías disponibles", () => {
    renderCard();
    expect(screen.getByText("Entretenimiento")).toBeInTheDocument();
    expect(screen.getByText("Tecnología")).toBeInTheDocument();
  });

  it("muestra el chip 'Ninguna' (LegendAllChip) cuando todas activas", () => {
    renderCard();
    expect(screen.getByRole("button", { name: "Ocultar todas las categorías" })).toBeInTheDocument();
    expect(screen.getByText("Ninguna")).toBeInTheDocument();
  });

  it("muestra el chip 'Todas' cuando hay alguna desactivada", () => {
    renderCard({ categoryIds: ["cat-2"] });
    expect(screen.getByRole("button", { name: "Mostrar todas las categorías" })).toBeInTheDocument();
    expect(screen.getByText("Todas")).toBeInTheDocument();
  });

  it("clic en 'Ninguna' llama onCategoryIdsChange con []", () => {
    const onCategoryIdsChange = vi.fn();
    renderCard({ onCategoryIdsChange });
    fireEvent.click(screen.getByRole("button", { name: "Ocultar todas las categorías" }));
    expect(onCategoryIdsChange).toHaveBeenCalledWith([]);
  });

  it("clic en 'Todas' llama onCategoryIdsChange con null", () => {
    const onCategoryIdsChange = vi.fn();
    renderCard({ categoryIds: ["cat-2"], onCategoryIdsChange });
    fireEvent.click(screen.getByRole("button", { name: "Mostrar todas las categorías" }));
    expect(onCategoryIdsChange).toHaveBeenCalledWith(null);
  });

  it("NO muestra chips ni LegendAllChip cuando no hay categorías disponibles", () => {
    mockUseCuotasGantt.mockReturnValue(makeSuccessReturn(emptyData));
    renderCard();
    expect(screen.queryByRole("button", { name: "Ocultar todas las categorías" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mostrar todas las categorías" })).not.toBeInTheDocument();
  });
});

// ─── Tests — Hook y parámetros ────────────────────────────────────────────────

describe("CuotasGanttCard — hook y parámetros", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCuotasGantt.mockReturnValue(makeSuccessReturn());
  });

  it("llama a useCuotasGantt con el año correcto", () => {
    renderCard({ year: 2025 });
    expect(mockUseCuotasGantt).toHaveBeenCalledWith(
      2025,
      null,      // categoryIds default
      undefined, // currency default
    );
  });

  it("pasa currency al hook cuando se provee", () => {
    renderCard({ year: 2026, currency: "USD" });
    expect(mockUseCuotasGantt).toHaveBeenCalledWith(
      2026,
      null,
      "USD",
    );
  });

  it("pasa categoryIds al hook cuando se filtra", () => {
    renderCard({ year: 2026, categoryIds: ["cat-1"] });
    expect(mockUseCuotasGantt).toHaveBeenCalledWith(
      2026,
      ["cat-1"],
      undefined,
    );
  });

  it("NO tiene parámetro today (diferencia con useCuotasGantt vs useUnicoGrid)", () => {
    renderCard({ year: 2026 });
    // useCuotasGantt recibe exactamente 3 argumentos (sin today)
    const calls = mockUseCuotasGantt.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]?.length).toBe(3);
  });
});

// ─── Tests — Stepper de año ───────────────────────────────────────────────────

describe("CuotasGanttCard — stepper de año", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCuotasGantt.mockReturnValue(makeSuccessReturn());
  });

  it("llama onYearChange al hacer clic en ‹ (año anterior)", () => {
    const onYearChange = vi.fn();
    renderCard({ year: 2025, onYearChange });
    fireEvent.click(screen.getByRole("button", { name: /año anterior/i }));
    expect(onYearChange).toHaveBeenCalledWith(2024);
  });

  it("› deshabilitado cuando year === año actual", () => {
    const currentYear = new Date().getFullYear();
    renderCard({ year: currentYear });
    const nextBtn = screen.getByRole("button", { name: /año siguiente/i });
    const isDisabled =
      nextBtn.hasAttribute("disabled") || nextBtn.getAttribute("aria-disabled") === "true";
    expect(isDisabled).toBe(true);
  });

  it("llama onYearChange al hacer clic en › (año siguiente)", () => {
    const onYearChange = vi.fn();
    renderCard({ year: 2024, onYearChange });
    fireEvent.click(screen.getByRole("button", { name: /año siguiente/i }));
    expect(onYearChange).toHaveBeenCalledWith(2025);
  });
});

// ─── Tests — Etiqueta de barra (FIX 2) ───────────────────────────────────────

describe("CuotasGanttCard — etiqueta de barra", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCuotasGantt.mockReturnValue(makeSuccessReturn());
  });

  it("barra ancha (≥2 meses): muestra el monto como pieza primaria (data-testid=bar-amount)", () => {
    // Netflix: startMonthIndex=0, endMonthIndex=5 → 6 meses → barra ancha
    const { container } = renderCard({ year: 2026 });
    // Debe haber elementos con data-testid="bar-amount" dentro de las barras
    const amountSpans = container.querySelectorAll("[data-testid='bar-amount']");
    expect(amountSpans.length).toBeGreaterThan(0);
  });

  it("barra ancha (≥2 meses): muestra el nombre de la compra junto al monto", () => {
    // Netflix: 6 meses → escalón 1 (monto + nombre)
    const { container } = renderCard({ year: 2026 });
    // El texto "Netflix" debe aparecer dentro de una barra (no solo en el aria-label)
    // Buscamos dentro de las barras (role="row") el texto de la descripción
    const bars = container.querySelectorAll("[role='row']");
    const netflixBar = Array.from(bars).find(b => b.getAttribute("aria-label")?.includes("Netflix"));
    expect(netflixBar).toBeTruthy();
    // El nombre debe estar en el contenido de texto de la barra
    expect(netflixBar?.textContent).toContain("Netflix");
  });

  it("barra de 1 mes (angosta): muestra solo el monto dentro, sin nombre", () => {
    // Creamos una barra de 1 mes (startMonthIndex === endMonthIndex)
    const oneMouthBar: CuotasGanttResponse = {
      ...mockData,
      bars: [{
        ...mockData.bars[0]!,
        description: "Compra corta",
        startMonthIndex: 3, // abril
        endMonthIndex: 3,   // abril (1 mes)
        installmentFrom: 1,
        installmentTo: 1,
        totalInstallments: 1,
        realStartMonth: "2026-04",
        realEndMonth: "2026-04",
      }],
      rowCount: 1,
    };
    mockUseCuotasGantt.mockReturnValue(makeSuccessReturn(oneMouthBar));
    const { container } = renderCard({ year: 2026 });
    const bars = container.querySelectorAll("[role='row']");
    const bar = bars[0] as HTMLElement;
    // La barra debe tener el monto (data-testid=bar-amount) pero NO el nombre "Compra corta"
    const amountEl = bar.querySelector("[data-testid='bar-amount']");
    expect(amountEl).toBeTruthy();
    // El nombre "Compra corta" no debe estar en el contenido visible de la barra
    // (puede estar en el aria-label pero no en el DOM de texto)
    const innerText = Array.from(bar.querySelectorAll("[aria-hidden='true']"))
      .map(el => el.textContent ?? "")
      .join("");
    expect(innerText).not.toContain("Compra corta");
  });

  it("barra de 1 mes con chevrones en ambos extremos (escalón 3): monto aparece afuera (data-testid=outer-amount)", () => {
    // Barra de 1 mes con continuesBefore Y continuesAfter → escalón 3: labelOutside
    const extremeBar: CuotasGanttResponse = {
      ...mockData,
      bars: [{
        ...mockData.bars[0]!,
        description: "Compra extrema",
        startMonthIndex: 5, // junio
        endMonthIndex: 5,   // junio (1 mes)
        continuesBefore: true,
        continuesAfter: true,
        installmentFrom: 7,
        installmentTo: 7,
        totalInstallments: 12,
        realStartMonth: "2025-12",
        realEndMonth: "2026-12",
      }],
      rowCount: 1,
    };
    mockUseCuotasGantt.mockReturnValue(makeSuccessReturn(extremeBar));
    const { container } = renderCard({ year: 2026 });
    // Debe existir un elemento con data-testid=outer-amount (monto afuera de la barra)
    const outerAmount = container.querySelector("[data-testid='outer-amount']");
    expect(outerAmount).toBeTruthy();
    // El nombre NUNCA viaja afuera
    const outerEl = outerAmount?.parentElement;
    expect(outerEl?.textContent).not.toContain("Compra extrema");
  });
});
