/**
 * Dashboard — / (raíz)
 *
 * RF-DASH-001/002/003/005
 * Pantalla de inicio tras autenticarse. Muestra el resumen financiero del mes
 * actual. No lista movimientos individuales.
 *
 * Ruta privada: el middleware redirige a /login si no hay sesión activa.
 * Usuario autenticado que entra a /login o /registro → redirige aquí.
 */

import Link from "next/link";
import { auth } from "@/auth";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { SignOutButton } from "@/components/ui/sign-out-button";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {/* ── Header de la app ── */}
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Control</h1>
            {session?.user?.email && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {session.user.email}
              </p>
            )}
          </div>
          <SignOutButton />
        </header>

        {/* ── Contenido del dashboard (Client Component) ── */}
        <DashboardClient />

        {/* ── Navegación básica (sin sidebar — RF-NAV-001 diferido) ── */}
        <nav className="mt-8 flex gap-4 border-t pt-4 text-sm text-muted-foreground">
          <Link href="/categorias" className="hover:text-foreground hover:underline underline-offset-4">
            Categorías
          </Link>
        </nav>
      </div>
    </main>
  );
}
