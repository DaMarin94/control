/**
 * Extensión de los tipos de NextAuth v5.
 * Agrega los campos custom que persistimos en la sesión y el token:
 *   - session.accessToken: JWT del backend NestJS (adjuntado como Bearer)
 *   - session.user.id: userId del backend
 *   - session.preferences: blob de preferencias del usuario (Fase 1.1.0)
 *   - token.accessToken: ídem, guardado en el JWT de Auth.js
 *   - token.userId: ídem
 *   - token.preferences: blob de preferencias persistido en el JWT de Auth.js
 */

import type { DefaultSession } from "next-auth";
import type { UserPreferences } from "@/types/auth";

declare module "next-auth" {
  interface Session {
    /** JWT emitido por el backend NestJS. Se adjunta como Authorization: Bearer <token>. */
    accessToken?: string;
    /**
     * Blob de preferencias del usuario.
     * Se carga al loguear y se puede actualizar sin re-login vía useSession().update().
     * Ver hook `usePreferences` para mutar.
     */
    preferences?: UserPreferences;
    user: {
      id: string;
    } & DefaultSession["user"];
  }

  interface User {
    /** JWT emitido por el backend NestJS, presente solo en el flujo Credentials. */
    accessToken?: string;
    /** Blob de preferencias del usuario, cargado al loguear. */
    preferences?: UserPreferences;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    userId?: string;
    /** Blob de preferencias persistido en el JWT de Auth.js (cargado al loguear, actualizable). */
    preferences?: UserPreferences;
  }
}
