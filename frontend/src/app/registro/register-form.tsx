"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSearchParams } from "next/navigation";
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
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-[14px]">
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
        {/* Link a login si el email ya existe */}
        {emailInUseError && (
          <a
            href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            className="text-[12.5px] font-semibold text-accent-ink underline-offset-[2px] hover:underline"
          >
            Ir a iniciar sesión
          </a>
        )}
        {/* Indicador de email conservado — solo si hay error de email en uso */}
        {emailInUseError && (
          <p className="text-[12px] text-muted">
            Email ingresado: {getValues("email")}
          </p>
        )}
      </div>

      {/* Campo contraseña */}
      <div className="flex flex-col gap-[7px]">
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
      <div className="flex flex-col gap-[7px]">
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

      {/* Botón principal — mismo estilo que el btn primario del DS */}
      <button
        type="submit"
        disabled={isLoading}
        className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-ctl border border-transparent bg-accent px-4 py-[13px] text-[15px] font-semibold text-white shadow-[var(--shadow-sm),inset_0_1px_0_oklch(1_0_0_/_0.2)] transition-all duration-[140ms] hover:-translate-y-px hover:bg-accent-press hover:shadow-[var(--shadow-md)] disabled:pointer-events-none disabled:opacity-50"
      >
        {isLoading ? "Creando cuenta..." : "Crear cuenta"}
      </button>
    </form>
  );
}
