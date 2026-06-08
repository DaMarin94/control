import { IsEmail, IsOptional, IsString } from 'class-validator';

/**
 * DTO para el endpoint POST /auth/google.
 *
 * El frontend (Auth.js callback) puede enviar el perfil de Google desestructurado.
 * Se acepta el id_token de Google para verificación server-side, más los campos
 * de perfil como fallback / enriquecimiento.
 *
 * Campos:
 * - idToken: el id_token de Google (JWT emitido por Google). Verificación server-side pendiente
 *   (ver TODO abajo).
 * - email, name, image, googleId: perfil desestructurado. Usados directamente si idToken no está
 *   disponible o como datos de perfil ya validados por Auth.js.
 */
export class GoogleAuthDto {
  @IsOptional()
  @IsString()
  idToken?: string;

  @IsEmail({}, { message: 'El email debe tener formato válido' })
  email!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  googleId?: string;
}
