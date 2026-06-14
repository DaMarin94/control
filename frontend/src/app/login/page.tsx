/**
 * Pantalla de Login — /login
 *
 * RF-AUTH-005: login con email + contraseña.
 * - Validación cliente con Zod + React Hook Form.
 * - Credenciales inválidas: mensaje genérico (no revela si falló email o password).
 * - Email se conserva en el campo ante error.
 * - Botón de Google: visible pero deshabilitado si no hay credenciales configuradas.
 * - Usuario ya autenticado: el middleware redirige al dashboard antes de llegar aquí.
 *
 * Fase 3 — Layout split "Precise Ledger":
 *   Grid 2 col (1.05fr 1fr), full viewport height.
 *   En ≤940px colapsa a 1 columna (brandside arriba, min-h-[280px]).
 */

import { Suspense } from "react";
import { isGoogleConfigured } from "@/lib/env";
import { LoginForm } from "./login-form";
import { BrandSide } from "@/components/ui/auth-brand-side";

export default function LoginPage() {
  return (
    <div className="grid min-h-screen [grid-template-columns:1.05fr_1fr] max-[940px]:grid-cols-1">
      {/* Panel izquierdo — marca */}
      <BrandSide />

      {/* Panel derecho — acceso */}
      <div className="flex items-center justify-center bg-paper px-10 py-10">
        <div className="flex w-full max-w-[360px] flex-col">
          {/* Eyebrow */}
          <span className="text-[13px] font-semibold uppercase tracking-[.1em] text-muted">
            Bienvenido
          </span>

          {/* Título */}
          <h3 className="mt-2 mb-1.5 text-[28px] font-bold tracking-[-0.02em] text-ink">
            Ingresá a Control
          </h3>

          {/* Subtítulo */}
          <p className="mb-[30px] text-[14.5px] leading-[1.5] text-muted">
            Usá tu cuenta de Google. Sin contraseñas que recordar.
          </p>

          {/* Formulario con Suspense (usa useSearchParams) */}
          <Suspense fallback={<div className="h-64 animate-pulse rounded-ctl bg-panel-3" />}>
            <LoginForm isGoogleConfigured={isGoogleConfigured} />
          </Suspense>

          {/* Fine print */}
          <p className="mt-[22px] text-center text-[12.5px] leading-[1.5] text-faint">
            Al continuar aceptás los{" "}
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

          {/* SSL */}
          <div className="mt-7 flex items-center justify-center gap-[7px] text-[12px] text-muted">
            <LockIcon />
            Conexión segura · cifrada de extremo a extremo
          </div>

          {/* Link a registro */}
          <p className="mt-8 text-center text-[13px] text-muted">
            ¿No tenés cuenta?{" "}
            <a
              href="/registro"
              className="font-semibold text-accent-ink underline-offset-[2px] hover:underline"
            >
              Registrate
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
