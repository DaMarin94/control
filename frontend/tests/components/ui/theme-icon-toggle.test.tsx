import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { ThemeIconToggle } from "@/components/ui/theme-icon-toggle";

describe("ThemeIconToggle", () => {
  it("el SSR no incluye el modo resuelto en el aria-label de Sistema (evita mismatch de hidratación)", () => {
    const html = renderToString(
      <ThemeIconToggle value="system" onChange={vi.fn()} resolvedTheme="dark" />,
    );
    expect(html).toContain('aria-label="Tema del sistema"');
    expect(html).not.toContain("ahora:");
  });

  it("tras montar, el label de Sistema incluye el modo resuelto", () => {
    render(<ThemeIconToggle value="system" onChange={vi.fn()} resolvedTheme="dark" />);
    expect(screen.getByRole("radio", { name: "Tema del sistema (ahora: oscuro)" })).toBeInTheDocument();
  });
});
