import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';
import { EnvConfig } from '../config/env.schema';

/**
 * JwtAuthGuard — guard global que valida el JWT en cada request entrante.
 *
 * Comportamiento:
 * - Si la ruta está marcada con @Public(), deja pasar sin validar.
 * - Extrae el token del header Authorization: Bearer <token>.
 * - Valida firma HS256 con JWT_SECRET y verifica exp.
 * - Inyecta { userId } en request.user para que los controllers lo usen.
 * - Lanza UnauthorizedException si el token falta, es inválido o expiró.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvConfig, true>,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Verificar si la ruta está marcada como pública
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Token de autenticación requerido');
    }

    const secret = this.configService.get('JWT_SECRET', { infer: true });

    let payload: { sub: string; exp: number };

    try {
      payload = this.jwtService.verify<{ sub: string; exp: number }>(token, {
        secret,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    // Inyectar userId en la request para que los controllers lo consuman
    (request as Request & { user: { userId: string } }).user = {
      userId: payload.sub,
    };

    return true;
  }

  private extractBearerToken(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.slice(7);
  }
}
