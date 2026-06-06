/**
 * Página placeholder — Server Component.
 * Fase 0: scaffolding. Las pantallas reales se implementan en fases posteriores.
 */

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Control</h1>
        <p className="mt-2 text-muted-foreground">Diario de gastos personales</p>
      </div>

      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <Button>Iniciar sesión</Button>
        <Button variant="outline">Registrarse</Button>
        <Button variant="ghost">Continuar con Google</Button>
      </div>

      <p className="text-xs text-muted-foreground">Scaffolding — Fase 0</p>
    </main>
  );
}
