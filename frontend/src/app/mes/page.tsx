/**
 * Vista del mes — /mes
 *
 * RF-VM-001/002/003/004
 * Lista completa de movimientos del mes activo con totales.
 *
 * Lee ?month=YYYY-MM del query. Si no viene, default = mes actual (zona del navegador).
 * El mes actual se calcula en el client via getCurrentMonth().
 *
 * Ruta privada: el middleware redirige a /login si no hay sesión activa.
 */

import { Suspense } from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { MonthViewWrapper } from "@/components/movements/month-view-wrapper";
import { SignOutButton } from "@/components/ui/sign-out-button";

export default async function MesPage() {
  const session = await auth();

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {/* ── Header de la app ── */}
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              <Link href="/" className="hover:opacity-80">
                Control
              </Link>
            </h1>
            {session?.user?.email && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {session.user.email}
              </p>
            )}
          </div>
          <SignOutButton />
        </header>

        {/* ── Contenido de la vista del mes ── */}
        {/* Suspense necesario porque MonthViewWrapper usa useSearchParams */}
        <Suspense
          fallback={
            <div className="space-y-4">
              <div className="h-10 animate-pulse rounded-lg bg-muted" />
              <div className="h-20 animate-pulse rounded-lg bg-muted" />
            </div>
          }
        >
          <MonthViewWrapper />
        </Suspense>

        {/* ── Navegación básica (sin sidebar — RF-NAV-001 diferido) ── */}
        <nav className="mt-8 flex gap-4 border-t pt-4 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground hover:underline underline-offset-4">
            Dashboard
          </Link>
          <Link
            href="/categorias"
            className="hover:text-foreground hover:underline underline-offset-4"
          >
            Categorías
          </Link>
        </nav>
      </div>
    </main>
  );
}
