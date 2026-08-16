"use client";

/**
 * CaptureShell — envase de la superficie de captura (RF-APP-003,
 * docs/design.md §Superficie de captura). Anatomía de 3 zonas: cabecera
 * (identidad de sesión + tabs, pineada) / cuerpo scrolleable (el form
 * activo) / footer (un solo botón Guardar, pineado). Sin scrim, sin ✕, sin
 * body-lock: no hay nada debajo que tapar.
 *
 * Consume las composiciones PROPIAS de esta superficie
 * (`CaptureMovementTypeTabs` + `CaptureMovementForms`) — capa 3, hermanas
 * de las que usa el modal de escritorio, no una variante de ellas
 * (docs/design.md §0 "Encuadre — una lógica, dos composiciones"). La
 * densidad (§4) ya está resuelta en esas composiciones mismas: este envase
 * no aplica ningún mecanismo de cascada CSS.
 */

import { useRef, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CaptureMovementTypeTabs, type MovementTabId } from "@/components/capture/capture-movement-type-tabs";
import { CaptureMovementForms } from "@/components/capture/capture-movement-forms";
import {
  DEFAULT_MOVEMENT_FORM_FOOTER_STATE,
  type MovementFormFooterState,
} from "@/components/movements/movement-form-footer";
import { CaptureSessionChip } from "@/components/capture/capture-session-chip";
import { useVisualViewportInset } from "@/hooks/use-visual-viewport-inset";

export interface CaptureShellProps {
  email: string;
}

export function CaptureShell({ email }: CaptureShellProps) {
  const [activeTab, setActiveTab] = useState<MovementTabId>("single");
  const [footerState, setFooterState] = useState<MovementFormFooterState>(
    DEFAULT_MOVEMENT_FORM_FOOTER_STATE,
  );

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bodyContainerRef = useRef<HTMLDivElement>(null);
  // Sigue el viewport visual para empujar el footer por encima del teclado
  // (ver comentario de `viewport` en app/layout.tsx: interactive-widget es
  // "overlays-content" a propósito, así que el viewport de LAYOUT no se
  // encoge solo — este hook hace ese trabajo sin tocar ninguna media query).
  const keyboardInsetRef = useVisualViewportInset<HTMLDivElement>();

  function handleTabChange(tab: MovementTabId) {
    setActiveTab(tab);
    // El scroll vuelve al tope solo (el form del nuevo tab es un nodo nuevo,
    // sin posición de scroll previa) — nada que resetear a mano acá.
  }

  function handleCreateSuccess() {
    // Guardado con éxito (docs/design.md §9): scroll arriba, teclado cerrado
    // (blur del campo enfocado) y foco al contenedor del form — nunca a un
    // campo, para no reabrir el teclado solo.
    scrollContainerRef.current?.scrollTo({ top: 0 });
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    bodyContainerRef.current?.focus();
  }

  return (
    <div
      ref={keyboardInsetRef}
      className="flex flex-col overflow-hidden bg-paper"
      style={{ height: "calc(100dvh - var(--capture-keyboard-inset, 0px))" }}
    >
      {/* Título accesible — la pantalla no lleva título visible (las tabs ya
          dicen qué es); el documento igual necesita un encabezado. */}
      <h1 className="sr-only">Nuevo movimiento</h1>

      {/* ── Zona 1 — Cabecera: identidad de sesión + tabs (pineada) ──
          El fondo/hairline corren de borde a borde; el contenido se alinea
          a la columna de 480px (§1). */}
      <div
        className="shrink-0 border-b border-hair bg-panel pb-3"
        style={{
          paddingLeft: "max(16px, env(safe-area-inset-left))",
          paddingRight: "max(16px, env(safe-area-inset-right))",
          paddingTop: "max(10px, env(safe-area-inset-top))",
        }}
      >
        <div className="mx-auto flex w-full max-w-[480px] flex-col gap-3 short:flex-row short:items-center short:gap-2">
          <div className="min-w-0 short:max-w-[45%]">
            <CaptureSessionChip email={email} />
          </div>
          <div className="short:min-w-0 short:flex-1">
            <CaptureMovementTypeTabs activeTab={activeTab} onTabChange={handleTabChange} />
          </div>
        </div>
      </div>

      {/* ── Zona 2 — Cuerpo: el form activo (única región con scroll) ── */}
      <CaptureMovementForms
        activeTab={activeTab}
        onFooterStateChange={setFooterState}
        onCreateSuccess={handleCreateSuccess}
        scrollContainerRef={scrollContainerRef}
      />
      {/* Ancla de foco post-guardado (§9) — no es un campo, así el lector de
          pantalla anuncia el form y el teclado no se reabre solo. */}
      <div ref={bodyContainerRef} tabIndex={-1} className="sr-only" aria-hidden="true" />

      {/* ── Zona 3 — Footer: un solo botón Guardar, ancho completo ──
          Padding vía clases (no inline style): el bottom depende de `short:`
          (10px en apaisado vs 14px en vertical, §1/§12) — un inline style no
          puede reaccionar a esa media query, así que TODO el padding vive en
          clases Tailwind con valores arbitrarios (soportan max()/env()). ── */}
      <div className="shrink-0 border-t border-hair bg-panel pt-3 pb-[max(14px,env(safe-area-inset-bottom))] pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))] short:pt-[10px] short:pb-[max(10px,env(safe-area-inset-bottom))]">
        <Button
          type="submit"
          form={footerState.formId}
          disabled={footerState.disabled}
          className="flex mx-auto h-[52px] w-full max-w-[480px] gap-1.5 text-[16px] short:h-[48px]"
        >
          <Check size={16} aria-hidden="true" />
          {footerState.submitLabel}
        </Button>
      </div>
    </div>
  );
}
