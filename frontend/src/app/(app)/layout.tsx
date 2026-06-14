/**
 * Layout del grupo de rutas autenticadas — (app)
 *
 * Re-estilado con tokens del DS "Precise Ledger" (Fase 3).
 *
 * Aplica a: / (dashboard), /mes, /categorias.
 * NO aplica a: /login, /registro (están fuera del route group).
 *
 * Responsabilidades:
 * - Obtener el email del usuario vía auth() (Server Component).
 * - Renderizar el AppSidebar con el email ya disponible.
 * - Dar la estructura de dos columnas: sidebar fijo 248px + contenido scrollable.
 *
 * El sidebar se posiciona fixed en desktop (≥941px, 248px).
 * El contenido principal recibe padding-left equivalente en desktop.
 * El <main> tiene el padding y max-width del DS (content area).
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
    <div className="min-h-screen bg-paper">
      {/* Sidebar: fixed en desktop, drawer en mobile */}
      <AppSidebar email={email} />

      {/* Contenido principal: desplazado a la derecha del sidebar en desktop */}
      <main className="[@media(min-width:941px)]:pl-[248px] min-h-screen">
        {children}
      </main>
    </div>
  );
}
