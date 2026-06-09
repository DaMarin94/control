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
}

export function NewTransactionButton({
  label = "Nuevo movimiento",
  variant = "default",
}: NewTransactionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant={variant} onClick={() => setIsOpen(true)}>
        {label}
      </Button>

      {isOpen && (
        <TransactionModal mode="create" onClose={() => setIsOpen(false)} />
      )}
    </>
  );
}
