"use client";

/**
 * Login de escritorio + piezas reutilizables por el acceso en régimen de
 * captura (RF-APP-004, docs/design.md §Superficie de captura → "13. Acceso
 * (login) en régimen de captura").
 *
 * El acceso en régimen de captura NO puede ser literalmente `<LoginForm/>`
 * sin cambios: su orden (Google → separador → credenciales) y el copy del
 * separador ("o ingresá con email") son los del login DE ESCRITORIO — que
 * esta pantalla "no se toca" (copy/layout intactos). El spec de captura
 * cierra un orden DISTINTO a propósito (credenciales primero, Google como
 * alternativa — el camino principal en captura es email+contraseña,
 * RF-APP-004) y un rótulo de separador distinto ("o", una sola letra).
 *
 * Por eso este archivo separa LÓGICA (el hook `useLoginFormLogic` — schema,
 * validación, las dos llamadas a `signIn`, manejo de error) de LAS PIEZAS
 * visuales (`GoogleLoginButton`, `LoginSeparator`, `CredentialsForm`). El
 * login de escritorio (`LoginForm`, este archivo) y el acceso en régimen de
 * captura (`CaptureAccessShell`, en components/capture/) consumen la MISMA
 * lógica y las MISMAS piezas (con overrides de densidad explícitos, nunca
 * cascada CSS — ver `inputClassName`/`submitClassName` de `CredentialsForm`),
 * en dos composiciones distintas — es el mismo patrón de "una lógica, dos
 * composiciones" que rige el form de movimiento, aplicado acá a la
 * autenticación. `LoginForm` no cambió su salida (mismo JSX/copy/orden de
 * antes de este refactor) — solo se reorganizaron sus internos.
 */

import { useState } from "react";
import { useForm, type UseFormRegister, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { createLogger } from "@/lib/logger";
import { cn } from "@/lib/utils";

const logger = createLogger("LoginForm");

const loginSchema = z.object({
  email: z.string().email("Ingresá un email válido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
  isGoogleConfigured: boolean;
}

// ─── Lógica compartida ──────────────────────────────────────────────────────

export interface LoginFormLogic {
  register: UseFormRegister<LoginFormData>;
  errors: FieldErrors<LoginFormData>;
  isLoading: boolean;
  isGoogleLoading: boolean;
  formError: string | null;
  onFormSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  handleGoogleLogin: () => Promise<void>;
}

export function useLoginFormLogic(isGoogleConfigured: boolean): LoginFormLogic {
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginFormData) {
    setIsLoading(true);
    setFormError(null);

    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        callbackUrl,
        redirect: false,
      });

      if (result?.error) {
        // Mensaje genérico: no revelar si falló email o password (RF-AUTH-005)
        logger.warn("Login fallido", { errorCode: result.error });
        setFormError("Email o contraseña incorrectos. Verificá tus datos e intentá de nuevo.");
        return;
      }

      if (result?.url) {
        // Redirigir manualmente para que Next.js maneje la navegación
        window.location.href = result.url;
      }
    } catch (err) {
      logger.error("Error inesperado en login", {
        error: err instanceof Error ? err.message : "desconocido",
      });
      toast.error("Ocurrió un error al iniciar sesión. Intentalo de nuevo.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleLogin() {
    if (!isGoogleConfigured) return;

    setIsGoogleLoading(true);
    try {
      await signIn("google", { callbackUrl });
    } catch (err) {
      logger.error("Error al iniciar sesión con Google", {
        error: err instanceof Error ? err.message : "desconocido",
      });
      toast.error("No se pudo iniciar sesión con Google. Intentalo de nuevo.");
      setIsGoogleLoading(false);
    }
  }

  return {
    register,
    errors,
    isLoading,
    isGoogleLoading,
    formError,
    onFormSubmit: handleSubmit(onSubmit),
    handleGoogleLogin,
  };
}

// ─── LoginForm (escritorio) ─────────────────────────────────────────────────

export function LoginForm({ isGoogleConfigured }: LoginFormProps) {
  const logic = useLoginFormLogic(isGoogleConfigured);

  return (
    <div className="flex flex-col gap-0">
      {/* Botón Google — estilo .gbtn del DS */}
      <GoogleLoginButton
        onClick={logic.handleGoogleLogin}
        disabled={!isGoogleConfigured || logic.isGoogleLoading}
        isLoading={logic.isGoogleLoading}
        isConfigured={isGoogleConfigured}
      />

      <LoginSeparator label="o ingresá con email" />

      <CredentialsForm {...logic} />
    </div>
  );
}

// ─── CredentialsForm — email + contraseña + submit (pieza compartida) ──────

interface CredentialsFormProps extends LoginFormLogic {
  className?: string;
  /**
   * ids de los campos — default "email"/"password" (comportamiento vigente
   * del login de escritorio, sin cambios). El acceso en régimen de captura
   * (`CaptureAccessShell`) los pisa: `{children}` del root layout sigue
   * montado (oculto vía `capture:hidden`, no desmontado) al mismo tiempo
   * que esta superficie cuando la ruta activa es `/login`, así que sin ids
   * propios ambos `<CredentialsForm>` colisionarían con `id="email"`
   * duplicado en el documento (HTML inválido: el `<label for="email">`
   * visible terminaría enfocando el input oculto del login de escritorio).
   */
  emailId?: string;
  passwordId?: string;
  /**
   * Overrides de densidad (docs/design.md §Superficie de captura §4/§13) —
   * mergeados vía `cn()` (tailwind-merge) sobre las clases default, NUNCA
   * cascada CSS. Ausentes en el login de escritorio (sin cambios).
   */
  inputClassName?: string;
  submitClassName?: string;
}

export function CredentialsForm({
  register,
  errors,
  isLoading,
  formError,
  onFormSubmit,
  className,
  emailId = "email",
  passwordId = "password",
  inputClassName,
  submitClassName,
}: CredentialsFormProps) {
  return (
    <form onSubmit={onFormSubmit} noValidate className={cn("flex flex-col gap-[14px]", className)}>
      {/* Error general del formulario */}
      {formError && (
        <div
          role="alert"
          className="rounded-ctl border border-expense/25 bg-expense-soft px-3 py-2.5 text-[13px] text-expense-ink"
        >
          {formError}
        </div>
      )}

      {/* Campo email */}
      <div className="flex flex-col gap-[7px]">
        <Label htmlFor={emailId} required>
          Email
        </Label>
        <Input
          id={emailId}
          type="email"
          autoComplete="email"
          placeholder="tu@email.com"
          error={errors.email?.message}
          className={inputClassName}
          {...register("email")}
        />
      </div>

      {/* Campo contraseña */}
      <div className="flex flex-col gap-[7px]">
        <Label htmlFor={passwordId} required>
          Contraseña
        </Label>
        <Input
          id={passwordId}
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          error={errors.password?.message}
          className={inputClassName}
          {...register("password")}
        />
      </div>

      {/* Botón principal */}
      <button
        type="submit"
        disabled={isLoading}
        className={cn(
          "mt-1 inline-flex w-full items-center justify-center gap-2 rounded-ctl border border-transparent bg-accent px-4 py-[13px] text-[15px] font-semibold text-white shadow-[var(--shadow-sm),inset_0_1px_0_oklch(1_0_0_/_0.2)] transition-all duration-[140ms] hover:-translate-y-px hover:bg-accent-press hover:shadow-[var(--shadow-md)] disabled:pointer-events-none disabled:opacity-50",
          submitClassName,
        )}
      >
        {isLoading ? "Iniciando sesión..." : "Iniciar sesión"}
      </button>
    </form>
  );
}

// ─── LoginSeparator — hairline con rótulo centrado (pieza compartida) ──────

export function LoginSeparator({ label }: { label: string }) {
  return (
    <div className="relative my-5">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-line" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-paper px-3 text-[12px] uppercase tracking-[.08em] text-faint">
          {label}
        </span>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------
   GoogleLoginButton — replica .gbtn del design system (pieza compartida)
   Panel + borde fuerte + gmark cuadrado con "G" placeholder neutro.
   NO se usa el logo oficial de Google (norma del DS).
---------------------------------------------------------------- */
interface GoogleLoginButtonProps {
  onClick: () => void;
  disabled: boolean;
  isLoading: boolean;
  isConfigured: boolean;
  className?: string;
}

export function GoogleLoginButton({
  onClick,
  disabled,
  isLoading,
  isConfigured,
  className,
}: GoogleLoginButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={!isConfigured ? "Google OAuth no está configurado" : undefined}
      className={cn(
        "flex w-full cursor-pointer items-center justify-center gap-3 rounded-ctl border border-line-strong bg-panel px-[14px] py-[14px] font-ui text-[15px] font-semibold text-ink shadow-[var(--shadow-sm)] transition-all duration-[140ms] hover:-translate-y-px hover:border-muted hover:bg-panel-2 hover:shadow-[var(--shadow-md)] disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
    >
      {/* gmark — placeholder cuadrado neutro con "G" en accent-ink */}
      <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[6px] border border-line bg-panel-3 text-[13px] font-bold text-accent-ink">
        G
      </span>
      {isLoading
        ? "Redirigiendo..."
        : isConfigured
          ? "Continuar con Google"
          : "Google (no disponible)"}
    </button>
  );
}
