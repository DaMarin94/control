"use client";

/**
 * Botón "Nuevo movimiento" reutilizable.
 * Abre el TransactionModal en modo crear.
 * Se usa tanto en el Dashboard como en la Vista del mes.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TransactionModal } from "@/components/movements/transaction-modal";

interface NewTransactionButtonProps {
  /** Texto del botón. Default: "Nuevo movimiento" */
  label?: string;
  /** Variante del botón */
  variant?: "default" | "outline" | "ghost";
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
  defaultMonth,
}: NewTransactionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant={variant} onClick={() => setIsOpen(true)}>
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
