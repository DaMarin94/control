/**
 * Página raíz — redirige según estado de autenticación.
 * El middleware maneja la redirección: sin sesión → /login, con sesión → /dashboard.
 * Esta página actúa como fallback para la ruta /.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();

  if (session) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
