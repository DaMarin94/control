/**
 * Pantalla de Login — /login
 *
 * RF-AUTH-005: login con email + contraseña.
 * - Validación cliente con Zod + React Hook Form.
 * - Credenciales inválidas: mensaje genérico (no revela si falló email o password).
 * - Email se conserva en el campo ante error.
 * - Botón de Google: visible pero deshabilitado si no hay credenciales configuradas.
 * - Usuario ya autenticado: el middleware redirige al dashboard antes de llegar aquí.
 */

import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Control</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Iniciá sesión para continuar
          </p>
        </div>

        {/* Suspense necesario porque LoginForm usa useSearchParams() */}
        <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted" />}>
          <LoginForm />
        </Suspense>

        <p className="text-center text-sm text-muted-foreground">
          ¿No tenés cuenta?{" "}
          <a href="/registro" className="font-medium text-primary underline-offset-4 hover:underline">
            Registrate
          </a>
        </p>
      </div>
    </main>
  );
}
