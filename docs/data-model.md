# Data Model

## Entidades principales

### User

```typescript
type User = {
  id: string           // cuid
  email: string        // de Google OAuth
  name: string | null
  image: string | null // avatar de Google
  createdAt: Date
}
```

### Category

```typescript
type CategoryScope = 'BOTH' | 'EXPENSE' | 'INCOME'

type Category = {
  id:        string
  userId:    string          // owner — nunca visible entre usuarios
  name:      string
  scope:     CategoryScope   // default: BOTH
  deletedAt: Date | null     // soft delete — null = activa
  createdAt: Date
}

// Categorías default al crear cuenta (scope: BOTH):
// "Consumibles" | "Tarjeta de crédito" | "Gastos fijos" | "Servicios"
```

### Transaction (movimiento único)

El caso simple: algo que pasó una vez.

```typescript
type TransactionType    = 'EXPENSE' | 'INCOME'

type Transaction = {
  id:          string
  userId:      string
  categoryId:  string
  type:        TransactionType
  amount:      number           // en centavos (integer) — sin decimales flotantes
  description: string | null
  date:        Date             // fecha elegida por el usuario (no createdAt)
  createdAt:   Date
}
```

### RecurringConfig (movimiento fijo)

Una "plantilla" activa que genera un movimiento virtual en cada mes mientras esté activa.

```typescript
type RecurringConfig = {
  id:          string
  userId:      string
  categoryId:  string
  type:        TransactionType
  amount:      number           // en centavos
  description: string | null
  startMonth:  Date             // primer mes en que aparece (día 1 del mes)
  deletedFrom: Date | null      // si no null: deja de aparecer desde este mes (día 1)
  createdAt:   Date
}
```

> **Regla `deletedFrom`:** si el usuario elimina sin el checkbox → `deletedFrom = primer día del mes siguiente`. Si marca el checkbox "eliminar desde este mes" → `deletedFrom = primer día del mes actual`. Los meses anteriores a `startMonth` nunca se tocan.

### InstallmentGroup (cuotas)

Una compra en cuotas: un grupo padre + N instancias mensuales.

```typescript
type InstallmentGroup = {
  id:                 string
  userId:             string
  categoryId:         string
  type:               TransactionType   // generalmente EXPENSE
  amountPerInstallment: number          // en centavos — monto de cada cuota
  totalInstallments:  number
  startMonth:         Date              // primer mes (día 1)
  description:        string | null
  createdAt:          Date
}
```

> Las cuotas se calculan on-the-fly al consultar un mes: si `startMonth <= mesConsultado < startMonth + totalInstallments meses`, la cuota aparece. No se generan filas individuales por cuota.

> **Nota — moneda:** en v1 no hay campo de moneda. El monto se guarda en centavos de la moneda implícita. Cuando se agregue `currency`, se añade a las tres entidades sin romper datos existentes.

## Schema Prisma

```prisma
enum TransactionType {
  EXPENSE
  INCOME
}

enum CategoryScope {
  BOTH
  EXPENSE
  INCOME
}

model User {
  id               String            @id @default(cuid())
  email            String            @unique
  name             String?
  image            String?
  createdAt        DateTime          @default(now())
  categories       Category[]
  transactions     Transaction[]
  recurringConfigs RecurringConfig[]
  installmentGroups InstallmentGroup[]
}

model Category {
  id               String            @id @default(cuid())
  userId           String
  name             String
  scope            CategoryScope     @default(BOTH)
  deletedAt        DateTime?         // soft delete
  createdAt        DateTime          @default(now())
  user             User              @relation(fields: [userId], references: [id])
  transactions     Transaction[]
  recurringConfigs RecurringConfig[]
  installmentGroups InstallmentGroup[]

  @@unique([userId, name])
}

model Transaction {
  id          String          @id @default(cuid())
  userId      String
  categoryId  String
  type        TransactionType
  amount      Int             // centavos
  description String?
  date        DateTime        // fecha elegida por el usuario
  createdAt   DateTime        @default(now())
  user        User            @relation(fields: [userId], references: [id])
  category    Category        @relation(fields: [categoryId], references: [id])
}

model RecurringConfig {
  id          String          @id @default(cuid())
  userId      String
  categoryId  String
  type        TransactionType
  amount      Int             // centavos
  description String?
  startMonth  DateTime        // primer día del mes de inicio
  deletedFrom DateTime?       // primer día del mes desde el que deja de aparecer
  createdAt   DateTime        @default(now())
  user        User            @relation(fields: [userId], references: [id])
  category    Category        @relation(fields: [categoryId], references: [id])
}

model InstallmentGroup {
  id                    String          @id @default(cuid())
  userId                String
  categoryId            String
  type                  TransactionType
  amountPerInstallment  Int             // centavos
  totalInstallments     Int
  startMonth            DateTime        // primer día del mes de la primer cuota
  description           String?
  createdAt             DateTime        @default(now())
  user                  User            @relation(fields: [userId], references: [id])
  category              Category        @relation(fields: [categoryId], references: [id])
}
```

## Contratos de API (NestJS → Next.js)

```typescript
// ── MOVIMIENTOS DEL MES ──────────────────────────────────────────
// GET /movements?month=2026-06
// Devuelve transacciones únicas + recurrentes activas + cuotas del mes, unificados:
MovementDto[] // ver shape abajo

type MovementDto = {
  id:          string
  source:      'transaction' | 'recurring' | 'installment'
  type:        'EXPENSE' | 'INCOME'
  amount:      number        // centavos
  categoryId:  string
  categoryName: string
  description: string | null
  date:        string | null // ISO — null para recurrentes (no tienen día)
  // Solo si source === 'installment':
  installmentNumber?:   number
  totalInstallments?:   number
  installmentGroupId?:  string
  // Solo si source === 'recurring':
  recurringConfigId?:   string
}

// ── TRANSACCIONES ÚNICAS ─────────────────────────────────────────
// POST /transactions
CreateTransactionDto {
  type:         'EXPENSE' | 'INCOME'
  amount:       number        // centavos
  categoryId:   string
  description?: string
  date:         string        // ISO 8601
}
// PATCH /transactions/:id  (mismos campos, todos opcionales)
// DELETE /transactions/:id

// ── RECURRENTES ──────────────────────────────────────────────────
// POST /recurring
CreateRecurringDto {
  type:         'EXPENSE' | 'INCOME'
  amount:       number
  categoryId:   string
  description?: string
  startMonth:   string        // 'YYYY-MM' — se normaliza a día 1
}
// PATCH /recurring/:id  { amount?, categoryId?, description? }
// DELETE /recurring/:id  { deleteFromCurrentMonth: boolean }

// ── CUOTAS ───────────────────────────────────────────────────────
// POST /installments
CreateInstallmentDto {
  type:               'EXPENSE' | 'INCOME'
  amountPerInstallment: number
  totalInstallments:  number
  startMonth:         string  // 'YYYY-MM'
  categoryId:         string
  description?:       string
}
// DELETE /installments/:id  (elimina todo el grupo)

// ── CATEGORÍAS ───────────────────────────────────────────────────
// GET /categories               (excluye deletedAt !== null)
// GET /categories?includeDeleted=true
CategoryDto[]

// POST /categories
CreateCategoryDto { name: string; scope?: 'BOTH' | 'EXPENSE' | 'INCOME' }

// PATCH /categories/:id
UpdateCategoryDto { name?: string; scope?: 'BOTH' | 'EXPENSE' | 'INCOME' }

// DELETE /categories/:id  → soft delete (setea deletedAt)
```

## Invariantes de negocio

- `amount` siempre > 0. El signo lo da `type` (EXPENSE / INCOME).
- Categorías eliminadas (soft delete) no aparecen en el selector de nuevos movimientos, pero sí en el historial.
- Todos los recursos están scoped a `userId` — el backend filtra siempre por el usuario del JWT.
- `date` en Transaction es la fecha elegida por el usuario, no el timestamp de creación.
- Los recurrentes y cuotas se calculan on-the-fly al consultar un mes — no hay filas generadas por mes.
