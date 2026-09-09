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
import { CreateSimulationsDto } from './dto/create-simulations.dto';

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
   * histórica vigente), `paused` (RF-SIM-002 — cayó por debajo del mínimo de
   * 3 meses) y el TRAMO PROPIO de cada simulación (`startMonth` crudo,
   * `effectiveStartMonth` clampeado contra el mes en curso, `endMonth`
   * persistido) — ya no hay un `horizonEndMonth` único para todas.
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
   * GET /simulations/candidates[?today=YYYY-MM-DD][&startMonth=YYYY-MM]
   *
   * Universo de categorías ACTIVAS del usuario (RF-SIM-001) con `monthsWithData`
   * y `alreadySimulated`, para el selector "Simular categoría". Más el tramo
   * (`startMonth`/`endMonth`) que TENDRÍA una simulación creada desde
   * `startMonth` (para la nota "Alcanza hasta {Mes}") — reemplaza al
   * `horizonEndMonth` único de antes, que dejó de tener sentido cuando el
   * tramo pasó a ser propio de cada simulación.
   *
   * `startMonth` (opcional, "YYYY-MM"): mes desde el que se crearía el lote.
   * Ausente = mes en curso. `400` si viene mal formado.
   */
  @Get('candidates')
  findCandidates(
    @Request() req: AuthRequest,
    @Query('today') todayParam: string | undefined,
    @Query('startMonth') startMonthParam: string | undefined,
  ) {
    const today = this.parseToday(todayParam);
    const startMonth = this.parseStartMonth(startMonthParam);
    return this.simulationsService.findCandidates(req.user.userId, today, startMonth);
  }

  /**
   * POST /simulations[?today=YYYY-MM-DD]
   * Body: { categoryIds: string[], startMonth?: "YYYY-MM" }
   *
   * Crea una simulación por cada categoría de `categoryIds` (RF-SIM-001),
   * con FALLO PARCIAL TOLERADO y sin transacción atómica: las categorías
   * válidas se crean, las que fallan se reportan — una categoría inválida no
   * voltea a las demás. Cada categoría se valida con las mismas reglas de
   * siempre (propia y activa; mínimo 3 meses con únicos; no simulada ya) y,
   * si falla, su entrada en `failed` trae el MISMO mensaje legible que
   * produciría un `create()` individual. `201` siempre (incluso si todas
   * fallaron) — el propio body distingue éxito/fracaso por categoría. No
   * genera entrada de historial (RF-HIST-001, excepción documentada en
   * RF-SIM-004).
   *
   * `today` (opcional): fecha local del usuario YYYY-MM-DD para resolver la
   * ventana histórica del mínimo de 3 meses (RN-028) y el mes en curso para
   * el clamp de `startMonth` — mismo contrato que los `GET`. Ausente → fecha
   * UTC del sistema. `startMonth` del body (opcional, "YYYY-MM") ancla el
   * tramo de las simulaciones creadas; ausente = mes en curso. Se aplica
   * igual a todas las categorías del batch.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Request() req: AuthRequest,
    @Body() dto: CreateSimulationsDto,
    @Query('today') todayParam: string | undefined,
  ) {
    const today = this.parseToday(todayParam);
    return this.simulationsService.createMany(
      req.user.userId,
      dto.categoryIds,
      today,
      dto.startMonth,
    );
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

  private parseStartMonth(startMonthParam: string | undefined): string | undefined {
    if (startMonthParam === undefined) return undefined;
    if (!/^\d{4}-\d{2}$/.test(startMonthParam)) {
      throw new BadRequestException(
        'El parámetro "startMonth" debe tener formato YYYY-MM (ej: 2026-06)',
      );
    }
    return startMonthParam;
  }
}
