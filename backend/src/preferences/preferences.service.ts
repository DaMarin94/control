import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

/**
 * PreferencesService — lectura y escritura del blob de preferencias del usuario.
 *
 * Una fila por usuario (UserPreferences). Si no existe aún la fila (usuario creado
 * antes de la Fase 1.1.0), se hace upsert y se devuelve {} como default (back-compat).
 *
 * PUT /preferences reemplaza el blob completo — el server NO hace merge.
 */
@Injectable()
export class PreferencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}

  // ---------------------------------------------------------------------------
  // GET /preferences — leer el blob actual
  // ---------------------------------------------------------------------------

  async getPreferences(userId: string): Promise<Record<string, unknown>> {
    const prefs = await this.prisma.userPreferences.findUnique({
      where: { userId },
    });

    if (!prefs) {
      // Back-compat: usuario existente sin fila → {} implícito (no crear fila todavía)
      this.logger.debug({ userId }, 'Preferencias no encontradas — devolviendo default {}');
      return {};
    }

    this.logger.debug({ userId }, 'Preferencias leídas');
    return prefs.data as Record<string, unknown>;
  }

  // ---------------------------------------------------------------------------
  // PUT /preferences — reemplazar el blob completo
  // ---------------------------------------------------------------------------

  async updatePreferences(
    userId: string,
    dto: UpdatePreferencesDto,
  ): Promise<Record<string, unknown>> {
    // Upsert: si no existe la fila (usuario viejo), la crea; si existe, la actualiza.
    // El servidor NO hace merge — reemplaza el blob completo con lo que manda el cliente.
    // Prisma 7 requiere tipo InputJsonValue para campos Json.
    // Record<string, unknown> es compatible en runtime pero no en tipos estáticos;
    // el double-cast via unknown es el patrón seguro para satisfacer el compilador.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jsonData = dto.data as any;
    const updated = await this.prisma.userPreferences.upsert({
      where: { userId },
      create: {
        userId,
        data: jsonData,
      },
      update: {
        data: jsonData,
      },
    });

    this.logger.log({ userId }, 'Preferencias actualizadas');
    return updated.data as Record<string, unknown>;
  }

  // ---------------------------------------------------------------------------
  // Helper interno: leer preferencias para embeber en AuthResult
  // ---------------------------------------------------------------------------

  /**
   * Leer el blob de preferencias para embeber en el AuthResult al loguear.
   * Si la fila no existe (usuario viejo), devuelve {} sin error.
   */
  async getPreferencesForAuth(userId: string): Promise<Record<string, unknown>> {
    const prefs = await this.prisma.userPreferences.findUnique({
      where: { userId },
    });
    return prefs ? (prefs.data as Record<string, unknown>) : {};
  }
}
