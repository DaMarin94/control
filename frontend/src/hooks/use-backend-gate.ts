"use client";

/**
 * Máquina de estados del gate de arranque del backend
 * (docs/design.md §"Gate de arranque del backend").
 *
 * Dos ejes independientes:
 *   - `phase`   → si la SUPERFICIE está montada: "hidden" | "visible" | "leaving".
 *   - `content` → qué se ve DENTRO: "waking" (GIF + copy) | "error" (a los 3 min).
 *
 * Un "ciclo" es una espera completa: arranca la sonda, a los 800ms pinta el
 * gate si todavía no hubo respuesta, a los 3 min pasa a `error`, y termina
 * cuando el backend responde. `cycleId` invalida las continuaciones async de
 * ciclos viejos (el loop de sonda es un `while` con `await`: sin este guard,
 * un ciclo abortado seguiría resolviendo sobre el estado del ciclo nuevo).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GATE_APPEAR_DELAY_MS,
  GATE_CONTENT_FADE_OUT_MS,
  GATE_ERROR_TIMEOUT_MS,
  GATE_EXIT_MS,
  GATE_EXIT_REDUCED_MS,
  GATE_MIN_VISIBLE_MS,
  GATE_PROBE_BACKOFF_MS,
  notifyBackendRecovered,
  prefersReducedMotion,
  probeBackendHealth,
  subscribeBackendUnreachable,
} from "@/lib/backend-gate";

export type GatePhase = "hidden" | "visible" | "leaving";
export type GateContent = "waking" | "error";

export interface BackendGateState {
  phase: GatePhase;
  content: GateContent;
  /** false durante el cruce entre contenidos (fade-out de 120ms). */
  contentVisible: boolean;
  /** Vuelve a `despertando` y reinicia el reloj de 3 minutos. */
  retry: () => void;
}

export function useBackendGate(): BackendGateState {
  const [phase, setPhase] = useState<GatePhase>("hidden");
  const [content, setContent] = useState<GateContent>("waking");
  const [contentVisible, setContentVisible] = useState(true);

  // Espejos en ref: los callbacks del ciclo (timers, loop async) leen el estado
  // vigente sin re-suscribirse ni re-crear el ciclo en cada render.
  const phaseRef = useRef<GatePhase>("hidden");
  const contentRef = useRef<GateContent>("waking");
  const shownAtRef = useRef<number | null>(null);
  const cycleIdRef = useRef(0);
  const runningRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const setPhaseSafe = useCallback((next: GatePhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const setContentSafe = useCallback((next: GateContent) => {
    contentRef.current = next;
    setContent(next);
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  /** Corta el ciclo en curso (timers + request en vuelo) e invalida sus continuaciones. */
  const stopCycle = useCallback(() => {
    cycleIdRef.current += 1;
    clearTimers();
    abortRef.current?.abort();
    abortRef.current = null;
    runningRef.current = false;
  }, [clearTimers]);

  /** Cruce de contenido: fade-out 120ms → swap → fade-in (con reduced-motion, directo). */
  const swapContent = useCallback(
    (next: GateContent) => {
      if (contentRef.current === next) return;

      if (prefersReducedMotion()) {
        setContentSafe(next);
        setContentVisible(true);
        return;
      }

      setContentVisible(false);
      schedule(() => {
        if (!mountedRef.current) return;
        setContentSafe(next);
        setContentVisible(true);
      }, GATE_CONTENT_FADE_OUT_MS);
    },
    [schedule, setContentSafe],
  );

  const showGate = useCallback(() => {
    if (phaseRef.current === "visible") return;
    shownAtRef.current = Date.now();
    setContentSafe("waking");
    setContentVisible(true);
    setPhaseSafe("visible");
  }, [setContentSafe, setPhaseSafe]);

  /** El backend respondió: salida respetando el mínimo visible de ~1s. */
  const resolveCycle = useCallback(() => {
    stopCycle();

    /**
     * Recuperación: un ÚNICO disparo por ciclo (acá, no por query fallida) y
     * ANTES de la salida — las queries que murieron por red mientras el gate
     * tapaba la pantalla vuelven a pedirse ya mismo, así cuando el negro
     * termina de irse abajo hay datos o skeletons, nunca el cartel de error.
     * Se emite también cuando el gate nunca llegó a pintarse (ciclo levantado
     * "en caliente" por un 503 que se resolvió antes de los 800ms): ahí
     * también hubo una query caída que hay que rescatar. Con el backend
     * despierto desde el arranque no hay ninguna query en `error`, así que la
     * señal no dispara ningún request (cero-impacto intacto).
     */
    notifyBackendRecovered();

    // Nunca se pintó (backend despierto): no hay nada que sacar.
    if (phaseRef.current === "hidden") return;

    const elapsed = Date.now() - (shownAtRef.current ?? Date.now());
    const hold = Math.max(0, GATE_MIN_VISIBLE_MS - elapsed);

    schedule(() => {
      if (!mountedRef.current) return;
      setPhaseSafe("leaving");
      const exitMs = prefersReducedMotion() ? GATE_EXIT_REDUCED_MS : GATE_EXIT_MS;
      schedule(() => {
        if (!mountedRef.current) return;
        setPhaseSafe("hidden");
        setContentSafe("waking");
        setContentVisible(true);
        shownAtRef.current = null;
      }, exitMs);
    }, hold);
  }, [schedule, setContentSafe, setPhaseSafe, stopCycle]);

  const runProbeLoop = useCallback(
    async (cycleId: number) => {
      let attempt = 0;

      while (mountedRef.current && cycleId === cycleIdRef.current) {
        const controller = new AbortController();
        abortRef.current = controller;

        const alive = await probeBackendHealth(controller.signal);
        if (!mountedRef.current || cycleId !== cycleIdRef.current) return;

        if (alive) {
          resolveCycle();
          return;
        }

        // Falló rápido (sin red / ECONNREFUSED): esperar antes de reintentar.
        const delay =
          GATE_PROBE_BACKOFF_MS[Math.min(attempt, GATE_PROBE_BACKOFF_MS.length - 1)]!;
        attempt += 1;

        await new Promise<void>((resolve) => {
          schedule(resolve, delay);
        });
        if (!mountedRef.current || cycleId !== cycleIdRef.current) return;
      }
    },
    [resolveCycle, schedule],
  );

  /**
   * Arranca un ciclo de espera. Si el gate ya está visible (reintento en caliente)
   * no se re-programa la aparición, pero el reloj de error SIEMPRE se reinicia.
   */
  const startCycle = useCallback(() => {
    stopCycle();
    const cycleId = cycleIdRef.current;
    runningRef.current = true;

    if (phaseRef.current !== "visible") {
      schedule(() => {
        if (!mountedRef.current || cycleId !== cycleIdRef.current) return;
        showGate();
      }, GATE_APPEAR_DELAY_MS);
    }

    schedule(() => {
      if (!mountedRef.current || cycleId !== cycleIdRef.current) return;
      showGate();
      swapContent("error");
    }, GATE_ERROR_TIMEOUT_MS);

    void runProbeLoop(cycleId);
  }, [runProbeLoop, schedule, showGate, stopCycle, swapContent]);

  // Orden deliberado: PRIMERO el ciclo nuevo (su `stopCycle` limpia todos los
  // timers pendientes) y DESPUÉS el cruce de contenido — al revés, el propio
  // `startCycle` cancelaría el timer del swap y el contenido quedaría en
  // `error` con la sonda ya corriendo.
  const retry = useCallback(() => {
    startCycle();
    swapContent("waking");
  }, [startCycle, swapContent]);

  // Sonda inicial al montar + enganche "en caliente" (ApiError 503 desde
  // react-query.tsx). Corre una sola vez: `startCycle` es estable.
  useEffect(() => {
    mountedRef.current = true;
    startCycle();

    const unsubscribe = subscribeBackendUnreachable(() => {
      if (!mountedRef.current) return;
      // Ya hay un ciclo esperando: no se apila un segundo loop de sonda.
      if (runningRef.current) return;
      // Si el gate estaba saliendo, se cancela la salida y vuelve a quedarse.
      if (phaseRef.current === "leaving") {
        setPhaseSafe("visible");
        shownAtRef.current = Date.now();
      }
      startCycle();
    });

    return () => {
      mountedRef.current = false;
      unsubscribe();
      stopCycle();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { phase, content, contentVisible, retry };
}
