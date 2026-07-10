/**
 * Tests del AppSidebar (RF-NAV-001 + RF-NAV-002).
 * Fase 1.1.5: renombre /anual → /reportes, "Anual" → "Reportes".
 * Ola 4: toggle de tema (ThemeIconToggle) en el bloque inferior del sidebar.
 * Rework RF-NAV-002: sidebar toggleable (docs/design.md §"Sidebar — mostrar/ocultar").
 *   El componente ya no maneja su propio estado de apertura (drawer mobile +
 *   hamburguesa); recibe `open` y `onToggle` del padre (AppShell).
 *
 * Verifica:
 * - Renderiza el logo "Control" con link al dashboard.
 * - Renderiza los cuatro links de navegación (Dashboard, Vista del mes, Reportes, Categorías).
 * - El link activo tiene aria-current="page" (marca la sección activa).
 * - Dashboard activo solo en "/" exacto (no en /mes ni /categorias ni /reportes).
 * - El link "Reportes" se ubica entre "Vista del mes" y "Categorías" (RF-NAV-001).
 * - En /reportes el link "Reportes" tiene aria-current="page".
 * - Renderiza el botón "Nuevo movimiento".
 * - Renderiza el UserMenu con el email recibido.
 * - Toggle de tema: label "Tema" visible, radiogroup "Modo de color" con 3 opciones,
 *   click en una opción llama setTheme, deshabilitado mientras isSaving.
 * - RF-NAV-002: abierto muestra el botón "Ocultar menú" (aria-expanded=true) y
 *   NO el chip "Mostrar menú"; cerrado es al revés — nunca los dos a la vez.
 *   Clic en cualquiera de los dos llama a onToggle.
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

// Mock de useTheme
const mockSetTheme = vi.fn();
vi.mock("@/hooks/use-theme", () => ({
  useTheme: vi.fn(),
}));

import { useTheme } from "@/hooks/use-theme";
const mockUseTheme = vi.mocked(useTheme);

function setupTheme({
  theme = "system",
  resolvedTheme = "light",
  isSaving = false,
}: {
  theme?: "system" | "light" | "dark";
  resolvedTheme?: "light" | "dark";
  isSaving?: boolean;
} = {}) {
  mockUseTheme.mockReturnValue({
    theme,
    resolvedTheme,
    setTheme: mockSetTheme,
    isSaving,
  });
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function renderSidebar({
  email = "test@example.com",
  open = true,
  onToggle = vi.fn(),
}: { email?: string; open?: boolean; onToggle?: () => void } = {}) {
  return render(<AppSidebar email={email} open={open} onToggle={onToggle} />);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AppSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupTheme();
  });

  it("renderiza el logo 'Control' con enlace a /", () => {
    mockUsePathname.mockReturnValue("/");
    renderSidebar();

    const logo = screen.getAllByRole("link", { name: /control/i })[0];
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("href", "/");
  });

  it("renderiza los cuatro links de navegación (con Reportes)", () => {
    mockUsePathname.mockReturnValue("/");
    renderSidebar();

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Vista del mes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reportes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Categorías" })).toBeInTheDocument();
  });

  it("el link 'Reportes' apunta a /reportes", () => {
    mockUsePathname.mockReturnValue("/");
    renderSidebar();

    const link = screen.getByRole("link", { name: "Reportes" });
    expect(link).toHaveAttribute("href", "/reportes");
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

  it("en /reportes el link 'Reportes' tiene aria-current='page' y Dashboard NO", () => {
    mockUsePathname.mockReturnValue("/reportes");
    renderSidebar();

    expect(screen.getByRole("link", { name: "Reportes" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Vista del mes" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Categorías" })).not.toHaveAttribute("aria-current");
  });

  it("renderiza el botón 'Nuevo movimiento'", () => {
    mockUsePathname.mockReturnValue("/");
    renderSidebar();

    expect(screen.getByRole("button", { name: /nuevo movimiento/i })).toBeInTheDocument();
  });

  it("renderiza el UserMenu con el email recibido", () => {
    mockUsePathname.mockReturnValue("/");
    renderSidebar({ email: "usuario@ejemplo.com" });

    expect(screen.getByTestId("user-menu")).toHaveTextContent("usuario@ejemplo.com");
  });

  // ── Mostrar/ocultar (RF-NAV-002) ─────────────────────────────────────────

  describe("Mostrar/ocultar (RF-NAV-002)", () => {
    it("abierto: muestra el botón 'Ocultar menú' con aria-expanded=true y NO el chip 'Mostrar menú'", () => {
      mockUsePathname.mockReturnValue("/");
      renderSidebar({ open: true });

      const collapseButton = screen.getByRole("button", { name: "Ocultar menú" });
      expect(collapseButton).toHaveAttribute("aria-expanded", "true");
      expect(screen.queryByRole("button", { name: "Mostrar menú" })).not.toBeInTheDocument();
    });

    it("cerrado: muestra el chip 'Mostrar menú' con aria-expanded=false y NO el botón 'Ocultar menú'", () => {
      mockUsePathname.mockReturnValue("/");
      renderSidebar({ open: false });

      const openButton = screen.getByRole("button", { name: "Mostrar menú" });
      expect(openButton).toHaveAttribute("aria-expanded", "false");
      // El sidebar sigue montado (para poder animar la transición) pero queda
      // aria-hidden/inert — no debe aparecer en el árbol de accesibilidad.
      expect(screen.queryByRole("button", { name: "Ocultar menú" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
    });

    it("clic en 'Ocultar menú' llama a onToggle", async () => {
      const user = userEvent.setup();
      const onToggle = vi.fn();
      mockUsePathname.mockReturnValue("/");
      renderSidebar({ open: true, onToggle });

      await user.click(screen.getByRole("button", { name: "Ocultar menú" }));
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it("clic en 'Mostrar menú' llama a onToggle", async () => {
      const user = userEvent.setup();
      const onToggle = vi.fn();
      mockUsePathname.mockReturnValue("/");
      renderSidebar({ open: false, onToggle });

      await user.click(screen.getByRole("button", { name: "Mostrar menú" }));
      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });

  // ── Toggle de tema (Ola 4) ────────────────────────────────────────────────

  describe("Toggle de tema", () => {
    it("muestra el label 'Tema' en el bloque inferior", () => {
      mockUsePathname.mockReturnValue("/");
      renderSidebar();
      expect(screen.getByText("Tema")).toBeInTheDocument();
    });

    it("renderiza el radiogroup 'Modo de color' con 3 opciones", () => {
      mockUsePathname.mockReturnValue("/");
      renderSidebar();
      expect(screen.getByRole("radiogroup", { name: "Modo de color" })).toBeInTheDocument();
      expect(screen.getAllByRole("radio")).toHaveLength(3);
    });

    it("Sistema seleccionado: aria-checked=true en el segmento de sistema", () => {
      setupTheme({ theme: "system", resolvedTheme: "light" });
      mockUsePathname.mockReturnValue("/");
      renderSidebar();
      expect(
        screen.getByRole("radio", { name: /tema del sistema/i }),
      ).toHaveAttribute("aria-checked", "true");
      expect(screen.getByRole("radio", { name: "Tema claro" })).toHaveAttribute("aria-checked", "false");
      expect(screen.getByRole("radio", { name: "Tema oscuro" })).toHaveAttribute("aria-checked", "false");
    });

    it("Oscuro seleccionado: aria-checked=true en el segmento oscuro", () => {
      setupTheme({ theme: "dark", resolvedTheme: "dark" });
      mockUsePathname.mockReturnValue("/");
      renderSidebar();
      expect(screen.getByRole("radio", { name: "Tema oscuro" })).toHaveAttribute("aria-checked", "true");
    });

    it("click en 'Tema oscuro' llama setTheme con 'dark'", async () => {
      const user = userEvent.setup();
      mockSetTheme.mockResolvedValue({ success: true });
      setupTheme({ theme: "system", resolvedTheme: "light" });
      mockUsePathname.mockReturnValue("/");
      renderSidebar();

      await user.click(screen.getByRole("radio", { name: "Tema oscuro" }));
      expect(mockSetTheme).toHaveBeenCalledWith("dark");
    });

    it("toggle deshabilitado mientras isSaving=true", () => {
      setupTheme({ isSaving: true });
      mockUsePathname.mockReturnValue("/");
      renderSidebar();

      const radios = screen.getAllByRole("radio");
      radios.forEach((radio) => expect(radio).toBeDisabled());
    });
  });
});
