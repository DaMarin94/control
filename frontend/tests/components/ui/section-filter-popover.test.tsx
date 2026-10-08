/**
 * Regresión — contención responsive del popover de filtro de sección (§8.2,
 * docs/design.md "Posicionamiento de popovers/listbox por portal"). Bug:
 * viewport piso 602×615 + simulaciones activas en Únicos → el popover
 * desbordaba el viewport y sus botones "Eliminar la simulación de …" quedaban
 * fuera de pantalla, inalcanzables.
 *
 * Dos causas raíz, ambas en `usePanelPosition`:
 *
 * 1. La 2da pasada de medición (alto REAL del panel, una vez montado)
 *    dependía solo de `calc`/`panelRef` — ambos estables por identidad — así
 *    que corría una ÚNICA vez, en el primer commit donde `SectionFilterPanel`
 *    todavía devuelve `null` (guard de `mounted`) y `panelRef.current` es
 *    `null`. El efecto quedaba como no-op para siempre: la posición final
 *    dependía solo del ESTIMADO (560px), no del alto real. (Fix: agregar
 *    `mounted` al dep-array.)
 *
 * 2. Con (1) resuelto, el bug persistía: la 1ra pasada (estimado) puede
 *    concluir "no entra en ningún lado" y aplicar un `maxHeight` ya
 *    clampeado (p. ej. 277px) en el PRIMER render real del panel (estimado y
 *    `mounted=true` se baten en el mismo commit). La 2da pasada medía
 *    entonces `getBoundingClientRect().height`, que en ese punto ya está
 *    recortada por ese `maxHeight` (vía `overflow-y-auto`) — no el contenido
 *    real (549px). Ese número corrupto (277) hacía que `calc` concluyera
 *    erróneamente "entra abajo" y liberara el `maxHeight` de vuelta al cap
 *    (560px), dejando que el contenido real (549px, que SÍ excede el espacio
 *    disponible) se desbordara del viewport. (Fix: medir `scrollHeight` en
 *    vez de `getBoundingClientRect().height` — inmune al `maxHeight` vigente
 *    al momento de medir.)
 *
 * Los números de este archivo (alto real del panel = 549px / `scrollHeight`
 * 547px) son una medición real en el navegador, no una estimación.
 */
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/hooks/use-simulations", () => ({
  useExtendSimulation: () => ({ extendSimulation: vi.fn() }),
}));

import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SectionFilterButton } from "@/components/ui/section-filter-popover";
import { SimulationBand } from "@/components/movements/simulation-band";
import { ToastProvider } from "@/components/ui/toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SimulationDto } from "@/types/simulation";

function Wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeSim(id: string, name: string): SimulationDto {
  return {
    id,
    categoryId: id,
    category: { id, name, color: "#ff0000", scope: "EXPENSE" },
    monthsWithData: 5,
    paused: false,
    startMonth: "2025-01",
    effectiveStartMonth: "2025-01",
    endMonth: "2099-12",
    createdAt: "2025-01-01",
  } as unknown as SimulationDto;
}

const categories = Array.from({ length: 13 }, (_, i) => ({
  id: `c${i}`,
  name: `Categoria ${i}`,
  color: "#333",
}));

/**
 * Instala mocks de medición del disparador y del panel.
 *
 * - `getBoundingClientRect` del disparador: rect fijo (top/bottom provistos).
 * - `scrollHeight` del panel: alto LÓGICO real del contenido, el valor que la
 *   2da pasada de `usePanelPosition` usa para decidir flip/clamp (ver
 *   comentario de cabecera del archivo — NO se mide vía
 *   `getBoundingClientRect`, que en el primer render real puede estar ya
 *   recortada por el `maxHeight` del estimado).
 */
function mockRects(triggerRect: { top: number; bottom: number }, panelScrollHeight: number) {
  const originalRect = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.tagName === "BUTTON" && this.getAttribute("aria-label") === "Filtrar Únicos") {
      return {
        top: triggerRect.top,
        bottom: triggerRect.bottom,
        left: 500,
        right: 527,
        width: 27,
        height: triggerRect.bottom - triggerRect.top,
        x: 500,
        y: triggerRect.top,
        toJSON: () => ({}),
      } as DOMRect;
    }
    return originalRect.call(this);
  });

  // `scrollHeight` es un accessor de solo lectura en jsdom (siempre 0); se
  // redefine en el prototipo para el elemento con el testid del panel.
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get(this: HTMLElement) {
      if (this.getAttribute("data-testid") === "section-filter-popover-unicos") {
        return panelScrollHeight;
      }
      return 0;
    },
  });
}

function renderPopover() {
  render(
    <SectionFilterButton
      sectionKey="unicos"
      sectionLabel="Únicos"
      sectionCategories={categories}
      selectedType="ALL"
      selectedCategories={null}
      onTypeChange={() => {}}
      onCategoriesChange={() => {}}
      footerSlot={() => (
        <SimulationBand
          currentMonth="2025-06"
          viewedMonth="2025-06"
          simulations={[makeSim("1", "Comida"), makeSim("2", "Transporte")]}
          onOpenCreate={() => {}}
          onRequestDelete={() => {}}
        />
      )}
    />,
    { wrapper: Wrapper },
  );
}

describe("SectionFilterPopover — contención responsive (flip vertical + clamp)", () => {
  it("viewport piso 602×615 con simulaciones activas: no entra en ningún lado → clampea maxHeight al espacio disponible, el panel queda íntegro en viewport y el footer es alcanzable", () => {
    Object.defineProperty(window, "innerHeight", { value: 615, configurable: true });
    Object.defineProperty(window, "innerWidth", { value: 602, configurable: true });
    // Medición real en el navegador (repro original): disparador top 295 /
    // bottom 320; panel con `scrollHeight` 547 (offsetHeight real 549).
    mockRects({ top: 295, bottom: 320 }, 547);

    renderPopover();
    fireEvent.click(screen.getByLabelText("Filtrar Únicos"));

    const panel = screen.getByRole("dialog", { name: "Filtrar Únicos" });
    const top = parseFloat(panel.style.top);
    const maxHeight = parseFloat(panel.style.maxHeight);

    // espacioAbajo = 615 - 320 - 12 = 283; espacioArriba = 295 - 12 = 283.
    // Contenido (547 + GAP 6 = 553) no entra en ningún lado → clamp al
    // espacio disponible: maxHeight = min(cap, 283 - GAP) = 277. Empate
    // arriba/abajo → se abre hacia abajo (mismo criterio que hoy).
    expect(top).toBe(326); // rect.bottom(320) + GAP(6)
    expect(maxHeight).toBe(277);

    // El panel entero (top + maxHeight) queda DENTRO del viewport — no
    // desborda, a diferencia del bug (antes: top 326 + 549 = 875 ≫ 615).
    expect(top + maxHeight).toBeLessThanOrEqual(615);

    // El footerSlot (banda de simulación) sigue en el árbol y alcanzable vía
    // scroll interno del panel (`overflow-y-auto`), no clipado/inexistente.
    expect(screen.getByLabelText("Eliminar la simulación de Comida")).toBeInTheDocument();
    expect(screen.getByLabelText("Eliminar la simulación de Transporte")).toBeInTheDocument();
  });

  it("alturas normales de escritorio: sigue abriendo hacia abajo, sin clamp (sin regresión)", () => {
    Object.defineProperty(window, "innerHeight", { value: 1080, configurable: true });
    Object.defineProperty(window, "innerWidth", { value: 1440, configurable: true });
    // Mismo alto real de contenido (549 ≈ scrollHeight 547/549, acá sin
    // clipping previo no hay diferencia práctica entre ambos) que el caso de
    // viewport chico — a escritorio entra de sobra, sin clamp ni scroll.
    mockRects({ top: 300, bottom: 325 }, 549);

    renderPopover();
    fireEvent.click(screen.getByLabelText("Filtrar Únicos"));

    const panel = screen.getByRole("dialog", { name: "Filtrar Únicos" });
    expect(panel.style.top).toBe("331px"); // rect.bottom(325) + GAP(6)
    expect(panel.style.maxHeight).toBe("560px"); // cap, sin clamp
  });
});
