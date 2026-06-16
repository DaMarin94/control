import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  Request,
} from '@nestjs/common';
import { PreferencesService } from './preferences.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

interface AuthRequest extends Request {
  user: { userId: string };
}

/**
 * PreferencesController — GET y PUT del blob de preferencias del usuario.
 *
 * Ambos endpoints están protegidos por JwtAuthGuard (global).
 * El userId se extrae SIEMPRE de request.user.userId (nunca del body/query).
 *
 * El blob es un objeto JSON abierto: el frontend manda el objeto completo
 * en PUT y el servidor lo reemplaza sin hacer merge.
 */
@Controller('preferences')
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  /**
   * GET /preferences
   * Devuelve el blob de preferencias del usuario autenticado.
   * Si no existe fila aún (usuario previo a Fase 1.1.0) → {} (back-compat).
   * Código 200.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  getPreferences(@Request() req: AuthRequest) {
    return this.preferencesService.getPreferences(req.user.userId);
  }

  /**
   * PUT /preferences
   * Reemplaza el blob completo de preferencias del usuario autenticado.
   * El frontend manda el objeto entero; el server no hace merge.
   * Código 200.
   */
  @Put()
  @HttpCode(HttpStatus.OK)
  updatePreferences(
    @Request() req: AuthRequest,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.preferencesService.updatePreferences(req.user.userId, dto);
  }
}
