import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { SimulationsService } from './simulations.service';
import { CreateSimulationDto } from './dto/create-simulation.dto';

interface AuthRequest extends Request {
  user: { userId: string };
}

/**
 * SimulationsController — Módulo 3.15 (Simulación de categoría), RF-SIM-001..004.
 *
 * Todas las rutas están protegidas por JwtAuthGuard (global).
 * El userId se extrae SIEMPRE de request.user.userId (nunca del body/query).
 */
@Controller('simulations')
export class SimulationsController {
  constructor(private readonly simulationsService: SimulationsService) {}

  /**
   * GET /simulations[?today=YYYY-MM-DD]
   *
   * Lista las simulaciones del usuario, con `monthsWithData` (0..12, ventana
   * histórica vigente) y `paused` (RF-SIM-002 — cayó por debajo del mínimo de
   * 3 meses) por simulación, más `horizonEndMonth` (mismo para todas — RN-028).
   *
   * `today` (opcional): fecha local del usuario YYYY-MM-DD para resolver el
   * mes en curso ("A" de RN-028). Ausente → fecha UTC del sistema.
   */
  @Get()
  findAll(
    @Request() req: AuthRequest,
    @Query('today') todayParam: string | undefined,
  ) {
    const today = this.parseToday(todayParam);
    return this.simulationsService.findAll(req.user.userId, today);
  }

  /**
   * GET /simulations/candidates[?today=YYYY-MM-DD]
   *
   * Universo de categorías ACTIVAS del usuario (RF-SIM-001) con `monthsWithData`
   * y `alreadySimulated`, para el selector "Simular categoría". Más
   * `horizonEndMonth` (para la nota "Alcanza hasta {Mes}").
   */
  @Get('candidates')
  findCandidates(
    @Request() req: AuthRequest,
    @Query('today') todayParam: string | undefined,
  ) {
    const today = this.parseToday(todayParam);
    return this.simulationsService.findCandidates(req.user.userId, today);
  }

  /**
   * POST /simulations[?today=YYYY-MM-DD]
   * Body: { categoryId }
   *
   * Crea una simulación sobre una categoría (RF-SIM-001). `400` si la
   * categoría es inválida (inexistente/ajena/eliminada) o no llega al mínimo
   * de 3 meses con únicos en la ventana histórica. `409` si ya hay una
   * simulación sobre esa categoría. No genera entrada de historial
   * (RF-HIST-001).
   *
   * `today` (opcional): fecha local del usuario YYYY-MM-DD para resolver la
   * ventana histórica del mínimo de 3 meses (RN-028) — mismo contrato que los
   * `GET`. Ausente → fecha UTC del sistema.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Request() req: AuthRequest,
    @Body() dto: CreateSimulationDto,
    @Query('today') todayParam: string | undefined,
  ) {
    const today = this.parseToday(todayParam);
    return this.simulationsService.create(req.user.userId, dto.categoryId, today);
  }

  /**
   * DELETE /simulations/:id
   *
   * Elimina (borrado FÍSICO) una simulación del usuario (RF-SIM-004). Esta
   * especie NO participa del historial de cambios y no es deshacible.
   * `404` si no existe o no es del usuario.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.simulationsService.remove(req.user.userId, id);
  }

  private parseToday(todayParam: string | undefined): string | undefined {
    if (todayParam === undefined) return undefined;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(todayParam)) {
      throw new BadRequestException(
        'El parámetro "today" debe tener formato YYYY-MM-DD (ej: 2026-06-25)',
      );
    }
    return todayParam;
  }
}
