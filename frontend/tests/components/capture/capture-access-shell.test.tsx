/**
 * Tests de CaptureAccessShell — acceso (login) en régimen de captura (RF-APP-004,
 * docs/design.md §Superficie de captura → "13. Acceso (login) en régimen de
 * captura"). Verifica:
 * - Orden: Email → Contraseña → "Iniciar sesión" → separador "o" → Google
 *   (al revés del login de escritorio, que arranca con Google).
 * - Sin enlace a "Crear cuenta" (RF-AUTH-006 no alcanzable en régimen de captura).
 * - Reusa la misma lógica que el login de escritorio (signIn con las mismas
 *   credenciales).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CaptureAccessShell } from "@/components/capture/capture-access-shell";

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue(null),
  }),
}));

import { signIn } from "next-auth/react";
import { ToastProvider } from "@/components/ui/toast";

const mockSignIn = vi.mocked(signIn);

function renderAccess(isGoogleConfigured = false) {
  return render(
    <ToastProvider>
      <CaptureAccessShell isGoogleConfigured={isGoogleConfigured} />
    </ToastProvider>,
  );
}

describe("CaptureAccessShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("título 'Ingresá a Control' y los campos email/contraseña", () => {
    renderAccess();
    expect(screen.getByRole("heading", { name: /ingresá a control/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
  });

  it("orden de los controles: Email, Contraseña, Iniciar sesión, separador 'o', Google", () => {
    renderAccess();
    const buttons = screen.getAllByRole("button").map((b) => b.textContent);
    const separator = screen.getByText("o");
    expect(separator).toBeInTheDocument();

    // El botón "Iniciar sesión" aparece ANTES que el de Google en el DOM
    // (credenciales primero — RF-APP-004: "el camino principal").
    const submitIndex = buttons.findIndex((t) => /iniciar sesión/i.test(t ?? ""));
    const googleIndex = buttons.findIndex((t) => /google/i.test(t ?? ""));
    expect(submitIndex).toBeGreaterThanOrEqual(0);
    expect(googleIndex).toBeGreaterThan(submitIndex);
  });

  it("NO ofrece ningún enlace a crear cuenta / registro (solo fine print de Términos/Privacidad)", () => {
    renderAccess();
    const links = screen.getAllByRole("link");
    expect(links.every((l) => !/registro|crear cuenta/i.test(l.getAttribute("href") ?? ""))).toBe(true);
    expect(screen.queryByText(/crear cuenta|registrate|¿no tenés cuenta/i)).not.toBeInTheDocument();
  });

  it("llama a signIn('credentials') con email y password (misma lógica que el login de escritorio)", async () => {
    const user = userEvent.setup();
    mockSignIn.mockResolvedValueOnce({ ok: true, error: undefined, code: undefined, status: 200, url: "/" });
    renderAccess();

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/contraseña/i), "password123");
    await user.click(screen.getByRole("button", { name: /^iniciar sesión$/i }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith("credentials", {
        email: "test@example.com",
        password: "password123",
        callbackUrl: "/",
        redirect: false,
      });
    });
  });

  it("botón de Google deshabilitado y rotulado cuando el proveedor no está configurado", () => {
    renderAccess(false);
    const googleButton = screen.getByRole("button", { name: /google/i });
    expect(googleButton).toBeDisabled();
    expect(googleButton).toHaveTextContent(/no disponible/i);
  });
});
