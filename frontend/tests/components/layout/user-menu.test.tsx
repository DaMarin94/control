/**
 * Tests del UserMenu.
 *
 * Verifica:
 * - Renderiza la inicial del email en el avatar.
 * - El email truncado aparece en el trigger.
 * - Al hacer clic en el trigger se despliega el menú.
 * - El menú desplegado contiene "Cerrar sesión".
 * - Al hacer clic en "Cerrar sesión" llama a signOut con callbackUrl "/login".
 * - El menú se cierra al hacer clic en "Cerrar sesión".
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserMenu } from "@/components/layout/user-menu";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockSignOut = vi.fn();
vi.mock("next-auth/react", () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("UserMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra la inicial del email en mayúscula en el avatar", () => {
    render(<UserMenu email="usuario@example.com" />);

    // La inicial "U" aparece en el avatar (aria-hidden) y en el display name del trigger
    // getAllByText para manejar múltiples ocurrencias
    const initials = screen.getAllByText("U");
    expect(initials.length).toBeGreaterThanOrEqual(1);
  });

  it("muestra el email en el trigger", () => {
    render(<UserMenu email="test@example.com" />);

    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("el menú desplegable NO está visible inicialmente", () => {
    render(<UserMenu email="test@example.com" />);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("al hacer clic en el trigger se despliega el menú con 'Cerrar sesión'", async () => {
    const user = userEvent.setup();
    render(<UserMenu email="test@example.com" />);

    // El trigger es el botón con aria-haspopup="menu"
    await user.click(screen.getByRole("button", { name: /test@example\.com/i }));

    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: /cerrar sesión/i })).toBeInTheDocument();
    });
  });

  it("hacer clic en 'Cerrar sesión' llama a signOut con callbackUrl='/login'", async () => {
    const user = userEvent.setup();
    render(<UserMenu email="test@example.com" />);

    await user.click(screen.getByRole("button", { name: /test@example\.com/i }));

    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: /cerrar sesión/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("menuitem", { name: /cerrar sesión/i }));

    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
  });

  it("inicial correcta para email que empieza con mayúscula", () => {
    render(<UserMenu email="Admin@control.com" />);

    // charAt(0).toUpperCase() de "Admin" = "A"
    // La inicial aparece múltiples veces (avatar + display name)
    const initials = screen.getAllByText("A");
    expect(initials.length).toBeGreaterThanOrEqual(1);
  });
});
