"use client";

/**
 * Hook centralizado de toasts.
 * Ningún componente dispara toasts directamente — todo pasa por useToast().
 *
 * Tipos soportados: success | error | warning | info
 * Acción opcional: { label: string; onClick: () => void }
 * Auto-dismiss: configurable, con default según tipo.
 */

import { useContext } from "react";
import { ToastContext, type ToastContextValue } from "@/components/ui/toast";

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast debe usarse dentro de <ToastProvider>");
  }

  return context;
}
