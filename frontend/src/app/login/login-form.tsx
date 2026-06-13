"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
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
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* Error general del formulario */}
        {formError && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {formError}
          </div>
        )}

        {/* Campo email */}
        <div className="space-y-1.5">
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
        <div className="space-y-1.5">
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
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Iniciando sesión..." : "Iniciar sesión"}
        </Button>
      </form>

      {/* Separador */}
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">o</span>
        </div>
      </div>

      {/* Botón de Google */}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGoogleLogin}
        disabled={!isGoogleConfigured || isGoogleLoading}
        title={!isGoogleConfigured ? "Google OAuth no está configurado" : undefined}
      >
        <GoogleIcon />
        {isGoogleLoading
          ? "Redirigiendo..."
          : isGoogleConfigured
            ? "Continuar con Google"
            : "Google (no disponible)"}
      </Button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="size-4"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
