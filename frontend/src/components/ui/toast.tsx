"use client";

/**
 * Sistema de toasts centralizado.
 * Re-estilado contra tokens del design system "Precise Ledger" (Fase 2).
 *
 * Cambios de estilo (funcionalidad 100% preservada):
 *  - Viewport: abajo-centro (fixed bottom-[26px] left-1/2 -translate-x-1/2)
 *    → era abajo-derecha; el DS lo define en centro.
 *  - Item: pill bg-ink text-paper, rounded-[13px], padding 12px 14px 12px 16px,
 *    shadow-[var(--shadow-lg)], animación slide-up .3s.
 *  - Ícono "tick": círculo 24px con ícono Lucide. Color varía por tipo:
 *      success → bg-income  (verde) + Check
 *      error   → bg-expense (rojo)  + X
 *      warning → bg-warning (ámbar) + AlertTriangle
 *      info    → bg-accent-ink      + Info
 *  - Acción (.tlink): font-weight 700, border-bottom currentColor (texto underline pesado).
 *  - Close: ícono X de lucide-react.
 *
 * Tipos: success | error | warning | info
 * Acción opcional: { label: string; onClick: () => void }
 * Auto-dismiss: configurable por toast (default 5000ms)
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
  type ReactNode,
} from "react";
import { AlertTriangle, Check, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  action?: ToastAction;
  /** Duración en ms antes del auto-dismiss. Default: 5000 */
  duration?: number;
}

export interface ShowToastOptions {
  action?: ToastAction;
  /** Duración en ms. Si es 0, no hay auto-dismiss. */
  duration?: number;
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

// ─── Provider ─────────────────────────────────────────────────────────────────

const DEFAULT_DURATION = 5000;

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timerRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));

    const timer = timerRefs.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timerRefs.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (type: ToastType, message: string, options?: ShowToastOptions) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const duration = options?.duration ?? DEFAULT_DURATION;

      const newToast: Toast = {
        id,
        type,
        message,
        action: options?.action,
        duration,
      };

      setToasts((prev) => [...prev, newToast]);

      // Auto-dismiss (si duration > 0)
      if (duration > 0) {
        const timer = setTimeout(() => {
          dismiss(id);
        }, duration);

        timerRefs.current.set(id, timer);
      }
    },
    [dismiss],
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
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
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
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  return (
    <div
      role="alert"
      aria-live={toast.type === "error" ? "assertive" : "polite"}
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

      {/* Mensaje + acción opcional */}
      <div className="min-w-0 flex-1">
        <p className="leading-snug">{toast.message}</p>

        {toast.action && (
          <button
            onClick={() => {
              toast.action?.onClick();
              onDismiss(toast.id);
            }}
            /* tlink DS: font-weight 700, borde inferior currentColor */
            className="mt-0.5 cursor-pointer border-b border-b-current pb-px text-sm font-bold leading-none hover:opacity-80"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {/* Botón cerrar con ícono Lucide X */}
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
}

function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  if (toasts.length === 0) return null;

  return (
    /*
     * Viewport DS: fixed abajo-centro
     * left-1/2 -translate-x-1/2 centra horizontalmente.
     * pointer-events-none en el contenedor, pointer-events-auto en cada item.
     */
    <div
      aria-label="Notificaciones"
      className="pointer-events-none fixed bottom-[26px] left-1/2 z-[90] flex -translate-x-1/2 flex-col items-center gap-[10px]"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
