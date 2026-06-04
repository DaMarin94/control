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
type Category = {
  id:        string
  userId:    string   // owner — nunca visible entre usuarios
  name:      string
  createdAt: Date
}

// Categorías default al crear cuenta:
// "Consumibles" | "Tarjeta de crédito" | "Gastos fijos" | "Servicios"
```

### Transaction

```typescript
type TransactionType = 'EXPENSE' | 'INCOME'

type Transaction = {
  id:          string
  userId:      string
  categoryId:  string
  type:        TransactionType
  amount:      number           // en centavos (integer) — sin decimales flotantes
  description: string | null
  date:        Date             // fecha del movimiento (no createdAt)
  createdAt:   Date
}
```

> **Nota — moneda:** en v1 no hay campo de moneda. Se guarda el monto en la unidad mínima (centavos) de la moneda implícita del usuario. Cuando se implemente selección de moneda, se agrega el campo `currency` a `Transaction` sin romper datos existentes.

## Schema Prisma

```prisma
model User {
  id           String        @id @default(cuid())
  email        String        @unique
  name         String?
  image        String?
  createdAt    DateTime      @default(now())
  categories   Category[]
  transactions Transaction[]
}

model Category {
  id           String        @id @default(cuid())
  userId       String
  name         String
  createdAt    DateTime      @default(now())
  user         User          @relation(fields: [userId], references: [id])
  transactions Transaction[]

  @@unique([userId, name])
}

model Transaction {
  id          String          @id @default(cuid())
  userId      String
  categoryId  String
  type        TransactionType
  amount      Int             // centavos
  description String?
  date        DateTime
  createdAt   DateTime        @default(now())
  user        User            @relation(fields: [userId], references: [id])
  category    Category        @relation(fields: [categoryId], references: [id])
}

enum TransactionType {
  EXPENSE
  INCOME
}
```

## Contratos de API (NestJS → Next.js)

```typescript
// GET /transactions?month=2026-06
// GET /transactions?year=2026
TransactionDto[]

// POST /transactions
CreateTransactionDto {
  type:        'EXPENSE' | 'INCOME'
  amount:      number   // centavos
  categoryId:  string
  description?: string
  date:        string   // ISO 8601
}

// DELETE /transactions/:id

// GET /categories
CategoryDto[]

// POST /categories
CreateCategoryDto { name: string }

// PATCH /categories/:id
UpdateCategoryDto { name: string }

// DELETE /categories/:id
```

## Invariantes de negocio

- `amount` siempre > 0. El signo lo da `type` (EXPENSE / INCOME).
- No se puede eliminar una categoría que tenga transacciones asociadas.
- Todos los recursos están scoped a `userId` — el backend filtra siempre por el usuario del JWT.
- `date` es la fecha elegida por el usuario, no la fecha de creación del registro.
