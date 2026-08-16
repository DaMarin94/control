/**
 * Tests de CaptureSessionChip — chrome de sesión de la superficie de captura
 * (docs/design.md §Superficie de captura → "5.
 * Cabecera A"). Verifica:
 * - El email de la cuenta activa se ve sin tocar nada.
 * - El popover NO está visible inicialmente.
 * - Tocar el chip abre un popover con UN SOLO ítem ("Cerrar sesión") — regla
 *   dura de la superficie (RF-APP-003: la única capacidad además de crear).
 * - "Cerrar sesión" llama a signOut con callbackUrl="/login" (mismo destino
 *   que el cierre de sesión de escritorio).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CaptureSessionChip } from "@/components/capture/capture-session-chip";

const mockSignOut = vi.fn();
vi.mock("next-auth/react", () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

describe("CaptureSessionChip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra el email de la cuenta activa sin ninguna acción del usuario", () => {
    render(<CaptureSessionChip email="usuario@control.com" />);
    expect(screen.getByText("usuario@control.com")).toBeInTheDocument();
  });

  it("el popover no está visible inicialmente", () => {
    render(<CaptureSessionChip email="usuario@control.com" />);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("tocar el chip abre un popover con exactamente UN ítem: 'Cerrar sesión'", async () => {
    const user = userEvent.setup();
    render(<CaptureSessionChip email="usuario@control.com" />);

    await user.click(screen.getByRole("button", { name: /usuario@control\.com/i }));

    await waitFor(() => {
      const menu = screen.getByRole("menu");
      expect(menu).toBeInTheDocument();
      const items = screen.getAllByRole("menuitem");
      expect(items).toHaveLength(1);
      expect(items[0]).toHaveTextContent(/cerrar sesión/i);
    });
  });

  it("'Cerrar sesión' llama a signOut con callbackUrl='/login'", async () => {
    const user = userEvent.setup();
    render(<CaptureSessionChip email="usuario@control.com" />);

    await user.click(screen.getByRole("button", { name: /usuario@control\.com/i }));
    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: /cerrar sesión/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("menuitem", { name: /cerrar sesión/i }));

    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
  });
});
