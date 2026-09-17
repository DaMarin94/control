/**
 * Tests del gate de arranque del backend
 * (src/components/backend-gate/backend-gate.tsx + hooks/use-backend-gate.ts,
 * docs/design.md §"Gate de arranque del backend").
 *
 * Timers falsos en todos los casos: la máquina es puro tiempo (800ms de
 * aparición, 1s de mínimo visible, 3 min al error, 220ms de salida) y el loop
 * de sonda es async, así que cada avance de reloj se envuelve en `act` para
 * que además drenen las microtareas del `await` del loop.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { BackendGate } from "@/components/backend-gate/backend-gate";
import { notifyBackendUnreachable, subscribeBackendRecovered } from "@/lib/backend-gate";

/** Avanza el reloj y drena microtareas (el loop de sonda es async). */
async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

/** Drena microtareas sin mover el reloj. */
async function flush() {
  await act(async () => {});
}

describe("BackendGate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("cero-impacto: si /health responde antes de los 800ms, el gate no se pinta nunca", async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 200 } as Response);

    render(<BackendGate />);
    await flush();
    await advance(5000);

    expect(screen.queryByTestId("backend-gate")).not.toBeInTheDocument();
  });

  it("a los 800ms sin respuesta aparece el estado `despertando` con el copy exacto", async () => {
    // Render dormido: el fetch queda colgado (caso real de Render).
    global.fetch = vi.fn().mockImplementation(() => new Promise<Response>(() => {}));

    render(<BackendGate />);
    await flush();

    await advance(799);
    expect(screen.queryByTestId("backend-gate")).not.toBeInTheDocument();

    await advance(1);
    const gate = screen.getByTestId("backend-gate");
    expect(gate).toBeInTheDocument();
    expect(gate).toHaveAttribute("role", "status");
    expect(gate).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Despertando el servidor…")).toBeInTheDocument();
  });

  it("bloquea el scroll del fondo y deja inertes a los hermanos mientras está montado", async () => {
    global.fetch = vi.fn().mockImplementation(() => new Promise<Response>(() => {}));

    const sibling = document.createElement("div");
    sibling.id = "app-branch";
    document.body.appendChild(sibling);

    const { unmount } = render(<BackendGate />);
    await flush();
    await advance(800);

    expect(document.body.classList.contains("body-scroll-locked")).toBe(true);
    expect(sibling.hasAttribute("inert")).toBe(true);

    unmount();
    expect(sibling.hasAttribute("inert")).toBe(false);
    expect(document.body.classList.contains("body-scroll-locked")).toBe(false);

    sibling.remove();
  });

  it("una vez visible permanece un mínimo de ~1s y recién ahí se desmonta tras la salida", async () => {
    let resolveProbe: ((value: Response) => void) | undefined;
    global.fetch = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveProbe = resolve;
        }),
    );

    render(<BackendGate />);
    await flush();
    await advance(800);
    expect(screen.getByTestId("backend-gate")).toBeInTheDocument();

    // El backend responde apenas 200ms después de que el gate se pintó.
    await advance(200);
    await act(async () => {
      resolveProbe!({ status: 200 } as Response);
    });

    // Todavía adentro: no titila.
    expect(screen.getByTestId("backend-gate")).toBeInTheDocument();

    // Completa el mínimo de 1s → arranca la salida (sin interceptar clics).
    await advance(800);
    expect(screen.getByTestId("backend-gate")).toHaveAttribute("data-phase", "leaving");

    // Fade de salida (220ms) → desmontaje.
    await advance(220);
    expect(screen.queryByTestId("backend-gate")).not.toBeInTheDocument();
  });

  it("a los 3 minutos pasa al estado de error, con foco en Reintentar; el botón vuelve a `despertando` y reinicia el reloj", async () => {
    global.fetch = vi.fn().mockImplementation(() => new Promise<Response>(() => {}));

    render(<BackendGate />);
    await flush();
    await advance(800);

    // Antes de los 3 min sigue en `despertando`.
    await advance(3 * 60 * 1000 - 800 - 1);
    expect(screen.getByText("Despertando el servidor…")).toBeInTheDocument();

    // Cruce de contenido: fade-out de 120ms y recién ahí el swap.
    await advance(1);
    await advance(120);

    const gate = screen.getByTestId("backend-gate");
    expect(gate).toHaveAttribute("role", "alert");
    expect(
      screen.getByText("El servidor está tardando más de lo normal"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Puede estar arrancando todavía. Probá de nuevo en unos segundos."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Despertando el servidor…")).not.toBeInTheDocument();

    const retry = screen.getByRole("button", { name: "Reintentar" });
    expect(retry).toHaveFocus();

    // Reintentar → vuelve a `despertando`…
    await act(async () => {
      fireEvent.click(retry);
    });
    await advance(120);
    expect(screen.getByText("Despertando el servidor…")).toBeInTheDocument();

    // …y el reloj de 3 minutos arranca de cero (no reaparece el error antes).
    await advance(3 * 60 * 1000 - 200);
    expect(screen.getByText("Despertando el servidor…")).toBeInTheDocument();
    await advance(200 + 120);
    expect(
      screen.getByText("El servidor está tardando más de lo normal"),
    ).toBeInTheDocument();
  });

  it("en caliente: notifyBackendUnreachable levanta el gate de nuevo tras un fallo de red", async () => {
    // Arranque con el backend despierto → sin gate.
    global.fetch = vi.fn().mockResolvedValue({ status: 200 } as Response);

    render(<BackendGate />);
    await flush();
    await advance(2000);
    expect(screen.queryByTestId("backend-gate")).not.toBeInTheDocument();

    // El backend se durmió: una llamada normal falla por red y avisa al gate.
    global.fetch = vi.fn().mockImplementation(() => new Promise<Response>(() => {}));
    await act(async () => {
      notifyBackendUnreachable();
    });

    await advance(799);
    expect(screen.queryByTestId("backend-gate")).not.toBeInTheDocument();
    await advance(1);
    expect(screen.getByTestId("backend-gate")).toBeInTheDocument();
  });

  it("no martilla al backend: si la sonda falla rápido, reintenta con backoff", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    global.fetch = fetchMock;

    render(<BackendGate />);
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await advance(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Segundo intervalo: 2s (backoff creciente, no un loop cerrado).
    await advance(1999);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("si el GIF no existe, se retira el <img> y la caja del encuadre sigue reservando el layout", async () => {
    global.fetch = vi.fn().mockImplementation(() => new Promise<Response>(() => {}));

    const { container } = render(<BackendGate />);
    await flush();
    await advance(800);

    const img = container.querySelector("img.gate-gif");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", "/backend-waking.gif");
    expect(img).toHaveAttribute("alt", "");

    await act(async () => {
      fireEvent.error(img!);
    });

    expect(container.querySelector("img.gate-gif")).toBeNull();
    // La caja cuadrada sigue ahí: el texto no se mueve.
    expect(container.querySelector(".gate-gif-box")).not.toBeNull();
    expect(screen.getByText("Despertando el servidor…")).toBeInTheDocument();
  });

  // ── Recuperación: aviso para rescatar las queries que murieron ─────────────
  //
  // Mientras el gate tapa la pantalla, las queries de la app fallan por red y
  // quedan en `error`. El gate avisa UNA sola vez por ciclo, apenas la sonda
  // confirma que el backend responde, para que react-query.tsx las vuelva a
  // pedir (ver tests/lib/react-query.test.tsx). Acá se prueba el emisor: que
  // dispare, que dispare una sola vez, y que lo haga ANTES de que el negro
  // termine de salir.
  describe("señal de recuperación", () => {
    it("avisa una sola vez por recuperación, apenas la sonda responde y antes del fin de la salida", async () => {
      let resolveProbe: ((value: Response) => void) | undefined;
      global.fetch = vi.fn().mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            resolveProbe = resolve;
          }),
      );

      const onRecovered = vi.fn();
      const unsubscribe = subscribeBackendRecovered(onRecovered);

      render(<BackendGate />);
      await flush();
      await advance(800);
      expect(screen.getByTestId("backend-gate")).toBeInTheDocument();
      expect(onRecovered).not.toHaveBeenCalled();

      // El backend despierta: el aviso sale YA, con el gate todavía puesto —
      // así el refetch corre por debajo durante el mínimo visible + la salida.
      await act(async () => {
        resolveProbe!({ status: 200 } as Response);
      });
      expect(onRecovered).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("backend-gate")).toBeInTheDocument();

      // Mínimo visible + fade de salida: ni un aviso de más (uno por ciclo, no
      // uno por query caída).
      await advance(1000 + 220);
      expect(screen.queryByTestId("backend-gate")).not.toBeInTheDocument();
      expect(onRecovered).toHaveBeenCalledTimes(1);

      unsubscribe();
    });

    it("también avisa cuando el ciclo se resuelve desde el estado de error (sin click en Reintentar)", async () => {
      let resolveProbe: ((value: Response) => void) | undefined;
      global.fetch = vi.fn().mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            resolveProbe = resolve;
          }),
      );

      const onRecovered = vi.fn();
      const unsubscribe = subscribeBackendRecovered(onRecovered);

      render(<BackendGate />);
      await flush();
      await advance(800);
      await advance(3 * 60 * 1000 + 120);
      expect(screen.getByText("El servidor está tardando más de lo normal")).toBeInTheDocument();

      await act(async () => {
        resolveProbe!({ status: 200 } as Response);
      });
      await advance(1000 + 220);

      expect(screen.queryByTestId("backend-gate")).not.toBeInTheDocument();
      expect(onRecovered).toHaveBeenCalledTimes(1);

      unsubscribe();
    });
  });
});
