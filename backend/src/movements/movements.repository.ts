import { Injectable } from '@nestjs/common';
import { CategoryScope, Currency, FormulaOperator, MovementType, RecurringFrequency, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { applyFormula } from '../recurring/formula.helper';
import { convertToDisplayCurrency, PivotRates, buildPivotRates, resolveNearestYearMonth } from '../common/currency.helper';

// ---------------------------------------------------------------------------
// Interfaces para la agregación anual
// ---------------------------------------------------------------------------

/**
 * Fila devuelta por el SQL raw de agregación anual de únicos.
 * Una fila por (mes local, categoryId, type, currency, exchangeRate, anchorCurrency).
 * Fase 1.2.4: agrupar también por anchorCurrency para aplicar la conversión correcta.
 */
interface RawAnnualUnicoRow {
  /** Mes en formato YYYY-MM (calculado con AT TIME ZONE del registro) */
  monthKey: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryScope: string;
  type: string;
  /** Moneda original del grupo */
  currency: string;
  /** Cotización como string (Postgres Decimal → string) */
  exchangeRate: string;
  /** Moneda de referencia del exchangeRate guardado (Fase 1.2.4) */
  anchorCurrency: string;
  /** BigInt de JS — resultado de SUM de Postgres */
  totalCents: bigint;
}

/**
 * Shape de una fila de Recurring para la proyección anual.
 * Incluye frequency (P2) y skippedMonths (P1) — Fase 1.1.1.
 * Incluye campos de calculado (Fase 1.1.7 y 1.1.7.ext).
 * Incluye currency, exchangeRate y anchorCurrency (Fase 1.2.3 / 1.2.4).
 */
export interface RecurringForAnnual {
  id: string;
  type: MovementType;
  /**
   * Para fijos normales: el monto real.
   * Para calculados: 0 (placeholder; el monto real se deriva on-the-fly).
   */
  amountCents: number;
  /** Moneda original del fijo. */
  currency: Currency;
  /** Cotización (unidades de anchorCurrency por 1 unidad de currency). */
  exchangeRate: number;
  /** Moneda default del usuario al guardar el fijo (Fase 1.2.4). */
  anchorCurrency: Currency;
  startMonth: string;
  deletedFrom: string | null;
  frequency: RecurringFrequency;
  /** Set de meses salteados (YYYY-MM) — vacío si no tiene skips */
  skippedMonths: Set<string>;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryScope: string;
  /** Identidad estable de cadena (Fase 1.1.7) */
  chainId: string;
  /** chainId del fijo de origen (Fase 1.1.7); null si no es calculado de fijo */
  sourceChainId: string | null;
  /** id del Transaction de origen (Fase 1.1.7.ext); null si no es calculado de único */
  sourceMovementId: string | null;
  /** id del InstallmentGroup de origen (Fase 1.1.7.ext); null si no es calculado de cuota */
  sourceInstallmentGroupId: string | null;
  formulaOperator: FormulaOperator | null;
  formulaOperand: number | null;
  formulaSign: number | null;
}

/**
 * Shape de una fila de InstallmentGroup para la proyección anual.
 * Incluye currency, exchangeRate y anchorCurrency (Fase 1.2.3 / 1.2.4).
 */
export interface InstallmentGroupForAnnual {
  id: string;
  type: MovementType;
  amountCents: number;
  /** Moneda original del grupo de cuotas. */
  currency: Currency;
  /** Cotización (unidades de anchorCurrency por 1 unidad de currency). */
  exchangeRate: number;
  /** Moneda default del usuario al guardar el grupo (Fase 1.2.4). */
  anchorCurrency: Currency;
  totalInstallments: number;
  startMonth: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryScope: string;
}

/**
 * Agregado intermedio de un mes para el cálculo anual.
 * Clave: "YYYY-MM".
 */
export interface MonthAggregate {
  incomeCents: number;
  expenseCents: number;
  /** Gasto por categoría en este mes: clave = categoryId */
  categoryExpense: Map<string, number>;
}

/**
 * Metadato de categoría para el resultado anual.
 */
export interface AnnualCategoryMeta {
  categoryId: string;
  name: string;
  color: string;
}

/**
 * Shape de categoría embebida en un MovementItem.
 * Se incluye AUNQUE la categoría esté soft-deleted (RF-CAT-004):
 * un movimiento histórico sigue mostrando el nombre de su categoría.
 */
export interface MovementEmbeddedCategory {
  id: string;
  name: string;
  color: string;
  scope: CategoryScope;
}

/**
 * Shape del campo installment para ítems de cuotas (D1 — Fase 7).
 * - number: número de cuota en el mes consultado (1-based)
 * - total: total de cuotas del grupo (totalInstallments)
 * - startMonth: mes de inicio del grupo (YYYY-MM)
 *
 * Para únicos y fijos: null.
 */
export interface InstallmentInfo {
  number: number;
  total: number;
  startMonth: string;
}

/**
 * Información de la relación padre/hijo para movimientos calculados (Fase 1.1.7).
 *
 * Para un fijo CALCULADO (hijo):
 *   calculated = { sourceType, sourceId, sourceChainId?, formulaOperator, formulaOperand, formulaSign,
 *                  sourceDescription }
 *   hasCalculated = false (no puede ser origen de otro calculado)
 *
 * Para un fijo ORIGEN que tiene calculados derivados (padre):
 *   calculated = null
 *   hasCalculated = true
 *
 * Para fijos normales sin calculados derivados y para únicos/cuotas:
 *   calculated = null
 *   hasCalculated = false
 */
export interface CalculatedInfo {
  /**
   * Discriminador del tipo de origen (Fase 1.1.7.ext):
   * - 'fijo':  el origen es un movimiento fijo (sourceChainId no-null)
   * - 'unico': el origen es un movimiento único Transaction (sourceMovementId no-null)
   * - 'cuota': el origen es un grupo de cuotas InstallmentGroup (sourceInstallmentGroupId no-null)
   */
  sourceType: 'fijo' | 'unico' | 'cuota';
  /**
   * ID del origen según el tipo:
   * - fijo:  chainId estable del fijo de origen (= sourceChainId)
   * - unico: id del Transaction
   * - cuota: id del InstallmentGroup
   * El front lo usa para prefilar el PATCH y el preview.
   */
  sourceId: string;
  /**
   * chainId del fijo de origen (solo presente si sourceType='fijo'; back-compat).
   * null si el origen es un único o cuota.
   */
  sourceChainId: string | null;
  /** Descripción del origen en ese mes (para el preview del formulario) */
  sourceDescription: string | null;
  formulaOperator: FormulaOperator;
  /**
   * Operando escalado como entero (ver formula.helper.ts):
   * ADD/SUB → centavos; MUL/DIV → factor × 1_000_000; PCT → pct × 100
   */
  formulaOperand: number;
  /** 1 (positivo) o -1 (negativo) */
  formulaSign: number;
  /**
   * Monto del origen en el mes consultado (en centavos).
   * - Fijo: monto de la fila activa del fijo en ese mes.
   * - Único: amountCents del Transaction.
   * - Cuota: amountCents por cuota del InstallmentGroup.
   * Es el monto base sobre el que se aplica la fórmula para derivar el amountCents del calculado.
   * Usado por el front para mostrar el preview del resultado al editar la fórmula.
   */
  sourceAmountCents: number;
}

/**
 * MovementItem — ítem de la lista unificada del mes.
 *
 * El campo `origin` discrimina el tipo de movimiento para el front:
 * - 'unico': movimiento único (Transaction)
 * - 'fijo':  movimiento fijo activo en el mes (Recurring)
 * - 'cuota': cuota de un grupo InstallmentGroup activa en el mes
 *
 * D1/D3 — occurredAt y timezone son nullable:
 * - Únicos: ambos tienen valor (instante + zona)
 * - Fijos y cuotas: ambos son null (operan a nivel mes, sin día/hora/zona)
 *
 * D1 — campo installment:
 * - Cuotas: { number, total, startMonth }
 * - Únicos y fijos: null / ausente
 *
 * P2 (Fase 1.1.1) — campo frequency:
 * - Fijos: la frecuencia del fijo (RecurringFrequency)
 * - Únicos y cuotas: null (no aplica)
 *
 * P1 (Fase 1.1.1) — campo skipped:
 * - Fijos: true si el fijo está anulado para este mes puntual (no suma a totales)
 * - Únicos y cuotas: false siempre (no tienen skip)
 *
 * Fase 1.1.7 — campo calculated:
 * - Presente si el ítem ES un calculado (hijo): contiene info del origen y la fórmula.
 * - null si el ítem no es un calculado (fijo normal, único o cuota).
 *
 * Fase 1.1.7 — campo hasCalculated:
 * - true si el ítem es un fijo de origen que tiene ≥1 calculado derivado en este mes.
 * - false para todos los demás ítems.
 *
 * NOTA sobre amountCents de calculados (RN-018):
 * Para calculados, amountCents es el monto derivado on-the-fly: sign × round(formula(sourceAmount)).
 * Puede ser negativo o cero (excepción a RN-001 válida solo para calculados).
 * Se suma al bucket de su propio type con su signo (RN-019).
 */
export interface MovementItem {
  id: string;
  origin: 'unico' | 'fijo' | 'cuota';
  type: MovementType;
  /**
   * Para fijos normales y únicos: siempre > 0.
   * Para calculados: puede ser negativo o cero (RN-018).
   * En la moneda ORIGINAL del movimiento (Fase 1.2.3).
   */
  amountCents: number;
  /**
   * Monto convertido a la moneda default del usuario, en centavos enteros.
   * Si currency == defaultCurrency: igual a |amountCents| para fijos/únicos normales.
   * Para calculados: |amountCents| convertido.
   * Fase 1.2.3.
   */
  convertedAmountCents: number;
  /** Moneda original del movimiento (Fase 1.2.3). */
  currency: Currency;
  /**
   * Cotización ARS/1 USD del movimiento (Fase 1.2.3).
   * Para calculados: cotización del origen (heredada al vuelo).
   */
  exchangeRate: number;
  description: string | null;
  occurredAt: Date | null;
  timezone: string | null;
  category: MovementEmbeddedCategory;
  installment: InstallmentInfo | null;
  /** Frecuencia del fijo. null para únicos y cuotas. */
  frequency: RecurringFrequency | null;
  /** true si el fijo está anulado para este mes. Siempre false para únicos y cuotas. */
  skipped: boolean;
  /** Fase 1.1.7: info del calculado si este ítem ES un calculado; null si no lo es. */
  calculated: CalculatedInfo | null;
  /** Fase 1.1.7: true si el ítem es un fijo origen que tiene ≥1 calculado en este mes. */
  hasCalculated: boolean;
}

/**
 * Shape interno de una fila devuelta por el SQL raw de movimientos únicos.
 */
interface RawTransactionRow {
  id: string;
  userId: string;
  type: string;
  amountCents: number;
  description: string | null;
  occurredAt: Date;
  timezone: string;
  /** Moneda original del movimiento */
  currency: string;
  /** Cotización como string (Postgres devuelve Decimal como string) */
  exchangeRate: string;
  /** Moneda de referencia del exchangeRate guardado (Fase 1.2.4) */
  anchorCurrency: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryScope: string;
}

/**
 * Shape interno de una fila de totales devuelta por el SQL raw.
 */
interface RawTotalsRow {
  expenseCents: bigint;
  incomeCents: bigint;
}

@Injectable()
export class MovementsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Carga TODOS los yearMonths y filas de ReferenceRate en una sola query.
   * La tabla es pequeña (~54 filas), así que es eficiente cargarla entera.
   * Devuelve un Map<yearMonth, Partial<PivotRates>> de todos los meses disponibles.
   * Método privado compartido por loadPivotRates y loadPivotRatesForYear.
   */
  private async loadAllPivotRates(): Promise<Map<string, Partial<PivotRates>>> {
    const rows = await this.prisma.referenceRate.findMany({
      select: { currency: true, yearMonth: true, rate: true },
    });
    const map = new Map<string, Partial<PivotRates>>();
    for (const r of rows) {
      if (!map.has(r.yearMonth)) {
        map.set(r.yearMonth, {});
      }
      const pr = map.get(r.yearMonth)!;
      if (r.currency === Currency.ARS) pr.ARS = Number(r.rate);
      else if (r.currency === Currency.BRL) pr.BRL = Number(r.rate);
      else if (r.currency === Currency.EUR) pr.EUR = Number(r.rate);
    }
    return map;
  }

  /**
   * Carga las cotizaciones de pivote USD (ReferenceRate) para un mes dado.
   *
   * CLAMP (Fase 1.2.4 fix): si el mes pedido no tiene filas en ReferenceRate,
   * se usa el mes disponible más cercano:
   *   - Mes futuro → máximo disponible (último conocido, ej: 2026-09 → 2026-06).
   *   - Mes pasado → mínimo disponible (primero conocido, ej: 2024-12 → 2025-01).
   *   - Hueco intermedio → más cercano por distancia en meses.
   *
   * Retorna null solo si la tabla está completamente vacía.
   * Método privado reutilizado por findUnicosByMonth, findFijosByMonth, findCuotasByMonth.
   */
  private async loadPivotRates(month: string): Promise<Partial<PivotRates> | null> {
    const allRates = await this.loadAllPivotRates();
    if (allRates.size === 0) return null;

    // Resolver el mes más cercano con clamp
    const resolved = resolveNearestYearMonth(month, Array.from(allRates.keys()));
    if (resolved === null) return null;

    return allRates.get(resolved) ?? null;
  }

  /**
   * Carga cotizaciones de pivote USD para todos los meses del año dado.
   * Una sola query (carga toda la tabla); devuelve un Map<"YYYY-MM", Partial<PivotRates>>.
   *
   * CLAMP (Fase 1.2.4 fix): cada mes del año (YYYY-01..YYYY-12) que no tenga
   * filas se resuelve al mes disponible más cercano. Así, meses futuros del año
   * (ej: 2026-07..2026-12 cuando el max disponible es 2026-06) usan las tasas
   * del último mes conocido en vez de devolver null y caer al fallback inflado.
   *
   * El Map resultante tiene siempre exactamente los 12 meses del año como claves,
   * con su PivotRates resuelto (o ausentes si la tabla está vacía).
   * Usado por getReportsMovements para el cálculo anual.
   */
  async loadPivotRatesForYear(year: number): Promise<Map<string, Partial<PivotRates>>> {
    const allRates = await this.loadAllPivotRates();
    const availableMonths = Array.from(allRates.keys());

    const yearStr = String(year).padStart(4, '0');
    const result = new Map<string, Partial<PivotRates>>();

    for (let m = 1; m <= 12; m++) {
      const monthKey = `${yearStr}-${String(m).padStart(2, '0')}`;
      const resolved = resolveNearestYearMonth(monthKey, availableMonths);
      if (resolved !== null) {
        const rates = allRates.get(resolved);
        if (rates) {
          result.set(monthKey, rates);
        }
      }
    }

    return result;
  }

  /**
   * Lista los movimientos únicos (Transaction) que pertenecen al mes YYYY-MM,
   * bucketando por la timezone propia de CADA registro (AT TIME ZONE t.timezone).
   *
   * Fase 1.1.7.ext — calculados de único:
   * Incluye los calculados de único (Recurring con sourceMovementId != null) activos
   * en este mes. Aparecen con origin='unico' (su sección de origen), no en 'fijos'.
   *
   * Fase 1.2.4 — displayCurrency: moneda de display vigente del usuario.
   * La conversión re-rutea vía la tabla ReferenceRate del mes cuando
   * anchorCurrency (del movimiento) ≠ displayCurrency.
   */
  async findUnicosByMonth(
    userId: string,
    month: string,
    displayCurrency: Currency = Currency.ARS,
  ): Promise<MovementItem[]> {
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);

    const monthStart = `${yearStr}-${monthStr}-01`;

    let nextYear = year;
    let nextMonth = monthNum + 1;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear = year + 1;
    }
    const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
    void monthEnd;

    // Cargar pivot rates del mes y las transacciones en paralelo (Fase 1.2.4)
    const [rows, pivotRates] = await Promise.all([
      this.prisma.$queryRaw<RawTransactionRow[]>`
        SELECT
          t.id                            AS "id",
          t."userId"                      AS "userId",
          t.type::text                    AS "type",
          t."amountCents"                 AS "amountCents",
          t.description                   AS "description",
          t."occurredAt"                  AS "occurredAt",
          t.timezone                      AS "timezone",
          t.currency::text                AS "currency",
          t."exchangeRate"::text          AS "exchangeRate",
          t."anchorCurrency"::text        AS "anchorCurrency",
          t."categoryId"                  AS "categoryId",
          c.name                          AS "categoryName",
          c.color                         AS "categoryColor",
          c.scope::text                   AS "categoryScope"
        FROM "Transaction" t
        JOIN "Category" c ON c.id = t."categoryId"
        WHERE
          t."userId" = ${userId}
          AND date_trunc('month', t."occurredAt" AT TIME ZONE t.timezone)
              = date_trunc('month', ${monthStart}::timestamp)
        ORDER BY t."amountCents" DESC, t."occurredAt" DESC
      `,
      this.loadPivotRates(month),
    ]);

    const unicosItems = rows.map((row) => this.mapRowToMovementItem(row, displayCurrency, pivotRates));

    // Calculados de único: Recurring con sourceMovementId != null activos en el mes
    const calculadosDeUnico = await this.prisma.recurring.findMany({
      where: {
        userId,
        sourceMovementId: { not: null },
        sourceChainId: null,
        sourceInstallmentGroupId: null,
        startMonth: { lte: month },
        OR: [
          { deletedFrom: null },
          { deletedFrom: { gt: month } },
        ],
      },
      include: {
        category: {
          select: { id: true, name: true, color: true, scope: true },
        },
      },
    });

    if (calculadosDeUnico.length === 0) {
      return unicosItems;
    }

    // Cargar Transactions de origen (con anchorCurrency)
    const txIds = calculadosDeUnico.map((r) => r.sourceMovementId!);
    const txRows = await this.prisma.transaction.findMany({
      where: { id: { in: txIds } },
      select: { id: true, amountCents: true, description: true, occurredAt: true, timezone: true, currency: true, exchangeRate: true, anchorCurrency: true },
    });
    const txOriginMap = new Map<string, {
      amountCents: number;
      description: string | null;
      occurredAt: Date;
      timezone: string;
      currency: Currency;
      exchangeRate: number;
      anchorCurrency: Currency;
    }>();
    for (const tx of txRows) {
      txOriginMap.set(tx.id, {
        amountCents: tx.amountCents,
        description: tx.description,
        occurredAt: tx.occurredAt,
        timezone: tx.timezone,
        currency: tx.currency,
        exchangeRate: Number(tx.exchangeRate),
        anchorCurrency: tx.anchorCurrency,
      });
    }

    for (const calc of calculadosDeUnico) {
      const txData = calc.sourceMovementId ? txOriginMap.get(calc.sourceMovementId) : undefined;
      if (!txData) continue;

      const derivedAmount = applyFormula(
        txData.amountCents,
        calc.formulaOperator as FormulaOperator,
        calc.formulaOperand!,
        calc.formulaSign!,
      );
      const derivedType: MovementType =
        derivedAmount > 0 ? MovementType.INCOME : MovementType.EXPENSE;

      // Calculados heredan moneda, cotización y anchor del origen
      const convertedAmount = convertToDisplayCurrency(
        Math.abs(derivedAmount),
        txData.currency,
        txData.exchangeRate,
        txData.anchorCurrency,
        displayCurrency,
        pivotRates,
      );

      unicosItems.push({
        id: calc.id,
        origin: 'unico' as const,
        type: derivedType,
        amountCents: derivedAmount,
        convertedAmountCents: convertedAmount,
        currency: txData.currency,
        exchangeRate: txData.exchangeRate,
        description: calc.description,
        occurredAt: txData.occurredAt,
        timezone: txData.timezone,
        category: {
          id: calc.category.id,
          name: calc.category.name,
          color: calc.category.color,
          scope: calc.category.scope as CategoryScope,
        },
        installment: null,
        frequency: null,
        skipped: false,
        calculated: {
          sourceType: 'unico',
          sourceId: calc.sourceMovementId!,
          sourceChainId: null,
          sourceDescription: txData.description,
          formulaOperator: calc.formulaOperator as FormulaOperator,
          formulaOperand: calc.formulaOperand!,
          formulaSign: calc.formulaSign!,
          sourceAmountCents: txData.amountCents,
        },
        hasCalculated: false,
      });
    }

    // Re-ordenar por valor convertido DESC (comparable entre monedas), desempate por occurredAt DESC
    unicosItems.sort(
      (a, b) =>
        b.convertedAmountCents - a.convertedAmountCents ||
        (b.occurredAt?.getTime() ?? 0) - (a.occurredAt?.getTime() ?? 0),
    );

    return unicosItems;
  }

  /**
   * Lista los movimientos fijos (Recurring) que aparecen en el mes YYYY-MM.
   *
   * Solo incluye fijos normales y calculados de fijo (sourceChainId != null).
   * Los calculados de único (sourceMovementId != null) van en findUnicosByMonth.
   * Los calculados de cuota (sourceInstallmentGroupId != null) van en findCuotasByMonth.
   *
   * Fase 1.1.7 — calculados on-the-fly (de fijo):
   * Los calculados con sourceChainId != null se incluyen con su monto derivado.
   * El origen es el fijo activo en el mes; su presencia gate-a al calculado.
   *
   * Fase 1.2.4 — displayCurrency: moneda de display vigente del usuario.
   * La conversión re-rutea vía la tabla ReferenceRate del mes cuando
   * anchorCurrency (del movimiento) ≠ displayCurrency.
   */
  async findFijosByMonth(
    userId: string,
    month: string,
    displayCurrency: Currency = Currency.ARS,
  ): Promise<MovementItem[]> {
    // Cargar candidatos activos y pivot rates del mes en paralelo
    const [recurrings, pivotRates] = await Promise.all([
      this.prisma.recurring.findMany({
        where: {
          userId,
          startMonth: { lte: month },
          OR: [
            { deletedFrom: null },
            { deletedFrom: { gt: month } },
          ],
          // Excluir calculados de único y cuota: esos van en sus propias secciones
          sourceMovementId: null,
          sourceInstallmentGroupId: null,
        },
        orderBy: [
          { amountCents: 'desc' },
          { createdAt: 'desc' },
        ],
        include: {
          category: {
            select: {
              id: true,
              name: true,
              color: true,
              scope: true,
            },
          },
          skips: {
            where: { month },
            select: { month: true },
          },
        },
      }),
      this.loadPivotRates(month),
    ]);

    // Separar en normales y calculados de fijo
    const normales = recurrings.filter(
      (r) => r.sourceChainId === null
        && isOnFrequency(r.startMonth, r.frequency, month),
    );
    // Calculados de fijo: gating por el origen
    const calculadosDeFijo = recurrings.filter((r) => r.sourceChainId !== null);

    // Construir mapa chainId → datos del origen para los fijos normales activos en el mes.
    const originMap = new Map<string, {
      amountCents: number;
      skipped: boolean;
      id: string;
      description: string | null;
      currency: Currency;
      exchangeRate: number;
      anchorCurrency: Currency;
    }>();

    for (const r of normales) {
      originMap.set(r.chainId, {
        amountCents: r.amountCents,
        skipped: r.skips.length > 0,
        id: r.id,
        description: r.description,
        currency: r.currency,
        exchangeRate: Number(r.exchangeRate),
        anchorCurrency: r.anchorCurrency,
      });
    }

    // Determinar qué chainIds tienen calculados activos en este mes
    const chainsWithCalculados = new Set<string>();
    for (const calc of calculadosDeFijo) {
      if (calc.sourceChainId && originMap.has(calc.sourceChainId)) {
        chainsWithCalculados.add(calc.sourceChainId);
      }
    }

    const result: MovementItem[] = [];

    // Agregar fijos normales
    for (const r of normales) {
      const skipped = r.skips.length > 0;
      const exchangeRate = Number(r.exchangeRate);
      const convertedAmountCents = convertToDisplayCurrency(
        r.amountCents,
        r.currency,
        exchangeRate,
        r.anchorCurrency,
        displayCurrency,
        pivotRates,
      );
      result.push({
        id: r.id,
        origin: 'fijo' as const,
        type: r.type,
        amountCents: r.amountCents,
        convertedAmountCents,
        currency: r.currency,
        exchangeRate,
        description: r.description,
        occurredAt: null,
        timezone: null,
        category: {
          id: r.category.id,
          name: r.category.name,
          color: r.category.color,
          scope: r.category.scope as CategoryScope,
        },
        installment: null,
        frequency: r.frequency,
        skipped,
        calculated: null,
        hasCalculated: chainsWithCalculados.has(r.chainId),
      });
    }

    // Agregar calculados de fijo (con monto derivado on-the-fly)
    for (const calc of calculadosDeFijo) {
      const originData = calc.sourceChainId ? originMap.get(calc.sourceChainId) : undefined;
      if (!originData) continue; // origen no activo en este mes

      const skipped = originData.skipped;
      const derivedAmount = applyFormula(
        originData.amountCents,
        calc.formulaOperator as FormulaOperator,
        calc.formulaOperand!,
        calc.formulaSign!,
      );
      const derivedType: MovementType =
        derivedAmount > 0 ? MovementType.INCOME : MovementType.EXPENSE;

      // Calculados heredan moneda, cotización y anchor del origen
      const convertedAmountCents = convertToDisplayCurrency(
        Math.abs(derivedAmount),
        originData.currency,
        originData.exchangeRate,
        originData.anchorCurrency,
        displayCurrency,
        pivotRates,
      );

      result.push({
        id: calc.id,
        origin: 'fijo' as const,
        type: derivedType,
        amountCents: derivedAmount,
        convertedAmountCents,
        currency: originData.currency,
        exchangeRate: originData.exchangeRate,
        description: calc.description,
        occurredAt: null,
        timezone: null,
        category: {
          id: calc.category.id,
          name: calc.category.name,
          color: calc.category.color,
          scope: calc.category.scope as CategoryScope,
        },
        installment: null,
        frequency: calc.frequency,
        skipped,
        calculated: {
          sourceType: 'fijo',
          sourceId: calc.sourceChainId!,
          sourceChainId: calc.sourceChainId!,
          sourceDescription: originData.description,
          formulaOperator: calc.formulaOperator as FormulaOperator,
          formulaOperand: calc.formulaOperand!,
          formulaSign: calc.formulaSign!,
          sourceAmountCents: originData.amountCents,
        },
        hasCalculated: false,
      });
    }

    // Re-ordenar por valor convertido DESC (comparable entre monedas).
    result.sort((a, b) => b.convertedAmountCents - a.convertedAmountCents);

    return result;
  }

  /**
   * Lista los grupos de cuotas (InstallmentGroup) activos en el mes YYYY-MM.
   *
   * Fase 1.1.7.ext — calculados de cuota:
   * Incluye los calculados de cuota (Recurring con sourceInstallmentGroupId != null)
   * activos en el mes, verificando on-the-fly que el mes cae dentro del rango del grupo.
   * Aparecen con origin='cuota' (su sección de origen), no en 'fijos'.
   *
   * Fase 1.2.4 — displayCurrency: moneda de display vigente del usuario.
   * La conversión re-rutea vía la tabla ReferenceRate del mes cuando
   * anchorCurrency (del grupo) ≠ displayCurrency.
   */
  async findCuotasByMonth(
    userId: string,
    month: string,
    displayCurrency: Currency = Currency.ARS,
  ): Promise<MovementItem[]> {
    // Cargar grupos e pivot rates en paralelo
    const [groups, pivotRates] = await Promise.all([
      this.prisma.installmentGroup.findMany({
        where: {
          userId,
          startMonth: { lte: month },
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              color: true,
              scope: true,
            },
          },
        },
      }),
      this.loadPivotRates(month),
    ]);

    const result: MovementItem[] = [];

    for (const g of groups) {
      const endMonth = addMonths(g.startMonth, g.totalInstallments);
      if (month >= endMonth) {
        continue;
      }

      const number = monthDiff(g.startMonth, month) + 1;
      const exchangeRate = Number(g.exchangeRate);
      const convertedAmountCents = convertToDisplayCurrency(
        g.amountCents,
        g.currency,
        exchangeRate,
        g.anchorCurrency,
        displayCurrency,
        pivotRates,
      );

      result.push({
        id: g.id,
        origin: 'cuota' as const,
        type: g.type,
        amountCents: g.amountCents,
        convertedAmountCents,
        currency: g.currency,
        exchangeRate,
        description: g.description,
        occurredAt: null,
        timezone: null,
        category: {
          id: g.category.id,
          name: g.category.name,
          color: g.category.color,
          scope: g.category.scope as CategoryScope,
        },
        installment: {
          number,
          total: g.totalInstallments,
          startMonth: g.startMonth,
        },
        frequency: null,
        skipped: false,
        calculated: null,
        hasCalculated: false,
      });
    }

    // Calculados de cuota: Recurring con sourceInstallmentGroupId != null activos en el mes
    const calculadosDeCuota = await this.prisma.recurring.findMany({
      where: {
        userId,
        sourceInstallmentGroupId: { not: null },
        sourceChainId: null,
        sourceMovementId: null,
        startMonth: { lte: month },
        OR: [
          { deletedFrom: null },
          { deletedFrom: { gt: month } },
        ],
      },
      include: {
        category: {
          select: { id: true, name: true, color: true, scope: true },
        },
      },
    });

    if (calculadosDeCuota.length > 0) {
      // Cargar InstallmentGroups de origen (con anchorCurrency)
      const groupIds = calculadosDeCuota.map((r) => r.sourceInstallmentGroupId!);
      const groupRows = await this.prisma.installmentGroup.findMany({
        where: { id: { in: groupIds } },
        select: {
          id: true,
          amountCents: true,
          description: true,
          totalInstallments: true,
          startMonth: true,
          currency: true,
          exchangeRate: true,
          anchorCurrency: true,
        },
      });
      const groupOriginMap = new Map<string, {
        amountCents: number;
        description: string | null;
        totalInstallments: number;
        startMonth: string;
        currency: Currency;
        exchangeRate: number;
        anchorCurrency: Currency;
      }>();
      for (const g of groupRows) {
        groupOriginMap.set(g.id, {
          amountCents: g.amountCents,
          description: g.description,
          totalInstallments: g.totalInstallments,
          startMonth: g.startMonth,
          currency: g.currency,
          exchangeRate: Number(g.exchangeRate),
          anchorCurrency: g.anchorCurrency,
        });
      }

      for (const calc of calculadosDeCuota) {
        const groupData = calc.sourceInstallmentGroupId
          ? groupOriginMap.get(calc.sourceInstallmentGroupId)
          : undefined;
        if (!groupData) continue;

        // Verificar que el mes está dentro del rango del grupo on-the-fly
        const endMonth = addMonths(groupData.startMonth, groupData.totalInstallments);
        if (month >= endMonth) continue;

        const derivedAmount = applyFormula(
          groupData.amountCents,
          calc.formulaOperator as FormulaOperator,
          calc.formulaOperand!,
          calc.formulaSign!,
        );
        const derivedType: MovementType =
          derivedAmount > 0 ? MovementType.INCOME : MovementType.EXPENSE;

        // Calculados heredan moneda, cotización y anchor del origen
        const convertedAmountCents = convertToDisplayCurrency(
          Math.abs(derivedAmount),
          groupData.currency,
          groupData.exchangeRate,
          groupData.anchorCurrency,
          displayCurrency,
          pivotRates,
        );

        result.push({
          id: calc.id,
          origin: 'cuota' as const,
          type: derivedType,
          amountCents: derivedAmount,
          convertedAmountCents,
          currency: groupData.currency,
          exchangeRate: groupData.exchangeRate,
          description: calc.description,
          occurredAt: null,
          timezone: null,
          category: {
            id: calc.category.id,
            name: calc.category.name,
            color: calc.category.color,
            scope: calc.category.scope as CategoryScope,
          },
          installment: null,
          frequency: null,
          skipped: false,
          calculated: {
            sourceType: 'cuota',
            sourceId: calc.sourceInstallmentGroupId!,
            sourceChainId: null,
            sourceDescription: groupData.description,
            formulaOperator: calc.formulaOperator as FormulaOperator,
            formulaOperand: calc.formulaOperand!,
            formulaSign: calc.formulaSign!,
            sourceAmountCents: groupData.amountCents,
          },
          hasCalculated: false,
        });
      }
    }

    result.sort(
      (a, b) => b.convertedAmountCents - a.convertedAmountCents || a.id.localeCompare(b.id),
    );

    return result;
  }

  /**
   * Calcula los totales de movimientos únicos del mes.
   */
  async getTotalsByMonth(
    userId: string,
    month: string,
  ): Promise<{ expenseCents: number; incomeCents: number }> {
    const [yearStr, monthStr] = month.split('-');

    const monthStart = `${yearStr}-${monthStr}-01`;

    const rows = await this.prisma.$queryRaw<RawTotalsRow[]>`
      SELECT
        COALESCE(SUM(CASE WHEN t.type = 'EXPENSE' THEN t."amountCents" ELSE 0 END), 0) AS "expenseCents",
        COALESCE(SUM(CASE WHEN t.type = 'INCOME'  THEN t."amountCents" ELSE 0 END), 0) AS "incomeCents"
      FROM "Transaction" t
      WHERE
        t."userId" = ${userId}
        AND date_trunc('month', t."occurredAt" AT TIME ZONE t.timezone)
            = date_trunc('month', ${monthStart}::timestamp)
    `;

    const row = rows[0];
    return {
      expenseCents: Number(row.expenseCents),
      incomeCents: Number(row.incomeCents),
    };
  }

  /**
   * Calcula los totales de los movimientos fijos activos en el mes.
   * Incluye calculados de fijo, único y cuota (con monto derivado on-the-fly).
   * Excluye fijos skippeados.
   *
   * NOTA: este método queda en el código pero MovementsService ya no lo llama
   * (los totales se recomputan desde las listas filtradas). Disponible para tests
   * directos del repo o uso futuro.
   */
  async getFijosTotalsByMonth(
    userId: string,
    month: string,
  ): Promise<{ expenseCents: number; incomeCents: number }> {
    const recurrings = await this.prisma.recurring.findMany({
      where: {
        userId,
        startMonth: { lte: month },
        OR: [
          { deletedFrom: null },
          { deletedFrom: { gt: month } },
        ],
      },
      select: {
        type: true,
        amountCents: true,
        startMonth: true,
        frequency: true,
        chainId: true,
        sourceChainId: true,
        sourceMovementId: true,
        sourceInstallmentGroupId: true,
        formulaOperator: true,
        formulaOperand: true,
        formulaSign: true,
        skips: {
          where: { month },
          select: { month: true },
        },
      },
    });

    // Construir mapa chainId → amountCents de los normales activos
    const normalesMap = new Map<string, { amountCents: number; skipped: boolean }>();
    const normales = recurrings.filter(
      (r) => r.sourceChainId === null && r.sourceMovementId === null && r.sourceInstallmentGroupId === null
        && isOnFrequency(r.startMonth, r.frequency, month),
    );
    for (const r of normales) {
      normalesMap.set(r.chainId, {
        amountCents: r.amountCents,
        skipped: r.skips.length > 0,
      });
    }

    // Cargar Transactions de origen para calculados de único
    const calculadosDeUnico = recurrings.filter((r) => r.sourceMovementId !== null);
    const txIds = calculadosDeUnico.map((r) => r.sourceMovementId!).filter(Boolean);
    const txMap = new Map<string, number>();
    if (txIds.length > 0) {
      const txRows = await this.prisma.transaction.findMany({
        where: { id: { in: txIds } },
        select: { id: true, amountCents: true },
      });
      for (const tx of txRows) txMap.set(tx.id, tx.amountCents);
    }

    // Cargar InstallmentGroups de origen para calculados de cuota
    const calculadosDeCuota = recurrings.filter((r) => r.sourceInstallmentGroupId !== null);
    const groupIds = calculadosDeCuota.map((r) => r.sourceInstallmentGroupId!).filter(Boolean);
    const groupMap = new Map<string, { amountCents: number; totalInstallments: number; startMonth: string }>();
    if (groupIds.length > 0) {
      const groupRows = await this.prisma.installmentGroup.findMany({
        where: { id: { in: groupIds } },
        select: { id: true, amountCents: true, totalInstallments: true, startMonth: true },
      });
      for (const g of groupRows) groupMap.set(g.id, { amountCents: g.amountCents, totalInstallments: g.totalInstallments, startMonth: g.startMonth });
    }

    let expenseCents = 0;
    let incomeCents = 0;

    for (const r of recurrings) {
      let effectiveAmount: number;
      let derivedType: MovementType;

      if (r.sourceChainId === null && r.sourceMovementId === null && r.sourceInstallmentGroupId === null) {
        // Fijo normal
        if (!isOnFrequency(r.startMonth, r.frequency, month)) continue;
        if (r.skips.length > 0) continue;
        effectiveAmount = r.amountCents;
        derivedType = r.type;
      } else if (r.sourceChainId !== null) {
        // Calculado de fijo
        const originData = normalesMap.get(r.sourceChainId);
        if (!originData) continue;
        if (originData.skipped) continue;
        effectiveAmount = applyFormula(
          originData.amountCents,
          r.formulaOperator as FormulaOperator,
          r.formulaOperand!,
          r.formulaSign!,
        );
        derivedType = effectiveAmount > 0 ? MovementType.INCOME : MovementType.EXPENSE;
      } else if (r.sourceMovementId !== null) {
        // Calculado de único
        const txAmount = txMap.get(r.sourceMovementId);
        if (txAmount === undefined) continue;
        effectiveAmount = applyFormula(
          txAmount,
          r.formulaOperator as FormulaOperator,
          r.formulaOperand!,
          r.formulaSign!,
        );
        derivedType = effectiveAmount > 0 ? MovementType.INCOME : MovementType.EXPENSE;
      } else if (r.sourceInstallmentGroupId !== null) {
        // Calculado de cuota: verificar que el mes está dentro del rango del grupo
        const groupData = groupMap.get(r.sourceInstallmentGroupId);
        if (!groupData) continue;
        const endMonth = addMonths(groupData.startMonth, groupData.totalInstallments);
        if (month >= endMonth) continue;
        effectiveAmount = applyFormula(
          groupData.amountCents,
          r.formulaOperator as FormulaOperator,
          r.formulaOperand!,
          r.formulaSign!,
        );
        derivedType = effectiveAmount > 0 ? MovementType.INCOME : MovementType.EXPENSE;
      } else {
        continue;
      }

      const magnitude = Math.abs(effectiveAmount);
      if (derivedType === MovementType.EXPENSE) {
        expenseCents += magnitude;
      } else {
        incomeCents += magnitude;
      }
    }

    return { expenseCents, incomeCents };
  }

  /**
   * Calcula los totales de los grupos de cuotas activos en el mes.
   */
  async getCuotasTotalsByMonth(
    userId: string,
    month: string,
  ): Promise<{ expenseCents: number; incomeCents: number }> {
    const groups = await this.prisma.installmentGroup.findMany({
      where: {
        userId,
        startMonth: { lte: month },
      },
      select: {
        type: true,
        amountCents: true,
        totalInstallments: true,
        startMonth: true,
      },
    });

    let expenseCents = 0;
    let incomeCents = 0;

    for (const g of groups) {
      const endMonth = addMonths(g.startMonth, g.totalInstallments);
      if (month >= endMonth) {
        continue;
      }

      if (g.type === MovementType.EXPENSE) {
        expenseCents += g.amountCents;
      } else {
        incomeCents += g.amountCents;
      }
    }

    return { expenseCents, incomeCents };
  }

  // ---------------------------------------------------------------------------
  // Métodos de agregación anual (RF-GRA-001, RN-015)
  // ---------------------------------------------------------------------------

  /**
   * Devuelve la agregación de movimientos únicos del año.
   */
  async getAnnualUnicosAggregated(
    userId: string,
    year: number,
  ): Promise<RawAnnualUnicoRow[]> {
    const rows = await this.prisma.$queryRaw<RawAnnualUnicoRow[]>`
      SELECT
        to_char(
          date_trunc('month', t."occurredAt" AT TIME ZONE t.timezone),
          'YYYY-MM'
        )                               AS "monthKey",
        t."categoryId"                  AS "categoryId",
        c.name                          AS "categoryName",
        c.color                         AS "categoryColor",
        c.scope::text                   AS "categoryScope",
        t.type::text                    AS "type",
        t.currency::text                AS "currency",
        t."exchangeRate"::text          AS "exchangeRate",
        t."anchorCurrency"::text        AS "anchorCurrency",
        SUM(t."amountCents")            AS "totalCents"
      FROM "Transaction" t
      JOIN "Category" c ON c.id = t."categoryId"
      WHERE
        t."userId" = ${userId}
        AND EXTRACT(year FROM
              date_trunc('month', t."occurredAt" AT TIME ZONE t.timezone)
            ) = ${year}
      GROUP BY
        date_trunc('month', t."occurredAt" AT TIME ZONE t.timezone),
        t."categoryId",
        c.name,
        c.color,
        c.scope,
        t.type,
        t.currency,
        t."exchangeRate",
        t."anchorCurrency"
      ORDER BY
        date_trunc('month', t."occurredAt" AT TIME ZONE t.timezone),
        t."categoryId"
    `;
    return rows;
  }

  /**
   * Devuelve todos los movimientos fijos del usuario para la proyección anual.
   * Incluye frequency (P2), skippedMonths (P1) y campos de calculado (Fase 1.1.7 + 1.1.7.ext).
   */
  async getAllFijosForAnnual(userId: string): Promise<RecurringForAnnual[]> {
    const [rows, allSkips] = await Promise.all([
      this.prisma.recurring.findMany({
        where: { userId },
        select: {
          id: true,
          type: true,
          amountCents: true,
          currency: true,
          exchangeRate: true,
          anchorCurrency: true,
          startMonth: true,
          deletedFrom: true,
          frequency: true,
          chainId: true,
          sourceChainId: true,
          sourceMovementId: true,
          sourceInstallmentGroupId: true,
          formulaOperator: true,
          formulaOperand: true,
          formulaSign: true,
          categoryId: true,
          category: {
            select: {
              name: true,
              color: true,
              scope: true,
            },
          },
        },
      }),
      this.prisma.recurringSkip.findMany({
        where: { recurring: { userId } },
        select: { recurringId: true, month: true },
      }),
    ]);

    const skipMap = new Map<string, Set<string>>();
    for (const s of allSkips) {
      if (!skipMap.has(s.recurringId)) {
        skipMap.set(s.recurringId, new Set<string>());
      }
      skipMap.get(s.recurringId)!.add(s.month);
    }

    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      amountCents: r.amountCents,
      currency: r.currency,
      exchangeRate: Number(r.exchangeRate),
      anchorCurrency: r.anchorCurrency,
      startMonth: r.startMonth,
      deletedFrom: r.deletedFrom,
      frequency: r.frequency,
      skippedMonths: skipMap.get(r.id) ?? new Set<string>(),
      categoryId: r.categoryId,
      categoryName: r.category.name,
      categoryColor: r.category.color,
      categoryScope: r.category.scope as string,
      chainId: r.chainId,
      sourceChainId: r.sourceChainId,
      sourceMovementId: r.sourceMovementId,
      sourceInstallmentGroupId: r.sourceInstallmentGroupId,
      formulaOperator: r.formulaOperator,
      formulaOperand: r.formulaOperand,
      formulaSign: r.formulaSign,
    }));
  }

  /**
   * Devuelve todos los grupos de cuotas del usuario para la proyección anual.
   */
  async getAllCuotasForAnnual(
    userId: string,
  ): Promise<InstallmentGroupForAnnual[]> {
    const rows = await this.prisma.installmentGroup.findMany({
      where: { userId },
      select: {
        id: true,
        type: true,
        amountCents: true,
        currency: true,
        exchangeRate: true,
        anchorCurrency: true,
        totalInstallments: true,
        startMonth: true,
        categoryId: true,
        category: {
          select: {
            name: true,
            color: true,
            scope: true,
          },
        },
      },
    });

    return rows.map((g) => ({
      id: g.id,
      type: g.type,
      amountCents: g.amountCents,
      currency: g.currency,
      exchangeRate: Number(g.exchangeRate),
      anchorCurrency: g.anchorCurrency,
      totalInstallments: g.totalInstallments,
      startMonth: g.startMonth,
      categoryId: g.categoryId,
      categoryName: g.category.name,
      categoryColor: g.category.color,
      categoryScope: g.category.scope as string,
    }));
  }

  /**
   * Devuelve los Transactions con los ids dados (para la proyección anual de calculados de único).
   * Sin filtro de userId: los ids ya fueron validados en el service al crearlos.
   */
  async findTransactionsByIds(ids: string[]): Promise<Array<{
    id: string;
    amountCents: number;
    description: string | null;
    currency: Currency;
    exchangeRate: number;
    anchorCurrency: Currency;
  }>> {
    const rows = await this.prisma.transaction.findMany({
      where: { id: { in: ids } },
      select: { id: true, amountCents: true, description: true, currency: true, exchangeRate: true, anchorCurrency: true },
    });
    return rows.map((r) => ({
      id: r.id,
      amountCents: r.amountCents,
      description: r.description,
      currency: r.currency,
      exchangeRate: Number(r.exchangeRate),
      anchorCurrency: r.anchorCurrency,
    }));
  }

  /**
   * Devuelve los InstallmentGroups con los ids dados (para la proyección anual de calculados de cuota).
   * Sin filtro de userId: los ids ya fueron validados en el service al crearlos.
   */
  async findInstallmentGroupsByIds(ids: string[]): Promise<Array<{
    id: string;
    amountCents: number;
    totalInstallments: number;
    startMonth: string;
    currency: Currency;
    exchangeRate: number;
    anchorCurrency: Currency;
  }>> {
    const rows = await this.prisma.installmentGroup.findMany({
      where: { id: { in: ids } },
      select: { id: true, amountCents: true, totalInstallments: true, startMonth: true, currency: true, exchangeRate: true, anchorCurrency: true },
    });
    return rows.map((r) => ({
      id: r.id,
      amountCents: r.amountCents,
      totalInstallments: r.totalInstallments,
      startMonth: r.startMonth,
      currency: r.currency,
      exchangeRate: Number(r.exchangeRate),
      anchorCurrency: r.anchorCurrency,
    }));
  }

  /**
   * Devuelve el año más antiguo con movimientos del usuario.
   */
  async getEarliestYear(userId: string): Promise<number | null> {
    const rows = await this.prisma.$queryRaw<{ earliestYear: bigint | null }[]>`
      SELECT MIN(y) AS "earliestYear"
      FROM (
        SELECT EXTRACT(year FROM
          date_trunc('month', t."occurredAt" AT TIME ZONE t.timezone)
        )::int AS y
        FROM "Transaction" t
        WHERE t."userId" = ${userId}

        UNION ALL

        SELECT SUBSTRING(r."startMonth" FROM 1 FOR 4)::int AS y
        FROM "Recurring" r
        WHERE r."userId" = ${userId}

        UNION ALL

        SELECT SUBSTRING(ig."startMonth" FROM 1 FOR 4)::int AS y
        FROM "InstallmentGroup" ig
        WHERE ig."userId" = ${userId}
      ) sub
    `;

    const raw = rows[0]?.earliestYear;
    if (raw === null || raw === undefined) return null;
    return Number(raw);
  }

  // ---------------------------------------------------------------------------
  // Mappers privados
  // ---------------------------------------------------------------------------

  private mapRowToMovementItem(
    row: RawTransactionRow,
    displayCurrency: Currency = Currency.ARS,
    pivotRates: Partial<PivotRates> | null = null,
  ): MovementItem {
    const exchangeRate = Number(row.exchangeRate);
    const amountCents = Number(row.amountCents);
    const currency = row.currency as Currency;
    const anchorCurrency = row.anchorCurrency as Currency;
    const convertedAmountCents = convertToDisplayCurrency(
      amountCents,
      currency,
      exchangeRate,
      anchorCurrency,
      displayCurrency,
      pivotRates,
    );
    return {
      id: row.id,
      origin: 'unico',
      type: row.type as MovementType,
      amountCents,
      convertedAmountCents,
      currency,
      exchangeRate,
      description: row.description,
      occurredAt: row.occurredAt,
      timezone: row.timezone,
      category: {
        id: row.categoryId,
        name: row.categoryName,
        color: row.categoryColor,
        scope: row.categoryScope as CategoryScope,
      },
      installment: null,
      frequency: null,
      skipped: false,
      calculated: null,
      hasCalculated: false,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers de cálculo de mes (YYYY-MM) — exportados para uso en tests
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helper de frecuencia (P2 — Fase 1.1.1)
// ---------------------------------------------------------------------------

/**
 * Devuelve el step (en meses) correspondiente a cada RecurringFrequency.
 */
export function frequencyStep(frequency: RecurringFrequency): number {
  switch (frequency) {
    case RecurringFrequency.MONTHLY:    return 1;
    case RecurringFrequency.BIMONTHLY:  return 2;
    case RecurringFrequency.QUARTERLY:  return 3;
    case RecurringFrequency.BIANNUAL:   return 6;
    case RecurringFrequency.ANNUAL:     return 12;
  }
}

/**
 * Devuelve true si el fijo aparece en el mes dado según su frecuencia.
 */
export function isOnFrequency(
  startMonth: string,
  frequency: RecurringFrequency,
  month: string,
): boolean {
  const diff = monthDiff(startMonth, month);
  const step = frequencyStep(frequency);
  return diff % step === 0;
}

/**
 * Suma N meses a un string YYYY-MM con rollover de año correcto.
 */
export function addMonths(yyyyMM: string, n: number): string {
  const [yearStr, monthStr] = yyyyMM.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) - 1; // 0-based

  month += n;

  year += Math.floor(month / 12);
  month = month % 12;
  if (month < 0) {
    month += 12;
    year -= 1;
  }

  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/**
 * Calcula la diferencia en meses entre dos strings YYYY-MM (b - a).
 */
export function monthDiff(a: string, b: string): number {
  const [yearA, monthA] = a.split('-').map(Number);
  const [yearB, monthB] = b.split('-').map(Number);
  return (yearB - yearA) * 12 + (monthB - monthA);
}
