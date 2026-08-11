import { Injectable, NotFoundException } from '@nestjs/common';
import { Currency, HistoryAction, HistoryTargetKind, MovementType, Prisma } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { PrismaService } from '../prisma/prisma.service';
import {
  HistoryEntryRow,
  HistoryRepository,
  MAX_ENTRIES_PER_MOVEMENT,
  RETENTION_MS,
} from './history.repository';
import {
  ComparableFields,
  CuotaSnapshot,
  FijoSnapshot,
  HistoryAmountValue,
  HistoryCategoryValue,
  HistoryChangeDto,
  HistoryFieldId,
  HistoryFieldValueMap,
  HistoryPaymentMethodValue,
  HISTORY_FIELD_ORDER,
  HistorySnapshot,
  RecurringRowSnapshot,
  UnicoSnapshot,
} from './history.types';

type TxClient = Prisma.TransactionClient;

/**
 * Mapas batcheados de `currency` de origen de calculados, keyeados por cada una
 * de las 3 claves posibles (mutuamente excluyentes por invariante — ver
 * `loadOriginCurrencyMaps`). Usados exclusivamente para resolver
 * `HistoryFormulaValue.currency` (el símbolo con el que el frontend formatea el
 * `operand` de la fórmula).
 */
interface OriginCurrencyMaps {
  byChainId: Map<string, Currency>;
  byMovementId: Map<string, Currency>;
  byInstallmentGroupId: Map<string, Currency>;
}

export interface HistoryEntryResponseDto {
  id: string;
  targetKind: HistoryTargetKind;
  /** Clave estable de agrupación del movimiento (RN-024): Transaction.id / Recurring.chainId / InstallmentGroup.id. */
  targetId: string;
  action: HistoryAction;
  createdAt: string;
  description: string | null;
  category: { id: string; name: string; color: string; scope: string } | null;
  type: MovementType;
  /**
   * Monto identificador del movimiento en el momento de esta entrada (previo al
   * cambio). `null` para calculados (su monto es la fórmula, no una cifra propia
   * — docs/design.md §3.2.a, ver `changes` con `field: 'formula'`).
   */
  amount: HistoryAmountValue | null;
  /**
   * `true` si la fila es un calculado (de fijo, único o cuota). Solo puede ser
   * `true` cuando `targetKind === 'FIJO'` (los calculados se persisten como filas
   * Recurring — ver docs/backend.md §Historial). La ESTRUCTURA que se muestra
   * (`targetKind`) sigue siendo `FIJO`; este flag es adicional, no la reemplaza.
   */
  isCalculated: boolean;
  changes: HistoryChangeDto[];
  canUndo: boolean;
  /** Cantidad de entradas posteriores del mismo movimiento que bloquean el undo (RF-HIST-004). */
  blockingCount: number;
}

// ---------------------------------------------------------------------------
// Aplicabilidad de campos por targetKind × calculado (docs/design.md §3.1/§3.3).
//
// EDIT_FIELDS: campos que participan del diff previous/next de una edición.
//   Restringidos a lo REALMENTE editable por cada tipo de movimiento (fuente de
//   verdad: RF-MU-002 único, RF-MF-003 fijo, RF-MC-003 cuota, RF-MCALC-006
//   calculado) — no todo lo que "aplica a" en la columna del spec es editable.
// STATE_FIELDS: campos mostrados en una entrada de ELIMINACIÓN (§3.3, "modo de
//   valor único"): el estado completo del movimiento tal como estaba, más
//   amplio que EDIT_FIELDS (incluye p. ej. `startMonth` de un fijo, que nunca
//   se edita pero sí es parte de su identidad al momento de borrarlo).
//
// GOTCHA documentado para el analista: docs/design.md §3.1 fila 5 (`Tipo`) dice
// "aplica a: fijos", lo que contradice RF-MF-003 (tipo NO editable en fijos) y
// RF-MU-002 (tipo SÍ editable en únicos). El razonamiento de la propia spec en
// la banda 2 ("Tipo encabeza la banda porque es el cambio más profundo") solo
// tiene sentido para el único caso donde el tipo puede cambiar: el único. Acá
// se implementa `type` aplicable EXCLUSIVAMENTE a UNICO (edit y state) —
// reportado como conflicto a resolver por el analista, ver reporte de la tarea.
// ---------------------------------------------------------------------------

const UNICO_EDIT_FIELDS: HistoryFieldId[] = [
  'type',
  'amount',
  'currency',
  'exchangeRate',
  'category',
  'description',
  'date',
  'paymentMethod',
  'autoDebit',
];
const CUOTA_EDIT_FIELDS: HistoryFieldId[] = [
  'amount',
  'currency',
  'exchangeRate',
  'category',
  'description',
  'startMonth',
  'installments',
  'paymentMethod',
  'autoDebit',
];
const FIJO_NORMAL_EDIT_FIELDS: HistoryFieldId[] = [
  'amount',
  'currency',
  'exchangeRate',
  'category',
  'description',
  'paymentMethod',
  'autoDebit',
];
const FIJO_CALCULADO_EDIT_FIELDS: HistoryFieldId[] = ['formula', 'category', 'description'];

const UNICO_STATE_FIELDS: HistoryFieldId[] = [
  'amount',
  'currency',
  'exchangeRate',
  'category',
  'description',
  'date',
  'paymentMethod',
  'autoDebit',
];
const CUOTA_STATE_FIELDS: HistoryFieldId[] = [
  'amount',
  'currency',
  'exchangeRate',
  'category',
  'description',
  'startMonth',
  'installments',
  'paymentMethod',
  'autoDebit',
];
const FIJO_NORMAL_STATE_FIELDS: HistoryFieldId[] = [
  'amount',
  'currency',
  'exchangeRate',
  'category',
  'description',
  'startMonth',
  'paymentMethod',
  'autoDebit',
];
const FIJO_CALCULADO_STATE_FIELDS: HistoryFieldId[] = ['formula', 'category', 'description', 'startMonth'];

/**
 * HistoryService — Módulo 3.14 (Historial de cambios), RF-HIST-001..006.
 *
 * GOTCHA DE ARQUITECTURA (deliberado): a diferencia del resto del backend
 * ("un módulo le habla a otro solo por su Service"), el UNDO y el REAPER de
 * este módulo mutan Transaction/Recurring/InstallmentGroup DIRECTO por Prisma,
 * sin pasar por TransactionsService/RecurringService/InstallmentsService.
 * Motivos:
 *   1. Atomicidad: el undo en cadena (RF-HIST-004) debe ejecutar N restauraciones
 *      en UNA sola transacción de DB; encadenar eso a través de los Services de
 *      dominio requeriría threadear un cliente Prisma transaccional por todas
 *      las capas de esos módulos (repos incluidos), que hoy no lo soportan.
 *   2. El undo no es una operación de negocio: es restaurar bytes exactos
 *      guardados en el snapshot. No hay reglas de validación que aplicar
 *      (ya se aplicaron cuando se hizo el cambio original).
 * La CAPTURA (grabar una entrada al editar/eliminar) sí vive en los services de
 * dominio (transactions/recurring/installments), que son quienes conocen el
 * momento exacto de "antes de mutar". Esto evita además una dependencia
 * circular de módulos (History necesitaría importar Transactions/Recurring/
 * Installments para el undo, que a su vez importan History para grabar).
 */
@Injectable()
export class HistoryService {
  constructor(
    private readonly repo: HistoryRepository,
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}

  // ---------------------------------------------------------------------------
  // Captura (llamada desde TransactionsService / RecurringService / InstallmentsService)
  // ---------------------------------------------------------------------------

  /**
   * Registra una entrada de historial y aplica el tope de retención por cantidad
   * (RF-HIST-005): si el movimiento (userId, targetKind, targetId) supera las
   * 5 entradas vigentes, descarta la(s) más antigua(s) por encima del tope.
   *
   * @returns el id de la entrada recién creada (para que el frontend pueda
   * ofrecer "Deshacer" en el toast de éxito post-edición/eliminación, pegándole
   * a POST /history/:id/undo). La entrada recién creada es siempre la más
   * nueva del movimiento, así que `findOverflowIds` (que descarta las más
   * ANTIGUAS por encima del tope) nunca la purga en la misma llamada.
   */
  async record(
    userId: string,
    targetKind: HistoryTargetKind,
    targetId: string,
    action: HistoryAction,
    snapshot: HistorySnapshot,
  ): Promise<string> {
    const created = await this.repo.create(userId, targetKind, targetId, action, snapshot);

    const overflowIds = await this.repo.findOverflowIds(
      userId,
      targetKind,
      targetId,
      MAX_ENTRIES_PER_MOVEMENT,
    );
    for (const id of overflowIds) {
      const entry = await this.repo.findById(id);
      if (entry) await this.discardEntry(entry);
    }

    return created.id;
  }

  // ---------------------------------------------------------------------------
  // GET /history
  // ---------------------------------------------------------------------------

  async findAllForUser(userId: string): Promise<HistoryEntryResponseDto[]> {
    // Purga lazy de vencidas (RF-HIST-005) — alternativa a un cron job, ver
    // docs/backend.md §Historial (no hay @nestjs/schedule en el proyecto).
    await this.purgeExpiredForUser(userId);

    // Moneda default VIGENTE del usuario (no la `anchorCurrency` guardada en el
    // movimiento) — necesaria para la regla de omisión de `Moneda` en el estado
    // de eliminación (docs/design.md §3.1/§3.3): cubre el caso de que el usuario
    // haya cambiado su default después de guardar el movimiento.
    const userDefaultCurrency = await this.getUserDefaultCurrency(userId);

    const entries = await this.repo.findAllForUserAsc(userId);

    // Agrupar por movimiento (userId ya está fijo) para resolver el stack LIFO.
    const groups = new Map<string, HistoryEntryRow[]>();
    for (const e of entries) {
      const key = `${e.targetKind}:${e.targetId}`;
      const group = groups.get(key);
      if (group) group.push(e);
      else groups.set(key, [e]);
    }

    interface PendingItem {
      entry: HistoryEntryRow;
      isLast: boolean;
      blockingCount: number;
      previous: ComparableFields;
      /** Solo presente para entradas EDIT. */
      next: ComparableFields | null;
      isCalculated: boolean;
    }

    const pending: PendingItem[] = [];
    const categoryIds = new Set<string>();
    const paymentMethodIds = new Set<string>();
    const sourceChainIds = new Set<string>();
    const sourceMovementIds = new Set<string>();
    const sourceInstallmentGroupIds = new Set<string>();

    const collectIds = (fields: ComparableFields | null) => {
      if (!fields) return;
      if (fields.categoryId) categoryIds.add(fields.categoryId);
      if (fields.paymentMethodId) paymentMethodIds.add(fields.paymentMethodId);
      if (fields.sourceChainId) sourceChainIds.add(fields.sourceChainId);
      if (fields.sourceMovementId) sourceMovementIds.add(fields.sourceMovementId);
      if (fields.sourceInstallmentGroupId) sourceInstallmentGroupIds.add(fields.sourceInstallmentGroupId);
    };

    for (const group of groups.values()) {
      for (let i = 0; i < group.length; i++) {
        const entry = group[i];
        const isLast = i === group.length - 1;
        const blockingCount = group.length - 1 - i;
        const previous = this.extractComparableFields(entry.targetKind, entry.snapshot);

        let next: ComparableFields | null = null;
        if (entry.action === HistoryAction.EDIT) {
          next = isLast
            ? await this.loadLiveComparableFields(entry)
            : this.extractComparableFields(group[i + 1].targetKind, group[i + 1].snapshot);
        }

        collectIds(previous);
        collectIds(next);

        pending.push({
          entry,
          isLast,
          blockingCount,
          previous,
          next,
          isCalculated: this.isCalculatedEntry(entry),
        });
      }
    }

    // Resolver categorías (RF-CAT-004: se muestran aunque estén soft-deleted) y
    // métodos de pago (RF-PM-006: espejo — se muestran aunque estén soft-deleted)
    // embebidos, en una sola query cada uno.
    const [categoryMap, paymentMethodMap, originCurrencyMaps] = await Promise.all([
      this.loadCategoryMap(Array.from(categoryIds)),
      this.loadPaymentMethodMap(Array.from(paymentMethodIds)),
      this.loadOriginCurrencyMaps(
        userId,
        Array.from(sourceChainIds),
        Array.from(sourceMovementIds),
        Array.from(sourceInstallmentGroupIds),
      ),
    ]);

    const result: HistoryEntryResponseDto[] = pending.map((p) => {
      const fieldIds = this.fieldIdsFor(p.entry.targetKind, p.isCalculated, p.entry.action);

      const changes =
        p.entry.action === HistoryAction.EDIT
          ? p.next
            ? this.diffFields(p.previous, p.next, fieldIds, categoryMap, paymentMethodMap, originCurrencyMaps)
            : []
          : this.stateFields(
              p.previous,
              fieldIds,
              categoryMap,
              paymentMethodMap,
              userDefaultCurrency,
              originCurrencyMaps,
            );

      return {
        id: p.entry.id,
        targetKind: p.entry.targetKind,
        targetId: p.entry.targetId,
        action: p.entry.action,
        createdAt: p.entry.createdAt.toISOString(),
        description: p.previous.description ?? null,
        category: p.previous.categoryId ? categoryMap.get(p.previous.categoryId) ?? null : null,
        type: p.previous.type ?? MovementType.EXPENSE,
        // Un calculado no tiene monto propio (es su fórmula) — ver docs/design.md §3.2.a.
        amount: p.isCalculated ? null : this.buildAmountValue(p.previous),
        isCalculated: p.isCalculated,
        changes,
        canUndo: p.isLast,
        blockingCount: p.blockingCount,
      };
    });

    // Orden cronológico descendente, más reciente primero (RF-HIST-002).
    result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return result;
  }

  // ---------------------------------------------------------------------------
  // POST /history/:id/undo
  // ---------------------------------------------------------------------------

  /**
   * Deshace una entrada de historial. Si tiene entradas posteriores vigentes del
   * mismo movimiento, las deshace también (de la más reciente a la más antigua)
   * en la MISMA transacción de DB (RF-HIST-003/004). Todas se borran del historial;
   * el undo en sí no genera ninguna entrada nueva.
   */
  async undo(userId: string, entryId: string): Promise<void> {
    const entry = await this.repo.findById(entryId);
    if (!entry || entry.userId !== userId) {
      throw new NotFoundException('Entrada de historial no encontrada');
    }

    const chain = await this.repo.findChainAsc(userId, entry.targetKind, entry.targetId);
    const idx = chain.findIndex((e) => e.id === entryId);
    if (idx === -1) {
      throw new NotFoundException('Entrada de historial no encontrada');
    }

    // De la más reciente a la más antigua, hasta `entry` inclusive (RF-HIST-004).
    const toUndo = chain.slice(idx).reverse();

    await this.prisma.$transaction(async (tx) => {
      for (const e of toUndo) {
        await this.applyUndo(tx, e);
        await tx.historyEntry.delete({ where: { id: e.id } });
      }
    });

    this.logger.log(
      {
        userId,
        entryId,
        targetKind: entry.targetKind,
        targetId: entry.targetId,
        undoneCount: toUndo.length,
      },
      'Historial: cambio deshecho',
    );
  }

  private async applyUndo(tx: TxClient, entry: HistoryEntryRow): Promise<void> {
    if (entry.targetKind === HistoryTargetKind.UNICO) {
      await this.undoUnico(tx, entry);
    } else if (entry.targetKind === HistoryTargetKind.CUOTA) {
      await this.undoCuota(tx, entry);
    } else {
      await this.undoFijo(tx, entry);
    }
  }

  private async undoUnico(tx: TxClient, entry: HistoryEntryRow): Promise<void> {
    const snap = entry.snapshot as UnicoSnapshot;
    if (entry.action === HistoryAction.DELETE) {
      await tx.transaction.update({
        where: { id: entry.targetId },
        data: { deletedAt: null },
      });
      // Cascada RN-024/026: restaurar calculados de único que cayeron soft-deleted junto con él.
      await tx.recurring.updateMany({
        where: { sourceMovementId: entry.targetId, deletedAt: { not: null } },
        data: { deletedAt: null },
      });
      return;
    }
    await tx.transaction.update({
      where: { id: entry.targetId },
      data: {
        type: snap.type,
        amountCents: snap.amountCents,
        categoryId: snap.categoryId,
        description: snap.description,
        occurredAt: new Date(snap.occurredAt),
        timezone: snap.timezone,
        currency: snap.currency,
        exchangeRate: snap.exchangeRate,
        anchorCurrency: snap.anchorCurrency,
        paymentMethodId: snap.paymentMethodId,
        autoDebit: snap.autoDebit,
      },
    });
  }

  private async undoCuota(tx: TxClient, entry: HistoryEntryRow): Promise<void> {
    const snap = entry.snapshot as CuotaSnapshot;
    if (entry.action === HistoryAction.DELETE) {
      await tx.installmentGroup.update({
        where: { id: entry.targetId },
        data: { deletedAt: null },
      });
      await tx.recurring.updateMany({
        where: { sourceInstallmentGroupId: entry.targetId, deletedAt: { not: null } },
        data: { deletedAt: null },
      });
      return;
    }
    await tx.installmentGroup.update({
      where: { id: entry.targetId },
      data: {
        type: snap.type,
        amountCents: snap.amountCents,
        categoryId: snap.categoryId,
        description: snap.description,
        startMonth: snap.startMonth,
        totalInstallments: snap.totalInstallments,
        currency: snap.currency,
        exchangeRate: snap.exchangeRate,
        anchorCurrency: snap.anchorCurrency,
        paymentMethodId: snap.paymentMethodId,
        autoDebit: snap.autoDebit,
      },
    });
  }

  private async undoFijo(tx: TxClient, entry: HistoryEntryRow): Promise<void> {
    const snap = entry.snapshot as FijoSnapshot;
    if (snap.kind === 'edit') {
      if (snap.newRowId) {
        // El split creó esta fila desde cero: nunca existió antes del cambio.
        await tx.recurring.delete({ where: { id: snap.newRowId } });
        // La fila vieja solo tuvo su deletedFrom tocado por el split.
        await tx.recurring.update({
          where: { id: snap.row.id },
          data: { deletedFrom: snap.row.deletedFrom },
        });
      } else {
        await tx.recurring.update({
          where: { id: snap.row.id },
          data: this.recurringRowToUpdateData(snap.row),
        });
      }
      return;
    }
    // DELETE: por cada fila de cada cadena afectada (origen + cascada), restaurar
    // deletedFrom/deletedAt — los únicos dos campos que un DELETE puede tocar.
    for (const chainSnap of snap.chains) {
      for (const row of chainSnap.rows) {
        await tx.recurring.update({
          where: { id: row.id },
          data: {
            deletedFrom: row.deletedFrom,
            deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
          },
        });
      }
    }
  }

  private recurringRowToUpdateData(row: RecurringRowSnapshot): Prisma.RecurringUpdateInput {
    return {
      startMonth: row.startMonth,
      deletedFrom: row.deletedFrom,
      type: row.type,
      amountCents: row.amountCents,
      category: { connect: { id: row.categoryId } },
      description: row.description,
      frequency: row.frequency,
      currency: row.currency,
      exchangeRate: row.exchangeRate,
      anchorCurrency: row.anchorCurrency,
      ...(row.paymentMethodId
        ? { paymentMethod: { connect: { id: row.paymentMethodId } } }
        : { paymentMethod: { disconnect: true } }),
      autoDebit: row.autoDebit,
      formulaOperator: row.formulaOperator,
      formulaOperand: row.formulaOperand,
      formulaSign: row.formulaSign,
    };
  }

  // ---------------------------------------------------------------------------
  // Retención y purga (RF-HIST-005)
  // ---------------------------------------------------------------------------

  /**
   * Purga lazy de entradas vencidas (> 31 días) del usuario, invocada al leer
   * el historial. Al purgar una entrada de eliminación, el registro con borrado
   * lógico se borra físicamente (reaper — RF-HIST-005).
   *
   * GOTCHA: al ser lazy (no hay job programado), una entrada vencida de un
   * usuario que nunca vuelve a abrir /historial no se purga sola. Aceptado como
   * alternativa a sumar @nestjs/schedule (no es dependencia del backend hoy).
   */
  private async purgeExpiredForUser(userId: string): Promise<void> {
    const cutoff = new Date(Date.now() - RETENTION_MS);
    const expired = await this.repo.findExpiredForUser(userId, cutoff);
    for (const entry of expired) {
      await this.discardEntry(entry);
    }
  }

  /** Descarta una entrada: si es una eliminación, purga físicamente el registro subyacente. */
  private async discardEntry(entry: HistoryEntryRow): Promise<void> {
    if (entry.action === HistoryAction.DELETE) {
      await this.reapPhysically(entry);
    }
    await this.repo.delete(entry.id);
  }

  /**
   * Borra físicamente el registro (y sus calculados en cascada, vía FK onDelete:
   * Cascade de la DB para único/cuota) de una entrada de ELIMINACIÓN vencida o
   * descartada por retención.
   *
   * Solo actúa si el registro SIGUE soft-deleted en este momento (siempre debería
   * serlo: mientras la entrada existe, nada puede haber restaurado el registro
   * salvo un undo, que ya borra la entrada). Defensivo por las dudas.
   */
  private async reapPhysically(entry: HistoryEntryRow): Promise<void> {
    if (entry.targetKind === HistoryTargetKind.UNICO) {
      const row = await this.prisma.transaction.findUnique({
        where: { id: entry.targetId },
        select: { deletedAt: true },
      });
      if (row?.deletedAt) {
        // onDelete: Cascade borra también los calculados de único vinculados.
        await this.prisma.transaction.delete({ where: { id: entry.targetId } });
      }
      return;
    }
    if (entry.targetKind === HistoryTargetKind.CUOTA) {
      const row = await this.prisma.installmentGroup.findUnique({
        where: { id: entry.targetId },
        select: { deletedAt: true },
      });
      if (row?.deletedAt) {
        // onDelete: Cascade borra también los calculados de cuota vinculados.
        await this.prisma.installmentGroup.delete({ where: { id: entry.targetId } });
      }
      return;
    }
    // FIJO
    const snap = entry.snapshot as FijoSnapshot;
    if (snap.kind !== 'delete') return; // un EDIT nunca deja filas soft-deleted
    for (const chainSnap of snap.chains) {
      for (const row of chainSnap.rows) {
        const current = await this.prisma.recurring.findUnique({
          where: { id: row.id },
          select: { deletedAt: true },
        });
        if (current?.deletedAt) {
          await this.prisma.recurring.delete({ where: { id: row.id } });
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers de diff (GET /history) — docs/design.md, Historial de cambios, §3
  // ---------------------------------------------------------------------------

  /** `true` si la entrada corresponde a una fila Recurring calculada (de fijo, único o cuota). */
  private isCalculatedEntry(entry: HistoryEntryRow): boolean {
    if (entry.targetKind !== HistoryTargetKind.FIJO) return false;
    const snap = entry.snapshot as FijoSnapshot;
    const row = snap.kind === 'edit' ? snap.row : this.vigenteRow(snap.chains[0]?.rows ?? []);
    return !!(row?.sourceChainId || row?.sourceMovementId || row?.sourceInstallmentGroupId);
  }

  /** Lista ordenada (HISTORY_FIELD_ORDER) de campos aplicables, por targetKind × calculado × acción. */
  private fieldIdsFor(
    targetKind: HistoryTargetKind,
    isCalculated: boolean,
    action: HistoryAction,
  ): HistoryFieldId[] {
    const isEdit = action === HistoryAction.EDIT;
    let ids: HistoryFieldId[];
    if (targetKind === HistoryTargetKind.UNICO) {
      ids = isEdit ? UNICO_EDIT_FIELDS : UNICO_STATE_FIELDS;
    } else if (targetKind === HistoryTargetKind.CUOTA) {
      ids = isEdit ? CUOTA_EDIT_FIELDS : CUOTA_STATE_FIELDS;
    } else if (isCalculated) {
      ids = isEdit ? FIJO_CALCULADO_EDIT_FIELDS : FIJO_CALCULADO_STATE_FIELDS;
    } else {
      ids = isEdit ? FIJO_NORMAL_EDIT_FIELDS : FIJO_NORMAL_STATE_FIELDS;
    }
    return HISTORY_FIELD_ORDER.filter((id) => ids.includes(id));
  }

  private extractComparableFields(
    targetKind: HistoryTargetKind,
    snapshot: HistorySnapshot,
  ): ComparableFields {
    if (targetKind === HistoryTargetKind.UNICO) {
      const s = snapshot as UnicoSnapshot;
      return {
        type: s.type,
        amountCents: s.amountCents,
        categoryId: s.categoryId,
        description: s.description,
        currency: s.currency,
        exchangeRate: s.exchangeRate,
        anchorCurrency: s.anchorCurrency,
        paymentMethodId: s.paymentMethodId,
        autoDebit: s.autoDebit,
        occurredAt: s.occurredAt,
        timezone: s.timezone,
      };
    }
    if (targetKind === HistoryTargetKind.CUOTA) {
      const s = snapshot as CuotaSnapshot;
      return {
        type: s.type,
        amountCents: s.amountCents,
        categoryId: s.categoryId,
        description: s.description,
        currency: s.currency,
        exchangeRate: s.exchangeRate,
        anchorCurrency: s.anchorCurrency,
        paymentMethodId: s.paymentMethodId,
        autoDebit: s.autoDebit,
        startMonth: s.startMonth,
        totalInstallments: s.totalInstallments,
      };
    }
    // FIJO
    const fs = snapshot as FijoSnapshot;
    const row = fs.kind === 'edit' ? fs.row : this.vigenteRow(fs.chains[0]?.rows ?? []);
    if (!row) return {};
    return this.mapRowToComparable(row);
  }

  private mapRowToComparable(row: RecurringRowSnapshot): ComparableFields {
    return {
      type: row.type,
      amountCents: row.amountCents,
      categoryId: row.categoryId,
      description: row.description,
      currency: row.currency,
      exchangeRate: row.exchangeRate,
      anchorCurrency: row.anchorCurrency,
      paymentMethodId: row.paymentMethodId,
      autoDebit: row.autoDebit,
      startMonth: row.startMonth,
      formulaOperator: row.formulaOperator,
      formulaOperand: row.formulaOperand,
      formulaSign: row.formulaSign,
      sourceChainId: row.sourceChainId,
      sourceMovementId: row.sourceMovementId,
      sourceInstallmentGroupId: row.sourceInstallmentGroupId,
    };
  }

  private vigenteRow(rows: RecurringRowSnapshot[]): RecurringRowSnapshot | undefined {
    if (rows.length === 0) return undefined;
    return rows.reduce((a, b) => (b.startMonth > a.startMonth ? b : a), rows[0]);
  }

  /** Campos de negocio vigentes (live) para la entrada MÁS RECIENTE de un movimiento. */
  private async loadLiveComparableFields(entry: HistoryEntryRow): Promise<ComparableFields | null> {
    if (entry.targetKind === HistoryTargetKind.UNICO) {
      const tx = await this.prisma.transaction.findUnique({ where: { id: entry.targetId } });
      if (!tx) return null;
      return {
        type: tx.type,
        amountCents: tx.amountCents,
        categoryId: tx.categoryId,
        description: tx.description,
        currency: tx.currency,
        exchangeRate: Number(tx.exchangeRate),
        anchorCurrency: tx.anchorCurrency,
        paymentMethodId: tx.paymentMethodId,
        autoDebit: tx.autoDebit,
        occurredAt: tx.occurredAt.toISOString(),
        timezone: tx.timezone,
      };
    }
    if (entry.targetKind === HistoryTargetKind.CUOTA) {
      const g = await this.prisma.installmentGroup.findUnique({ where: { id: entry.targetId } });
      if (!g) return null;
      return {
        type: g.type,
        amountCents: g.amountCents,
        categoryId: g.categoryId,
        description: g.description,
        currency: g.currency,
        exchangeRate: Number(g.exchangeRate),
        anchorCurrency: g.anchorCurrency,
        paymentMethodId: g.paymentMethodId,
        autoDebit: g.autoDebit,
        startMonth: g.startMonth,
        totalInstallments: g.totalInstallments,
      };
    }
    // FIJO: la fila vigente es la que resultó de ESTA MISMA entrada (newRowId si hubo split).
    const snap = entry.snapshot as FijoSnapshot;
    if (snap.kind !== 'edit') return null;
    const liveId = snap.newRowId ?? snap.row.id;
    const r = await this.prisma.recurring.findUnique({ where: { id: liveId } });
    if (!r) return null;
    return {
      type: r.type,
      amountCents: r.amountCents,
      categoryId: r.categoryId,
      description: r.description,
      currency: r.currency,
      exchangeRate: Number(r.exchangeRate),
      anchorCurrency: r.anchorCurrency,
      paymentMethodId: r.paymentMethodId,
      autoDebit: r.autoDebit,
      startMonth: r.startMonth,
      formulaOperator: r.formulaOperator,
      formulaOperand: r.formulaOperand,
      formulaSign: r.formulaSign,
      sourceChainId: r.sourceChainId,
      sourceMovementId: r.sourceMovementId,
      sourceInstallmentGroupId: r.sourceInstallmentGroupId,
    };
  }

  // ---------------------------------------------------------------------------
  // Construcción del valor tipado de un campo (docs/design.md §3.1/§3.2)
  // ---------------------------------------------------------------------------

  /**
   * Arma el valor tipado de UN campo a partir de los `ComparableFields` de un
   * lado del par (previous o next). `undefined` = el campo no aplica a este
   * movimiento (p. ej. `date` para un fijo) — nunca se compara ni se muestra.
   */
  private buildFieldValue(
    fieldId: HistoryFieldId,
    fields: ComparableFields,
    categoryMap: Map<string, HistoryCategoryValue>,
    paymentMethodMap: Map<string, HistoryPaymentMethodValue>,
    originCurrencyMaps: OriginCurrencyMaps,
  ): HistoryFieldValueMap[HistoryFieldId] | undefined {
    switch (fieldId) {
      case 'amount':
        return this.buildAmountValue(fields) ?? undefined;
      case 'formula': {
        if (fields.formulaOperator == null || fields.formulaOperand == null || fields.formulaSign == null) {
          return undefined;
        }
        // `currency` es la del ORIGEN del calculado, no la de esta fila (placeholder —
        // ver HistoryFormulaValue.currency). Si el origen no se puede resolver (borrado
        // físicamente, o dato inconsistente), se omite el campo entero: un símbolo de
        // moneda equivocado es peor que un campo ausente.
        const originCurrency = this.resolveOriginCurrency(fields, originCurrencyMaps);
        if (originCurrency == null) return undefined;
        return {
          operator: fields.formulaOperator,
          operand: fields.formulaOperand,
          sign: fields.formulaSign,
          currency: originCurrency,
        };
      }
      case 'currency':
        return fields.currency;
      case 'exchangeRate':
        return fields.exchangeRate;
      case 'type':
        return fields.type;
      case 'category':
        if (!fields.categoryId) return undefined;
        return categoryMap.get(fields.categoryId) ?? undefined;
      case 'description':
        return fields.description === undefined ? undefined : fields.description;
      case 'date':
        if (fields.occurredAt === undefined || fields.timezone === undefined) return undefined;
        return { occurredAt: fields.occurredAt, timezone: fields.timezone };
      case 'startMonth':
        return fields.startMonth;
      case 'installments':
        return fields.totalInstallments;
      case 'paymentMethod':
        if (fields.paymentMethodId === undefined) return undefined;
        if (fields.paymentMethodId === null) return null;
        return paymentMethodMap.get(fields.paymentMethodId) ?? null;
      case 'autoDebit':
        // Booleano fundamental: `null` (no aplica el flag — RN-021) equivale a
        // "desactivado", nunca es un tercer estado a diferenciar de `false`.
        return !!fields.autoDebit;
      default:
        return undefined;
    }
  }

  private buildAmountValue(fields: ComparableFields): HistoryAmountValue | null {
    if (fields.amountCents === undefined || fields.currency === undefined || fields.type === undefined) {
      return null;
    }
    return { amountCents: fields.amountCents, currency: fields.currency, type: fields.type };
  }

  /** Igualdad de valor de campo — objetos por forma (misma construcción → mismo orden de claves), primitivos por valor. */
  private fieldValuesEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || a === undefined || b === null || b === undefined) return false;
    if (typeof a === 'object' && typeof b === 'object') {
      return JSON.stringify(a) === JSON.stringify(b);
    }
    return false;
  }

  /**
   * `true` ⇔ el estado tiene conversión real de moneda (docs/design.md §3.1,
   * vocabulario): `currency !== anchorCurrency`. Si alguno de los dos no está
   * definido (campo no aplica a este movimiento) no hay conversión que informar.
   */
  private hasRealConversion(fields: ComparableFields): boolean {
    return (
      fields.currency !== undefined &&
      fields.anchorCurrency !== undefined &&
      fields.currency !== fields.anchorCurrency
    );
  }

  /**
   * Regla de emisión de `Cotización` en el diff de edición (docs/design.md
   * §3.1): se emite ⇔ hay conversión real en algún lado del par Y (la
   * cotización cambió o la moneda cambió). Si la moneda cambió, se emite
   * SIEMPRE aunque el número sea idéntico en los dos lados — borde explícito
   * del spec: la cotización es la información que explica en qué quedó
   * convertido el monto cuando cambia de moneda.
   */
  private shouldEmitExchangeRateDiff(
    previous: ComparableFields,
    next: ComparableFields,
    prevValue: unknown,
    nextValue: unknown,
  ): boolean {
    if (!this.hasRealConversion(previous) && !this.hasRealConversion(next)) return false;
    const currencyChanged = previous.currency !== next.currency;
    const rateChanged = !this.fieldValuesEqual(prevValue, nextValue);
    return currencyChanged || rateChanged;
  }

  /**
   * Diff previous → next de una entrada de EDICIÓN (docs/design.md §3).
   *
   * Regla del §3.2.e (RN implícita del spec): si `type` cambió, la fila `amount`
   * se incluye SIEMPRE, aunque `amountCents` sea idéntico — esto sale gratis acá
   * porque `amount` es un valor COMPUESTO {amountCents, currency, type}: si type
   * difiere, el objeto difiere, y `fieldValuesEqual` lo marca como cambiado sin
   * necesidad de una regla especial. Solo aplica en la práctica a UNICO (único
   * targetKind donde `type` es editable — ver el gotcha documentado arriba).
   *
   * `currency`: sin regla de significancia — se emite ⇔ cambió, sin excepciones
   * (§3.1, "Regla de emisión — Moneda"). El compare genérico de abajo ya lo
   * resuelve: si `previous.currency === next.currency`, los valores son iguales
   * y no se empuja ninguna fila.
   *
   * `exchangeRate`: SÍ tiene regla de significancia especial (ver
   * `shouldEmitExchangeRateDiff`) — es el campo que el form normaliza sin que
   * el usuario lo haya tocado (QA: `Cotización 1.450,00 → 1,00` en un ARS→ARS).
   */
  private diffFields(
    previous: ComparableFields,
    next: ComparableFields,
    fieldIds: HistoryFieldId[],
    categoryMap: Map<string, HistoryCategoryValue>,
    paymentMethodMap: Map<string, HistoryPaymentMethodValue>,
    originCurrencyMaps: OriginCurrencyMaps,
  ): HistoryChangeDto[] {
    const changes: HistoryChangeDto[] = [];
    for (const field of fieldIds) {
      const prevValue = this.buildFieldValue(field, previous, categoryMap, paymentMethodMap, originCurrencyMaps);
      const nextValue = this.buildFieldValue(field, next, categoryMap, paymentMethodMap, originCurrencyMaps);
      if (prevValue === undefined && nextValue === undefined) continue;

      if (field === 'exchangeRate') {
        if (this.shouldEmitExchangeRateDiff(previous, next, prevValue, nextValue)) {
          changes.push({ field, previous: prevValue ?? null, next: nextValue ?? null } as HistoryChangeDto);
        }
        continue;
      }

      if (!this.fieldValuesEqual(prevValue, nextValue)) {
        changes.push({ field, previous: prevValue ?? null, next: nextValue ?? null } as HistoryChangeDto);
      }
    }
    return changes;
  }

  /**
   * Estado completo de una entrada de ELIMINACIÓN, modo "valor único" (§3.3):
   * mismas filas rótulo·valor, sin `next`. Omite los opcionales sin valor
   * (`paymentMethod` sin método, `autoDebit` desactivado) y los dos campos no
   * significativos del spec:
   * - `exchangeRate`: se omite si el movimiento NO tenía conversión real
   *   (`currency === anchorCurrency`).
   * - `currency`: se omite ⇔ `currency === anchorCurrency` Y `currency ===
   *   defaultCurrency VIGENTE del usuario` (doble condición — cubre el caso de
   *   que el usuario haya cambiado su default después de guardar el
   *   movimiento; `userDefaultCurrency` viene de `getUserDefaultCurrency`).
   */
  private stateFields(
    fields: ComparableFields,
    fieldIds: HistoryFieldId[],
    categoryMap: Map<string, HistoryCategoryValue>,
    paymentMethodMap: Map<string, HistoryPaymentMethodValue>,
    userDefaultCurrency: Currency | null,
    originCurrencyMaps: OriginCurrencyMaps,
  ): HistoryChangeDto[] {
    const changes: HistoryChangeDto[] = [];
    for (const field of fieldIds) {
      const value = this.buildFieldValue(field, fields, categoryMap, paymentMethodMap, originCurrencyMaps);
      if (value === undefined) continue;
      if (field === 'paymentMethod' && value === null) continue;
      if (field === 'exchangeRate' && !this.hasRealConversion(fields)) continue;
      if (
        field === 'currency' &&
        fields.currency !== undefined &&
        fields.anchorCurrency !== undefined &&
        fields.currency === fields.anchorCurrency &&
        userDefaultCurrency !== null &&
        fields.currency === userDefaultCurrency
      ) {
        continue;
      }
      if (field === 'autoDebit' && value === false) continue;
      changes.push({ field, previous: value } as HistoryChangeDto);
    }
    return changes;
  }

  /**
   * Moneda default VIGENTE del usuario (`User.defaultCurrency`), leída en el
   * momento del GET — a diferencia de `anchorCurrency`, que es la foto guardada
   * en el movimiento al momento de editarlo/crearlo. `null` si el usuario no
   * existe (defensivo: no debería pasar dentro de una request autenticada) —
   * en ese caso la regla de omisión de `Moneda` en el estado de eliminación
   * nunca omite (mejor mostrar de más que ocultar por un dato que no se pudo
   * resolver).
   */
  private async getUserDefaultCurrency(userId: string): Promise<Currency | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { defaultCurrency: true },
    });
    return user?.defaultCurrency ?? null;
  }

  private async loadCategoryMap(
    ids: string[],
  ): Promise<Map<string, { id: string; name: string; color: string; scope: string }>> {
    const map = new Map<string, { id: string; name: string; color: string; scope: string }>();
    if (ids.length === 0) return map;
    // RF-CAT-004: se embebe aunque esté soft-deleted.
    const rows = await this.prisma.category.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, color: true, scope: true },
    });
    for (const c of rows) map.set(c.id, { id: c.id, name: c.name, color: c.color, scope: c.scope });
    return map;
  }

  /**
   * Resuelve la `currency` del origen de un calculado a partir de las 3 claves
   * batcheadas por `loadOriginCurrencyMaps` (cargadas UNA vez para toda la
   * respuesta, no por campo/entrada — evita N+1 con muchas entradas). `undefined`
   * si `fields` no es un calculado, o si su origen no se pudo resolver (chain/
   * movimiento/grupo purgado físicamente) — el caller debe omitir el campo.
   */
  private resolveOriginCurrency(fields: ComparableFields, maps: OriginCurrencyMaps): Currency | undefined {
    if (fields.sourceChainId) return maps.byChainId.get(fields.sourceChainId);
    if (fields.sourceMovementId) return maps.byMovementId.get(fields.sourceMovementId);
    if (fields.sourceInstallmentGroupId) return maps.byInstallmentGroupId.get(fields.sourceInstallmentGroupId);
    return undefined;
  }

  /**
   * Batchea la resolución de moneda de origen para TODAS las entradas de la
   * respuesta (evita N+1). Las 3 claves son mutuamente excluyentes por
   * construcción (invariante de Recurring — ver schema.prisma), así que no hay
   * colisión posible entre los 3 mapas.
   *
   * GOTCHA (RF-HIST-002, "el historial es la única superficie que muestra
   * movimientos eliminados"): NO filtra por `deletedAt`/soft-delete del origen —
   * a diferencia de toda otra lectura de negocio (ver soft-delete.helper.ts), acá
   * el origen puede estar soft-deleted y debe seguir resolviendo su moneda.
   *
   * Para `sourceChainId` (origen = fijo), la moneda es la de la fila VIGENTE de
   * esa cadena (mayor `startMonth`) — un fijo puede haber cambiado de moneda vía
   * split (RF-MF-003), y lo que corresponde mostrar es la moneda ACTUAL del
   * origen, mismo criterio que `vigenteRow` usa para el resto de los campos
   * "vigentes" de una cadena. NO es lo mismo que "primera fila de la cadena"
   * (ver gotcha de `startMonth`/arranque en docs/backend.md, que es una regla
   * DISTINTA — esa es sobre la fecha de arranque mostrada, no sobre currency).
   */
  private async loadOriginCurrencyMaps(
    userId: string,
    chainIds: string[],
    movementIds: string[],
    installmentGroupIds: string[],
  ): Promise<OriginCurrencyMaps> {
    const byChainId = new Map<string, Currency>();
    const byMovementId = new Map<string, Currency>();
    const byInstallmentGroupId = new Map<string, Currency>();

    const [chainRows, movementRows, groupRows] = await Promise.all([
      chainIds.length === 0
        ? Promise.resolve([])
        : this.prisma.recurring.findMany({
            where: { userId, chainId: { in: chainIds } },
            select: { chainId: true, startMonth: true, currency: true },
          }),
      movementIds.length === 0
        ? Promise.resolve([])
        : this.prisma.transaction.findMany({
            where: { userId, id: { in: movementIds } },
            select: { id: true, currency: true },
          }),
      installmentGroupIds.length === 0
        ? Promise.resolve([])
        : this.prisma.installmentGroup.findMany({
            where: { userId, id: { in: installmentGroupIds } },
            select: { id: true, currency: true },
          }),
    ]);

    // Por cadena: quedarse con la fila de mayor startMonth (la vigente).
    const bestByChain = new Map<string, { startMonth: string; currency: Currency }>();
    for (const r of chainRows) {
      const existing = bestByChain.get(r.chainId);
      if (!existing || r.startMonth > existing.startMonth) {
        bestByChain.set(r.chainId, { startMonth: r.startMonth, currency: r.currency });
      }
    }
    for (const [chainId, v] of bestByChain) byChainId.set(chainId, v.currency);

    for (const tx of movementRows) byMovementId.set(tx.id, tx.currency);
    for (const g of groupRows) byInstallmentGroupId.set(g.id, g.currency);

    return { byChainId, byMovementId, byInstallmentGroupId };
  }

  private async loadPaymentMethodMap(ids: string[]): Promise<Map<string, HistoryPaymentMethodValue>> {
    const map = new Map<string, HistoryPaymentMethodValue>();
    if (ids.length === 0) return map;
    // RF-PM-006: se embebe aunque esté soft-deleted (espejo de la categoría).
    const rows = await this.prisma.paymentMethod.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
    for (const pm of rows) map.set(pm.id, { id: pm.id, name: pm.name });
    return map;
  }
}
