/**
 * Tests estructurales del root layout (`src/app/layout.tsx`) — cobertura del
 * gate por debajo del ancho mínimo soportado (RF-APP-002).
 *
 * El root layout es un Server Component async que renderiza `<html>`/`<body>`
 * y llama a `auth()`: no es renderizable con React Testing Library sobre
 * jsdom (jsdom ya posee su propio `document.documentElement`/`document.body`,
 * y el árbol de providers reales exigiría mockear `next/font/google`,
 * `@/auth`, `@/lib/env`, React Query, etc. solo para verificar dos strings de
 * clase). Por eso el gate en sí (`ViewportGate`) se testea rendereado
 * (`tests/components/layout/viewport-gate.test.tsx`) y este archivo verifica,
 * a nivel de código fuente, que:
 * - `<body>` lleva las clases que lo vuelven invisible/no-focuseable y sin
 *   scroll por debajo del piso (`max-floor:invisible max-floor:overflow-hidden`).
 * - `<html>` lleva `max-floor:overflow-hidden` (defensa adicional contra scroll).
 * - `ViewportGate` está importado y montado dentro de `<body>`, cubriendo
 *   toda la app (incluido login/registro, fuera del route group `(app)`).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const layoutSource = readFileSync(
  resolve(process.cwd(), "src/app/layout.tsx"),
  "utf-8",
);

describe("Root layout — gate por debajo del ancho mínimo soportado (RF-APP-002)", () => {
  it("importa y monta ViewportGate dentro de <body>", () => {
    expect(layoutSource).toMatch(
      /import\s*\{\s*ViewportGate\s*\}\s*from\s*"@\/components\/layout\/viewport-gate"/,
    );
    expect(layoutSource).toMatch(/<ViewportGate\s*\/>/);
  });

  it("<body> lleva las clases que lo vuelven invisible y sin scroll por debajo del piso", () => {
    // Captura el tag de apertura completo (no solo el atributo className):
    // el className usa un template literal con `${...}` que contiene `}`,
    // así que no alcanza con cortar en el primer `}`.
    const bodyMatch = layoutSource.match(/<body[\s\S]*?>/);
    expect(bodyMatch).not.toBeNull();

    const bodyOpenTag = bodyMatch![0]!;
    expect(bodyOpenTag).toContain("max-floor:invisible");
    expect(bodyOpenTag).toContain("max-floor:overflow-hidden");
  });

  it("<html> lleva max-floor:overflow-hidden (defensa adicional contra scroll)", () => {
    const htmlMatch = layoutSource.match(/<html\s+([^>]*)>/);
    expect(htmlMatch).not.toBeNull();

    const htmlAttrs = htmlMatch![1]!;
    expect(htmlAttrs).toContain("max-floor:overflow-hidden");
  });

  it("no hardcodea el ancho del piso (768/767) fuera del copy de RF-APP-002", () => {
    // El único lugar donde 768/767 puede aparecer en código de la app es la
    // definición del token (globals.css) y el copy exacto de RF-APP-002
    // (viewport-gate.tsx). El root layout no debe repetir el número.
    expect(layoutSource).not.toMatch(/76[78]/);
  });
});
