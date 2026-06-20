import { Injectable } from '@nestjs/common';
import { Currency, FormulaOperator, MovementType, RecurringFrequency, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Shape de categoría embebida en un Recurring.
 * Se incluye siempre para que el frontend pueda mostrarla sin request adicional.
 */
export interface EmbeddedCategory {
  id: string;
  name: string;
  color: string;
  scope: string;
}

/**
 * Shape completo de un fijo con categoría embebida.
 * Incluye frequency (P2 — Fase 1.1.1), campos de calculado (Fase 1.1.7 + 1.1.7.ext) y chainId.
 */
export interface RecurringWithCategory {
  id: string;
  userId: string;
  categoryId: string;
  type: MovementType;
  amountCents: number;
  description: string | null;
  startMonth: string;
  deletedFrom: string | null;
  frequency: RecurringFrequency;
  chainId: string;
  /** null en fijos normales; chainId del origen en calculados de fijo */
  sourceChainId: string | null;
  /** id del Transaction de origen en calculados de único (Fase 1.1.7.ext); null en los demás */
  sourceMovementId: string | null;
  /** id del InstallmentGroup de origen en calculados de cuota (Fase 1.1.7.ext); null en los demás */
  sourceInstallmentGroupId: string | null;
  formulaOperator: FormulaOperator | null;
  /**
   * Operando almacenado como entero escalado:
   * ADD/SUB: centavos × 100 (mismo que amountCents)
   * MUL/DIV: factor × 1_000_000 (6 decimales)
   * PCT:     porcentaje × 100 (ej. 10% → 1000, 1.5% → 150)
   */
  formulaOperand: number | null;
  /** 1 (positivo) o -1 (negativo) */
  formulaSign: number | null;
  /** Moneda del fijo (Fase 1.2.3). Los calculados no usan este campo (heredan del origen). */
  currency: Currency;
  /** Cotización ARS/1 USD para este tramo de la cadena (Fase 1.2.3). */
  exchangeRate: number;
  createdAt: Date;
  updatedAt: Date;
  category: EmbeddedCategory;
}

/**
 * Resultado del toggle de skip (P1 — Fase 1.1.1).
 * - skipped: true si el mes quedó anulado (se creó el skip); false si fue des-anulado (se borró).
 * - month: mes que fue toggleado.
 */
export interface SkipToggleResult {
  skipped: boolean;
  month: string;
}

/**
 * Fila mínima de Recurring para localizar el monto del origen de un calculado.
 * Usada en la derivación on-the-fly del monto del calculado.
 */
export interface RecurringSourceRow {
  id: string;
  chainId: string;
  amountCents: number;
  startMonth: string;
  deletedFrom: string | null;
}

// Include para todas las queries de Recurring
const RECURRING_INCLUDE = {
  category: {
    select: {
      id: true,
      name: true,
      color: true,
      scope: true,
    },
  },
} satisfies Prisma.RecurringInclude;

/**
 * Parsea el resultado de Prisma (con include de category) al shape interno.
 */
function mapToRecurringWithCategory(
  r: Prisma.RecurringGetPayload<{ include: typeof RECURRING_INCLUDE }>,
): RecurringWithCategory {
  return {
    id: r.id,
    userId: r.userId,
    categoryId: r.categoryId,
    type: r.type,
    amountCents: r.amountCents,
    description: r.description,
    startMonth: r.startMonth,
    deletedFrom: r.deletedFrom,
    frequency: r.frequency,
    chainId: r.chainId,
    sourceChainId: r.sourceChainId,
    sourceMovementId: r.sourceMovementId,
    sourceInstallmentGroupId: r.sourceInstallmentGroupId,
    formulaOperator: r.formulaOperator,
    formulaOperand: r.formulaOperand,
    formulaSign: r.formulaSign,
    currency: r.currency,
    exchangeRate: Number(r.exchangeRate),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    category: {
      id: r.category.id,
      name: r.category.name,
      color: r.category.color,
      scope: r.category.scope,
    },
  };
}

@Injectable()
export class RecurringRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea un fijo nuevo.
   */
  async create(
    data: Prisma.RecurringCreateInput,
  ): Promise<RecurringWithCategory> {
    const r = await this.prisma.recurring.create({
      data,
      include: RECURRING_INCLUDE,
    });
    return mapToRecurringWithCategory(r);
  }

  /**
   * Busca un fijo por id (sin filtrar por userId — el caller hace la validación).
   */
  async findById(id: string): Promise<RecurringWithCategory | null> {
    const r = await this.prisma.recurring.findUnique({
      where: { id },
      include: RECURRING_INCLUDE,
    });
    if (!r) return null;
    return mapToRecurringWithCategory(r);
  }

  /**
   * Actualiza un fijo por id (update in-place para el caso sin pasado — D1).
   */
  async update(
    id: string,
    data: Prisma.RecurringUpdateInput,
  ): Promise<RecurringWithCategory> {
    const r = await this.prisma.recurring.update({
      where: { id },
      data,
      include: RECURRING_INCLUDE,
    });
    return mapToRecurringWithCategory(r);
  }

  /**
   * Elimina físicamente un fijo por id (hard delete — solo cuando boundary <= startMonth).
   */
  async delete(id: string): Promise<void> {
    await this.prisma.recurring.delete({ where: { id } });
  }

  // ---------------------------------------------------------------------------
  // Calculados (Fase 1.1.7) — búsquedas por chainId
  // ---------------------------------------------------------------------------

  /**
   * Busca la fila activa (la más reciente en la cadena) de un fijo para un mes dado.
   * Un fijo lógico es una cadena de filas con el mismo chainId: la fila activa en el mes M
   * es la que tiene startMonth <= M AND (deletedFrom IS NULL OR deletedFrom > M).
   *
   * Se usa para derivar el monto del origen de un calculado on-the-fly.
   *
   * NOTA: puede devolver null si el origen no tiene fila activa en ese mes (el origen
   * está eliminado o su rango de actividad no cubre el mes).
   */
  async findActiveRowByChainId(
    chainId: string,
    month: string,
  ): Promise<RecurringSourceRow | null> {
    // Busca la fila de la cadena activa en el mes pedido.
    // Si hay varias (no debería por la invariante del split), toma la de startMonth más alto.
    const r = await this.prisma.recurring.findFirst({
      where: {
        chainId,
        startMonth: { lte: month },
        OR: [
          { deletedFrom: null },
          { deletedFrom: { gt: month } },
        ],
      },
      orderBy: { startMonth: 'desc' },
      select: {
        id: true,
        chainId: true,
        amountCents: true,
        startMonth: true,
        deletedFrom: true,
      },
    });
    return r;
  }

  /**
   * Busca todas las filas de una cadena (chainId) con sus campos esenciales.
   * Se usa en el borrado de cadena completa para iterar y aplicar boundary por fila.
   */
  async findChainRows(
    chainId: string,
  ): Promise<Array<{ id: string; startMonth: string; deletedFrom: string | null }>> {
    return this.prisma.recurring.findMany({
      where: { chainId },
      select: { id: true, startMonth: true, deletedFrom: true },
    });
  }

  /**
   * Busca todos los calculados (sourceChainId != null) de una cadena origen dada.
   * Se usa al eliminar el origen para cascadar la eliminación a los calculados.
   * Devuelve todas las filas (incluidas las ya terminadas) para identificar las cadenas
   * del calculado y operar sobre ellas.
   */
  async findCalculadosBySourceChain(
    sourceChainId: string,
  ): Promise<Array<{ id: string; chainId: string; startMonth: string; deletedFrom: string | null }>> {
    return this.prisma.recurring.findMany({
      where: { sourceChainId },
      select: { id: true, chainId: true, startMonth: true, deletedFrom: true },
    });
  }

  // ---------------------------------------------------------------------------
  // Lookup de orígenes externos (Fase 1.1.7.ext)
  // ---------------------------------------------------------------------------

  /**
   * Busca un Transaction por id con los campos mínimos necesarios para crear un calculado.
   * Devuelve null si no existe.
   * El caller valida ownership (userId).
   */
  async findTransactionById(id: string): Promise<{
    id: string;
    userId: string;
    amountCents: number;
    type: string;
    description: string | null;
    occurredAt: Date;
    timezone: string;
  } | null> {
    return this.prisma.transaction.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        amountCents: true,
        type: true,
        description: true,
        occurredAt: true,
        timezone: true,
      },
    });
  }

  /**
   * Busca un InstallmentGroup por id con los campos mínimos necesarios para crear un calculado.
   * Devuelve null si no existe.
   * El caller valida ownership (userId).
   */
  async findInstallmentGroupById(id: string): Promise<{
    id: string;
    userId: string;
    amountCents: number;
    type: string;
    totalInstallments: number;
    startMonth: string;
    description: string | null;
  } | null> {
    return this.prisma.installmentGroup.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        amountCents: true,
        type: true,
        totalInstallments: true,
        startMonth: true,
        description: true,
      },
    });
  }

  /**
   * Busca el calculado vinculado a un Transaction (sourceMovementId).
   * Devuelve null si no existe calculado para ese Transaction.
   * Solo debería haber uno (1:1 con el Transaction); si hubiera más de uno devuelve el primero.
   */
  async findCalculatedBySourceMovement(
    sourceMovementId: string,
  ): Promise<RecurringWithCategory | null> {
    const r = await this.prisma.recurring.findFirst({
      where: { sourceMovementId },
      include: RECURRING_INCLUDE,
    });
    if (!r) return null;
    return mapToRecurringWithCategory(r);
  }

  /**
   * Busca el calculado vinculado a un InstallmentGroup (sourceInstallmentGroupId).
   * Devuelve null si no existe calculado para ese grupo.
   * Solo debería haber uno (1:1 con el grupo); si hubiera más de uno devuelve el primero.
   */
  async findCalculatedBySourceInstallment(
    sourceInstallmentGroupId: string,
  ): Promise<RecurringWithCategory | null> {
    const r = await this.prisma.recurring.findFirst({
      where: { sourceInstallmentGroupId },
      include: RECURRING_INCLUDE,
    });
    if (!r) return null;
    return mapToRecurringWithCategory(r);
  }

  /**
   * Elimina físicamente todas las filas de un chainId dado.
   * Solo se llama cuando se hace hard-delete de todos los calculados de una cadena.
   */
  async deleteByChainId(chainId: string): Promise<void> {
    await this.prisma.recurring.deleteMany({ where: { chainId } });
  }

  /**
   * Establece deletedFrom en todas las filas activas de un chainId cuyo startMonth
   * es posterior al boundary (es decir, las que vivirían "después" del boundary).
   * Se usa al eliminar un origen para cascadar deletedFrom a los calculados.
   */
  async setDeletedFromByChainId(
    chainId: string,
    boundary: string,
  ): Promise<void> {
    // Solo aplica a las filas de la cadena que todavía no estaban terminadas antes del boundary.
    // Si boundary <= startMonth: hard-delete (se llama deleteByChainId).
    // Si no: actualizar deletedFrom a boundary (si no tenía deletedFrom o el que tenía era mayor).
    await this.prisma.recurring.updateMany({
      where: {
        chainId,
        OR: [
          { deletedFrom: null },
          { deletedFrom: { gt: boundary } },
        ],
      },
      data: { deletedFrom: boundary },
    });
  }

  // ---------------------------------------------------------------------------
  // Skips (P1 — Fase 1.1.1)
  // ---------------------------------------------------------------------------

  /**
   * Verifica si existe un skip para (recurringId, month).
   */
  async findSkip(
    recurringId: string,
    month: string,
  ): Promise<boolean> {
    const skip = await this.prisma.recurringSkip.findUnique({
      where: { recurringId_month: { recurringId, month } },
    });
    return skip !== null;
  }

  /**
   * Crea un skip para (recurringId, month).
   */
  async createSkip(recurringId: string, month: string): Promise<void> {
    await this.prisma.recurringSkip.create({
      data: { recurringId, month },
    });
  }

  /**
   * Elimina un skip para (recurringId, month).
   */
  async deleteSkip(recurringId: string, month: string): Promise<void> {
    await this.prisma.recurringSkip.delete({
      where: { recurringId_month: { recurringId, month } },
    });
  }

  /**
   * Devuelve el set de meses salteados de un fijo dado como Set<string>.
   * Útil para las queries del mes y del año donde ya se tiene el recurringId.
   */
  async findSkipsForRecurring(recurringId: string): Promise<Set<string>> {
    const skips = await this.prisma.recurringSkip.findMany({
      where: { recurringId },
      select: { month: true },
    });
    return new Set(skips.map((s) => s.month));
  }

  /**
   * Devuelve el set de meses salteados de TODOS los fijos del usuario como Map<recurringId, Set<month>>.
   * Usada en las queries de proyección mensual/anual para aplicar skips en memoria.
   */
  async findAllSkipsForUser(
    userId: string,
  ): Promise<Map<string, Set<string>>> {
    // Traer todos los skips de fijos del usuario (join vía Recurring.userId)
    const skips = await this.prisma.recurringSkip.findMany({
      where: {
        recurring: { userId },
      },
      select: {
        recurringId: true,
        month: true,
      },
    });

    const result = new Map<string, Set<string>>();
    for (const s of skips) {
      if (!result.has(s.recurringId)) {
        result.set(s.recurringId, new Set<string>());
      }
      result.get(s.recurringId)!.add(s.month);
    }
    return result;
  }
}
