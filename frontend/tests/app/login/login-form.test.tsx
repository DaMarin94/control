/**
 * Tests del formulario de login.
 * Verifica: validación cliente, mensaje genérico en credenciales inválidas,
 * conservación del email ante error, llamada a signIn correcta.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "@/app/login/login-form";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue(null),
  }),
}));

// Mock del env para isGoogleConfigured
vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_API_URL: "http://localhost:4000", AUTH_SECRET: "test-secret-32-chars-for-tests!!" },
  isGoogleConfigured: false,
}));

import { signIn } from "next-auth/react";
import { ToastProvider } from "@/components/ui/toast";

const mockSignIn = vi.mocked(signIn);

function renderLoginForm() {
  return render(
    <ToastProvider>
      <LoginForm />
    </ToastProvider>,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza los campos email, password y el botón de submit", () => {
    renderLoginForm();

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  it("muestra error de validación si el email es inválido", async () => {
    const user = userEvent.setup();
    renderLoginForm();

    await user.type(screen.getByLabelText(/email/i), "no-es-email");
    await user.type(screen.getByLabelText(/contraseña/i), "cualquier");
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(screen.getByText(/ingresá un email válido/i)).toBeInTheDocument();
    });

    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("muestra error de validación si la contraseña está vacía", async () => {
    const user = userEvent.setup();
    renderLoginForm();

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(screen.getByText(/la contraseña es requerida/i)).toBeInTheDocument();
    });

    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("llama a signIn('credentials') con email y password correctos", async () => {
    const user = userEvent.setup();
    mockSignIn.mockResolvedValueOnce({ ok: true, error: null, status: 200, url: "/dashboard" });
    renderLoginForm();

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/contraseña/i), "password123");
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith("credentials", {
        email: "test@example.com",
        password: "password123",
        callbackUrl: "/dashboard",
        redirect: false,
      });
    });
  });

  it("muestra mensaje GENÉRICO si las credenciales son inválidas (no revela cuál falló)", async () => {
    const user = userEvent.setup();
    mockSignIn.mockResolvedValueOnce({
      ok: false,
      error: "CredentialsSignin",
      status: 401,
      url: null,
    });
    renderLoginForm();

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/contraseña/i), "wrongpassword");
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/email o contraseña incorrectos/i),
      ).toBeInTheDocument();
    });

    // El email debe permanecer en el campo
    expect(screen.getByLabelText(/email/i)).toHaveValue("test@example.com");
  });

  it("conserva el email en el campo después de un error de credenciales", async () => {
    const user = userEvent.setup();
    mockSignIn.mockResolvedValueOnce({
      ok: false,
      error: "CredentialsSignin",
      status: 401,
      url: null,
    });
    renderLoginForm();

    await user.type(screen.getByLabelText(/email/i), "my@email.com");
    await user.type(screen.getByLabelText(/contraseña/i), "bad");
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toHaveValue("my@email.com");
    });
  });

  it("botón de Google aparece deshabilitado cuando isGoogleConfigured es false", () => {
    renderLoginForm();
    const googleButton = screen.getByRole("button", { name: /google/i });
    expect(googleButton).toBeDisabled();
  });

  it("el botón de submit se deshabilita durante el loading", async () => {
    const user = userEvent.setup();
    // signIn que nunca resuelve (simula carga)
    mockSignIn.mockReturnValueOnce(new Promise(() => {}) as ReturnType<typeof signIn>);
    renderLoginForm();

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/contraseña/i), "password123");
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /iniciando sesión/i })).toBeDisabled();
    });
  });
});
