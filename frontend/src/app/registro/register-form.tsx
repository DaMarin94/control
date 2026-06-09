"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useRegister } from "@/hooks/use-register";

const registerSchema = z
  .object({
    email: z.string().email("Ingresá un email válido"),
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres"),
    confirmPassword: z.string().min(1, "Confirmá tu contraseña"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const [emailInUseError, setEmailInUseError] = useState(false);
  const { toast } = useToast();
  const { register: registerUser, isLoading } = useRegister();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
    getValues,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(data: RegisterFormData) {
    setEmailInUseError(false);

    const result = await registerUser({
      email: data.email,
      password: data.password,
      redirectTo: callbackUrl,
    });

    if (!result.success) {
      if (result.emailInUse) {
        // Mostrar error en el campo email sin perder el valor (RF-AUTH-006)
        setEmailInUseError(true);
        setError("email", {
          message: "Este email ya está registrado. ¿Querés iniciar sesión?",
        });
        return;
      }

      if (result.error) {
        toast.error(result.error);
      }
    }
    // Si success: useRegister dispara signIn con redirect:true, la navegación
    // la maneja Next.js automáticamente.
  }

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
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
          {/* Link a login si el email ya existe */}
          {emailInUseError && (
            <a
              href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
              className="text-xs text-primary underline-offset-2 hover:underline"
            >
              Ir a iniciar sesión
            </a>
          )}
        </div>

        {/* Campo contraseña */}
        <div className="space-y-1.5">
          <Label htmlFor="password" required>
            Contraseña
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            error={errors.password?.message}
            {...register("password")}
          />
        </div>

        {/* Campo confirmar contraseña */}
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" required>
            Confirmá tu contraseña
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Repetí tu contraseña"
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Creando cuenta..." : "Crear cuenta"}
        </Button>
      </form>

      {/* Indicador de email conservado en hover para debug — solo si hay error */}
      {emailInUseError && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Email ingresado: {getValues("email")}
        </p>
      )}
    </div>
  );
}
