import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../../src/auth/jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../../../src/auth/public.decorator';
import { EnvConfig } from '../../../src/config/env.schema';

// ---------------------------------------------------------------------------
// Helpers para construir mocks de ExecutionContext
// ---------------------------------------------------------------------------

function makeRequest(authHeader?: string): Record<string, unknown> {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
    user: undefined,
  };
}

function makeContext(
  request: Record<string, unknown>,
): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('JwtAuthGuard', () => {
  const JWT_SECRET = 'test-secret-at-least-32-characters-long';

  let guard: JwtAuthGuard;
  let jwtService: JwtService;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    jwtService = new JwtService({ secret: JWT_SECRET });

    const configService = {
      get: jest.fn().mockReturnValue(JWT_SECRET),
    } as unknown as ConfigService<EnvConfig, true>;

    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    guard = new JwtAuthGuard(jwtService, configService, reflector);
  });

  it('deja pasar rutas marcadas como @Public() sin token', () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    const ctx = makeContext(makeRequest());
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('lanza UnauthorizedException si no hay header Authorization', () => {
    reflector.getAllAndOverride.mockReturnValue(false);

    const ctx = makeContext(makeRequest());
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('lanza UnauthorizedException si el header no es Bearer', () => {
    reflector.getAllAndOverride.mockReturnValue(false);

    const ctx = makeContext(makeRequest('Basic abc123'));
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('lanza UnauthorizedException si el token es inválido', () => {
    reflector.getAllAndOverride.mockReturnValue(false);

    const ctx = makeContext(makeRequest('Bearer token.invalido.xyz'));
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('lanza UnauthorizedException si el token está expirado', () => {
    reflector.getAllAndOverride.mockReturnValue(false);

    // Token expirado (exp en el pasado)
    const expiredToken = jwtService.sign(
      { sub: 'user-123' },
      { secret: JWT_SECRET, expiresIn: '-1s' },
    );

    const ctx = makeContext(makeRequest(`Bearer ${expiredToken}`));
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('inyecta { userId } en request.user con token válido', () => {
    reflector.getAllAndOverride.mockReturnValue(false);

    const token = jwtService.sign(
      { sub: 'user-cuid-123' },
      { secret: JWT_SECRET, expiresIn: '1h' },
    );

    const request = makeRequest(`Bearer ${token}`);
    const ctx = makeContext(request);

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
    expect((request as { user: { userId: string } }).user).toEqual({
      userId: 'user-cuid-123',
    });
  });

  it('rechaza token firmado con secret distinto', () => {
    reflector.getAllAndOverride.mockReturnValue(false);

    const wrongSecret = 'wrong-secret-totally-different-from-the-one-configured';
    const tokenWithWrongSecret = jwtService.sign(
      { sub: 'user-123' },
      { secret: wrongSecret, expiresIn: '1h' },
    );

    const ctx = makeContext(makeRequest(`Bearer ${tokenWithWrongSecret}`));
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('rechaza rutas no marcadas como @Public() cuando metadata es undefined', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const ctx = makeContext(makeRequest());
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('verifica que IS_PUBLIC_KEY tiene el valor esperado', () => {
    expect(IS_PUBLIC_KEY).toBe('isPublic');
  });
});
