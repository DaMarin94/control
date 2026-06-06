/**
 * Tests del sistema de toasts (ToastProvider + useToast).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";

// Componente de prueba que dispara toasts via botones
function TestConsumer() {
  const { toast } = useToast();

  return (
    <div>
      <button onClick={() => toast.success("Guardado correctamente")}>show success</button>
      <button onClick={() => toast.error("Error al guardar")}>show error</button>
      <button onClick={() => toast.warning("Advertencia")}>show warning</button>
      <button onClick={() => toast.info("Información")}>show info</button>
      <button
        onClick={() =>
          toast.success("Guardado", {
            action: { label: "Ir a ver", onClick: vi.fn() },
          })
        }
      >
        show with action
      </button>
      <button onClick={() => toast.success("Sin dismiss", { duration: 0 })}>
        show no autodismiss
      </button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <ToastProvider>
      <TestConsumer />
    </ToastProvider>,
  );
}

describe("ToastProvider + useToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    // clearAllTimers en vez de runAllTimers: evita disparar el auto-dismiss
    // de un toast del test anterior sobre un componente ya desmontado,
    // lo que generaría warnings de act() de React 19.
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("muestra un toast de success", () => {
    renderWithProvider();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "show success" }));
    });
    expect(screen.getByText("Guardado correctamente")).toBeInTheDocument();
  });

  it("muestra un toast de error", () => {
    renderWithProvider();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "show error" }));
    });
    expect(screen.getByText("Error al guardar")).toBeInTheDocument();
  });

  it("muestra un toast de warning", () => {
    renderWithProvider();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "show warning" }));
    });
    expect(screen.getByText("Advertencia")).toBeInTheDocument();
  });

  it("muestra un toast de info", () => {
    renderWithProvider();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "show info" }));
    });
    expect(screen.getByText("Información")).toBeInTheDocument();
  });

  it("el toast desaparece después del auto-dismiss (5000ms)", () => {
    renderWithProvider();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "show success" }));
    });
    expect(screen.getByText("Guardado correctamente")).toBeInTheDocument();

    // Avanzamos los timers y React procesa el estado resultante
    act(() => {
      vi.advanceTimersByTime(5100);
    });

    expect(screen.queryByText("Guardado correctamente")).not.toBeInTheDocument();
  });

  it("un toast con duration 0 no desaparece solo", () => {
    renderWithProvider();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "show no autodismiss" }));
    });
    expect(screen.getByText("Sin dismiss")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Sigue visible
    expect(screen.getByText("Sin dismiss")).toBeInTheDocument();
  });

  it("muestra el botón de acción cuando se pasa una action", () => {
    renderWithProvider();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "show with action" }));
    });
    expect(screen.getByText("Ir a ver")).toBeInTheDocument();
  });

  it("se cierra al hacer click en el botón de cerrar", () => {
    renderWithProvider();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "show success" }));
    });
    expect(screen.getByText("Guardado correctamente")).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Cerrar notificación" }));
    });

    expect(screen.queryByText("Guardado correctamente")).not.toBeInTheDocument();
  });

  it("lanza error si useToast se usa fuera del provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    function BadConsumer() {
      useToast();
      return null;
    }

    expect(() => render(<BadConsumer />)).toThrow(
      "useToast debe usarse dentro de <ToastProvider>",
    );

    spy.mockRestore();
  });
});
