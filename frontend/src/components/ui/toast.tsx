"use client";

/**
 * Sistema de toasts centralizado.
 * Re-estilado contra tokens del design system "Precise Ledger" (Fase 2).
 * Anatomía con acción inline + reglas generales de pausa/apilado/ancho
 * (docs/design.md §"Toast con acción — Deshacer inmediato tras editar o eliminar").
 *
 * Cambios de estilo (funcionalidad 100% preservada, salvo lo indicado):
 *  - Viewport: abajo-centro (fixed bottom-[26px] left-1/2 -translate-x-1/2)
 *    → era abajo-derecha; el DS lo define en centro.
 *  - Item: pill bg-ink text-paper, rounded-[13px], padding 12px 14px 12px 16px,
 *    shadow-[var(--shadow-lg)], animación slide-up .3s.
 *  - Ícono "tick": círculo 24px con ícono Lucide. Color varía por tipo:
 *      success → bg-income  (verde) + Check
 *      error   → bg-expense (rojo)  + X
 *      warning → bg-warning (ámbar) + AlertTriangle
 *      info    → bg-accent-ink      + Info
 *  - Acción — INLINE (no debajo del mensaje): divisor vertical + botón, con
 *    hit area de 48px vía `after` sin engordar el pill. `min-w-[104px]` anti
 *    layout-shift (reserva el ancho de "Deshaciendo…").
 *  - Close: ícono X de lucide-react.
 *
 * Tipos: success | error | warning | info
 *
 * Acción — dos formas (ver `ToastAction`):
 *  - Sync (`onClick` retorna `void`): cierra el toast en el mismo tick al
 *    clickear (comportamiento clásico, preserva los call sites existentes).
 *  - Async (`onClick` retorna `Promise<ToastActionOutcome>`): el toast queda
 *    "en vuelo" (label = pendingLabel, disabled, aria-busy, timer cancelado
 *    definitivamente) hasta resolver. Éxito → swap en la misma posición por un
 *    toast del type/message del outcome (sin acción). Rechazo → el toast
 *    vuelve a reposo (acción restaurada, timer nuevo) + toast `error` aparte.
 *
 * Reglas generales (no específicas de ninguna acción particular):
 *  - Duración: 5000ms sin acción, 8000ms con acción (`ACTION_DURATION`).
 *  - Pausa por hover (`pointerenter`) y por foco (`focus-within`), reanuda con
 *    el tiempo restante, piso de 2000ms. No pausa por pestaña oculta.
 *  - Tope de 3 toasts visibles; el 4º expulsa al más viejo que NO esté en
 *    vuelo (nunca se expulsa un toast con acción en curso).
 *  - Identidad de grupo (`groupId`): un toast nuevo con el mismo `groupId`
 *    reemplaza al anterior conservando su posición e índice en la pila.
 *  - Ancho: sin acción `max-w-[min(460px,calc(100vw-32px))]` (natural,
 *    capeado). Con acción, ancho FIJO `w-[min(520px,calc(100vw-32px))]` —una
 *    sola propiedad, sin `min-w`— para que el blanco de clic no cambie de
 *    tamaño bajo el cursor entre toasts sucesivos (el desenlace sin acción
 *    que lo reemplaza se angosta, es esperado). Columna de mensaje resultante
 *    con acción: 287px. Alturas canónicas del pill: 48px con el mensaje en
 *    una línea, 63px en dos (no 68px, esa cifra vieja no aplica más).
 *
 * Auto-dismiss: configurable por toast (default 5000ms; 8000ms con acción).
 *
 * Arquitectura:
 * - ToastContext: expone el API de toasts (toast.success, toast.error, etc.)
 * - ToastProvider: wrappea la app, monta el portal de toasts
 * - ToastItem: render de un toast individual
 */

import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
} from "react";
import { AlertTriangle, Check, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ToastType = "success" | "error" | "warning" | "info";

/** Desenlace de una acción async — el toast de origen se reemplaza por este. */
export interface ToastActionOutcome {
  type: ToastType;
  message: string;
}

export interface ToastAction {
  label: string;
  /**
   * Rótulo mostrado mientras la acción está en vuelo (ej. "Deshaciendo…").
   * Solo aplica si `onClick` es async. Si no se define, se reusa `label`.
   */
  pendingLabel?: string;
  /**
   * Sync (retorna `void`/`undefined`): comportamiento clásico, cierra el
   * toast en el mismo tick.
   * Async (retorna `Promise<ToastActionOutcome>`): ver reglas generales arriba.
   */
  onClick: () => void | Promise<ToastActionOutcome>;
}

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  action?: ToastAction;
  /** Duración en ms antes del auto-dismiss. Default: 5000 (8000 con acción) */
  duration?: number;
  /**
   * Identidad de grupo estable (ej. Transaction.id / Recurring.chainId /
   * InstallmentGroup.id — NUNCA el id de una fila que puede cambiar por split).
   * Un toast nuevo con el mismo `groupId` reemplaza al anterior en su misma
   * posición en la pila.
   */
  groupId?: string;
  /** true mientras la acción async de este toast está en vuelo. */
  pending?: boolean;
}

export interface ShowToastOptions {
  action?: ToastAction;
  /** Duración en ms. Si es 0, no hay auto-dismiss. */
  duration?: number;
  groupId?: string;
}

export interface ToastContextValue {
  toast: {
    success(message: string, options?: ShowToastOptions): void;
    error(message: string, options?: ShowToastOptions): void;
    warning(message: string, options?: ShowToastOptions): void;
    info(message: string, options?: ShowToastOptions): void;
  };
  dismiss(id: string): void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

export const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Emisor imperativo (fuera del árbol de React) ─────────────────────────────

/**
 * Permite emitir un toast desde código que corre fuera del árbol de React
 * (ej: el `onError` de QueryCache/MutationCache en `lib/react-query.tsx`,
 * que se crea en el initializer del provider — no puede llamar a `useToast()`).
 *
 * `<ToastProvider>` registra su función `show` al montar. Si todavía no
 * montó (o ya se desmontó), `emitToast` es un no-op silencioso.
 */
type ToastEmitFn = (type: ToastType, message: string, options?: ShowToastOptions) => void;

let toastEmitFn: ToastEmitFn | null = null;

export function emitToast(type: ToastType, message: string, options?: ShowToastOptions): void {
  toastEmitFn?.(type, message, options);
}

// ─── Helpers de módulo ────────────────────────────────────────────────────────

const DEFAULT_DURATION = 5000;
/** Duración de todo toast con acción — regla general, no exclusiva del undo. */
const ACTION_DURATION = 8000;
/** Piso al reanudar el auto-dismiss tras una pausa por hover/foco. */
const MIN_RESUME_MS = 2000;
/** Tope de toasts visibles simultáneamente. */
const MAX_VISIBLE_TOASTS = 3;

function generateToastId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function isPromiseLike(value: unknown): value is Promise<ToastActionOutcome> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

interface TimerMeta {
  timeoutId: ReturnType<typeof setTimeout> | null;
  /** Duración restante (ms) al momento de armar/pausar este timer. */
  remaining: number;
  /** Timestamp (Date.now()) de cuándo se armó/reanudó el timer vigente. */
  startedAt: number;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Espejo síncrono de `toasts` — evita depender de closures potencialmente
  // obsoletas de `setState` funcional cuando varias mutaciones (show/dismiss/
  // handleAction) ocurren en el mismo tick, antes de que React re-renderice.
  const toastsRef = useRef<Toast[]>([]);
  const timerMeta = useRef<Map<string, TimerMeta>>(new Map());

  const clearTimerEntry = useCallback((id: string) => {
    const entry = timerMeta.current.get(id);
    if (entry?.timeoutId !== null && entry?.timeoutId !== undefined) {
      clearTimeout(entry.timeoutId);
    }
    timerMeta.current.delete(id);
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      const next = toastsRef.current.filter((t) => t.id !== id);
      toastsRef.current = next;
      setToasts(next);
      clearTimerEntry(id);
    },
    [clearTimerEntry],
  );

  const scheduleTimer = useCallback(
    (id: string, ms: number) => {
      const entry = timerMeta.current.get(id);
      if (entry?.timeoutId !== null && entry?.timeoutId !== undefined) {
        clearTimeout(entry.timeoutId);
      }
      if (ms <= 0) {
        timerMeta.current.delete(id);
        return;
      }
      const timeoutId = setTimeout(() => dismiss(id), ms);
      timerMeta.current.set(id, { timeoutId, remaining: ms, startedAt: Date.now() });
    },
    [dismiss],
  );

  /** Pausa por hover/foco — congela el tiempo restante sin cerrar el timer. */
  const pauseTimer = useCallback((id: string) => {
    const entry = timerMeta.current.get(id);
    if (!entry || entry.timeoutId === null) return;
    const elapsed = Date.now() - entry.startedAt;
    const remaining = Math.max(entry.remaining - elapsed, 0);
    clearTimeout(entry.timeoutId);
    timerMeta.current.set(id, { timeoutId: null, remaining, startedAt: entry.startedAt });
  }, []);

  /** Reanuda con el tiempo restante, nunca menos de MIN_RESUME_MS. */
  const resumeTimer = useCallback(
    (id: string) => {
      const entry = timerMeta.current.get(id);
      if (!entry || entry.timeoutId !== null) return;
      const ms = Math.max(entry.remaining, MIN_RESUME_MS);
      const timeoutId = setTimeout(() => dismiss(id), ms);
      timerMeta.current.set(id, { timeoutId, remaining: ms, startedAt: Date.now() });
    },
    [dismiss],
  );

  const show = useCallback(
    (type: ToastType, message: string, options?: ShowToastOptions) => {
      const action = options?.action;
      const groupId = options?.groupId;
      const duration = options?.duration ?? (action ? ACTION_DURATION : DEFAULT_DURATION);

      const existingIndex = groupId
        ? toastsRef.current.findIndex((t) => t.groupId === groupId)
        : -1;

      // Identidad de grupo: reemplaza en la misma posición, la pila no crece.
      if (existingIndex !== -1) {
        const existing = toastsRef.current[existingIndex];
        clearTimerEntry(existing.id);
        const id = generateToastId();
        const newToast: Toast = { id, type, message, action, duration, groupId, pending: false };
        const next = toastsRef.current.slice();
        next[existingIndex] = newToast;
        toastsRef.current = next;
        setToasts(next);
        scheduleTimer(id, duration);
        return;
      }

      // Toast nuevo: tope de MAX_VISIBLE_TOASTS — expulsa al más viejo que no
      // esté en vuelo (nunca uno con acción pendiente).
      let base = toastsRef.current;
      if (base.length >= MAX_VISIBLE_TOASTS) {
        const victimIndex = base.findIndex((t) => !t.pending);
        if (victimIndex !== -1) {
          clearTimerEntry(base[victimIndex].id);
          base = base.filter((_, i) => i !== victimIndex);
        }
      }

      const id = generateToastId();
      const newToast: Toast = { id, type, message, action, duration, groupId, pending: false };
      const next = [...base, newToast];
      toastsRef.current = next;
      setToasts(next);
      scheduleTimer(id, duration);
    },
    [clearTimerEntry, scheduleTimer],
  );

  /** Click en la acción de un toast. Bifurca sync/async (ver ToastAction). */
  const handleAction = useCallback(
    (id: string) => {
      const current = toastsRef.current.find((t) => t.id === id);
      if (!current?.action) return;

      const result = current.action.onClick();

      if (!isPromiseLike(result)) {
        // Sync: comportamiento clásico, cierra en el mismo tick.
        dismiss(id);
        return;
      }

      // Async: en vuelo. Cancela el timer definitivamente (no se resucita
      // con tiempo restante — una operación en curso no puede evaporarse).
      clearTimerEntry(id);
      const withPending = toastsRef.current.map((t) =>
        t.id === id ? { ...t, pending: true } : t,
      );
      toastsRef.current = withPending;
      setToasts(withPending);

      result.then(
        (outcome) => {
          const stillPresent = toastsRef.current.some((t) => t.id === id);
          if (stillPresent) {
            // Reemplaza en su misma posición — el intercambio es 1↔1.
            const next = toastsRef.current.map((t) =>
              t.id === id
                ? {
                    ...t,
                    type: outcome.type,
                    message: outcome.message,
                    action: undefined,
                    pending: false,
                    duration: DEFAULT_DURATION,
                  }
                : t,
            );
            toastsRef.current = next;
            setToasts(next);
            scheduleTimer(id, DEFAULT_DURATION);
          } else {
            // El usuario cerró el toast mientras estaba en vuelo — el
            // desenlace igual se anuncia, como un toast nuevo.
            show(outcome.type, outcome.message, { groupId: current.groupId });
          }
        },
        (err: unknown) => {
          const message =
            err instanceof Error ? err.message : "No se pudo completar la acción.";
          const stillPresent = toastsRef.current.some((t) => t.id === id);
          if (stillPresent) {
            const retryDuration = current.duration ?? ACTION_DURATION;
            const next = toastsRef.current.map((t) =>
              t.id === id ? { ...t, pending: false } : t,
            );
            toastsRef.current = next;
            setToasts(next);
            scheduleTimer(id, retryDuration);
          }
          show("error", message);
        },
      );
    },
    [dismiss, clearTimerEntry, scheduleTimer, show],
  );

  // Registra `show` como emisor imperativo mientras el provider está montado.
  useEffect(() => {
    toastEmitFn = show;
    return () => {
      toastEmitFn = null;
    };
  }, [show]);

  const contextValue: ToastContextValue = {
    toast: {
      success: (msg, opts) => show("success", msg, opts),
      error: (msg, opts) => show("error", msg, opts),
      warning: (msg, opts) => show("warning", msg, opts),
      info: (msg, opts) => show("info", msg, opts),
    },
    dismiss,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastViewport
        toasts={toasts}
        onDismiss={dismiss}
        onAction={handleAction}
        onPause={pauseTimer}
        onResume={resumeTimer}
      />
    </ToastContext.Provider>
  );
}

// ─── Mapeo tipo → ícono y color del círculo tick ──────────────────────────────

/**
 * Mapeo tipo → clases de color del círculo tick del DS.
 * success → bg-income   (verde, semántica correcta)
 * error   → bg-expense  (rojo, semántica correcta)
 * warning → bg-warning  (ámbar, semántica correcta)
 * info    → bg-accent-ink (índigo oscuro)
 */
const tickColorMap: Record<ToastType, string> = {
  success: "bg-income",
  error:   "bg-expense",
  warning: "bg-warning",
  info:    "bg-accent-ink",
};

const tickIconMap: Record<ToastType, React.ReactElement> = {
  success: <Check size={14} strokeWidth={2.5} aria-hidden="true" />,
  error:   <X size={14} strokeWidth={2.5} aria-hidden="true" />,
  warning: <AlertTriangle size={14} strokeWidth={2.5} aria-hidden="true" />,
  info:    <Info size={14} strokeWidth={2.5} aria-hidden="true" />,
};

// ─── ToastItem ────────────────────────────────────────────────────────────────

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
  onAction: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
}

function ToastItem({ toast, onDismiss, onAction, onPause, onResume }: ToastItemProps) {
  const isPending = !!toast.pending;

  function handleBlur(e: FocusEvent<HTMLDivElement>) {
    // focus-within aproximado: si el foco no sigue dentro del pill, reanuda.
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      onResume(toast.id);
    }
  }

  return (
    <div
      role="alert"
      aria-live={toast.type === "error" ? "assertive" : "polite"}
      onPointerEnter={() => onPause(toast.id)}
      onPointerLeave={() => onResume(toast.id)}
      onFocus={() => onPause(toast.id)}
      onBlur={handleBlur}
      className={cn(
        // Pill oscuro DS: bg-ink text-paper, rounded-[13px]
        "pointer-events-auto flex items-center gap-[14px]",
        "rounded-[13px] bg-ink text-paper",
        // Padding DS: 12px top/bottom, 14px right, 16px left
        "py-3 pl-4 pr-[14px]",
        // Sombra DS
        "shadow-[var(--shadow-lg)]",
        // Fuente
        "font-ui text-[14px] font-medium",
        // Animación slide-up — keyframes definidos en globals.css via @layer
        "animate-toast-in",
        // Ancho — regla general de todos los toasts (docs/design.md §Toast con acción):
        // con acción, ancho FIJO (una sola propiedad, no min/max) para que el
        // blanco de clic no cambie de tamaño bajo el cursor entre reemplazos;
        // sin acción, ancho natural capeado. El toast de desenlace (sin acción)
        // que reemplaza a uno con acción se angosta — es lo esperado.
        toast.action
          ? "w-[min(520px,calc(100vw-32px))]"
          : "max-w-[min(460px,calc(100vw-32px))]",
      )}
    >
      {/* Círculo tick con ícono semántico */}
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-full text-white",
          "h-6 w-6",
          tickColorMap[toast.type],
        )}
        aria-hidden="true"
      >
        {tickIconMap[toast.type]}
      </span>

      {/* Mensaje — min-w-0 flex-1, máximo 2 líneas con elipsis */}
      <p className="min-w-0 flex-1 leading-snug line-clamp-2">{toast.message}</p>

      {/* Divisor + acción — INLINE, a la derecha del mensaje (no debajo) */}
      {toast.action && (
        <>
          <span
            className="h-5 w-px shrink-0 bg-current opacity-[0.22]"
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={() => onAction(toast.id)}
            disabled={isPending}
            aria-busy={isPending || undefined}
            className={cn(
              "relative min-w-[104px] shrink-0 whitespace-nowrap text-center text-[14px] font-bold",
              // Hit area 48px sin engordar el pill (no crece el alto real del botón)
              "after:absolute after:-inset-y-[7px] after:inset-x-0 after:content-['']",
              isPending
                ? "cursor-default opacity-70"
                : cn(
                    "border-b border-b-current pb-px hover:opacity-80",
                    "focus:outline-none focus-visible:rounded-ctl focus-visible:ring-2 focus-visible:ring-current",
                  ),
            )}
          >
            {isPending ? (toast.action.pendingLabel ?? toast.action.label) : toast.action.label}
          </button>
        </>
      )}

      {/* Botón cerrar con ícono Lucide X — siempre habilitado, también en vuelo */}
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Cerrar notificación"
        className="shrink-0 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-current"
      >
        <X size={14} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  );
}

// ─── ToastViewport ────────────────────────────────────────────────────────────

interface ToastViewportProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  onAction: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
}

function ToastViewport({ toasts, onDismiss, onAction, onPause, onResume }: ToastViewportProps) {
  if (toasts.length === 0) return null;

  return (
    /*
     * Viewport DS: fixed abajo-centro
     * left-1/2 -translate-x-1/2 centra horizontalmente.
     * pointer-events-none en el contenedor, pointer-events-auto en cada item.
     * El más nuevo queda al final del array → último hijo → abajo (§5).
     */
    <div
      aria-label="Notificaciones"
      className="pointer-events-none fixed bottom-[var(--toast-inset-bottom)] left-1/2 z-[90] flex -translate-x-1/2 flex-col items-center gap-[10px]"
    >
      {toasts.map((t) => (
        <ToastItem
          key={t.id}
          toast={t}
          onDismiss={onDismiss}
          onAction={onAction}
          onPause={onPause}
          onResume={onResume}
        />
      ))}
    </div>
  );
}
