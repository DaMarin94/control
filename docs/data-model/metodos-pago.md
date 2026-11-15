# Métodos de pago (`PaymentMethod`)

> Parte del modelo de datos de Control. Índice: `docs/data-model.md`. Reglas funcionales: submódulo 3.6.b (`docs/requirements/metodos-pago.md`) y RN-021. Decisiones de modelado (espejo de Categoría, `paymentMethodId`, `autoDebit`): `entidades.md`. Clave de preferencias `defaultPaymentMethods`: `preferencias.md`.

Toda respuesta exitosa de los endpoints de métodos de pago devuelve, dentro del sobre `{ success, statusCode, data }`, este shape (CRUD espejo del de categorías, `categorias.md`):

```
PaymentMethod = {
  id: string,
  userId: string,
  name: string,                          // tal cual lo tipeó el usuario
  type: "CREDIT" | "DEBIT" | "CASH",     // allowlist en código (string, no enum)
  icon: string,                          // clave del set curado; "card" default/fallback
  closingDay: number | null,             // día del mes 1-31; solo CREDIT (null en DEBIT/CASH)
  paymentDay: number | null,             // día del mes 1-31; solo CREDIT (null en DEBIT/CASH)
  deletedAt: null,                       // las respuestas solo traen activos
  createdAt: string,
  updatedAt: string,
  movementCount: number
}
```

- **`type` — string con allowlist en código**, no enum de Prisma (extensible sin migración; ver decisión de modelado). Rótulos UI: Crédito / Débito / Efectivo.
- **Campos condicionales nullable.** `closingDay`/`paymentDay` solo tienen valor en `CREDIT`; en `DEBIT`/`CASH` vienen `null` (ningún campo condicional). Días válidos 1-31; si el valor excede el último día del mes se **clampea** a ese último día (informativo, no mueve imputación; RN-021).
- **`icon` — string con allowlist en código**, default/fallback `card`; una marca ausente del set cae a `card`. Es la única identidad visual (no hay `color`). El set concreto vive en `docs/design.md`.
- **`movementCount` — derivado de solo lectura**, suma de las tres relaciones de movimiento (únicos + fijos + grupos de cuotas) que referencian el método vía `paymentMethodId`. Cero si no tiene movimientos. Alimenta el contador "N movimientos" (RF-PM-005). No se confunde con los totales de dinero.
- **Payload reactivable en errores (409).** Igual que categorías, la colisión con un método **eliminado** (RF-PM-001 A4) responde `409` con `error.data = { reactivable: true, paymentMethod: { id, name, type, icon } }`; la colisión con uno **activo** responde `409` sin `data`.
