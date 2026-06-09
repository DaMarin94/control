"use client";

/**
 * Botón "Nuevo movimiento" para el dashboard.
 * Abre el TransactionModal en modo crear.
 * Es Client Component porque gestiona estado del modal.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TransactionModal } from "@/components/movements/transaction-modal";

export function NewTransactionButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Nuevo movimiento</Button>

      {isOpen && (
        <TransactionModal transaction={null} onClose={() => setIsOpen(false)} />
      )}
    </>
  );
}
