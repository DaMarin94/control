/**
 * Layout del grupo de rutas autenticadas — (app)
 *
 * Re-estilado con tokens del DS "Precise Ledger" (Fase 3).
 * Rework RF-NAV-002: sidebar toggleable (docs/design.md §"Sidebar — mostrar/ocultar").
 *
 * Aplica a: / (dashboard), /mes, /categorias, /metodos-pago, /reportes, /configuracion.
 * NO aplica a: /login, /registro (están fuera del route group).
 *
 * Responsabilidades:
 * - Obtener el email del usuario Y la preferencia `sidebarOpen` vía auth()
 *   (Server Component) — misma pasada, sin pedidos extra.
 * - Delegar el shell (sidebar + <main>) a AppShell (Client Component), pasando
 *   `initialSidebarOpen` server-rendered para que el primer paint ya refleje
 *   el estado correcto sin flash al hidratar (docs/design.md §"Carga inicial
 *   sin flash").
 */

import { auth } from "@/auth";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  // La sesión siempre existe aquí porque el middleware protege estas rutas.
  // Fallback defensivo: string vacío (el avatar mostraría "").
  const email = session?.user?.email ?? "";

  // Preferencia `sidebarOpen` (RF-NAV-002): ausente o no-booleana → default abierto.
  const rawSidebarOpen = session?.preferences?.sidebarOpen;
  const initialSidebarOpen = typeof rawSidebarOpen === "boolean" ? rawSidebarOpen : true;

  return (
    <AppShell email={email} initialSidebarOpen={initialSidebarOpen}>
      {children}
    </AppShell>
  );
}
