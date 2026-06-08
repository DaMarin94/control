/**
 * Extensión de los tipos de NextAuth v5.
 * Agrega los campos custom que persistimos en la sesión y el token:
 *   - session.accessToken: JWT del backend NestJS (adjuntado como Bearer)
 *   - session.user.id: userId del backend
 *   - token.accessToken: ídem, guardado en el JWT de Auth.js
 *   - token.userId: ídem
 */

import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    /** JWT emitido por el backend NestJS. Se adjunta como Authorization: Bearer <token>. */
    accessToken?: string;
    user: {
      id: string;
    } & DefaultSession["user"];
  }

  interface User {
    /** JWT emitido por el backend NestJS, presente solo en el flujo Credentials. */
    accessToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    userId?: string;
  }
}
