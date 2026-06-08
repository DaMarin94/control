/**
 * Tests del formulario de registro.
 * Verifica: validación cliente (email, password, confirmación), flujo OK,
 * error de email en uso (409), conservación del email ante error.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegisterForm } from "@/app/registro/register-form";
import { ToastProvider } from "@/components/ui/toast";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue(null),
  }),
}));

vi.mock("@/hooks/use-register", () => ({
  useRegister: vi.fn(),
}));

import { useRegister } from "@/hooks/use-register";

const mockUseRegister = vi.mocked(useRegister);

function renderRegisterForm() {
  return render(
    <ToastProvider>
      <RegisterForm />
    </ToastProvider>,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("RegisterForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup por defecto: registro no hace nada
    mockUseRegister.mockReturnValue({
      register: vi.fn().mockResolvedValue({ success: true }),
      isLoading: false,
    });
  });

  it("renderiza los campos email, password, confirmación y el botón de submit", () => {
    renderRegisterForm();

    expect(screen.getByLabelText(/^email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^contraseña/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmá/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /crear cuenta/i })).toBeInTheDocument();
  });

  it("muestra error si el email es inválido", async () => {
    const user = userEvent.setup();
    renderRegisterForm();

    await user.type(screen.getByLabelText(/^email/i), "no-es-email");
    await user.type(screen.getByLabelText(/^contraseña/i), "password123");
    await user.type(screen.getByLabelText(/confirmá/i), "password123");
    await user.click(screen.getByRole("button", { name: /crear cuenta/i }));

    await waitFor(() => {
      expect(screen.getByText(/ingresá un email válido/i)).toBeInTheDocument();
    });

    expect(mockUseRegister().register).not.toHaveBeenCalled();
  });

  it("muestra error si la contraseña tiene menos de 8 caracteres", async () => {
    const user = userEvent.setup();
    renderRegisterForm();

    await user.type(screen.getByLabelText(/^email/i), "test@example.com");
    await user.type(screen.getByLabelText(/^contraseña/i), "corta");
    await user.type(screen.getByLabelText(/confirmá/i), "corta");
    await user.click(screen.getByRole("button", { name: /crear cuenta/i }));

    await waitFor(() => {
      expect(screen.getByText(/al menos 8 caracteres/i)).toBeInTheDocument();
    });
  });

  it("muestra error si las contraseñas no coinciden", async () => {
    const user = userEvent.setup();
    renderRegisterForm();

    await user.type(screen.getByLabelText(/^email/i), "test@example.com");
    await user.type(screen.getByLabelText(/^contraseña/i), "password123");
    await user.type(screen.getByLabelText(/confirmá/i), "diferente123");
    await user.click(screen.getByRole("button", { name: /crear cuenta/i }));

    await waitFor(() => {
      expect(screen.getByText(/las contraseñas no coinciden/i)).toBeInTheDocument();
    });
  });

  it("llama a register con email y password cuando el formulario es válido", async () => {
    const user = userEvent.setup();
    const mockRegister = vi.fn().mockResolvedValue({ success: true });
    mockUseRegister.mockReturnValue({ register: mockRegister, isLoading: false });

    renderRegisterForm();

    await user.type(screen.getByLabelText(/^email/i), "test@example.com");
    await user.type(screen.getByLabelText(/^contraseña/i), "password123");
    await user.type(screen.getByLabelText(/confirmá/i), "password123");
    await user.click(screen.getByRole("button", { name: /crear cuenta/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "test@example.com",
          password: "password123",
        }),
      );
    });
  });

  it("muestra error en el campo email si el email está en uso (409)", async () => {
    const user = userEvent.setup();
    const mockRegister = vi
      .fn()
      .mockResolvedValue({ success: false, emailInUse: true });
    mockUseRegister.mockReturnValue({ register: mockRegister, isLoading: false });

    renderRegisterForm();

    await user.type(screen.getByLabelText(/^email/i), "taken@example.com");
    await user.type(screen.getByLabelText(/^contraseña/i), "password123");
    await user.type(screen.getByLabelText(/confirmá/i), "password123");
    await user.click(screen.getByRole("button", { name: /crear cuenta/i }));

    await waitFor(() => {
      expect(screen.getByText(/ya está registrado/i)).toBeInTheDocument();
    });

    // El email debe conservarse
    expect(screen.getByLabelText(/^email/i)).toHaveValue("taken@example.com");
  });

  it("el email se conserva en el campo tras error de email en uso", async () => {
    const user = userEvent.setup();
    const mockRegister = vi
      .fn()
      .mockResolvedValue({ success: false, emailInUse: true });
    mockUseRegister.mockReturnValue({ register: mockRegister, isLoading: false });

    renderRegisterForm();

    await user.type(screen.getByLabelText(/^email/i), "taken@example.com");
    await user.type(screen.getByLabelText(/^contraseña/i), "password123");
    await user.type(screen.getByLabelText(/confirmá/i), "password123");
    await user.click(screen.getByRole("button", { name: /crear cuenta/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^email/i)).toHaveValue("taken@example.com");
    });
  });

  it("muestra el botón en estado loading cuando isLoading es true", () => {
    mockUseRegister.mockReturnValue({
      register: vi.fn(),
      isLoading: true,
    });

    renderRegisterForm();

    expect(screen.getByRole("button", { name: /creando cuenta/i })).toBeDisabled();
  });
});
