/**
 * Tests del hook useRegister.
 * Verifica los flujos: registro exitoso, email en uso (409), error de red/servidor.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRegister } from "@/hooks/use-register";

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock de next-auth/react
vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

// Mock de la capa de API
vi.mock("@/lib/api", () => ({
  api: {
    post: vi.fn(),
  },
}));

import { signIn } from "next-auth/react";
import { api } from "@/lib/api";
import { ApiError } from "@/types/api";

const mockSignIn = vi.mocked(signIn);
const mockApiPost = vi.mocked(api.post);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useRegister", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registro exitoso: llama a /auth/register y luego a signIn", async () => {
    mockApiPost.mockResolvedValueOnce({ accessToken: "tok", user: { id: "1", email: "a@b.com", name: null, image: null } });
    // signIn con redirect:true devuelve never/void — simular con Promise vacía
    mockSignIn.mockImplementation(() => Promise.resolve(undefined) as never);

    const { result } = renderHook(() => useRegister());

    let registerResult: Awaited<ReturnType<typeof result.current.register>>;

    await act(async () => {
      registerResult = await result.current.register({
        email: "test@example.com",
        password: "password123",
      });
    });

    expect(mockApiPost).toHaveBeenCalledWith("/auth/register", {
      email: "test@example.com",
      password: "password123",
    });

    expect(mockSignIn).toHaveBeenCalledWith("credentials", {
      email: "test@example.com",
      password: "password123",
      callbackUrl: "/",
      redirect: true,
    });

    expect(registerResult!.success).toBe(true);
  });

  it("registro exitoso: usa redirectTo personalizado en signIn", async () => {
    mockApiPost.mockResolvedValueOnce({ accessToken: "tok", user: { id: "1", email: "a@b.com", name: null, image: null } });
    mockSignIn.mockImplementation(() => Promise.resolve(undefined) as never);

    const { result } = renderHook(() => useRegister());

    await act(async () => {
      await result.current.register({
        email: "test@example.com",
        password: "password123",
        redirectTo: "/custom",
      });
    });

    expect(mockSignIn).toHaveBeenCalledWith(
      "credentials",
      expect.objectContaining({ callbackUrl: "/custom" }),
    );
  });

  it("409 email en uso: devuelve emailInUse=true sin llamar a signIn", async () => {
    mockApiPost.mockRejectedValueOnce(new ApiError("El email ya está registrado", 409));

    const { result } = renderHook(() => useRegister());

    let registerResult: Awaited<ReturnType<typeof result.current.register>>;

    await act(async () => {
      registerResult = await result.current.register({
        email: "taken@example.com",
        password: "password123",
      });
    });

    expect(registerResult!.success).toBe(false);
    expect(registerResult!.emailInUse).toBe(true);
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("400 validación backend: devuelve error con el mensaje del backend", async () => {
    mockApiPost.mockRejectedValueOnce(new ApiError("El password debe tener al menos 8 caracteres", 400));

    const { result } = renderHook(() => useRegister());

    let registerResult: Awaited<ReturnType<typeof result.current.register>>;

    await act(async () => {
      registerResult = await result.current.register({
        email: "test@example.com",
        password: "short",
      });
    });

    expect(registerResult!.success).toBe(false);
    expect(registerResult!.error).toBe("El password debe tener al menos 8 caracteres");
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("error de servidor (500): devuelve error genérico", async () => {
    mockApiPost.mockRejectedValueOnce(new ApiError("Internal Server Error", 500));

    const { result } = renderHook(() => useRegister());

    let registerResult: Awaited<ReturnType<typeof result.current.register>>;

    await act(async () => {
      registerResult = await result.current.register({
        email: "test@example.com",
        password: "password123",
      });
    });

    expect(registerResult!.success).toBe(false);
    expect(registerResult!.error).toBe("Ocurrió un error al registrarte. Intentalo de nuevo.");
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("isLoading: es true durante la operación y false al terminar", async () => {
    let resolvePost: (value: unknown) => void;
    const postPromise = new Promise((res) => {
      resolvePost = res;
    });

    mockApiPost.mockReturnValueOnce(postPromise as ReturnType<typeof api.post>);
    mockSignIn.mockImplementation(() => Promise.resolve(undefined) as never);

    const { result } = renderHook(() => useRegister());

    expect(result.current.isLoading).toBe(false);

    act(() => {
      void result.current.register({ email: "a@b.com", password: "12345678" });
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolvePost!({ accessToken: "t", user: { id: "1", email: "a@b.com", name: null, image: null } });
      await postPromise;
    });

    expect(result.current.isLoading).toBe(false);
  });
});
