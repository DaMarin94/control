/**
 * Tipos del dominio de Simulación de categoría — /simulations.
 * Reflejan el contrato de la API del backend (Módulo 3.15, RF-SIM-001..004,
 * RN-028/029). No hay paquete de tipos compartido con el backend — el
 * frontend define los suyos.
 *
 * Ver docs/design.md, "Simulación de categoría (`/mes`)" y
 * docs/requirements.md RF-SIM-001..004 / RN-028/029.
 */

import type { CategoryScope } from "@/types/category";

/** Categoría embebida en una simulación — mismo shape mínimo que el resto de los módulos de movimiento. */
export interface SimulationCategory {
  id: string;
  name: string;
  color: string;
  scope: CategoryScope;
}

/**
 * Simulación de categoría activa — GET /simulations, POST /simulations. El
 * tramo es PROPIO de cada simulación (docs/design.md §0, cambio 1): ya no
 * existe un `horizonEndMonth` único a nivel respuesta.
 */
export interface SimulationDto {
  id: string;
  categoryId: string;
  category: SimulationCategory;
  /** 0..12 — meses CON movimientos únicos de la categoría en la ventana histórica vigente (RN-028). */
  monthsWithData: number;
  /**
   * `true` = la categoría cayó por debajo del mínimo de 3 meses con datos
   * (RF-SIM-002): la simulación sigue viva y es eliminable, pero deja de
   * derivar movimientos simulados hasta que vuelva a alcanzar el mínimo.
   */
  paused: boolean;
  /** "YYYY-MM" — mes desde el que se CREÓ la simulación. Ya clampeado a la fecha de creación (nunca un mes pasado en ese momento); no cambia nunca. */
  startMonth: string;
  /** "YYYY-MM" — arranque EFECTIVO del tramo en esta lectura: `max(startMonth, mes en curso)`. */
  effectiveStartMonth: string;
  /** "YYYY-MM" — fin del tramo (persistido al crear, no derivado en lectura). */
  endMonth: string;
  createdAt: string;
}

/** GET /simulations — solo simulaciones ACTIVAS del usuario. El tramo va por simulación (ver `SimulationDto`). */
export interface SimulationsListResponse {
  simulations: SimulationDto[];
}

/** Candidata del selector "Simular categoría" (RF-SIM-001) — GET /simulations/candidates. */
export interface SimulationCandidate {
  categoryId: string;
  name: string;
  color: string;
  /** 0..12 — meses CON únicos de la categoría en la ventana histórica vigente. */
  monthsWithData: number;
  /** `true` = ya tiene una simulación activa (a lo sumo una por categoría). */
  alreadySimulated: boolean;
}

/**
 * GET /simulations/candidates — universo = catálogo de categorías ACTIVAS del
 * usuario. `startMonth`/`endMonth`: el tramo que TENDRÍA un lote creado desde
 * el `startMonth` pedido por query (ya clampeado) — reemplaza al
 * `horizonEndMonth` único de antes.
 */
export interface SimulationCandidatesResponse {
  startMonth: string;
  endMonth: string;
  categories: SimulationCandidate[];
}

/**
 * Body de POST /simulations — batch: 1 o más categorías, sin ids duplicados
 * (400 si vacío o con duplicados). `startMonth` (opcional, "YYYY-MM"): mes
 * desde el que se crea el LOTE — se aplica a todas las categorías del batch;
 * ausente = mes en curso. Nunca revive un mes pasado (el backend clampea).
 */
export interface CreateSimulationRequest {
  categoryIds: string[];
  startMonth?: string;
}

/** Fallo de una categoría puntual dentro del batch — `message` ya viene legible del backend (mismo texto que hoy en 400/409). */
export interface CreateSimulationFailure {
  categoryId: string;
  message: string;
}

/** 201 SIEMPRE (incluso si fallaron todas): POST /simulations con desenlace mixto tolerado. */
export interface CreateSimulationBatchResponse {
  created: SimulationDto[];
  failed: CreateSimulationFailure[];
}
