/**
 * Configuración central de NextAuth v5 (Auth.js).
 *
 * Providers:
 *  - Credentials: email + contraseña via POST /auth/login del backend NestJS.
 *  - Google: scaffolded y listo para activar. Requiere GOOGLE_CLIENT_ID y
 *    GOOGLE_CLIENT_SECRET configurados. Sin credenciales, el botón de Google
 *    queda deshabilitado en la UI (ver `isGoogleConfigured` en env.ts).
 *
 * El accessToken que viaja en la sesión es el JWT emitido por el backend NestJS
 * (HS256, sub=userId, exp 30 días), NO un token de Auth.js. El frontend lo adjunta
 * como "Authorization: Bearer <token>" en cada llamada al backend.
 *
 * Persistencia: estrategia JWT de Auth.js (sesión encriptada en cookie).
 * El accessToken del backend se guarda en el token JWT de Auth.js y se expone
 * en session.accessToken para la capa de API.
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import type { AuthResponse, GoogleAuthRequest, UserPreferences } from "@/types/auth";

const logger = createLogger("Auth");

// ─── Esquema de validación de credenciales ────────────────────────────────────

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// ─── Helpers de llamada al backend ───────────────────────────────────────────

async function loginWithBackend(email: string, password: string): Promise<AuthResponse | null> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) return null;

  try {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const json = (await res.json()) as { success: boolean; data?: AuthResponse };

    if (!res.ok || !json.success || !json.data) {
      logger.warn("Login fallido en el backend", { status: res.status });
      return null;
    }

    return json.data;
  } catch (err) {
    logger.error("Error de red al hacer login", {
      error: err instanceof Error ? err.message : "desconocido",
    });
    return null;
  }
}

async function loginWithGoogle(payload: GoogleAuthRequest): Promise<AuthResponse | null> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) return null;

  try {
    const res = await fetch(`${baseUrl}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = (await res.json()) as { success: boolean; data?: AuthResponse };

    if (!res.ok || !json.success || !json.data) {
      logger.warn("Google auth fallido en el backend", { status: res.status });
      return null;
    }

    return json.data;
  } catch (err) {
    logger.error("Error de red al hacer auth con Google", {
      error: err instanceof Error ? err.message : "desconocido",
    });
    return null;
  }
}

// ─── Configuración de NextAuth ────────────────────────────────────────────────

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,

  session: {
    strategy: "jwt",
    // La sesión dura 30 días, sincronizando con el exp del JWT del backend
    maxAge: 30 * 24 * 60 * 60,
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  providers: [
    Credentials({
      name: "Credenciales",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const result = await loginWithBackend(email, password);

        if (!result) return null;

        return {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          image: result.user.image,
          // Campos custom: accessToken y preferences del backend NestJS
          accessToken: result.accessToken,
          preferences: result.preferences,
        };
      },
    }),

    // Google OAuth — scaffolded. Activo cuando GOOGLE_CLIENT_ID y
    // GOOGLE_CLIENT_SECRET están configurados. Sin ellas, NextAuth omite el provider.
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],

  callbacks: {
    /**
     * jwt: se ejecuta al crear/refrescar el token de Auth.js.
     * Persiste el accessToken del backend y el userId en el token JWT de Auth.js.
     *
     * En el flujo de Credentials, el accessToken viene en user.accessToken.
     * En el flujo de Google, se obtiene llamando a POST /auth/google con el perfil.
     */
    async jwt({ token, user, account, profile, trigger, session }) {
      // Actualización de sesión vía useSession().update() (trigger === "update").
      // El hook usePreferences llama update({ preferences: {...} }) después de persistir
      // en el backend. Acá se sobreescribe el token con el nuevo blob.
      if (trigger === "update" && session?.preferences !== undefined) {
        token.preferences = session.preferences as UserPreferences;
        return token;
      }

      // Primera vez que se crea el token (login)
      if (user) {
        token.userId = user.id;

        // Credentials: el accessToken y preferences vienen directo en el user object
        if ("accessToken" in user && typeof user.accessToken === "string") {
          token.accessToken = user.accessToken;
        }
        if ("preferences" in user && user.preferences !== undefined) {
          token.preferences = user.preferences;
        }
      }

      // Google OAuth: obtener el accessToken y preferences del backend NestJS
      if (account?.provider === "google" && profile?.email) {
        const result = await loginWithGoogle({
          email: profile.email,
          name: (profile.name as string | null | undefined) ?? null,
          image: (profile.picture as string | null | undefined) ?? null,
          googleId: (profile.sub as string | null | undefined) ?? null,
          idToken: account.id_token ?? null,
        });

        if (result) {
          token.accessToken = result.accessToken;
          token.userId = result.user.id;
          token.preferences = result.preferences;
        }
      }

      return token;
    },

    /**
     * session: expone los campos del token a la sesión del cliente.
     * accessToken, userId y preferences quedan disponibles en useSession() / auth().
     *
     * Las preferences se actualizan sin re-login cuando el cliente llama a
     * useSession().update() después de persistir en el backend (ver usePreferences).
     */
    session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined;
      session.user.id = token.userId as string;
      session.preferences = token.preferences as UserPreferences | undefined;
      return session;
    },
  },
});
