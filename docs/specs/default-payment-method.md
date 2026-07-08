# Spec congelada — Método de pago por defecto por tipo de gasto

> **Estado: PAUSADA — no implementada.** Este es un documento de trabajo autocontenido.
> No refleja el estado actual del sistema y no debe leerse como tal.
> Cuando la feature se cierre, mover lo que corresponda a los docs canónicos
> (`requirements.md`, `data-model.md`, `features.md`) y borrar o actualizar este archivo.

## Objetivo

Permitir auto-preseleccionar un método de pago al **crear** un movimiento de egreso,
según el **tipo de gasto** (único / fijo / cuota).

Hoy el método de pago es opcional en los tres forms de carga y arranca en
"Sin método de pago" (valor `""`). Esta feature lo prefillea con un método por defecto
configurable por el usuario.

## Decisiones cerradas

1. **Un default independiente por cada tipo de gasto.** Tres slots — único, fijo, cuota —
   y cada uno apunta a un método de pago o a ninguno.
2. **Se configura desde la tarjeta del método** en la pantalla Métodos de pago
   (`/metodos-pago`), no en Configuración.
3. **Aplica solo a egresos.** Los ingresos no tienen método de pago y no se ven afectados.
4. **El prefill ocurre solo al crear.** Al **editar** un movimiento se carga el método
   guardado del propio movimiento; el default no pisa nada.
5. **Es una sugerencia editable.** En el form el usuario puede cambiar el método a otro
   o dejarlo en "Sin método de pago".
6. **Fallback al eliminar un método.** Si se elimina un método que era default de algún
   tipo, ese slot vuelve a "ninguno". Implementación: **al leer, validar el id guardado
   contra los métodos activos; si no está entre ellos, tratarlo como "ninguno".** No hace
   falta limpiar el blob al borrar el método — la validación en lectura es la fuente de verdad.
7. **Los movimientos calculados no aplican.** Los fijos derivados/calculados heredan el
   método de su origen y no tienen selector propio; el default no interviene.

## Almacenamiento

Se persiste en el blob abierto `UserPreferences` (JSON, sin migración de schema).
El backend valida solo que el body sea un objeto (`UpdatePreferencesDto` → `@IsObject`),
así que acepta claves arbitrarias sin cambios. Se escribe vía `PUT /preferences` con el
blob completo (semántica de reemplazo total; el frontend arma el merge).

### Clave nueva

```ts
// dentro de UserPreferences (frontend/src/types/auth.ts)
defaultPaymentMethods?: {
  unico: string | null;
  fijo:  string | null;
  cuota: string | null;
};
```

- Cada valor es el `id` de un método de pago, o `null` para "ninguno".
- Ausente → equivale a `{ unico: null, fijo: null, cuota: null }` (ningún default).
- Un slot con un id que no corresponde a ningún método activo se trata como `null` en
  lectura (regla de fallback, decisión 6).

## Semántica de exclusividad

Un método de pago puede ser default de varios tipos a la vez, pero **cada tipo tiene un
solo método**. Activar un tipo en una tarjeta lo desactiva en cualquier otra: el slot
`unico` / `fijo` / `cuota` apunta a lo sumo a un id. Escribir un tipo en una tarjeta
reemplaza el valor previo de ese slot, sin importar a qué tarjeta apuntaba.

## Prefill — reglas exactas

| Contexto | Comportamiento |
|---|---|
| Crear egreso único | Prefill con `defaultPaymentMethods.unico` validado; si `null`, "Sin método de pago" |
| Crear egreso fijo | Prefill con `defaultPaymentMethods.fijo` validado; si `null`, "Sin método de pago" |
| Crear egreso en cuotas | Prefill con `defaultPaymentMethods.cuota` validado; si `null`, "Sin método de pago" |
| Crear ingreso (cualquier tipo) | Sin cambios — no hay método de pago |
| Editar (cualquier tipo) | Carga el método guardado del movimiento; el default no interviene |
| Movimiento calculado | No aplica — hereda del origen, sin selector propio |

El prefill es solo el **valor inicial** del selector: sigue siendo editable por el usuario.

## UI propuesta (a formalizar por control-design)

En cada tarjeta de método, tres toggles chicos: **Únicos / Fijos / Cuotas**. Activar un
toggle marca ese método como default para ese tipo; es exclusivo por tipo (activarlo en una
tarjeta lo desactiva en el resto). Cada toggle activo escribe el `id` de la tarjeta en el
slot correspondiente; desactivarlo pone el slot en `null`.

> **El spec visual definitivo (color, tamaño, ubicación, jerarquía, estados, copy) lo
> produce `control-design` antes de implementar.** Lo de arriba es intención funcional,
> no diseño cerrado.

## Alcance de implementación estimado

**Frontend + preferences, probablemente sin backend.** El blob JSON acepta claves
arbitrarias (`UpdatePreferencesDto` valida solo `IsObject`), así que no requiere cambios
de schema ni de backend. **Confirmar al retomar** leyendo `frontend/src/hooks/use-preferences.ts`:
el patrón es leer `preferences`, mergear con spread y llamar `setPreferences(blobCompleto)`.

Archivos frontend involucrados:

- `frontend/src/components/movements/transaction-form.tsx` — prefill único
- `frontend/src/components/movements/recurring-form.tsx` — prefill fijo
- `frontend/src/components/movements/installment-form.tsx` — prefill cuota
- `frontend/src/app/(app)/metodos-pago/payment-methods-list.tsx` — toggles en la tarjeta + escritura en preferences
- `frontend/src/hooks/use-preferences.ts` — lectura/escritura del blob (helper opcional para la clave)
- `frontend/src/types/auth.ts` — agregar la clave `defaultPaymentMethods` al tipo `UserPreferences`

## Pasos al retomar

1. `control-design` produce el spec visual de los toggles en la tarjeta de método.
2. `control-frontend` implementa: toggles + escritura en preferences (con exclusividad por
   tipo) + prefill en los tres forms (solo egreso, solo creación) + validación de fallback en lectura.
3. Al cerrar, mover lo que corresponda a los docs canónicos
   (`requirements.md` / `data-model.md` / `features.md`) y borrar o actualizar este spec.
