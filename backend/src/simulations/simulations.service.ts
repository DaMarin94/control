import {
  BadRequestException,
  ConflictException,
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
  buildWindowMonths,
  computeHorizonEndMonth,
  MIN_MONTHS_WITH_DATA,
  resolveTodayMonthKey,
} from './simulation-window.helper';
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
  /** "YYYY-MM" — último mes del horizonte vigente (RN-028), igual para todas las simulaciones. */
  horizonEndMonth: string;
  simulations: SimulationDto[];
}

export interface SimulationCandidatesResponse {
  horizonEndMonth: string;
  categories: SimulationCandidateDto[];
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

  async create(userId: string, categoryId: string, today?: string): Promise<SimulationDto> {
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
      simulation = await this.repo.create(userId, categoryId);
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
      { userId, simulationId: simulation.id, categoryId },
      'Simulación de categoría creada',
    );

    return {
      id: simulation.id,
      categoryId,
      category,
      monthsWithData,
      paused: false,
      createdAt: simulation.createdAt.toISOString(),
    };
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
  // GET /simulations — listado + estado (RF-SIM-004, contrato de control-design)
  // ---------------------------------------------------------------------------

  async findAll(userId: string, today?: string): Promise<SimulationsListResponse> {
    const todayMonthKey = resolveTodayMonthKey(today);
    const horizonEndMonth = computeHorizonEndMonth(todayMonthKey);

    const [userSimulations, userSettings] = await Promise.all([
      this.repo.findAllForUser(userId),
      this.settingsService.getSettings(userId),
    ]);

    if (userSimulations.length === 0) {
      return { horizonEndMonth, simulations: [] };
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
        createdAt: sim.createdAt.toISOString(),
      };
    });

    return { horizonEndMonth, simulations };
  }

  // ---------------------------------------------------------------------------
  // GET /simulations/candidates — universo con motivos (RF-SIM-001, contrato de control-design)
  // ---------------------------------------------------------------------------

  async findCandidates(userId: string, today?: string): Promise<SimulationCandidatesResponse> {
    const todayMonthKey = resolveTodayMonthKey(today);
    const horizonEndMonth = computeHorizonEndMonth(todayMonthKey);
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

    return { horizonEndMonth, categories };
  }

  // ---------------------------------------------------------------------------
  // Consumido por MovementsService — derivación on-the-fly (RF-SIM-002/003)
  // ---------------------------------------------------------------------------

  /**
   * Movimientos simulados a embeber en la sección Únicos de `GET /movements`
   * para el `month` pedido. `[]` si el mes no es futuro, cae fuera del
   * horizonte, o no hay ninguna simulación activa/elegible que aporte ese mes
   * (RF-SIM-002/003). Nunca genera filas: todo se calcula al vuelo.
   */
  async getSimulatedItemsForMonth(
    userId: string,
    month: string,
    today?: string,
  ): Promise<MovementItem[]> {
    const todayMonthKey = resolveTodayMonthKey(today);

    // El mes en curso y los pasados NUNCA se simulan (RN-028).
    if (month <= todayMonthKey) return [];

    const horizonEndMonth = computeHorizonEndMonth(todayMonthKey);
    if (month > horizonEndMonth) return [];

    const userSimulations = await this.repo.findAllForUser(userId);
    if (userSimulations.length === 0) return [];

    const userSettings = await this.settingsService.getSettings(userId);
    const displayCurrency = userSettings.defaultCurrency;
    const windowMonths = buildWindowMonths(todayMonthKey);

    const [data, categories] = await Promise.all([
      this.loadCategoryMonthlyData(userId, windowMonths, displayCurrency),
      this.repo.findCategoriesByIds(userSimulations.map((s) => s.categoryId)),
    ]);
    const categoryById = new Map(categories.map((c) => [c.id, c]));

    const position = axisPositionFor(todayMonthKey, month);
    const items: MovementItem[] = [];

    for (const sim of userSimulations) {
      const catData = data.get(sim.categoryId);
      const monthsWithData = catData?.monthsWithData.size ?? 0;
      // Simulación pausada (RN-028): cayó por debajo del mínimo, no deriva sin eliminarse.
      if (monthsWithData < MIN_MONTHS_WITH_DATA) continue;

      const monthlyTotals = windowMonths.map((m) => catData?.totalsByMonth.get(m) ?? 0);
      const fit = fitCategoryRegression(monthlyTotals);
      const rawValue = evaluateRegressionAt(fit, position);
      const roundedCents = Math.round(rawValue);
      // Redondea a 0 centavos → no genera movimiento simulado ese mes (RF-SIM-002).
      if (roundedCents === 0) continue;

      const category = categoryById.get(sim.categoryId) ?? this.fallbackCategory(sim.categoryId);
      const magnitude = Math.abs(roundedCents);
      // Signo del valor proyectado define la dirección (RN-028): negativo → gasto, positivo → ingreso.
      const type: MovementType = roundedCents > 0 ? MovementType.INCOME : MovementType.EXPENSE;

      items.push({
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

    return items;
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
}
