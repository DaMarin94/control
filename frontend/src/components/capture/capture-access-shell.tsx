"use client";

/**
 * CaptureAccessShell — acceso (login) en régimen de captura (RF-APP-004,
 * docs/design.md §Superficie de captura → "13. Acceso (login) en régimen de
 * captura").
 *
 * Una sola columna, sin `BrandSide` (el panel de marca del login de
 * escritorio no entra en un viewport angosto o bajo). Reusa la LÓGICA de
 * `app/login/login-form.tsx` (`useLoginFormLogic`, `CredentialsForm`,
 * `LoginSeparator`, `GoogleLoginButton`) — mismo comportamiento y mismos
 * métodos que el login de escritorio, con una composición y un copy
 * distintos: acá el orden es credenciales → separador → Google (RF-APP-004:
 * "el email + contraseña es el camino principal"), al revés del orden del
 * login de escritorio, que NO se toca (ver comentario en login-form.tsx).
 * La densidad propia (§4/§13: campos 48px con texto 16px, botón "Iniciar
 * sesión" 52px) se pasa explícita vía `inputClassName`/`submitClassName` —
 * nunca cascada CSS.
 *
 * Sin enlace a "Crear cuenta": el registro no es alcanzable en régimen de
 * captura (RF-AUTH-006 / RF-APP-004).
 */

import {
  useLoginFormLogic,
  CredentialsForm,
  LoginSeparator,
  GoogleLoginButton,
} from "@/app/login/login-form";

export interface CaptureAccessShellProps {
  isGoogleConfigured: boolean;
}

export function CaptureAccessShell({ isGoogleConfigured }: CaptureAccessShellProps) {
  const logic = useLoginFormLogic(isGoogleConfigured);

  return (
    <div
      className="flex min-h-dvh flex-col items-center overflow-y-auto bg-paper"
      style={{
        paddingLeft: "max(24px, env(safe-area-inset-left))",
        paddingRight: "max(24px, env(safe-area-inset-right))",
        paddingTop: "max(24px, env(safe-area-inset-top))",
        paddingBottom: "max(24px, env(safe-area-inset-bottom))",
      }}
    >
      <div className="flex w-full max-w-[360px] flex-1 flex-col justify-center">
        {/* ── Marca — chip de gem + wordmark, centrados ── */}
        <div className="flex flex-col items-center gap-2">
          <div
            className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[13px] shadow-[var(--shadow-sm)]"
            style={{ background: "#fff" }}
            aria-hidden="true"
          >
            <div className="h-[34px] w-[34px] rounded-[9px] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand-icon.svg" alt="" aria-hidden="true" className="h-full w-full object-cover" />
            </div>
          </div>
          <b className="text-[20px] font-bold tracking-[-0.01em] text-ink">Control</b>
        </div>

        {/* ── Título ── */}
        <h1 className="mt-5 mb-0 text-center text-[24px] font-bold tracking-[-0.02em] text-ink">
          Ingresá a Control
        </h1>

        {/* ── Credenciales primero (camino principal, RF-APP-004) ──
            ids propios (capture-email/capture-password): `{children}` del
            root layout sigue montado (oculto vía `capture:hidden`) cuando
            la ruta activa es `/login`, así que sin ids propios acá
            colisionaría con el `id="email"`/`id="password"` del login de
            escritorio (ver comentario en login-form.tsx). */}
        <div className="mt-6">
          <CredentialsForm
            {...logic}
            emailId="capture-email"
            passwordId="capture-password"
            inputClassName="px-[14px] py-[13px] text-[16px]"
            submitClassName="h-[52px] text-[16px]"
          />
        </div>

        <LoginSeparator label="o" />

        <GoogleLoginButton
          onClick={logic.handleGoogleLogin}
          disabled={!isGoogleConfigured || logic.isGoogleLoading}
          isLoading={logic.isGoogleLoading}
          isConfigured={isGoogleConfigured}
          className="h-[52px]"
        />

        {/* Fine print — sin enlace a registro (RF-APP-004) */}
        <p className="mt-[22px] text-center text-[12.5px] leading-[1.5] text-faint">
          Al continuar aceptás los{" "}
          <a href="#" className="text-muted underline underline-offset-[2px] hover:text-ink">
            Términos
          </a>{" "}
          y la{" "}
          <a href="#" className="text-muted underline underline-offset-[2px] hover:text-ink">
            Política de privacidad
          </a>
          .
        </p>
      </div>
    </div>
  );
}
