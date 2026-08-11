/**
 * Tests del sistema de toasts (ToastProvider + useToast).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { ToastProvider, type ToastActionOutcome } from "@/components/ui/toast";
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

  it("un toast con acción dura 8000ms (no 5000ms)", () => {
    renderWithProvider();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "show with action" }));
    });
    expect(screen.getByText("Guardado")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5100);
    });
    // A los 5.1s uno CON acción sigue vivo (el default de 5s no aplica)
    expect(screen.getByText("Guardado")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByText("Guardado")).not.toBeInTheDocument();
  });
});

// ─── Acción async — ciclo de vida (docs/design.md §"Toast con acción") ────────

interface UndoConsumerProps {
  message: string;
  groupId?: string;
  onClick: () => void | Promise<ToastActionOutcome>;
}

function UndoConsumer({ message, groupId, onClick }: UndoConsumerProps) {
  const { toast } = useToast();
  return (
    <button
      onClick={() =>
        toast.success(message, {
          groupId,
          action: { label: "Deshacer", pendingLabel: "Deshaciendo…", onClick },
        })
      }
    >
      trigger {message}
    </button>
  );
}

describe("ToastProvider — acción async (en vuelo / desenlaces)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("en vuelo: no cierra el toast, deshabilita, aria-busy y cambia a pendingLabel", async () => {
    let resolveFn!: (v: ToastActionOutcome) => void;
    const pending = new Promise<ToastActionOutcome>((res) => {
      resolveFn = res;
    });

    render(
      <ToastProvider>
        <UndoConsumer message="Actualizado: ‘Mov A’." onClick={() => pending} />
      </ToastProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "trigger Actualizado: ‘Mov A’." }));
    });
    expect(screen.getByText("Actualizado: ‘Mov A’.")).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    });

    // Sigue visible, no se cerró en el mismo tick.
    expect(screen.getByText("Actualizado: ‘Mov A’.")).toBeInTheDocument();
    const actionBtn = screen.getByRole("button", { name: "Deshaciendo…" });
    expect(actionBtn).toBeDisabled();
    expect(actionBtn).toHaveAttribute("aria-busy", "true");

    // El timer quedó cancelado — ni con 8s+ se cierra solo mientras está en vuelo.
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(screen.getByText("Actualizado: ‘Mov A’.")).toBeInTheDocument();

    await act(async () => {
      resolveFn({ type: "success", message: "Cambio deshecho." });
      await pending;
    });

    expect(screen.queryByText("Actualizado: ‘Mov A’.")).not.toBeInTheDocument();
    expect(screen.getByText("Cambio deshecho.")).toBeInTheDocument();
    // El desenlace no lleva acción.
    expect(screen.queryByRole("button", { name: "Deshacer" })).not.toBeInTheDocument();
  });

  it("éxito: reemplaza en su misma posición (la pila no crece)", async () => {
    let resolveFn!: (v: ToastActionOutcome) => void;
    const pending = new Promise<ToastActionOutcome>((res) => {
      resolveFn = res;
    });

    render(
      <ToastProvider>
        <UndoConsumer message="Actualizado: ‘Mov A’." onClick={() => pending} />
      </ToastProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "trigger Actualizado: ‘Mov A’." }));
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    });

    expect(screen.getAllByRole("alert")).toHaveLength(1);

    await act(async () => {
      resolveFn({ type: "success", message: "Cambio deshecho." });
      await pending;
    });

    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("obsoleto (404): reemplaza por warning con el mismo mensaje", async () => {
    let resolveFn!: (v: ToastActionOutcome) => void;
    const pending = new Promise<ToastActionOutcome>((res) => {
      resolveFn = res;
    });

    render(
      <ToastProvider>
        <UndoConsumer message="Eliminado: ‘Mov B’." onClick={() => pending} />
      </ToastProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "trigger Eliminado: ‘Mov B’." }));
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    });

    await act(async () => {
      resolveFn({
        type: "warning",
        message: "Este cambio ya no está disponible para deshacer.",
      });
      await pending;
    });

    expect(
      screen.getByText("Este cambio ya no está disponible para deshacer."),
    ).toBeInTheDocument();
  });

  it("error reintentable: el toast original vuelve a reposo (acción restaurada) + toast de error aparte", async () => {
    let rejectFn!: (err: unknown) => void;
    const pending = new Promise<ToastActionOutcome>((_res, rej) => {
      rejectFn = rej;
    });
    // Evita el unhandledRejection warning entre el reject y el catch interno.
    pending.catch(() => {});

    render(
      <ToastProvider>
        <UndoConsumer message="Actualizado: ‘Mov C’." onClick={() => pending} />
      </ToastProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "trigger Actualizado: ‘Mov C’." }));
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    });

    await act(async () => {
      rejectFn(new Error("No se pudo deshacer el cambio. Intentá de nuevo."));
      await pending.catch(() => {});
    });

    // El toast original sigue, con el botón "Deshacer" restaurado (no "Deshaciendo…").
    expect(screen.getByText("Actualizado: ‘Mov C’.")).toBeInTheDocument();
    const restoredBtn = screen.getByRole("button", { name: "Deshacer" });
    expect(restoredBtn).not.toBeDisabled();
    // Y aparece un toast de error aparte.
    expect(
      screen.getByText("No se pudo deshacer el cambio. Intentá de nuevo."),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("alert")).toHaveLength(2);
  });

  it("cerrar el toast mientras está en vuelo igual anuncia el desenlace (como toast nuevo)", async () => {
    let resolveFn!: (v: ToastActionOutcome) => void;
    const pending = new Promise<ToastActionOutcome>((res) => {
      resolveFn = res;
    });

    render(
      <ToastProvider>
        <UndoConsumer message="Eliminado: ‘Mov D’." onClick={() => pending} />
      </ToastProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "trigger Eliminado: ‘Mov D’." }));
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    });

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Cerrar notificación" }));
    });
    expect(screen.queryByText("Eliminado: ‘Mov D’.")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("alert")).toHaveLength(0);

    await act(async () => {
      resolveFn({ type: "success", message: "Cambio deshecho." });
      await pending;
    });

    expect(screen.getByText("Cambio deshecho.")).toBeInTheDocument();
  });

  it("identidad de grupo: un toast nuevo con el mismo groupId reemplaza al anterior en su posición", () => {
    render(
      <ToastProvider>
        <UndoConsumer message="Mensaje B" groupId="group-b" onClick={() => undefined} />
        <UndoConsumer message="Mensaje A v1" groupId="group-a" onClick={() => undefined} />
        <UndoConsumer message="Mensaje A v2" groupId="group-a" onClick={() => undefined} />
      </ToastProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "trigger Mensaje B" }));
      fireEvent.click(screen.getByRole("button", { name: "trigger Mensaje A v1" }));
    });

    expect(screen.getAllByRole("alert")).toHaveLength(2);

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "trigger Mensaje A v2" }));
    });

    // Sigue habiendo 2 (reemplazo, no apilado) y B mantiene su posición (primero).
    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(2);
    expect(alerts[0]).toHaveTextContent("Mensaje B");
    expect(alerts[1]).toHaveTextContent("Mensaje A v2");
    expect(screen.queryByText("Mensaje A v1")).not.toBeInTheDocument();
  });
});

// ─── Pausa por hover/foco con piso de 2000ms ──────────────────────────────────

describe("ToastProvider — pausa del auto-dismiss por hover", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("con el puntero encima no se cierra, aunque pase la duración completa", () => {
    render(
      <ToastProvider>
        <ShowSuccessButton />
      </ToastProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "show" }));
    });

    const alertEl = screen.getByRole("alert");
    act(() => {
      fireEvent.pointerEnter(alertEl);
    });

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();

    act(() => {
      fireEvent.pointerLeave(alertEl);
      vi.advanceTimersByTime(6000);
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("al reanudar nunca da menos de 2000ms, aunque casi no quedara tiempo", () => {
    render(
      <ToastProvider>
        <ShowSuccessButton />
      </ToastProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "show" }));
    });

    const alertEl = screen.getByRole("alert");

    // Casi se agotó el default de 5000ms — quedan ~100ms.
    act(() => {
      vi.advanceTimersByTime(4900);
    });

    act(() => {
      fireEvent.pointerEnter(alertEl);
      fireEvent.pointerLeave(alertEl);
    });

    // Sin el piso, se cerraría a los ~100ms. Con el piso de 2000ms, sigue vivo.
    act(() => {
      vi.advanceTimersByTime(1900);
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

function ShowSuccessButton() {
  const { toast } = useToast();
  return <button onClick={() => toast.success("Guardado correctamente")}>show</button>;
}

// ─── Tope de 3 toasts visibles ─────────────────────────────────────────────────

describe("ToastProvider — tope de 3 toasts visibles", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("el 4º toast expulsa al más viejo, nunca a uno con acción en vuelo", async () => {
    const pending = new Promise<ToastActionOutcome>(() => {});

    render(
      <ToastProvider>
        <UndoConsumer message="Toast 1" onClick={() => undefined} />
        <UndoConsumer message="Toast 2 (en vuelo)" onClick={() => pending} />
        <UndoConsumer message="Toast 3" onClick={() => undefined} />
        <UndoConsumer message="Toast 4" onClick={() => undefined} />
      </ToastProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "trigger Toast 1" }));
      fireEvent.click(screen.getByRole("button", { name: "trigger Toast 2 (en vuelo)" }));
    });
    // Pone "Toast 2" en vuelo antes de que lleguen Toast 3/4.
    act(() => {
      fireEvent.click(screen.getAllByRole("button", { name: "Deshacer" })[1]);
    });

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "trigger Toast 3" }));
      fireEvent.click(screen.getByRole("button", { name: "trigger Toast 4" }));
    });

    expect(screen.getAllByRole("alert")).toHaveLength(3);
    // Toast 1 (el más viejo, no en vuelo) fue expulsado; Toast 2 (en vuelo) sobrevive.
    expect(screen.queryByText("Toast 1")).not.toBeInTheDocument();
    expect(screen.getByText("Toast 2 (en vuelo)")).toBeInTheDocument();
    expect(screen.getByText("Toast 3")).toBeInTheDocument();
    expect(screen.getByText("Toast 4")).toBeInTheDocument();
  });
});

// ─── Ancho del pill (docs/design.md §"Toast con acción", §1/§6) ───────────────
//
// jsdom no calcula layout real (no hay `clientWidth`/`getBoundingClientRect`
// utilizables), así que la cobertura de ancho se hace sobre las clases de
// Tailwind aplicadas — mismo patrón que el resto de la suite (ver
// button.test.tsx, create-limit-modal.test.tsx).

describe("ToastProvider — ancho del pill", () => {
  it("con acción: ancho FIJO w-[min(520px,…)], nunca min-w-[320px] ni el max-w del pill sin acción", () => {
    render(
      <ToastProvider>
        <UndoConsumer message="Actualizado: ‘Alquiler’." onClick={() => undefined} />
      </ToastProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "trigger Actualizado: ‘Alquiler’." }));
    });

    const pill = screen.getByRole("alert");
    expect(pill).toHaveClass("w-[min(520px,calc(100vw-32px))]");
    expect(pill.className).not.toMatch(/min-w-\[320px\]/);
    expect(pill.className).not.toMatch(/max-w-\[min\(460px/);
  });

  it("sin acción: ancho natural capeado max-w-[min(460px,…)], nunca el ancho fijo del pill con acción", () => {
    function PlainConsumer() {
      const { toast } = useToast();
      return <button onClick={() => toast.success("Guardado correctamente")}>show plain</button>;
    }

    render(
      <ToastProvider>
        <PlainConsumer />
      </ToastProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "show plain" }));
    });

    const pill = screen.getByRole("alert");
    expect(pill).toHaveClass("max-w-[min(460px,calc(100vw-32px))]");
    expect(pill.className).not.toMatch(/w-\[min\(520px/);
  });

  it("el desenlace (sin acción) que reemplaza a un toast con acción se angosta al esquema sin acción", async () => {
    let resolveFn!: (v: ToastActionOutcome) => void;
    const pending = new Promise<ToastActionOutcome>((res) => {
      resolveFn = res;
    });

    render(
      <ToastProvider>
        <UndoConsumer message="Eliminado: ‘Alquiler’." onClick={() => pending} />
      </ToastProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "trigger Eliminado: ‘Alquiler’." }));
    });

    const pillWithAction = screen.getByRole("alert");
    expect(pillWithAction).toHaveClass("w-[min(520px,calc(100vw-32px))]");

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    });

    await act(async () => {
      resolveFn({ type: "success", message: "Cambio deshecho." });
      await pending;
    });

    const pillOutcome = screen.getByRole("alert");
    expect(pillOutcome).toHaveClass("max-w-[min(460px,calc(100vw-32px))]");
    expect(pillOutcome.className).not.toMatch(/w-\[min\(520px/);
  });
});

// ─── No-truncado del nombre en el DOM (docs/design.md §1/§6) ──────────────────
//
// El truncado visual (`line-clamp-2`) es CSS puro y no se puede medir en
// jsdom; lo que sí es responsabilidad del componente (y por eso se cubre acá)
// es que el mensaje NUNCA se recorte a nivel string — el DOM siempre contiene
// el texto completo, sea cual sea su longitud. Complementa el criterio visual
// del checklist de diseño (scrollHeight/clientHeight, verificado en QA).

describe("ToastProvider — el mensaje nunca se recorta a nivel de string", () => {
  it("un nombre largo (>80 caracteres) queda completo en el DOM, con line-clamp-2 aplicado", () => {
    const longName =
      "Alquiler del departamento nuevo con expensas y cochera incluidas del mes de referencia";
    const message = `Actualizado: ‘${longName}’.`;

    render(
      <ToastProvider>
        <UndoConsumer message={message} onClick={() => undefined} />
      </ToastProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: `trigger ${message}` }));
    });

    const paragraph = screen.getByText(message);
    expect(paragraph.textContent).toBe(message);
    expect(paragraph).toHaveClass("line-clamp-2");
  });
});
