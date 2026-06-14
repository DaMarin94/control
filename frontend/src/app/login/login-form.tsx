"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { createLogger } from "@/lib/logger";

const logger = createLogger("LoginForm");

const loginSchema = z.object({
  email: z.string().email("Ingresá un email válido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
  isGoogleConfigured: boolean;
}

export function LoginForm({ isGoogleConfigured }: LoginFormProps) {
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

  return (
    <div className="flex flex-col gap-0">
      {/* Botón Google — estilo .gbtn del DS */}
      <GoogleButton
        onClick={handleGoogleLogin}
        disabled={!isGoogleConfigured || isGoogleLoading}
        isLoading={isGoogleLoading}
        isConfigured={isGoogleConfigured}
      />

      {/* Separador */}
      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-line" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-paper px-3 text-[12px] uppercase tracking-[.08em] text-faint">
            o ingresá con email
          </span>
        </div>
      </div>

      {/* Form de credenciales */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-[14px]">
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
          <Label htmlFor="email" required>
            Email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="tu@email.com"
            error={errors.email?.message}
            {...register("email")}
          />
        </div>

        {/* Campo contraseña */}
        <div className="flex flex-col gap-[7px]">
          <Label htmlFor="password" required>
            Contraseña
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            error={errors.password?.message}
            {...register("password")}
          />
        </div>

        {/* Botón principal */}
        <button
          type="submit"
          disabled={isLoading}
          className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-ctl border border-transparent bg-accent px-4 py-[13px] text-[15px] font-semibold text-white shadow-[var(--shadow-sm),inset_0_1px_0_oklch(1_0_0_/_0.2)] transition-all duration-[140ms] hover:-translate-y-px hover:bg-accent-press hover:shadow-[var(--shadow-md)] disabled:pointer-events-none disabled:opacity-50"
        >
          {isLoading ? "Iniciando sesión..." : "Iniciar sesión"}
        </button>
      </form>
    </div>
  );
}

/* ----------------------------------------------------------------
   GoogleButton — replica .gbtn del design system
   Panel + borde fuerte + gmark cuadrado con "G" placeholder neutro.
   NO se usa el logo oficial de Google (norma del DS).
---------------------------------------------------------------- */
interface GoogleButtonProps {
  onClick: () => void;
  disabled: boolean;
  isLoading: boolean;
  isConfigured: boolean;
}

function GoogleButton({ onClick, disabled, isLoading, isConfigured }: GoogleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={!isConfigured ? "Google OAuth no está configurado" : undefined}
      className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-ctl border border-line-strong bg-panel px-[14px] py-[14px] font-ui text-[15px] font-semibold text-ink shadow-[var(--shadow-sm)] transition-all duration-[140ms] hover:-translate-y-px hover:border-muted hover:bg-panel-2 hover:shadow-[var(--shadow-md)] disabled:pointer-events-none disabled:opacity-50"
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
