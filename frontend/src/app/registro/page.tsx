/**
 * Pantalla de Registro — /registro
 *
 * RF-AUTH-006: registro con email + contraseña.
 * - Validación cliente: email válido, password ≥ 8, confirmación coincide.
 * - Si 409 (email en uso): muestra error sin perder el email.
 * - Si OK: inicia sesión automáticamente y redirige al dashboard.
 * - Usuario ya autenticado: el middleware redirige al dashboard antes de llegar aquí.
 */

import { Suspense } from "react";
import { RegisterForm } from "./register-form";

export default function RegistroPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Control</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Creá tu cuenta para empezar
          </p>
        </div>

        {/* Suspense por compatibilidad con useSearchParams */}
        <Suspense fallback={<div className="h-72 animate-pulse rounded-lg bg-muted" />}>
          <RegisterForm />
        </Suspense>

        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tenés cuenta?{" "}
          <a href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Iniciá sesión
          </a>
        </p>
      </div>
    </main>
  );
}
