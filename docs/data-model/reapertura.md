# Contrato de reapertura de fijos (`/recurring/:id/reopen`)

> Parte del modelo de datos de Control. Índice: `docs/data-model.md`. Regla funcional: RF-MF-008 (`docs/requirements/fijos.md`); mecánica en `docs/backend/fijos.md` §Reapertura de un fijo terminado. `historyEntryId`: `historial.md`.

Endpoints de RF-MF-008 en el `RecurringModule`. **JWT requerido**; scope por `userId` del token.

| Endpoint | Entrada | Éxito | Errores |
|---|---|---|---|
| `GET /recurring/:id/reopen-preview` | query `currentMonth` (`YYYY-MM`, requerido) | `200` · `data: ReopenPreview` | `400` · `404` |
| `POST /recurring/:id/reopen` | `ReopenBody` | `200` · `data: ReopenResult` | `400` · `404` |

```
ReopenPreview = {
  chainId: string,
  endMonth: string,                 // "YYYY-MM" exclusivo — fin vigente del fijo lógico (E)
  minReopenMonth: string,           // piso y default de X = máx(currentMonth, endMonth)
  amountCents: number,              // último monto (fila vigente)
  currency: Currency,
  category: { id, name, color, deleted: boolean },
  paymentMethod: { id, name, icon, deleted: boolean } | null,
  requiresCategory: boolean,        // = category.deleted
  requiresPaymentMethod: boolean,   // = paymentMethod !== null && paymentMethod.deleted
  mirrors: Array<{                  // calculados de fijo que se reabren en espejo
    chainId: string,
    description: string | null,
    category: { id, name, color, deleted: boolean },
    requiresCategory: boolean
  }>
}

ReopenBody = {
  currentMonth: string,             // mes en curso real
  reopenMonth: string,              // X
  amountCents: number,              // entero > 0, monto desde X
  categoryId?: string,
  paymentMethodId?: string | null,
  calculatedCategories?: Array<{ chainId: string, categoryId: string }>   // máx. 100
}

ReopenResult = {
  id: string,                       // fila nueva del origen (startMonth = X)
  chainId: string,
  previousEndMonth: string,         // E
  reopenMonth: string,              // X
  skippedCount: number,             // apariciones del relleno [E, X) del origen (cadencia vieja)
  reopenedCalculatedChainIds: string[],
  historyEntryId: string
}
```

- **`:id`** = cualquier fila de la cadena del fijo; el backend resuelve la fila vigente por `chainId`.
- **No reabrible → `400`** (preview y POST): el `:id` es un calculado de cualquier origen, o la fila vigente no tiene fin (`deletedFrom = null`). **`404`**: no existe o es de otro usuario.
- **Reemplazos solo cuando el preview los marca requeridos.** `categoryId` ⇔ `requiresCategory`; `paymentMethodId` ⇔ `requiresPaymentMethod`; una entrada de `calculatedCategories` por cada espejo con `requiresCategory`. Faltar uno requerido, mandar uno no requerido, repetir un `chainId` o apuntar a un calculado que no es espejo → `400`. Los reemplazos se validan como en el alta (categoría activa y de scope compatible; la del espejo con scope `BOTH`).
- **`paymentMethodId`: omitido ≠ `null`.** `null` = "sin método", reemplazo válido; omitido = no se manda reemplazo. Solo se acepta (en cualquiera de sus dos formas) cuando el método vigente está dado de baja.
- **Validación de X → `400`:** `reopenMonth < máx(currentMonth, endMonth)`, o año de `reopenMonth` > 2200. `X == endMonth` es válido (sin relleno).
- **`skippedCount` de la respuesta ≠ `reopen.skippedCount` de `/history`:** la respuesta cuenta todas las apariciones del relleno; el historial cuenta solo las anulaciones que la reapertura **creó** (excluye las que ya existían).
