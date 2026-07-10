"use client";

/**
 * Diálogo de confirmación para reactivar un método de pago eliminado.
 * Espejo exacto del flujo de categorías (RF-CAT-002 A3 → RF-PM-001 A4).
 *
 * Consume el shell compartido `ModalShell` (variant="dialog").
 */

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { ModalShell, ModalShellHeader, ModalShellBody, ModalShellFooter } from "@/components/ui/modal-shell";
import { PaymentMethodIcon } from "@/components/ui/payment-method-icon";
import {
  PAYMENT_METHOD_TYPE_LABELS,
  type PaymentMethodType,
  type PaymentMethod,
} from "@/types/payment-method";

interface ReactivationPromptProps {
  reactivable: {
    id: string;
    name: string;
    type: string;
    icon: string;
  };
  onCancel: () => void;
  onReactivated: (paymentMethod: PaymentMethod) => void;
}

export function ReactivationPrompt({ reactivable, onCancel, onReactivated }: ReactivationPromptProps) {
  const { toast } = useToast();
  const { reactivatePaymentMethod, isReactivating } = usePaymentMethods();

  const typeLabel =
    PAYMENT_METHOD_TYPE_LABELS[reactivable.type as PaymentMethodType] ?? reactivable.type;

  async function handleReactivate() {
    const result = await reactivatePaymentMethod(reactivable.id);

    if (!result.success) {
      toast.error(result.error ?? "No se pudo reactivar el método de pago.");
      return;
    }

    toast.success(`Método de pago "${reactivable.name}" reactivado correctamente.`);
    const reactivated: PaymentMethod = result.paymentMethod ?? {
      id: reactivable.id,
      name: reactivable.name,
      type: reactivable.type as PaymentMethodType,
      icon: reactivable.icon,
      closingDay: null,
      paymentDay: null,
      userId: "",
      deletedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      movementCount: 0,
    };
    onReactivated(reactivated);
  }

  return (
    <ModalShell variant="dialog" onClose={onCancel} labelledBy="pm-reactivation-title">
      <ModalShellHeader titleId="pm-reactivation-title" title="Método de pago eliminado encontrado" />

      <ModalShellBody>
        <p className="text-[14px] text-ink">
          Ya tenés un método de pago{" "}
          <span className="font-semibold">&ldquo;{reactivable.name}&rdquo;</span> eliminado.
          ¿Querés reactivarlo?
        </p>

        {/* Detalle de configuración original */}
        <div className="rounded-ctl border border-line bg-panel-2 px-4 py-3 text-[13px]">
          <p className="mb-2 font-semibold text-ink">
            El método se reactivará con su configuración original:
          </p>
          <ul className="space-y-1 text-muted">
            <li className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
                Nombre
              </span>
              <span className="font-semibold text-ink">{reactivable.name}</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
                Tipo
              </span>
              <span className="font-semibold text-ink">{typeLabel}</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
                Ícono
              </span>
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-ctl border border-line bg-panel-3 text-ink-2"
                aria-hidden="true"
              >
                <PaymentMethodIcon icon={reactivable.icon} size={14} />
              </span>
            </li>
          </ul>
          <p className="mt-2 text-[12px] text-muted">
            El nombre y tipo que escribiste en el formulario no se aplicarán.
          </p>
        </div>
      </ModalShellBody>

      <ModalShellFooter>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isReactivating}>
          Cancelar
        </Button>
        <Button type="button" size="sm" onClick={handleReactivate} disabled={isReactivating}>
          {isReactivating ? "Reactivando..." : "Reactivar"}
        </Button>
      </ModalShellFooter>
    </ModalShell>
  );
}
