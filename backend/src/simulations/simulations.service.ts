import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoryScope, Currency, MovementType, Prisma } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import {
  RawSimulationUnicoRow,
  SimulationCategoryEmbed,
  SimulationsRepository,
} from './simulations.repository';
import {
  axisPositionFor,
  buildMonthRange,
  buildWindowMonths,
  computeHorizonEndMonth,
  effectiveStartMonth,
  MIN_MONTHS_WITH_DATA,
  resolveTodayMonthKey,
} from './simulation-window.helper';
import { addMonths } from '../common/month.helper';
import { fitCategoryRegression, evaluateRegressionAt } from '../common/projection.helper';
import { convertToDisplayCurrency } from '../common/currency.helper';
import { CategoryValidatorService } from '../categories/category-validator.service';
import { CategoriesService } from '../categories/categories.service';
import { SettingsService } from '../settings/settings.service';
import { ReferenceRatesService } from '../settings/reference-rates.service';
import { MovementItem } from '../movements/movements.repository';

export interface SimulationDto {
  id: string;
  categoryId: string;
  category: SimulationCategoryEmbed;
  /** 0..12 — meses CON únicos de la categoría en la ventana histórica vigente (RN-028). */
  monthsWithData: number;
  /** true ⇔ cayó por debajo del mínimo de 3 meses (RF-SIM-002) — dejó de derivar movimientos sin eliminarse. */
  paused: boolean;
  /** "YYYY-MM" — mes desde el que se CREÓ la simulación. Crudo, ya clampeado (nunca un mes pasado a la fecha de creación); no cambia nunca. */
  startMonth: string;
  /**
   * "YYYY-MM" — arranque EFECTIVO del tramo en esta lectura: `max(startMonth, mes en curso)`.
   * `startMonth` no revive meses pasados si el mes en curso ya lo dejó atrás.
   */
  effectiveStartMonth: string;
  /** "YYYY-MM" — fin del tramo (PERSISTIDO al crear, no derivado en lectura). */
  endMonth: string;
  createdAt: string;
}

export interface SimulationCandidateDto {
  categoryId: string;
  name: string;
  color: string;
  monthsWithData: number;
  alreadySimulated: boolean;
}

export interface SimulationsListResponse {
  simulations: SimulationDto[];
}

export interface SimulationCandidatesResponse {
  /** "YYYY-MM" — tramo que TENDRÍA una simulación creada desde `startMonth` (query param), ya clampeado. */
  startMonth: string;
  /** "YYYY-MM" — fin de ese tramo hipotético (para la nota "Alcanza hasta {Mes}"). */
  endMonth: string;
  categories: SimulationCandidateDto[];
}

/** Un `categoryId` que no pudo simularse en una creación batch (`createMany`), con el mensaje legible del error. */
export interface SimulationCreationFailure {
  categoryId: string;
  message: string;
}

/**
 * Resultado de `POST /simulations` con VARIAS categorías (fallo parcial
 * tolerado, sin transacción atómica): `created` trae una `SimulationDto` por
 * categoría que se pudo crear, `failed` una entrada por categoría que no.
 */
export interface CreateSimulationsResponse {
  created: SimulationDto[];
  failed: SimulationCreationFailure[];
}

/** Datos mensuales de una categoría dentro de la ventana histórica. */
interface CategoryMonthlyData {
  /** Meses (YYYY-MM) con ≥1 único de la categoría (RN-028 — "meses con únicos"). */
  monthsWithData: Set<string>;
  /** Total mensual CON SIGNO, ya convertido a la moneda default vigente. */
  totalsByMonth: Map<string, number>;
}

/**
 * SimulationsService — Módulo 3.15 (Simulación de categoría), RF-SIM-001..004.
 *
 * Persiste SOLO la configuración (usuario + categoría, RN-029). El monto y la
 * dirección del movimiento simulado se derivan on-the-fly en cada lectura
 * (RF-SIM-002/RN-028) — no hay ningún job ni caché: `getSimulatedItemsForMonth`
 * es la API pública que consume `MovementsService` para embeber la fila
 * sintética en `GET /movements` (propiedad de dominio: Movements nunca toca
 * el repositorio de Simulations directamente).
 *
 * Dependencia UNIDIRECCIONAL Movements → Simulations (nunca al revés) para
 * evitar un ciclo de módulos: este service necesita agregaciones de
 * `Transaction` (serie de ajuste de la regresión), que lee DIRECTO por su
 * propio repositorio (mismo precedente que `MovementsRepository`, que ya
 * bypasea `TransactionsService` por el mismo motivo — ver docs/backend.md,
 * §Movimientos del mes → "Por qué un módulo propio").
 */
@Injectable()
export class SimulationsService {
  constructor(
    private readonly repo: SimulationsRepository,
    private readonly categoryValidator: CategoryValidatorService,
    private readonly categoriesService: CategoriesService,
    private readonly settingsService: SettingsService,
    private readonly referenceRatesService: ReferenceRatesService,
    private readonly logger: Logger,
  ) {}

  // ---------------------------------------------------------------------------
  // POST /simulations — RF-SIM-001
  // ---------------------------------------------------------------------------

  async create(
    userId: string,
    categoryId: string,
    today?: string,
    startMonthInput?: string,
  ): Promise<SimulationDto> {
    // Categoría propia, activa (existe/ajena/eliminada → 400, mismo criterio no
    // revelador que el resto de los movimientos — RN-010-like). skipScopeCheck=true:
    // la simulación no tiene un `type` fijo, su dirección la decide el cálculo
    // mes a mes (RN-028), así que cualquier scope de categoría es válido.
    await this.categoryValidator.validateCategory(userId, categoryId, MovementType.EXPENSE, true);

    const existing = await this.repo.findByCategory(userId, categoryId);
    if (existing) {
      throw new ConflictException('Ya tenés una simulación para esta categoría');
    }

    const userSettings = await this.settingsService.getSettings(userId);
    const todayMonthKey = resolveTodayMonthKey(today);
    // Tramo propio de esta simulación: nunca un mes pasado (clamp contra el
    // mes en curso) y persistido de una — la ventana histórica de abajo sigue
    // ancladas a "hoy", no al startMonth (no cambia con esta feature).
    const startMonth = effectiveStartMonth(startMonthInput ?? todayMonthKey, todayMonthKey);
    const endMonth = computeHorizonEndMonth(startMonth);
    const windowMonths = buildWindowMonths(todayMonthKey);
    const data = await this.loadCategoryMonthlyData(userId, windowMonths, userSettings.defaultCurrency);
    const monthsWithData = data.get(categoryId)?.monthsWithData.size ?? 0;

    if (monthsWithData < MIN_MONTHS_WITH_DATA) {
      throw new BadRequestException(
        `La categoría necesita al menos ${MIN_MONTHS_WITH_DATA} meses con movimientos únicos en los últimos 12 meses (tiene ${monthsWithData})`,
      );
    }

    let simulation;
    try {
      simulation = await this.repo.create(userId, categoryId, startMonth, endMonth);
    } catch (err) {
      // Red de seguridad contra el índice único PARCIAL de la DB (RF-SIM-001):
      // el chequeo `findByCategory` de arriba ya cubre el caso normal;
      // esto solo blinda una carrera concurrente.
      if (this.isUniqueConstraintError(err)) {
        throw new ConflictException('Ya tenés una simulación para esta categoría');
      }
      throw err;
    }

    const [category] = await this.repo.findCategoriesByIds([categoryId]);

    this.logger.log(
      { userId, simulationId: simulation.id, categoryId, startMonth, endMonth },
      'Simulación de categoría creada',
    );

    return {
      id: simulation.id,
      categoryId,
      category,
      monthsWithData,
      paused: false,
      startMonth,
      // Recién creada: el arranque efectivo coincide siempre con el startMonth
      // persistido (ya viene clampeado contra "hoy").
      effectiveStartMonth: startMonth,
      endMonth,
      createdAt: simulation.createdAt.toISOString(),
    };
  }

  /**
   * `POST /simulations` con VARIAS categorías, fallo parcial tolerado, SIN
   * transacción atómica: cada `categoryId` se procesa por separado con el
   * `create()` de arriba (mismas validaciones, mismos mensajes legibles) y
   * que uno falle no voltea a los demás. Se procesa SECUENCIAL (no
   * `Promise.all`) para que un duplicado dentro del mismo request se resuelva
   * de forma determinística: la primera ocurrencia crea, la segunda encuentra
   * la recién creada y cae en el mismo `409` de "ya tenés una simulación para
   * esta categoría" — sin esto, correr en paralelo dejaría el resultado del
   * duplicado a una carrera.
   */
  async createMany(
    userId: string,
    categoryIds: string[],
    today?: string,
    startMonth?: string,
  ): Promise<CreateSimulationsResponse> {
    const created: SimulationDto[] = [];
    const failed: SimulationCreationFailure[] = [];

    for (const categoryId of categoryIds) {
      try {
        created.push(await this.create(userId, categoryId, today, startMonth));
      } catch (err) {
        failed.push({ categoryId, message: this.extractErrorMessage(err) });
      }
    }

    return { created, failed };
  }

  // ---------------------------------------------------------------------------
  // DELETE /simulations/:id — RF-SIM-004
  // ---------------------------------------------------------------------------

  /**
   * Borrado FÍSICO (RF-SIM-004): esta especie no participa del historial de
   * cambios y no es deshacible — a diferencia de único/fijo/cuota.
   */
  async remove(userId: string, id: string): Promise<void> {
    const simulation = await this.repo.findById(id);
    if (!simulation || simulation.userId !== userId) {
      throw new NotFoundException('Simulación no encontrada');
    }

    await this.repo.delete(id);

    this.logger.log({ userId, simulationId: id }, 'Simulación de categoría eliminada');
  }

  // ---------------------------------------------------------------------------
  // PATCH /simulations/:id/extend — RF-SIM (extender tramo)
  // ---------------------------------------------------------------------------

  /**
   * Corre el `endMonth` de una simulación `months` meses hacia adelante
   * (RF-SIM). `startMonth` NUNCA se toca — el ancla de la simulación no
   * cambia, solo su fin. A diferencia del alta, el nuevo `endMonth` es una
   * suma directa (`addMonths`): no se vuelve a aplicar `computeHorizonEndMonth`
   * (esa regla es solo del alta), no hay clamp contra el mes en curso ni tope
   * superior. No genera entrada de historial (RF-SIM-004, misma excepción que
   * crear/eliminar).
   */
  async extend(userId: string, id: string, months: number, today?: string): Promise<SimulationDto> {
    const simulation = await this.repo.findById(id);
    if (!simulation || simulation.userId !== userId) {
      throw new NotFoundException('Simulación no encontrada');
    }

    const newEndMonth = addMonths(simulation.endMonth, months);
    const updated = await this.repo.updateEndMonth(id, newEndMonth);

    const todayMonthKey = resolveTodayMonthKey(today);
    const windowMonths = buildWindowMonths(todayMonthKey);
    const [userSettings, [category]] = await Promise.all([
      this.settingsService.getSettings(userId),
      this.repo.findCategoriesByIds([updated.categoryId]),
    ]);

    const monthlyData = await this.loadCategoryMonthlyData(userId, windowMonths, userSettings.defaultCurrency);
    const monthsWithData = monthlyData.get(updated.categoryId)?.monthsWithData.size ?? 0;

    this.logger.log(
      { userId, simulationId: id, months, endMonth: updated.endMonth },
      'Simulación de categoría extendida',
    );

    return {
      id: updated.id,
      categoryId: updated.categoryId,
      category: category ?? this.fallbackCategory(updated.categoryId),
      monthsWithData,
      paused: monthsWithData < MIN_MONTHS_WITH_DATA,
      startMonth: updated.startMonth,
      effectiveStartMonth: effectiveStartMonth(updated.startMonth, todayMonthKey),
      endMonth: updated.endMonth,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // GET /simulations — listado + estado (RF-SIM-004, contrato de control-design)
  // ---------------------------------------------------------------------------

  async findAll(userId: string, today?: string): Promise<SimulationsListResponse> {
    const todayMonthKey = resolveTodayMonthKey(today);

    const [userSimulations, userSettings] = await Promise.all([
      this.repo.findAllForUser(userId),
      this.settingsService.getSettings(userId),
    ]);

    if (userSimulations.length === 0) {
      return { simulations: [] };
    }

    const windowMonths = buildWindowMonths(todayMonthKey);
    const [data, categories] = await Promise.all([
      this.loadCategoryMonthlyData(userId, windowMonths, userSettings.defaultCurrency),
      this.repo.findCategoriesByIds(userSimulations.map((s) => s.categoryId)),
    ]);
    const categoryById = new Map(categories.map((c) => [c.id, c]));

    const simulations: SimulationDto[] = userSimulations.map((sim) => {
      const monthsWithData = data.get(sim.categoryId)?.monthsWithData.size ?? 0;
      return {
        id: sim.id,
        categoryId: sim.categoryId,
        category: categoryById.get(sim.categoryId) ?? this.fallbackCategory(sim.categoryId),
        monthsWithData,
        paused: monthsWithData < MIN_MONTHS_WITH_DATA,
        startMonth: sim.startMonth,
        effectiveStartMonth: effectiveStartMonth(sim.startMonth, todayMonthKey),
        endMonth: sim.endMonth,
        createdAt: sim.createdAt.toISOString(),
      };
    });

    return { simulations };
  }

  // ---------------------------------------------------------------------------
  // GET /simulations/candidates — universo con motivos (RF-SIM-001, contrato de control-design)
  // ---------------------------------------------------------------------------

  async findCandidates(
    userId: string,
    today?: string,
    startMonthInput?: string,
  ): Promise<SimulationCandidatesResponse> {
    const todayMonthKey = resolveTodayMonthKey(today);
    // Tramo HIPOTÉTICO: el que resultaría de crear desde `startMonthInput`
    // (mismo clamp/fórmula que `create()`, sin persistir nada).
    const startMonth = effectiveStartMonth(startMonthInput ?? todayMonthKey, todayMonthKey);
    const endMonth = computeHorizonEndMonth(startMonth);
    const windowMonths = buildWindowMonths(todayMonthKey);

    const [activeCategories, userSimulations, userSettings] = await Promise.all([
      // RF-SIM-001: universo = catálogo de categorías ACTIVAS (las eliminadas no se ofrecen).
      this.categoriesService.findAll(userId),
      this.repo.findAllForUser(userId),
      this.settingsService.getSettings(userId),
    ]);

    const simulatedCategoryIds = new Set(userSimulations.map((s) => s.categoryId));
    const data = await this.loadCategoryMonthlyData(userId, windowMonths, userSettings.defaultCurrency);

    // Orden = el del catálogo (CategoriesService.findAll ya ordena por nombre ASC);
    // no se reagrupa por elegibilidad (ver docs/design.md — "las deshabilitadas no se mandan al fondo").
    const categories: SimulationCandidateDto[] = activeCategories.map((cat) => ({
      categoryId: cat.id,
      name: cat.name,
      color: cat.color,
      monthsWithData: data.get(cat.id)?.monthsWithData.size ?? 0,
      alreadySimulated: simulatedCategoryIds.has(cat.id),
    }));

    return { startMonth, endMonth, categories };
  }

  // ---------------------------------------------------------------------------
  // Consumido por MovementsService — derivación on-the-fly (RF-SIM-002/003/RF-REP-017)
  // ---------------------------------------------------------------------------

  /**
   * Movimientos simulados a embeber en la sección Únicos de `GET /movements`
   * para el `month` pedido. `[]` si el mes es PASADO, cae fuera del tramo de
   * TODAS las simulaciones del usuario (cada una tiene el suyo — RN-028/RN-029),
   * o no hay ninguna simulación activa/elegible que aporte ese mes
   * (RF-SIM-002/003). El mes EN CURSO sí puede llevar simulado si cae dentro
   * del tramo de alguna (ver `getSimulatedItemsForMonths`). Nunca genera
   * filas: todo se calcula al vuelo.
   *
   * Wrapper de un solo mes sobre `getSimulatedItemsForMonths` (ver ahí el
   * detalle del cálculo). `displayCurrencyOverride` — RF-REP-017: moneda de
   * display de la card de reporte que consume el dato; ausente = moneda
   * default del usuario (comportamiento histórico de `GET /movements`).
   */
  async getSimulatedItemsForMonth(
    userId: string,
    month: string,
    today?: string,
    displayCurrencyOverride?: Currency,
  ): Promise<MovementItem[]> {
    const byMonth = await this.getSimulatedItemsForMonths(
      userId,
      [month],
      today,
      displayCurrencyOverride,
    );
    return byMonth.get(month) ?? [];
  }

  /**
   * Variante batch de `getSimulatedItemsForMonth`, para `GET /movements/reports`
   * (RF-REP-017): carga la historia de la ventana [A-12..A-1] UNA sola vez y
   * evalúa la regresión de cada simulación en cada mes pedido, en vez de
   * repetir la carga por mes (evita N round-trips redundantes al recorrer un
   * año completo). Misma semántica que la variante de un solo mes: un mes
   * PASADO nunca se evalúa (queda `[]` en el mapa de salida) para NINGUNA
   * simulación; un mes que cae fuera del TRAMO PROPIO de una simulación
   * (`[arranque efectivo..endMonth]`, RN-028/RN-029 — cada simulación tiene el
   * suyo, ya no hay un horizonte único) no la incluye a ELLA, pero sí puede
   * incluir a otra simulación cuyo tramo sí la cubra. Una simulación pausada
   * (RN-028) no aporta a ningún mes. El mes EN CURSO arranca el tramo (nunca
   * antes) y sí se evalúa si cae dentro (ver más abajo — remanente).
   *
   * El monto de CADA mes del horizonte (incluido el en curso) es un
   * REMANENTE, no el valor crudo de la regresión: `remanente = proyección(mes)
   * − total real con signo de únicos de esa categoría en ese mes`. El total
   * real se carga con el MISMO criterio que la serie histórica (sin anulados
   * ni eliminados, convertido con la cotización propia de cada único vía el
   * TC del mes de ESE único) — reusa `loadCategoryMonthlyData` sobre el rango
   * del horizonte, en UNA sola query adicional (no una por mes). Un mes futuro
   * puede tener únicos reales ya cargados y el remanente los descuenta igual.
   * Si el remanente redondea a 0 centavos, o cambia de signo respecto de la
   * proyección (el real "se pasó" en la dirección contraria), no se emite fila
   * ese mes (decisión de producto — ver `docs/backend.md`).
   *
   * Devuelve un `Map` con TODAS las claves de `months` presentes (incluso las
   * que no calificaron, con `[]`), para que el caller pueda indexar sin
   * chequear presencia.
   */
  async getSimulatedItemsForMonths(
    userId: string,
    months: string[],
    today?: string,
    displayCurrencyOverride?: Currency,
  ): Promise<Map<string, MovementItem[]>> {
    const result = new Map<string, MovementItem[]>();
    for (const m of months) result.set(m, []);

    const todayMonthKey = resolveTodayMonthKey(today);

    // Los meses PASADOS nunca se simulan (RN-028, no cambia) — se descartan
    // antes de cualquier acceso a datos. El límite superior YA NO es global:
    // cada simulación tiene su propio tramo (`[arranque efectivo..endMonth]`),
    // filtrado más abajo por simulación.
    const targetMonths = months.filter((m) => m >= todayMonthKey);
    if (targetMonths.length === 0) return result;

    const userSimulations = await this.repo.findAllForUser(userId);
    if (userSimulations.length === 0) return result;

    const userSettings = await this.settingsService.getSettings(userId);
    const displayCurrency = displayCurrencyOverride ?? userSettings.defaultCurrency;
    const windowMonths = buildWindowMonths(todayMonthKey);

    // Rango de datos reales a cargar = la UNIÓN de los tramos vigentes de
    // todas las simulaciones, intersecada con `targetMonths` — se reduce a un
    // min/max porque `loadCategoryMonthlyData` solo usa los extremos para
    // acotar su query (rango contiguo, UNA sola consulta; cargar de más entre
    // medio es inofensivo, cargar por simulación o por mes no lo sería —
    // dejaría de ser O(1) por llamada).
    let realRangeMin: string | null = null;
    let realRangeMax: string | null = null;
    for (const sim of userSimulations) {
      const simEffectiveStart = effectiveStartMonth(sim.startMonth, todayMonthKey);
      for (const m of targetMonths) {
        if (m < simEffectiveStart || m > sim.endMonth) continue;
        if (realRangeMin === null || m < realRangeMin) realRangeMin = m;
        if (realRangeMax === null || m > realRangeMax) realRangeMax = m;
      }
    }
    // Ninguna simulación aporta a ninguno de los meses pedidos (todas
    // vencidas, o sus tramos no cubren `targetMonths`).
    if (realRangeMin === null || realRangeMax === null) return result;

    // Dos cargas separadas, cada una UNA sola query: la ventana histórica
    // [A-12..A-1] (serie de ajuste de la regresión + monthsWithData/paused) y
    // el rango de la unión de tramos (reales a descontar del remanente). No se
    // fusionan en una sola llamada porque `loadCategoryMonthlyData` acumula
    // TODO lo que devuelve la query en `monthsWithData`/`totalsByMonth` —
    // mezclar rangos inflaría el conteo de "meses con dato" de la ventana
    // histórica con meses del horizonte.
    const realDataMonths = buildMonthRange(realRangeMin, realRangeMax);
    const [historyData, realData, categories] = await Promise.all([
      this.loadCategoryMonthlyData(userId, windowMonths, displayCurrency),
      this.loadCategoryMonthlyData(userId, realDataMonths, displayCurrency),
      this.repo.findCategoriesByIds(userSimulations.map((s) => s.categoryId)),
    ]);
    const categoryById = new Map(categories.map((c) => [c.id, c]));

    for (const sim of userSimulations) {
      const catData = historyData.get(sim.categoryId);
      const monthsWithData = catData?.monthsWithData.size ?? 0;
      // Simulación pausada (RN-028): cayó por debajo del mínimo, no deriva sin eliminarse.
      if (monthsWithData < MIN_MONTHS_WITH_DATA) continue;

      const monthlyTotals = windowMonths.map((m) => catData?.totalsByMonth.get(m) ?? 0);
      const fit = fitCategoryRegression(monthlyTotals);
      const category = categoryById.get(sim.categoryId) ?? this.fallbackCategory(sim.categoryId);
      const realTotalsByMonth = realData.get(sim.categoryId)?.totalsByMonth;
      const simEffectiveStart = effectiveStartMonth(sim.startMonth, todayMonthKey);

      for (const month of targetMonths) {
        // Pertenencia POR SIMULACIÓN (RN-028/RN-029): fuera de su propio tramo
        // (arranque efectivo..endMonth), esta simulación no aporta a este mes
        // — pero otra simulación con un tramo distinto sí puede.
        if (month < simEffectiveStart || month > sim.endMonth) continue;

        const position = axisPositionFor(todayMonthKey, month);
        const projectedRaw = evaluateRegressionAt(fit, position);
        const realSigned = realTotalsByMonth?.get(month) ?? 0;
        // Remanente (decisión de producto): la proyección se ajusta por lo que
        // ya ocurrió realmente ese mes en la categoría, con signo.
        const remnantRaw = projectedRaw - realSigned;
        const roundedCents = Math.round(remnantRaw);
        // Redondea a 0 centavos → no genera movimiento simulado ese mes (RN-002/RF-SIM-002).
        if (roundedCents === 0) continue;

        // Cancelación: el remanente solo se emite si coincide con el signo de
        // la proyección. Si el real "se pasó" y dio vuelta el signo (ej.
        // proyección de gasto, pero el real ya gastó de más), no se emite fila
        // — no se convierte un gasto proyectado en un ingreso simulado.
        const projectionSign = Math.sign(projectedRaw);
        const remnantSign = Math.sign(roundedCents);
        if (remnantSign !== projectionSign) continue;

        const magnitude = Math.abs(roundedCents);
        // Signo del remanente define la dirección: negativo → gasto, positivo → ingreso.
        const type: MovementType = roundedCents > 0 ? MovementType.INCOME : MovementType.EXPENSE;

        result.get(month)!.push({
          id: `simulated:${sim.id}:${month}`,
          origin: 'unico',
          type,
          amountCents: magnitude,
          convertedAmountCents: magnitude,
          currency: displayCurrency,
          exchangeRate: 1,
          description: null,
          occurredAt: null,
          timezone: null,
          category,
          paymentMethod: null,
          autoDebit: null,
          installment: null,
          frequency: null,
          startMonth: null,
          endMonth: null,
          chainId: null,
          skipped: false,
          calculated: null,
          hasCalculated: false,
          calculatedChildren: [],
          simulated: true,
        });
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Helpers privados
  // ---------------------------------------------------------------------------

  /**
   * Carga los totales mensuales CON SIGNO (ya convertidos a `displayCurrency`)
   * y los meses-con-dato, por categoría, dentro de la ventana `windowMonths`
   * (RN-028). Cada único se convierte con SU PROPIA cotización (RF-CUR-005),
   * vía el TC oficial del MES DE ESE único (no el de hoy) — mismo criterio que
   * `getAnnualUnicosAggregated` en `movements.repository.ts`.
   */
  private async loadCategoryMonthlyData(
    userId: string,
    windowMonths: string[],
    displayCurrency: Currency,
  ): Promise<Map<string, CategoryMonthlyData>> {
    const firstMonth = windowMonths[0];
    const lastMonth = windowMonths[windowMonths.length - 1];

    const [rows, pivotEntries] = await Promise.all([
      this.repo.getUnicosMonthlyTotalsByCategory(userId, firstMonth, lastMonth),
      Promise.all(
        windowMonths.map(
          async (m) => [m, await this.referenceRatesService.getPivotRatesForMonth(m)] as const,
        ),
      ),
    ]);
    const pivotByMonth = new Map(pivotEntries);

    const result = new Map<string, CategoryMonthlyData>();
    for (const row of rows as RawSimulationUnicoRow[]) {
      let entry = result.get(row.categoryId);
      if (!entry) {
        entry = { monthsWithData: new Set(), totalsByMonth: new Map() };
        result.set(row.categoryId, entry);
      }
      // Presencia (RN-028: "meses sin únicos... la ausencia es dato" — a la
      // inversa, un mes CON esta fila SÍ tiene únicos, aunque el neto sea 0).
      entry.monthsWithData.add(row.monthKey);

      const pivotRates = pivotByMonth.get(row.monthKey) ?? null;
      const magnitude = convertToDisplayCurrency(
        Number(row.totalCents),
        row.currency as Currency,
        Number(row.exchangeRate),
        row.anchorCurrency as Currency,
        displayCurrency,
        pivotRates,
      );
      const signed = row.type === 'INCOME' ? magnitude : -magnitude;
      entry.totalsByMonth.set(row.monthKey, (entry.totalsByMonth.get(row.monthKey) ?? 0) + signed);
    }
    return result;
  }

  private fallbackCategory(categoryId: string): SimulationCategoryEmbed {
    // Defensivo: no debería ocurrir (la FK Restrict impide el borrado físico
    // de una categoría referenciada). Evita un 500 si de todos modos pasara.
    return { id: categoryId, name: '', color: '', scope: CategoryScope.BOTH };
  }

  private isUniqueConstraintError(err: unknown): boolean {
    return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
  }

  /**
   * Mensaje legible de un fallo de `create()` dentro de `createMany` — el
   * mismo texto de `BadRequestException`/`ConflictException` que ya produce
   * el flujo de creación simple, por categoría (no un mensaje genérico).
   */
  private extractErrorMessage(err: unknown): string {
    if (err instanceof HttpException) {
      const response = err.getResponse();
      if (typeof response === 'string') return response;
      if (
        typeof response === 'object' &&
        response !== null &&
        'message' in response &&
        typeof (response as { message: unknown }).message === 'string'
      ) {
        return (response as { message: string }).message;
      }
      return err.message;
    }
    if (err instanceof Error) return err.message;
    return 'No se pudo crear la simulación';
  }
}
