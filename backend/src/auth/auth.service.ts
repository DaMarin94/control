import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Logger } from 'nestjs-pino';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { COLOR_POOL } from '../categories/color-pool';

// -----------------------------------------------------------------------
// Categorías por defecto (RF-CAT-001)
//
// Los colores se asignan del pool centralizado (COLOR_POOL) en orden de
// definición del pool, uno por categoría. Las 4 categorías por defecto
// toman los primeros 4 colores del pool.
// -----------------------------------------------------------------------
const DEFAULT_CATEGORY_NAMES = [
  'Consumibles',
  'Tarjeta de crédito',
  'Gastos fijos',
  'Servicios',
] as const;

const DEFAULT_CATEGORIES = DEFAULT_CATEGORY_NAMES.map((name, i) => ({
  name,
  color: COLOR_POOL[i],
}));

// Timezone por defecto para usuarios que se registran vía email/contraseña.
// El frontend todavía no envía la zona del cliente en el registro; se usa
// America/Argentina/Buenos_Aires como default explícito.
// TODO: recibir timezone del frontend en el body del registro (Fase 3 o cuando
// el frontend lo soporte).
const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

export interface AuthUserPublic {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

export interface AuthResult {
  accessToken: string;
  user: AuthUserPublic;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly logger: Logger,
  ) {}

  // -----------------------------------------------------------------------
  // register
  // -----------------------------------------------------------------------
  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      this.logger.warn('Registro fallido: email ya en uso');
      throw new ConflictException('El email ya está registrado');
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        timezone: DEFAULT_TIMEZONE,
      },
    });

    // Crear categorías por defecto (RF-CAT-001)
    await this.createDefaultCategories(user.id);

    this.logger.log(`Usuario registrado: ${user.id}`);

    return this.buildAuthResult(user);
  }

  // -----------------------------------------------------------------------
  // login
  // -----------------------------------------------------------------------
  async login(dto: LoginDto): Promise<AuthResult> {
    // Mensaje de error genérico que no revela si falló email o contraseña (RF-AUTH-005 A1)
    const genericError = new UnauthorizedException('Credenciales inválidas');

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.passwordHash) {
      this.logger.warn('Login fallido: usuario no encontrado o sin contraseña');
      throw genericError;
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);

    if (!passwordValid) {
      this.logger.warn(`Login fallido: contraseña incorrecta para userId=${user.id}`);
      throw genericError;
    }

    this.logger.log(`Login exitoso: userId=${user.id}`);

    return this.buildAuthResult(user);
  }

  // -----------------------------------------------------------------------
  // googleAuth
  //
  // TODO: Verificar el idToken contra Google (google-auth-library) si se
  // requiere seguridad server-side completa. Por ahora se confía en los datos
  // del perfil que Auth.js ya validó en el frontend antes de llamar a este
  // endpoint. Para habilitar la verificación real, instalar google-auth-library
  // y descomentar la lógica de verificación usando GOOGLE_CLIENT_ID.
  // -----------------------------------------------------------------------
  async googleAuth(dto: GoogleAuthDto): Promise<AuthResult> {
    let user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          name: dto.name ?? null,
          image: dto.image ?? null,
          timezone: DEFAULT_TIMEZONE,
          // Sin passwordHash: cuenta solo-Google
        },
      });

      // Crear categorías por defecto solo en alta nueva (RF-CAT-001)
      await this.createDefaultCategories(user.id);
      this.logger.log(`Usuario Google creado: ${user.id}`);
    } else {
      // Actualizar nombre e imagen si cambiaron (RF-AUTH-001)
      if (dto.name !== undefined || dto.image !== undefined) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            ...(dto.name !== undefined && { name: dto.name }),
            ...(dto.image !== undefined && { image: dto.image }),
          },
        });
      }
      this.logger.log(`Login Google exitoso: userId=${user.id}`);
    }

    return this.buildAuthResult(user);
  }

  // -----------------------------------------------------------------------
  // Helpers privados
  // -----------------------------------------------------------------------

  /**
   * Genera el JWT para el usuario dado.
   * Claims: sub (userId), iat (automático), exp (30 días).
   *
   * El tiempo de expiración de 30 días es deliberado para una app de uso personal
   * donde la fricción de re-login frecuente es indeseable. Auth.js en el frontend
   * es la fuente de verdad de sesión; este JWT es el token que valida el backend.
   */
  private signToken(userId: string): string {
    return this.jwtService.sign({ sub: userId });
  }

  private buildAuthResult(user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  }): AuthResult {
    return {
      accessToken: this.signToken(user.id),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
    };
  }

  /**
   * Crea las 4 categorías por defecto para un usuario recién creado (RF-CAT-001).
   * Los colores vienen del COLOR_POOL centralizado (src/categories/color-pool.ts).
   * No duplica si ya existen (skipDuplicates).
   */
  private async createDefaultCategories(userId: string): Promise<void> {
    await this.prisma.category.createMany({
      data: DEFAULT_CATEGORIES.map((cat) => ({
        userId,
        name: cat.name,
        scope: 'BOTH' as const,
        color: cat.color,
      })),
      skipDuplicates: true,
    });
  }
}
