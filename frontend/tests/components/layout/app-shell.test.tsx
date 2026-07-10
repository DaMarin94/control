/**
 * Tests de AppShell (RF-NAV-002) — integra AppSidebar + <main> compartiendo
 * el estado de abierto/cerrado del sidebar.
 *
 * Verifica:
 * - <main> arranca con marginLeft 248px cuando initialSidebarOpen=true.
 * - <main> arranca con marginLeft 0 cuando initialSidebarOpen=false (sin flash:
 *   el valor inicial viene directo de la prop server-rendered, no de un efecto).
 * - Clic en "Ocultar menú" (dentro del sidebar) lleva <main> a marginLeft 0.
 * - Clic en "Mostrar menú" (chip flotante) lleva <main> a marginLeft 248px.
 * - <main> es `@container` (ancla de las container queries del área de contenido).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppShell } from "@/components/layout/app-shell";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/movements/new-transaction-button", () => ({
  NewTransactionButton: ({ label }: { label?: string }) => (
    <button type="button">{label ?? "Nuevo movimiento"}</button>
  ),
}));

vi.mock("@/components/layout/user-menu", () => ({
  UserMenu: ({ email }: { email: string }) => <div data-testid="user-menu">{email}</div>,
}));

vi.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({
    theme: "system",
    resolvedTheme: "light",
    setTheme: vi.fn(),
    isSaving: false,
  }),
}));

const mockSetPreferences = vi.fn().mockResolvedValue({ success: true, preferences: {} });
vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: () => ({
    preferences: {},
    isLoading: false,
    isError: false,
    error: null,
    setPreferences: mockSetPreferences,
    isSaving: false,
  }),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AppShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("<main> arranca con marginLeft 248px cuando initialSidebarOpen=true (sin flash)", () => {
    render(
      <AppShell email="test@example.com" initialSidebarOpen={true}>
        <div>contenido</div>
      </AppShell>,
    );

    const main = screen.getByText("contenido").closest("main");
    expect(main).toHaveStyle({ marginLeft: "248px" });
  });

  it("<main> arranca con marginLeft 0 cuando initialSidebarOpen=false (sin flash)", () => {
    render(
      <AppShell email="test@example.com" initialSidebarOpen={false}>
        <div>contenido</div>
      </AppShell>,
    );

    const main = screen.getByText("contenido").closest("main");
    expect(main).toHaveStyle({ marginLeft: "0px" });
  });

  it("<main> es @container (ancla de las container queries del área de contenido)", () => {
    render(
      <AppShell email="test@example.com" initialSidebarOpen={true}>
        <div>contenido</div>
      </AppShell>,
    );

    const main = screen.getByText("contenido").closest("main");
    expect(main).toHaveClass("@container");
  });

  it("clic en 'Ocultar menú' lleva <main> a marginLeft 0", async () => {
    const user = userEvent.setup();
    render(
      <AppShell email="test@example.com" initialSidebarOpen={true}>
        <div>contenido</div>
      </AppShell>,
    );

    await user.click(screen.getByRole("button", { name: "Ocultar menú" }));

    const main = screen.getByText("contenido").closest("main");
    expect(main).toHaveStyle({ marginLeft: "0px" });
  });

  it("clic en 'Mostrar menú' lleva <main> a marginLeft 248px", async () => {
    const user = userEvent.setup();
    render(
      <AppShell email="test@example.com" initialSidebarOpen={false}>
        <div>contenido</div>
      </AppShell>,
    );

    await user.click(screen.getByRole("button", { name: "Mostrar menú" }));

    const main = screen.getByText("contenido").closest("main");
    expect(main).toHaveStyle({ marginLeft: "248px" });
  });

  it("persiste sidebarOpen en el blob de preferencias al hacer toggle", async () => {
    const user = userEvent.setup();
    render(
      <AppShell email="test@example.com" initialSidebarOpen={true}>
        <div>contenido</div>
      </AppShell>,
    );

    await user.click(screen.getByRole("button", { name: "Ocultar menú" }));

    expect(mockSetPreferences).toHaveBeenCalledWith({ sidebarOpen: false });
  });
});
