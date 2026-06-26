"use client";

/**
 * Wrapper del SessionProvider de NextAuth v5.
 * Se monta en el root layout para que los Client Components
 * puedan usar useSession() en toda la app.
 *
 * Acepta una prop opcional `session` (semilla de servidor) para que
 * useSession() arranque directamente en estado "authenticated" en el
 * primer render del cliente, evitando el flash de preferencias por defecto.
 */

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import type { ReactNode } from "react";

interface AuthSessionProviderProps {
  children: ReactNode;
  session?: Session | null;
}

export function AuthSessionProvider({ children, session }: AuthSessionProviderProps) {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
