/**
 * Layout del grupo de rutas autenticadas — (app)
 *
 * Aplica a: / (dashboard), /mes, /categorias.
 * NO aplica a: /login, /registro (están fuera del route group).
 *
 * Responsabilidades:
 * - Obtener el email del usuario vía auth() (Server Component).
 * - Renderizar el AppSidebar con el email ya disponible.
 * - Dar la estructura de dos columnas: sidebar fijo + contenido scrollable.
 *
 * El sidebar se posiciona fixed en desktop (lg:w-64). El contenido principal
 * recibe un padding-left igual al ancho del sidebar en desktop para no quedar
 * debajo de él.
 */

import { auth } from "@/auth";
import { AppSidebar } from "@/components/layout/app-sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  // La sesión siempre existe aquí porque el middleware protege estas rutas.
  // Fallback defensivo: string vacío (el avatar mostraría "").
  const email = session?.user?.email ?? "";

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar: fixed en desktop, drawer en mobile */}
      <AppSidebar email={email} />

      {/* Contenido principal: desplazado a la derecha del sidebar en desktop */}
      <main className="lg:pl-64 min-h-screen">
        {children}
      </main>
    </div>
  );
}
