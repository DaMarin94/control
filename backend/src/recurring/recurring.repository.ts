import { Injectable } from '@nestjs/common';
import { Currency, FormulaOperator, MovementType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NOT_DELETED } from '../common/soft-delete.helper';

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
 * Shape de método de pago embebido (RF-PM-006). `null` si el fijo no tiene método.
 * Los calculados NUNCA persisten uno propio (siempre null en su fila; el método
 * mostrado se deriva al vuelo del origen en MovementsRepository).
 */
export interface EmbeddedPaymentMethod {
  id: string;
  name: string;
  icon: string;
  type: string;
}

/**
 * Shape completo de un fijo con categoría embebida.
 * Incluye frequency (P1 — entero 1..12), campos de calculado (Fase 1.1.7 + 1.1.7.ext) y chainId.
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
  /** Periodicidad del fijo, en meses (P1 — entero 1..12). Inmutable tras crearse. */
  frequency: number;
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
  /** Cotización anchorCurrency/1 currency para este tramo de la cadena (Fase 1.2.3/1.2.4). */
  exchangeRate: number;
  /** Moneda default del usuario al momento de guardar el movimiento (Fase 1.2.4). */
  anchorCurrency: Currency;
  /** Método de pago asociado; null = sin método o es un calculado (RF-PM-006) */
  paymentMethodId: string | null;
  /**
   * Débito automático (P4 — corrección de alcance). Atributo del MOVIMIENTO. Solo
   * aplica a fijos NORMALES con paymentMethod de tipo DEBIT; un calculado NUNCA
   * persiste uno propio (siempre null en su fila — se deriva del origen al vuelo).
   */
  autoDebit: boolean | null;
  createdAt: Date;
  updatedAt: Date;
  category: EmbeddedCategory;
  paymentMethod: EmbeddedPaymentMethod | null;
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
  paymentMethod: {
    select: {
      id: true,
      name: true,
      icon: true,
      type: true,
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
    anchorCurrency: r.anchorCurrency,
    paymentMethodId: r.paymentMethodId,
    autoDebit: r.autoDebit,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    category: {
      id: r.category.id,
      name: r.category.name,
      color: r.category.color,
      scope: r.category.scope,
    },
    paymentMethod: r.paymentMethod
      ? {
          id: r.paymentMethod.id,
          name: r.paymentMethod.name,
          icon: r.paymentMethod.icon,
          type: r.paymentMethod.type,
        }
      : null,
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
   *
   * Excluye borrados lógicos (RF-HIST-006): un fijo/calculado eliminado no
   * existe para el resto de la app.
   */
  async findById(id: string): Promise<RecurringWithCategory | null> {
    const r = await this.prisma.recurring.findUnique({
      where: { id, ...NOT_DELETED },
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

  // ---------------------------------------------------------------------------
  // Calculados (Fase 1.1.7) — búsquedas por chainId
  // ---------------------------------------------------------------------------

  /**
   * Busca todas las filas VIVAS de una cadena (chainId) con sus campos esenciales.
   * Se usa en el borrado de cadena completa para iterar y aplicar boundary por fila.
   * Excluye filas ya soft-deleted: no hay nada que tocar en una fila ya eliminada.
   */
  async findChainRows(
    chainId: string,
  ): Promise<Array<{ id: string; startMonth: string; deletedFrom: string | null }>> {
    return this.prisma.recurring.findMany({
      where: { chainId, ...NOT_DELETED },
      select: { id: true, startMonth: true, deletedFrom: true },
    });
  }

  /**
   * Busca todos los calculados (sourceChainId != null) de una cadena origen dada.
   * Se usa al eliminar el origen para cascadar la eliminación a los calculados.
   * Devuelve todas las filas VIVAS (incluidas las ya terminadas, excluidas las ya
   * soft-deleted) para identificar las cadenas del calculado y operar sobre ellas.
   */
  async findCalculadosBySourceChain(
    sourceChainId: string,
  ): Promise<Array<{ id: string; chainId: string; startMonth: string; deletedFrom: string | null }>> {
    return this.prisma.recurring.findMany({
      where: { sourceChainId, ...NOT_DELETED },
      select: { id: true, chainId: true, startMonth: true, deletedFrom: true },
    });
  }

  /**
   * Snapshot COMPLETO (todos los campos de negocio) de todas las filas de una
   * cadena (chainId). Usado para capturar el estado previo a un DELETE (RF-HIST-001),
   * tanto de la cadena eliminada directamente como de las cadenas de calculados
   * de fijo que caen en cascada (RN-024).
   */
  async findChainRowsForSnapshot(chainId: string): Promise<
    Array<{
      id: string;
      chainId: string;
      startMonth: string;
      deletedFrom: string | null;
      deletedAt: Date | null;
      type: MovementType;
      amountCents: number;
      categoryId: string;
      description: string | null;
      frequency: number;
      currency: Currency;
      exchangeRate: Prisma.Decimal;
      anchorCurrency: Currency;
      paymentMethodId: string | null;
      autoDebit: boolean | null;
      sourceChainId: string | null;
      sourceMovementId: string | null;
      sourceInstallmentGroupId: string | null;
      formulaOperator: FormulaOperator | null;
      formulaOperand: number | null;
      formulaSign: number | null;
    }>
  > {
    return this.prisma.recurring.findMany({
      where: { chainId },
      select: {
        id: true,
        chainId: true,
        startMonth: true,
        deletedFrom: true,
        deletedAt: true,
        type: true,
        amountCents: true,
        categoryId: true,
        description: true,
        frequency: true,
        currency: true,
        exchangeRate: true,
        anchorCurrency: true,
        paymentMethodId: true,
        autoDebit: true,
        sourceChainId: true,
        sourceMovementId: true,
        sourceInstallmentGroupId: true,
        formulaOperator: true,
        formulaOperand: true,
        formulaSign: true,
      },
    });
  }

  /**
   * Borrado lógico de una fila (RF-HIST-006): marca deletedAt = now().
   * Usado por applyBoundaryToChain: la eliminación de un fijo es siempre
   * reversible desde /historial.
   */
  async softDeleteRow(id: string): Promise<void> {
    await this.prisma.recurring.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /** Cascada lógica (RN-024/026): soft-delete de todos los calculados vivos de un único. */
  async cascadeSoftDeleteBySourceMovement(sourceMovementId: string): Promise<void> {
    await this.prisma.recurring.updateMany({
      where: { sourceMovementId, ...NOT_DELETED },
      data: { deletedAt: new Date() },
    });
  }

  /** Cascada lógica (RN-024/026): soft-delete de todos los calculados vivos de una cuota. */
  async cascadeSoftDeleteBySourceInstallmentGroup(sourceInstallmentGroupId: string): Promise<void> {
    await this.prisma.recurring.updateMany({
      where: { sourceInstallmentGroupId, ...NOT_DELETED },
      data: { deletedAt: new Date() },
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
      where: { id, ...NOT_DELETED },
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
      where: { id, ...NOT_DELETED },
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
      where: { sourceMovementId, ...NOT_DELETED },
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
      where: { sourceInstallmentGroupId, ...NOT_DELETED },
      include: RECURRING_INCLUDE,
    });
    if (!r) return null;
    return mapToRecurringWithCategory(r);
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
}
