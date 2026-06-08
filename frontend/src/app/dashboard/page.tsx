/**
 * Dashboard — /dashboard
 *
 * Ruta privada: el middleware redirige a /login si no hay sesión activa.
 * Placeholder para la Fase 3 (lista de movimientos).
 */

import { auth } from "@/auth";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Control</h1>
        <p className="mt-2 text-muted-foreground">Bienvenido/a</p>
        {session?.user?.email && (
          <p className="mt-1 text-sm font-medium">{session.user.email}</p>
        )}
      </div>

      <div className="w-full max-w-sm space-y-3">
        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Dashboard</p>
          <p className="mt-1">Fase 3: los movimientos irán aquí.</p>
        </div>

        <SignOutButton />
      </div>

      <p className="text-xs text-muted-foreground">
        Fase 2 — Autenticación completada
      </p>
    </main>
  );
}
