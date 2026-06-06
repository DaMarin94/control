"use client";

/**
 * Sistema de toasts centralizado.
 * Incluye: ToastContext, ToastProvider, y el componente visual de toast.
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
  useRef,
  useState,
  type ReactNode,
} from "react";
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

// ─── Componente visual ────────────────────────────────────────────────────────

const toastTypeStyles: Record<ToastType, string> = {
  success: "border-green-500 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100",
  error: "border-red-500 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100",
  warning:
    "border-yellow-500 bg-yellow-50 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-100",
  info: "border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100",
};

const toastIconMap: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ℹ",
};

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
        "pointer-events-auto flex w-full items-start gap-3 rounded-lg border-l-4 p-4 shadow-lg",
        "animate-in slide-in-from-right-full duration-300",
        toastTypeStyles[toast.type],
      )}
    >
      <span className="mt-0.5 shrink-0 text-sm font-bold" aria-hidden="true">
        {toastIconMap[toast.type]}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{toast.message}</p>

        {toast.action && (
          <button
            onClick={() => {
              toast.action?.onClick();
              onDismiss(toast.id);
            }}
            className="mt-1 text-sm font-semibold underline underline-offset-2 hover:opacity-80"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Cerrar notificación"
        className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-current"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

interface ToastViewportProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notificaciones"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
