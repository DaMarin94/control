"use client";

/**
 * Botón "Nuevo movimiento" reutilizable.
 * Abre el TransactionModal en modo crear.
 * Se usa tanto en el Dashboard como en la Vista del mes y el sidebar.
 *
 * Re-estilado en Fase 3: acepta prop `size` para el botón grande del dashboard.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TransactionModal } from "@/components/movements/transaction-modal";
import { type VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";

interface NewTransactionButtonProps {
  /** Texto del botón. Default: "Nuevo movimiento" */
  label?: string;
  /** Variante del botón */
  variant?: "default" | "outline" | "ghost";
  /** Tamaño del botón */
  size?: VariantProps<typeof buttonVariants>["size"];
  /**
   * Mes contexto (YYYY-MM) desde la Vista del mes.
   * Se pasa al TransactionModal para precargar el mes de inicio en Fijo y Cuotas.
   * Opcional — si no se pasa, los forms usan el mes actual del navegador.
   */
  defaultMonth?: string;
}

export function NewTransactionButton({
  label = "Nuevo movimiento",
  variant = "default",
  size,
  defaultMonth,
}: NewTransactionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setIsOpen(true)}>
        {label}
      </Button>

      {isOpen && (
        <TransactionModal
          mode="create"
          onClose={() => setIsOpen(false)}
          defaultMonth={defaultMonth}
        />
      )}
    </>
  );
}
