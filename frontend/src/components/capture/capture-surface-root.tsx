"use client";

/**
 * CaptureSurfaceRoot — punto de montaje único de la superficie de captura
 * (RF-APP-003/004, docs/design.md §Superficie de captura). Montado SIEMPRE
 * en el root layout, junto a `{children}` (la app), visible únicamente bajo
 * la variante CSS `capture:` (globals.css, criterio: `min(ancho, alto) <
 * 600px`) — CSS puro, decidido antes del primer paint: no hay flash de
 * superficie equivocada ni al cargar ni al cruzar la frontera en vivo
 * (redimensionar/rotar).
 *
 * `isAuthenticated`/`email` llegan como props RESUELTAS EN EL SERVIDOR
 * (root layout, `auth()`), no de `useSession()`: evita cualquier estado
 * "loading" intermedio en el primer render del cliente. Cerrar sesión y
 * loguearse navegan (`signOut`/`signIn` con `redirect`), así que esta prop
 * se re-calcula fresca en cada respuesta del servidor — no hace falta
 * sincronizarla en vivo desde el cliente.
 *
 * El `<div>` de abajo es el nodo raíz cuya visibilidad decide el CSS
 * (`hidden capture:block`).
 */

import { Suspense } from "react";
import { CaptureShell } from "@/components/capture/capture-shell";
import { CaptureAccessShell } from "@/components/capture/capture-access-shell";

export interface CaptureSurfaceRootProps {
  isAuthenticated: boolean;
  email: string;
  isGoogleConfigured: boolean;
}

export function CaptureSurfaceRoot({
  isAuthenticated,
  email,
  isGoogleConfigured,
}: CaptureSurfaceRootProps) {
  return (
    <div className="hidden capture:block">
      {isAuthenticated ? (
        <CaptureShell email={email} />
      ) : (
        // useSearchParams (vía useLoginFormLogic) exige un límite de Suspense
        // en el App Router de Next 15 — mismo patrón que app/login/page.tsx.
        <Suspense fallback={null}>
          <CaptureAccessShell isGoogleConfigured={isGoogleConfigured} />
        </Suspense>
      )}
    </div>
  );
}
