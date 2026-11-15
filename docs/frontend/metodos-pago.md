# Frontend — Métodos de pago (íconos)

CRUD de métodos de pago —sección `/configuracion/metodos-pago` del hub (ver `docs/frontend/configuracion.md`), componentes co-ubicados bajo `app/(app)/configuracion/metodos-pago/`— y selector de método en los forms de movimiento. Reglas funcionales en `docs/requirements/metodos-pago.md`; pantalla en `docs/screens.md`.

## Allowlist de íconos — espejo del backend (gotcha)

La allowlist vive en `frontend/src/types/payment-method.ts` (`PAYMENT_METHOD_ICON_KEYS`), **espejo** de `PAYMENT_METHOD_ICONS` en `backend/src/payment-methods/payment-method-constants.ts` — sin paquete compartido. **Gotcha:** cambiar el set exige actualizar **ambos lados**.

## Render del ícono — dos fuentes, un único mapa

Se renderiza en un **único lugar** (`components/ui/payment-method-icon.tsx`): íconos **genéricos vía `lucide-react`**, **marcas vía `simple-icons`**. Marca ausente → fallback a `card`.

## Selector en el form de carga — listbox custom

Es un **listbox custom** (portal + `fixed`, consume `use-listbox-popover`; ver `docs/frontend/base.md`), **no** un `<select>` nativo, porque cada opción muestra **ícono + nombre**.

## Default por estructura — prefill one-shot (RF-PM-007)

Prefill del selector al **crear** un movimiento con el default de la estructura (único/fijo/cuota), leído del blob `defaultPaymentMethods` (ver `docs/data-model/preferencias.md`). **Gotcha:** no puede resolverse en los `defaultValues` de `useForm` — `usePreferences` / `usePaymentMethods` pueden seguir cargando en el primer render. Se dispara desde un **`useEffect` one-shot (ref)** que solo aplica si el campo sigue en `""` (no pisa una selección manual) y valida el id contra los métodos **activos** (inválido → "Sin método de pago"). Hook: `hooks/use-default-payment-method-prefill.ts`. Aplica a los tres forms de creación (único / fijo / cuota), egreso e ingreso; no en edición ni en calculados.

- **Re-armado tras crear (`rearm`).** El hook devuelve `{ rearm }`, que resetea la ref one-shot. Los tres form-logic hooks (`use-transaction-form-logic` / `use-recurring-form-logic` / `use-installment-form-logic`) lo llaman en el reset post-creación de la captura mobile (`onCreateSuccess`): el form queda montado y se resetea, así que sin re-armar el siguiente alta no se prellenaría. Re-armado, vale la misma regla: solo creación, solo si el campo está en `""`.
