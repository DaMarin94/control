import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

/**
 * ESQUELETO — JwtAuthGuard (Fase 0)
 *
 * Guard global que valida el JWT en cada request entrante y extrae el userId.
 * Este archivo es un ESQUELETO vacío. La lógica real se implementa en la Fase 2
 * cuando se conecte la autenticación completa (HS256, secret compartido, claims).
 *
 * En Fase 2:
 * - Extrae el header Authorization: Bearer <token>
 * - Valida firma HS256 con JWT_SECRET
 * - Verifica claims: sub (userId) y exp
 * - Inyecta userId en request.user para que los controllers lo usen
 * - Lanza UnauthorizedException si el token es inválido o faltante
 *
 * Por ahora: permite pasar todas las requests (para que el health check funcione).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  // TODO Fase 2: inyectar JwtService y validar el token real
  canActivate(_context: ExecutionContext): boolean {
    // ESQUELETO: sin validación real — permite todo
    // Reemplazar con lógica JWT en Fase 2
    return true;
  }
}
