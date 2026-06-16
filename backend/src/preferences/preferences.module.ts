import { Module } from '@nestjs/common';
import { PreferencesController } from './preferences.controller';
import { PreferencesService } from './preferences.service';

/**
 * PreferencesModule — persistencia del blob de preferencias por usuario.
 *
 * PrismaService ya está disponible globalmente (PrismaModule global).
 * Logger (nestjs-pino) también está disponible globalmente via LoggerModule.
 *
 * Exporta PreferencesService para que AuthModule pueda inyectarlo y embeber
 * las preferencias en el AuthResult al loguear.
 */
@Module({
  controllers: [PreferencesController],
  providers: [PreferencesService],
  exports: [PreferencesService],
})
export class PreferencesModule {}
