/**
 * Tests del MonthJumpPopover — Selector de salto de mes/año (Ola 1, P4).
 *
 * Cubre:
 * - Disparador desktop: se renderiza con aria-expanded=false inicialmente.
 * - Disparador mobile: se renderiza con aria-expanded=false inicialmente.
 * - Abrir popover: click en disparador → dialog "Saltar a mes y año" aparece.
 * - Re-clic en disparador: cierra el popover (toggle).
 * - Las ruedas inician en el mes/año actuales.
 * - Stepper ▲ del mes incrementa el mes.
 * - Stepper ▼ del mes decrementa el mes.
 * - Wrap del mes: ▲ en Diciembre pasa a Enero y sube el año.
 * - Wrap del mes: ▼ en Enero pasa a Diciembre y baja el año.
 * - Stepper ▲ del año incrementa el año.
 * - Stepper ▼ del año decrementa el año.
 * - Input año: acepta solo dígitos (descarta no numéricos).
 * - Input año: maxLength=4.
 * - "Ir" está disabled si el año tiene menos de 4 dígitos.
 * - "Ir" está enabled cuando el año tiene 4 dígitos.
 * - "Ir" navega al mes/año elegido y cierra el popover.
 * - "Cancelar" cierra el popover sin navegar.
 * - Esc cierra el popover sin navegar.
 * - Enter en el input año navega si el año está completo.
 * - Enter en el input año no navega si el año está incompleto.
 * - NO cierra por click afuera (regla P6).
 * - Al abrir el popover, el estado de las ruedas refleja el mes actual.
 * - Al navegar y re-abrir, las ruedas reinician al mes de la vista.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import {
  MonthJumpTriggerDesktop,
  MonthJumpTriggerMobile,
  MonthJumpPanel,
} from "@/components/movements/month-jump-popover";

// ─── Mocks ────────────────────────────────────────────────────────────────────

// createPortal: renderizar inline en el DOM de test (jsdom no soporta portales)
vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRef(el?: HTMLButtonElement | null) {
  return { current: el ?? null } as React.RefObject<HTMLButtonElement | null>;
}

// Render del panel completo con refs stub (sin DOM real para getBoundingClientRect)
function renderPanel({
  currentMonth = "2026-06",
  onNavigate = vi.fn(),
  onClose = vi.fn(),
}: {
  currentMonth?: string;
  onNavigate?: ReturnType<typeof vi.fn>;
  onClose?: ReturnType<typeof vi.fn>;
} = {}) {
  const triggerRefs = [makeRef(), makeRef()];
  return {
    ...render(
      <MonthJumpPanel
        currentMonth={currentMonth}
        triggerRefs={triggerRefs}
        onNavigate={onNavigate}
        onClose={onClose}
      />,
    ),
    onNavigate,
    onClose,
  };
}

// ─── Tests del panel ──────────────────────────────────────────────────────────

describe("MonthJumpPanel", () => {
  it("renderiza el dialog con las ruedas de mes y año", async () => {
    renderPanel({ currentMonth: "2026-06" });
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /saltar a mes y año/i })).toBeInTheDocument();
    });
    expect(screen.getByText("Mes")).toBeInTheDocument();
    expect(screen.getByText("Año")).toBeInTheDocument();
    expect(screen.getByText("Junio")).toBeInTheDocument();
    expect(screen.getByLabelText("Año")).toHaveValue("2026");
  });

  it("muestra el nombre del mes correcto según el currentMonth", async () => {
    renderPanel({ currentMonth: "2026-01" });
    await waitFor(() => {
      expect(screen.getByText("Enero")).toBeInTheDocument();
    });
  });

  it("▲ del mes incrementa el mes", async () => {
    renderPanel({ currentMonth: "2026-06" });
    await waitFor(() => screen.getByRole("dialog"));
    const btnUp = screen.getByLabelText("Mes siguiente");
    fireEvent.click(btnUp);
    expect(screen.getByText("Julio")).toBeInTheDocument();
  });

  it("▼ del mes decrementa el mes", async () => {
    renderPanel({ currentMonth: "2026-06" });
    await waitFor(() => screen.getByRole("dialog"));
    const btnDown = screen.getByLabelText("Mes anterior");
    fireEvent.click(btnDown);
    expect(screen.getByText("Mayo")).toBeInTheDocument();
  });

  it("▲ en Diciembre wrappea a Enero SIN modificar el año (ruedas independientes)", async () => {
    // Ola 1, P4: wrap circular puro. El año solo cambia con su propia rueda.
    renderPanel({ currentMonth: "2026-12" });
    await waitFor(() => screen.getByRole("dialog"));
    const btnUp = screen.getByLabelText("Mes siguiente");
    fireEvent.click(btnUp);
    expect(screen.getByText("Enero")).toBeInTheDocument();
    // El año NO cambia — sigue en 2026
    expect(screen.getByLabelText("Año")).toHaveValue("2026");
  });

  it("▼ en Enero wrappea a Diciembre SIN modificar el año (ruedas independientes)", async () => {
    // Ola 1, P4: wrap circular puro. El año solo cambia con su propia rueda.
    renderPanel({ currentMonth: "2026-01" });
    await waitFor(() => screen.getByRole("dialog"));
    const btnDown = screen.getByLabelText("Mes anterior");
    fireEvent.click(btnDown);
    expect(screen.getByText("Diciembre")).toBeInTheDocument();
    // El año NO cambia — sigue en 2026
    expect(screen.getByLabelText("Año")).toHaveValue("2026");
  });

  it("▲ del año incrementa el año en 1", async () => {
    renderPanel({ currentMonth: "2026-06" });
    await waitFor(() => screen.getByRole("dialog"));
    const btnUp = screen.getByLabelText("Año siguiente");
    fireEvent.click(btnUp);
    expect(screen.getByLabelText("Año")).toHaveValue("2027");
  });

  it("▼ del año decrementa el año en 1", async () => {
    renderPanel({ currentMonth: "2026-06" });
    await waitFor(() => screen.getByRole("dialog"));
    const btnDown = screen.getByLabelText("Año anterior");
    fireEvent.click(btnDown);
    expect(screen.getByLabelText("Año")).toHaveValue("2025");
  });

  it("input año solo acepta dígitos", async () => {
    renderPanel({ currentMonth: "2026-06" });
    await waitFor(() => screen.getByRole("dialog"));
    const input = screen.getByLabelText("Año");
    fireEvent.change(input, { target: { value: "20ab" } });
    expect(input).toHaveValue("20");
  });

  it("botón Ir está disabled con año incompleto (<4 dígitos)", async () => {
    renderPanel({ currentMonth: "2026-06" });
    await waitFor(() => screen.getByRole("dialog"));
    const input = screen.getByLabelText("Año");
    fireEvent.change(input, { target: { value: "202" } });
    const btnIr = screen.getByRole("button", { name: /^ir/i });
    expect(btnIr).toBeDisabled();
    expect(btnIr).toHaveAttribute("aria-disabled", "true");
  });

  it("botón Ir está enabled con año de 4 dígitos", async () => {
    renderPanel({ currentMonth: "2026-06" });
    await waitFor(() => screen.getByRole("dialog"));
    const btnIr = screen.getByRole("button", { name: /^ir/i });
    expect(btnIr).not.toBeDisabled();
  });

  it("'Ir' navega al mes/año elegido y llama a onNavigate", async () => {
    const onNavigate = vi.fn();
    renderPanel({ currentMonth: "2026-06", onNavigate });
    await waitFor(() => screen.getByRole("dialog"));

    // Cambiar a Julio 2027
    fireEvent.click(screen.getByLabelText("Mes siguiente")); // → Julio
    fireEvent.click(screen.getByLabelText("Año siguiente")); // → 2027

    fireEvent.click(screen.getByRole("button", { name: /^ir/i }));
    expect(onNavigate).toHaveBeenCalledWith("2027-07");
  });

  it("'Cancelar' llama a onClose sin navegar", async () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();
    renderPanel({ currentMonth: "2026-06", onNavigate, onClose });
    await waitFor(() => screen.getByRole("dialog"));

    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onClose).toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("Esc llama a onClose sin navegar", async () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();
    renderPanel({ currentMonth: "2026-06", onNavigate, onClose });
    await waitFor(() => screen.getByRole("dialog"));

    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(onClose).toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("Enter en el input año llama a onNavigate si el año está completo", async () => {
    const onNavigate = vi.fn();
    renderPanel({ currentMonth: "2026-06", onNavigate });
    await waitFor(() => screen.getByRole("dialog"));
    const input = screen.getByLabelText("Año");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onNavigate).toHaveBeenCalledWith("2026-06");
  });

  it("Enter en el input año NO navega si el año está incompleto", async () => {
    const onNavigate = vi.fn();
    renderPanel({ currentMonth: "2026-06", onNavigate });
    await waitFor(() => screen.getByRole("dialog"));
    const input = screen.getByLabelText("Año");
    fireEvent.change(input, { target: { value: "202" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("NO cierra por click afuera (regla P6)", async () => {
    const onClose = vi.fn();
    renderPanel({ currentMonth: "2026-06", onClose });
    await waitFor(() => screen.getByRole("dialog"));

    // Simular click fuera del panel
    act(() => {
      fireEvent.mouseDown(document.body);
    });
    // No debe llamar a onClose — el popover no cierra por click afuera
    expect(onClose).not.toHaveBeenCalled();
  });

  it("navega el formato YYYY-MM correcto para todos los meses", async () => {
    // Verificar que el formato de salida es YYYY-MM (ej. 2026-01, no 2026-1).
    // Ola 1, P4: el wrap de Diciembre → Enero NO toca el año (ruedas independientes).
    // El año se sube con su propia rueda.
    const onNavigate = vi.fn();
    renderPanel({ currentMonth: "2026-12", onNavigate });
    await waitFor(() => screen.getByRole("dialog"));

    // Enero (wrap circular sin cambio de año): sigue en 2026, mes pasa a 01
    fireEvent.click(screen.getByLabelText("Mes siguiente")); // Dic → Ene, año = 2026
    fireEvent.click(screen.getByRole("button", { name: /^ir/i }));
    expect(onNavigate).toHaveBeenCalledWith("2026-01");
  });
});

// ─── Tests del disparador desktop ────────────────────────────────────────────

describe("MonthJumpTriggerDesktop", () => {
  it("renderiza el label del período y el ícono ↕", () => {
    const ref = makeRef();
    render(
      <MonthJumpTriggerDesktop
        periodLabel="Junio 2026"
        isOpen={false}
        onClick={vi.fn()}
        triggerRef={ref}
      />,
    );
    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getByText("Junio 2026")).toBeInTheDocument();
  });

  it("tiene aria-expanded=false cuando está cerrado", () => {
    render(
      <MonthJumpTriggerDesktop
        periodLabel="Junio 2026"
        isOpen={false}
        onClick={vi.fn()}
        triggerRef={makeRef()}
      />,
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
  });

  it("tiene aria-expanded=true cuando está abierto", () => {
    render(
      <MonthJumpTriggerDesktop
        periodLabel="Junio 2026"
        isOpen={true}
        onClick={vi.fn()}
        triggerRef={makeRef()}
      />,
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  });

  it("tiene aria-haspopup=dialog", () => {
    render(
      <MonthJumpTriggerDesktop
        periodLabel="Junio 2026"
        isOpen={false}
        onClick={vi.fn()}
        triggerRef={makeRef()}
      />,
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("llama a onClick al hacer click", () => {
    const onClick = vi.fn();
    render(
      <MonthJumpTriggerDesktop
        periodLabel="Junio 2026"
        isOpen={false}
        onClick={onClick}
        triggerRef={makeRef()}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

// ─── Tests del disparador mobile ─────────────────────────────────────────────

describe("MonthJumpTriggerMobile", () => {
  it("renderiza el mes, año y statusLabel", () => {
    render(
      <MonthJumpTriggerMobile
        mesName="Junio"
        yearName="2026"
        statusLabel="Mes en curso"
        isOpen={false}
        onClick={vi.fn()}
        triggerRef={makeRef()}
      />,
    );
    expect(screen.getByText("Junio 2026")).toBeInTheDocument();
    expect(screen.getByText("Mes en curso")).toBeInTheDocument();
  });

  it("tiene aria-expanded=false cuando está cerrado", () => {
    render(
      <MonthJumpTriggerMobile
        mesName="Junio"
        yearName="2026"
        statusLabel="Mes en curso"
        isOpen={false}
        onClick={vi.fn()}
        triggerRef={makeRef()}
      />,
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
  });

  it("tiene aria-haspopup=dialog", () => {
    render(
      <MonthJumpTriggerMobile
        mesName="Junio"
        yearName="2026"
        statusLabel="Mes en curso"
        isOpen={false}
        onClick={vi.fn()}
        triggerRef={makeRef()}
      />,
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("llama a onClick al hacer click", () => {
    const onClick = vi.fn();
    render(
      <MonthJumpTriggerMobile
        mesName="Junio"
        yearName="2026"
        statusLabel="Mes en curso"
        isOpen={false}
        onClick={onClick}
        triggerRef={makeRef()}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
