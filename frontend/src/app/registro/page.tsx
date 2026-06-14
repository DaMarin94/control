/**
 * Pantalla de Registro — /registro
 *
 * RF-AUTH-006: registro con email + contraseña.
 * - Validación cliente: email válido, password ≥ 8, confirmación coincide.
 * - Si 409 (email en uso): muestra error sin perder el email.
 * - Si OK: inicia sesión automáticamente y redirige al dashboard.
 * - Usuario ya autenticado: el middleware redirige al dashboard antes de llegar aquí.
 *
 * Fase 3 — Mismo layout split "Precise Ledger" que el login.
 *   Reutiliza BrandSide; panel derecho adapta textos/acciones al registro.
 */

import { Suspense } from "react";
import { RegisterForm } from "./register-form";
import { BrandSide } from "@/components/ui/auth-brand-side";

export default function RegistroPage() {
  return (
    <div className="grid min-h-screen [grid-template-columns:1.05fr_1fr] max-[940px]:grid-cols-1">
      {/* Panel izquierdo — marca (idéntico al login) */}
      <BrandSide />

      {/* Panel derecho — acceso */}
      <div className="flex items-center justify-center bg-paper px-10 py-10">
        <div className="flex w-full max-w-[360px] flex-col">
          {/* Eyebrow */}
          <span className="text-[13px] font-semibold uppercase tracking-[.1em] text-muted">
            Empezá gratis
          </span>

          {/* Título */}
          <h3 className="mt-2 mb-1.5 text-[28px] font-bold tracking-[-0.02em] text-ink">
            Creá tu cuenta
          </h3>

          {/* Subtítulo */}
          <p className="mb-[30px] text-[14.5px] leading-[1.5] text-muted">
            Completá tus datos para empezar a registrar tus finanzas.
          </p>

          {/* Formulario con Suspense (usa useSearchParams) */}
          <Suspense fallback={<div className="h-72 animate-pulse rounded-ctl bg-panel-3" />}>
            <RegisterForm />
          </Suspense>

          {/* Fine print */}
          <p className="mt-[22px] text-center text-[12.5px] leading-[1.5] text-faint">
            Al registrarte aceptás los{" "}
            <a
              href="#"
              className="text-muted underline underline-offset-[2px] hover:text-ink"
            >
              Términos
            </a>{" "}
            y la{" "}
            <a
              href="#"
              className="text-muted underline underline-offset-[2px] hover:text-ink"
            >
              Política de privacidad
            </a>
            .
          </p>

          {/* Link a login */}
          <p className="mt-8 text-center text-[13px] text-muted">
            ¿Ya tenés cuenta?{" "}
            <a
              href="/login"
              className="font-semibold text-accent-ink underline-offset-[2px] hover:underline"
            >
              Iniciá sesión
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
