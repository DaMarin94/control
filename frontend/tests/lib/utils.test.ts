/**
 * Tests del helper cn (clsx + tailwind-merge).
 */

import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("combina clases simples", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("filtra valores falsy", () => {
    expect(cn("px-4", false && "py-2", undefined, null, "text-sm")).toBe("px-4 text-sm");
  });

  it("resuelve conflictos de Tailwind (tailwind-merge)", () => {
    // px-4 luego px-6 → px-6 gana
    expect(cn("px-4", "px-6")).toBe("px-6");
  });

  it("acepta clases condicionales con objeto clsx", () => {
    expect(cn({ "bg-primary": true, "text-white": false })).toBe("bg-primary");
  });

  it("permite prop className como override", () => {
    const base = "rounded-md bg-primary text-sm";
    const override = "bg-secondary";
    // bg-secondary reemplaza bg-primary
    expect(cn(base, override)).toBe("rounded-md text-sm bg-secondary");
  });

  it("devuelve string vacío si no hay clases", () => {
    expect(cn()).toBe("");
  });
});
