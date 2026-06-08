import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { Public } from './public.decorator';

/**
 * AuthController — maneja los 3 endpoints de autenticación.
 *
 * Todas las rutas son públicas (@Public): el JwtAuthGuard global las omite.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/register
   * Registra un usuario nuevo con email y contraseña.
   * Genera categorías por defecto al crear la cuenta (RF-CAT-001).
   * Devuelve JWT + datos públicos del usuario.
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * POST /auth/login
   * Autentica con email y contraseña.
   * Error genérico ante credenciales inválidas (no revela si falló email o password).
   * Devuelve JWT + datos públicos del usuario.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * POST /auth/google
   * Scaffolded/funcional: crea o actualiza usuario a partir del perfil de Google.
   * Genera categorías por defecto si es la primera vez (RF-CAT-001).
   * Devuelve JWT + datos públicos del usuario.
   *
   * TODO: verificar el idToken contra Google con google-auth-library cuando
   * se active el flujo Google en el frontend.
   */
  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  googleAuth(@Body() dto: GoogleAuthDto) {
    return this.authService.googleAuth(dto);
  }
}
