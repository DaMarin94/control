import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EnvConfig } from '../config/env.schema';

/**
 * AuthModule — autenticación email/contraseña + Google OAuth scaffolded.
 *
 * Registra JwtModule con la configuración HS256:
 * - secret: JWT_SECRET del entorno (≥32 chars, validado por env.schema)
 * - expiresIn: 30d — tiempo de expiración deliberado para app personal.
 *   Auth.js en el frontend gestiona la sesión; el JWT del backend es solo
 *   el mecanismo de validación de cada request.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: {
          expiresIn: '30d',
          algorithm: 'HS256',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [JwtModule],
})
export class AuthModule {}
