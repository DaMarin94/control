/**
 * Tests estructurales del root layout (`src/app/layout.tsx`) — cobertura de
 * los dos regímenes de superficie (RF-APP-003/004, docs/design.md
 * §Contención responsive → "Dos regímenes de superficie").
 *
 * El root layout es un Server Component async que renderiza `<html>`/`<body>`
 * y llama a `auth()`: no es renderizable con React Testing Library sobre
 * jsdom (jsdom ya posee su propio `document.documentElement`/`document.body`,
 * y el árbol de providers reales exigiría mockear `next/font/google`,
 * `@/auth`, `@/lib/env`, React Query, etc. solo para verificar dos strings de
 * clase). Por eso este archivo verifica, a nivel de código fuente, que:
 * - `{children}` (la app) está envuelto en `capture:hidden` y `CaptureSurfaceRoot`
 *   está montado como hermano (RF-APP-003/004, docs/design.md §Superficie de
 *   captura).
 * - No queda ningún resto del gate por debajo del ancho mínimo soportado
 *   (RF-APP-002, retirado): ni `ViewportGate`, ni `max-floor`, ni `celular:`.
 * - El `viewport` export declara `interactive-widget: overlays-content`
 *   (deliberado — ver comentario en layout.tsx sobre el gotcha del criterio
 *   de régimen por tamaño).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const layoutSource = readFileSync(
  resolve(process.cwd(), "src/app/layout.tsx"),
  "utf-8",
);

describe("Root layout — superficie de captura (RF-APP-003/004)", () => {
  it("importa y monta CaptureSurfaceRoot", () => {
    expect(layoutSource).toMatch(
      /import\s*\{\s*CaptureSurfaceRoot\s*\}\s*from\s*"@\/components\/capture\/capture-surface-root"/,
    );
    expect(layoutSource).toMatch(/<CaptureSurfaceRoot\b/);
  });

  it("envuelve {children} en `capture:hidden` — la rama de app nunca se ve en régimen de captura", () => {
    expect(layoutSource).toMatch(/className="capture:hidden">\{children\}<\/div>/);
  });

  it("CaptureSurfaceRoot recibe isAuthenticated/email/isGoogleConfigured resueltos server-side", () => {
    const captureSurfaceMatch = layoutSource.match(/<CaptureSurfaceRoot[\s\S]*?\/>/);
    expect(captureSurfaceMatch).not.toBeNull();
    const props = captureSurfaceMatch![0]!;
    expect(props).toContain("isAuthenticated={isAuthenticated}");
    expect(props).toContain("email={email}");
    expect(props).toContain("isGoogleConfigured={isGoogleConfigured}");
  });

  it("declara el viewport con interactive-widget: overlays-content (gotcha del criterio de régimen por tamaño)", () => {
    expect(layoutSource).toMatch(/export const viewport: Viewport = \{/);
    expect(layoutSource).toMatch(/interactiveWidget:\s*"overlays-content"/);
  });

  it("monta el gate de arranque del backend como TERCER hermano, fuera de la rama de app y de CaptureSurfaceRoot", () => {
    expect(layoutSource).toMatch(
      /import\s*\{\s*BackendGate\s*\}\s*from\s*"@\/components\/backend-gate\/backend-gate"/,
    );
    expect(layoutSource).toMatch(/<BackendGate\s*\/>/);

    // Orden estructural: la rama de app, la superficie de captura y recién
    // después el gate — hermanos los tres, el gate por encima de los dos.
    const appBranch = layoutSource.indexOf('className="capture:hidden">{children}</div>');
    const captureRoot = layoutSource.indexOf("<CaptureSurfaceRoot");
    const gate = layoutSource.indexOf("<BackendGate");
    expect(appBranch).toBeGreaterThan(-1);
    expect(captureRoot).toBeGreaterThan(appBranch);
    expect(gate).toBeGreaterThan(captureRoot);

    // Una sola superficie para los dos regímenes: el gate NO lleva variante
    // de visibilidad por régimen (ocultarlo en uno lo dejaría sin gate).
    const gateTag = layoutSource.slice(gate, layoutSource.indexOf("/>", gate) + 2);
    expect(gateTag).not.toMatch(/capture:|max-wide:|app-regime:/);
  });

  it("no monta ningún gate por debajo del ancho mínimo soportado (RF-APP-002, retirado)", () => {
    expect(layoutSource).not.toMatch(/ViewportGate/);
    expect(layoutSource).not.toMatch(/max-floor/);
    expect(layoutSource).not.toMatch(/celular:/);
  });
});
