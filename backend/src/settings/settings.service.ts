import { Injectable, NotFoundException } from '@nestjs/common';
import { Currency } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

/**
 * Shape de los settings del usuario (moneda + cotización).
 */
export interface UserSettings {
  defaultCurrency: Currency;
  /** null si el usuario aún no ha ingresado ninguna cotización */
  lastExchangeRate: number | null;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}

  /**
   * GET /settings — devuelve los settings de moneda del usuario.
   */
  async getSettings(userId: string): Promise<UserSettings> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { defaultCurrency: true, lastExchangeRate: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return {
      defaultCurrency: user.defaultCurrency,
      lastExchangeRate:
        user.lastExchangeRate !== null
          ? Number(user.lastExchangeRate)
          : null,
    };
  }

  /**
   * PATCH /settings — actualiza defaultCurrency y/o lastExchangeRate.
   * Solo actualiza los campos que vienen en el body.
   */
  async updateSettings(
    userId: string,
    dto: UpdateSettingsDto,
  ): Promise<UserSettings> {
    // Verificar que el usuario existe
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.defaultCurrency !== undefined && {
          defaultCurrency: dto.defaultCurrency,
        }),
        ...(dto.lastExchangeRate !== undefined && {
          lastExchangeRate: dto.lastExchangeRate,
        }),
      },
      select: { defaultCurrency: true, lastExchangeRate: true },
    });

    this.logger.log(
      { userId, settings: dto },
      'Settings del usuario actualizados',
    );

    return {
      defaultCurrency: updated.defaultCurrency,
      lastExchangeRate:
        updated.lastExchangeRate !== null
          ? Number(updated.lastExchangeRate)
          : null,
    };
  }

  /**
   * Actualiza solo el lastExchangeRate del usuario.
   * Llamado internamente por los services de movimientos cuando el usuario
   * guarda un movimiento con una cotización explícita.
   *
   * Solo actualiza si exchangeRate != 1 (los movimientos ARS con back-compat
   * tienen 1 por default y no deben sobreescribir la última cotización real).
   */
  async updateLastExchangeRate(
    userId: string,
    exchangeRate: number,
  ): Promise<void> {
    if (exchangeRate === 1) return; // no actualizar con el default de back-compat

    await this.prisma.user.update({
      where: { id: userId },
      data: { lastExchangeRate: exchangeRate },
    });
  }
}
