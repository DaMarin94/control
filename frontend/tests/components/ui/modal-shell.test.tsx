/**
 * Tests del contrato de `ModalShell` (docs/design.md §"Shell de modal
 * compartido (ModalShell) — pieza única"):
 * - Anatomía de 3 zonas: header pineado (shrink-0) · cuerpo scrolleable
 *   (flex-1 min-h-0 overflow-y-auto) · footer pineado (shrink-0).
 * - `max-height: calc(100dvh - 48px)` (dvh, no vh) atado al padding del scrim.
 * - Cierre: botón ✕ y `Esc` cierran; click en el scrim NO cierra.
 * - Body-lock del fondo mientras el modal está montado (ref-counted).
 * - `stacked` sube el scrim de z-40 a z-50 (apilamiento sobre otro modal).
 * - Portal a `document.body`.
 *
 * Nota: `role={role}` (default "dialog") se aplica al SCRIM (contenedor
 * `fixed inset-0`), no al panel. El panel es el primer hijo del scrim — de
 * ahí sale el `max-height`/`max-width`/clipping.
 */

import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ModalShell,
  ModalShellHeader,
  ModalShellBody,
  ModalShellFooter,
  type ModalShellProps,
} from "@/components/ui/modal-shell";

function renderShell(onClose = vi.fn(), extraProps: Partial<ModalShellProps> = {}) {
  return render(
    <ModalShell variant="dialog" onClose={onClose} labelledBy="shell-test-title" {...extraProps}>
      <ModalShellHeader titleId="shell-test-title" title="Título de prueba" onClose={onClose} />
      <ModalShellBody>
        <p>Cuerpo del modal</p>
      </ModalShellBody>
      <ModalShellFooter>
        <button type="button">Acción</button>
      </ModalShellFooter>
    </ModalShell>,
  );
}

/** El scrim es el elemento con `role="dialog"`/`"alertdialog"`; el panel es su primer hijo. */
function getScrimAndPanel(roleName: "dialog" | "alertdialog" = "dialog") {
  const scrim = screen.getByRole(roleName);
  const panel = scrim.firstElementChild as HTMLElement;
  return { scrim, panel };
}

describe("ModalShell — anatomía de 3 zonas", () => {
  it("renderiza header, cuerpo y footer, cada uno en su zona", () => {
    renderShell();

    expect(screen.getByText("Título de prueba")).toBeInTheDocument();
    expect(screen.getByText("Cuerpo del modal")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Acción" })).toBeInTheDocument();
  });

  it("el cuerpo es la única zona con overflow-y-auto (flex-1 min-h-0)", () => {
    renderShell();

    const body = screen.getByText("Cuerpo del modal").closest("div")!;
    expect(body.className).toMatch(/flex-1/);
    expect(body.className).toMatch(/min-h-0/);
    expect(body.className).toMatch(/overflow-y-auto/);
  });

  it("header y footer son shrink-0 (pineados, no scrollean)", () => {
    renderShell();

    const header = screen.getByText("Título de prueba").closest("div")!;
    const footer = screen.getByRole("button", { name: "Acción" }).closest("div")!;
    expect(header.className).toMatch(/shrink-0/);
    expect(footer.className).toMatch(/shrink-0/);
  });

  it("el panel usa max-height: calc(100dvh - 48px) — dvh, no vh", () => {
    renderShell();

    const { panel } = getScrimAndPanel();
    expect(panel.className).toContain("max-h-[calc(100dvh-48px)]");
    // Nunca la variante `vh` (offender original de create-limit-modal).
    expect(panel.className).not.toMatch(/max-h-\[calc\(100vh/);
  });

  it("el panel queda clippeado a las esquinas (overflow-hidden) y es una columna flex", () => {
    renderShell();

    const { panel } = getScrimAndPanel();
    expect(panel.className).toMatch(/overflow-hidden/);
    expect(panel.className).toMatch(/flex-col/);
  });
});

describe("ModalShell — cierre", () => {
  it("el botón ✕ del header invoca onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderShell(onClose);

    await user.click(screen.getByRole("button", { name: /cerrar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Esc invoca onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderShell(onClose);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("un click en el scrim NO invoca onClose (decisión explícita, no click-afuera)", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderShell(onClose);

    const { scrim } = getScrimAndPanel();
    await user.click(scrim);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("ModalShell — closeOnScrimClick (excepción opt-in, ej: card de detalle)", () => {
  it("closeOnScrimClick=true: un click en el scrim SÍ invoca onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderShell(onClose, { closeOnScrimClick: true });

    const { scrim } = getScrimAndPanel();
    await user.click(scrim);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closeOnScrimClick=true: un click DENTRO del panel NO invoca onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderShell(onClose, { closeOnScrimClick: true });

    await user.click(screen.getByText("Cuerpo del modal"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closeOnScrimClick=true: el shell montado como hijo de un disparador con su propio onClick no se reabre al cerrar por scrim (gotcha: el evento sintético de React burbujea por el árbol de React, no el de DOM, aunque el shell se porte a document.body)", async () => {
    const user = userEvent.setup();
    // Reproduce el caso real: MovementItemRow abre la card con
    // onClick={() => setIsDetailOpen(true)} en un contenedor que envuelve
    // (en el árbol de React) al ModalShell portado.
    function Trigger() {
      const [open, setOpen] = useState(true);
      return (
        <div onClick={() => setOpen(true)} data-testid="row">
          {open && (
            <ModalShell
              variant="dialog"
              onClose={() => setOpen(false)}
              labelledBy="trigger-title"
              closeOnScrimClick
            >
              <ModalShellHeader titleId="trigger-title" title="Detalle" />
              <ModalShellBody>
                <p>Contenido</p>
              </ModalShellBody>
            </ModalShell>
          )}
        </div>
      );
    }
    render(<Trigger />);

    const { scrim } = getScrimAndPanel();
    await user.click(scrim);
    expect(screen.queryByText("Contenido")).not.toBeInTheDocument();
  });
});

describe("ModalShell — portal y apilamiento", () => {
  it("se monta por portal directo en document.body", () => {
    renderShell();
    const { scrim } = getScrimAndPanel();
    expect(scrim.parentElement).toBe(document.body);
  });

  it("por default el scrim usa z-40 (capa base)", () => {
    renderShell();
    const { scrim } = getScrimAndPanel();
    expect(scrim.className).toMatch(/z-40/);
  });

  it("con stacked=true el scrim usa z-50 (apilado sobre otro modal)", () => {
    renderShell(vi.fn(), { stacked: true });
    const { scrim } = getScrimAndPanel();
    expect(scrim.className).toMatch(/z-50/);
  });

  it("role=alertdialog se propaga cuando se pasa explícito", () => {
    renderShell(vi.fn(), { role: "alertdialog" });
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});

describe("ModalShell — body-lock del fondo", () => {
  it("bloquea el scroll del body mientras el modal está montado, y lo libera al desmontar", () => {
    const { unmount } = renderShell();
    expect(document.body.classList.contains("body-scroll-locked")).toBe(true);

    unmount();
    expect(document.body.classList.contains("body-scroll-locked")).toBe(false);
  });

  it("el lock persiste mientras haya ≥1 modal abierto (ref-counted, apilamiento)", () => {
    const { unmount: unmountFirst } = renderShell();
    const { unmount: unmountSecond } = render(
      <ModalShell variant="dialog" stacked onClose={vi.fn()} labelledBy="second-title">
        <ModalShellHeader titleId="second-title" title="Segundo modal" />
        <ModalShellBody>
          <p>Cuerpo 2</p>
        </ModalShellBody>
        <ModalShellFooter>
          <button type="button">Ok</button>
        </ModalShellFooter>
      </ModalShell>,
    );

    expect(document.body.classList.contains("body-scroll-locked")).toBe(true);

    // Cerrar el de encima: el lock persiste porque el primero sigue abierto.
    unmountSecond();
    expect(document.body.classList.contains("body-scroll-locked")).toBe(true);

    // Cerrar el último: recién ahí se libera.
    unmountFirst();
    expect(document.body.classList.contains("body-scroll-locked")).toBe(false);
  });
});

describe("ModalShell — variantes", () => {
  it("variant='dialog' usa max-w-[440px]", () => {
    renderShell(vi.fn(), { variant: "dialog" });
    const { panel } = getScrimAndPanel();
    expect(panel.className).toContain("max-w-[440px]");
  });

  it("variant='form' usa max-w-[460px]", () => {
    renderShell(vi.fn(), { variant: "form" });
    const { panel } = getScrimAndPanel();
    expect(panel.className).toContain("max-w-[460px]");
  });
});
