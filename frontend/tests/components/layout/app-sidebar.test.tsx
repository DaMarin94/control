/**
 * Tests del AppSidebar (RF-NAV-001).
 *
 * Verifica:
 * - Renderiza el logo "Control" con link al dashboard.
 * - Renderiza los tres links de navegación.
 * - El link activo tiene aria-current="page" (marca la sección activa).
 * - Dashboard activo solo en "/" exacto (no en /mes ni /categorias).
 * - El botón hamburguesa aparece (accesible por aria-label).
 * - Renderiza el botón "Nuevo movimiento".
 * - Renderiza el UserMenu con el email recibido.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppSidebar } from "@/components/layout/app-sidebar";

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock de next/navigation para controlar el pathname
const mockUsePathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock de next/link → renderiza un <a> simple
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock de NewTransactionButton (evita cargar toda la cadena de modales)
vi.mock("@/components/movements/new-transaction-button", () => ({
  NewTransactionButton: ({ label }: { label?: string }) => (
    <button type="button">{label ?? "Nuevo movimiento"}</button>
  ),
}));

// Mock de UserMenu
vi.mock("@/components/layout/user-menu", () => ({
  UserMenu: ({ email }: { email: string }) => (
    <div data-testid="user-menu">{email}</div>
  ),
}));

// ─── Helper ───────────────────────────────────────────────────────────────────

function renderSidebar(email = "test@example.com") {
  return render(<AppSidebar email={email} />);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AppSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza el logo 'Control' con enlace a /", () => {
    mockUsePathname.mockReturnValue("/");
    renderSidebar();

    const logo = screen.getAllByRole("link", { name: /control/i })[0];
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("href", "/");
  });

  it("renderiza los tres links de navegación", () => {
    mockUsePathname.mockReturnValue("/");
    renderSidebar();

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Vista del mes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Categorías" })).toBeInTheDocument();
  });

  it("el link 'Vista del mes' apunta a /mes (sin query)", () => {
    mockUsePathname.mockReturnValue("/mes");
    renderSidebar();

    const link = screen.getByRole("link", { name: "Vista del mes" });
    expect(link).toHaveAttribute("href", "/mes");
  });

  it("en / el link Dashboard tiene aria-current='page'", () => {
    mockUsePathname.mockReturnValue("/");
    renderSidebar();

    const dashLink = screen.getByRole("link", { name: "Dashboard" });
    expect(dashLink).toHaveAttribute("aria-current", "page");

    // Los otros no deben estar activos
    expect(screen.getByRole("link", { name: "Vista del mes" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Categorías" })).not.toHaveAttribute("aria-current");
  });

  it("en /mes el link 'Vista del mes' tiene aria-current='page' y Dashboard NO", () => {
    mockUsePathname.mockReturnValue("/mes");
    renderSidebar();

    expect(screen.getByRole("link", { name: "Vista del mes" })).toHaveAttribute("aria-current", "page");
    // Dashboard NO debe estar activo (comparación exacta, no prefijo)
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });

  it("en /categorias el link 'Categorías' tiene aria-current='page' y Dashboard NO", () => {
    mockUsePathname.mockReturnValue("/categorias");
    renderSidebar();

    expect(screen.getByRole("link", { name: "Categorías" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });

  it("renderiza el botón 'Nuevo movimiento'", () => {
    mockUsePathname.mockReturnValue("/");
    renderSidebar();

    expect(screen.getByRole("button", { name: /nuevo movimiento/i })).toBeInTheDocument();
  });

  it("renderiza el UserMenu con el email recibido", () => {
    mockUsePathname.mockReturnValue("/");
    renderSidebar("usuario@ejemplo.com");

    expect(screen.getByTestId("user-menu")).toHaveTextContent("usuario@ejemplo.com");
  });

  it("el botón hamburguesa está presente (aria-label 'Abrir menú')", () => {
    mockUsePathname.mockReturnValue("/");
    renderSidebar();

    expect(screen.getByRole("button", { name: /abrir menú/i })).toBeInTheDocument();
  });

  it("al hacer clic en hamburguesa se muestra el panel del drawer mobile", async () => {
    const user = userEvent.setup();
    mockUsePathname.mockReturnValue("/");
    renderSidebar();

    await user.click(screen.getByRole("button", { name: /abrir menú/i }));

    // Al abrir el drawer, aparece el botón de cerrar
    expect(screen.getByRole("button", { name: /cerrar menú/i })).toBeInTheDocument();
  });
});
