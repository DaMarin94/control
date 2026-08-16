/**
 * Envase de footer mínimo para tests de TransactionForm/RecurringForm/
 * InstallmentForm — estos forms ya NO dibujan su propio footer (docs/design.md
 * §Superficie de captura → "0. Encuadre": "la zona de acción es un
 * slot del envase, no del form"). Reproduce lo que dibuja un envase real
 * (ModalShellFooter en desktop / la Zona 3 en la superficie de captura): un botón `Guardar`
 * asociado al `<form>` vía `form={formId}` (asociación nativa de HTML, el
 * botón no necesita ser descendiente del `<form>`).
 *
 * Uso: envolver el form bajo prueba y pasar `onFooterStateChange={setState}`
 * al form; este componente pinta el botón con el estado reportado.
 */
import { useState } from "react";
import {
  DEFAULT_MOVEMENT_FORM_FOOTER_STATE,
  type MovementFormFooterState,
} from "@/components/movements/movement-form-footer";

interface TestMovementFormFooterProps {
  children: (onFooterStateChange: (state: MovementFormFooterState) => void) => React.ReactNode;
}

export function TestMovementFormFooter({ children }: TestMovementFormFooterProps) {
  const [state, setState] = useState<MovementFormFooterState>(DEFAULT_MOVEMENT_FORM_FOOTER_STATE);

  return (
    <>
      {children(setState)}
      <button type="submit" form={state.formId} disabled={state.disabled}>
        {state.submitLabel}
      </button>
    </>
  );
}
