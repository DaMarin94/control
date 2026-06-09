"use client";

/**
 * Botón de cierre de sesión.
 * Client Component porque usa signOut de next-auth/react.
 * Redirige a /login tras cerrar sesión (RF-AUTH-004).
 */

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button
      variant="outline"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      Cerrar sesión
    </Button>
  );
}
