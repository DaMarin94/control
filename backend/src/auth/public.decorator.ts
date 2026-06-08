import { SetMetadata } from '@nestjs/common';

/**
 * Marca una ruta como pública: el JwtAuthGuard global la deja pasar sin validar JWT.
 *
 * Uso:
 *   @Public()
 *   @Post('register')
 *   register(...) {}
 *
 * Aplicar en todos los endpoints de auth (register, login, google)
 * y en el health check.
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
