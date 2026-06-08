"use client";

/**
 * Wrapper del SessionProvider de NextAuth v5.
 * Se monta en el root layout para que los Client Components
 * puedan usar useSession() en toda la app.
 */

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
