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

/** Simulación de categoría activa — GET /simulations, POST /simulations. */
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
  createdAt: string;
}

/** GET /simulations — solo simulaciones ACTIVAS del usuario + horizonte vigente. */
export interface SimulationsListResponse {
  /** "YYYY-MM" — último mes del horizonte vigente (RN-028), igual para todas las simulaciones. */
  horizonEndMonth: string;
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

/** GET /simulations/candidates — universo = catálogo de categorías ACTIVAS del usuario. */
export interface SimulationCandidatesResponse {
  horizonEndMonth: string;
  categories: SimulationCandidate[];
}

/** Body de POST /simulations. */
export interface CreateSimulationRequest {
  categoryId: string;
}
