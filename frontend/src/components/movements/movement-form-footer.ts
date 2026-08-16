/**
 * Contrato de "footer como slot del envase" (docs/design.md §Superficie de
 * captura → "0. Encuadre — una lógica, dos composiciones"):
 *
 *   "La zona de acción es un slot del envase, no del form. El form aporta
 *   sus campos y su submit; quién dibuja los botones y con qué composición
 *   lo decide el envase."
 *
 * El estado se reporta desde la CAPA 1 (los hooks `useTransactionFormLogic`
 * / `useRecurringFormLogic` / `useInstallmentFormLogic`), no desde las
 * composiciones — así ninguna de las dos superficies necesita reimplementar
 * el reporte. Cada hook:
 *   1. Genera `formId` con `useId()`.
 *   2. Reporta este estado hacia arriba vía `onFooterStateChange`, con
 *      `useLayoutEffect` (no `useEffect`) para que el envase tenga el
 *      estado correcto ANTES del primer paint del botón externo.
 *
 * El envase (`ModalShellFooter` en `TransactionModal` / la Zona 3 del envase
 * de captura) dibuja el/los botón(es) reales, con `type="submit"
 * form={formId}` — asociación nativa de HTML que funciona aunque el botón NO
 * sea descendiente del <form> (que es exactamente el caso: el footer es
 * HERMANO del cuerpo scrolleable, nunca su hijo).
 */
export interface MovementFormFooterState {
  /** id del <form> real — el envase lo usa vía `form={formId}` en su botón. */
  formId: string;
  isLoading: boolean;
  /** true si el submit debe estar deshabilitado (cargando o sin categorías). */
  disabled: boolean;
  /** Ya resuelto ("Guardar" | "Guardar cambios" | "Guardando…") — el envase lo pinta tal cual. */
  submitLabel: string;
}

export const DEFAULT_MOVEMENT_FORM_FOOTER_STATE: MovementFormFooterState = {
  formId: "",
  isLoading: false,
  disabled: true,
  submitLabel: "Guardar",
};
