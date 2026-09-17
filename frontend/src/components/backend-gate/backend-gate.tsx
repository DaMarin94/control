"use client";

/**
 * Gate de arranque del backend — pantalla de espera a pantalla completa
 * (docs/design.md §"Gate de arranque del backend").
 *
 * Tapa TODA la app (incluido /login) mientras el backend está despertando
 * (plan free de Render: suspende tras ~15 min, el primer request tarda ~50s).
 * Sin esta superficie la app se lee como colgada.
 *
 * Montaje: tercer hermano del root layout, FUERA de `capture:hidden` y FUERA
 * de `CaptureSurfaceRoot`, por encima de los dos. Es UNA SOLA superficie para
 * los dos regímenes: deliberadamente SIN variante `capture:`/`max-wide:` de
 * visibilidad — ocultarla en un régimen dejaría a ese régimen sin gate.
 *
 * Todo el color/tipografía vive en las clases `.gate-*` de globals.css (el
 * negro `--gate-bg` no se repite suelto en ningún .tsx) y la máquina de
 * estados en `useBackendGate`. Acá queda solo la composición.
 */

import { useEffect, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { useBackendGate, type GateContent, type GatePhase } from "@/hooks/use-backend-gate";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";

/**
 * Ruta estable del GIF de espera. La caja del encuadre es cuadrada y de lado
 * fijo (globals.css, `.gate-gif-box`): reserva el layout ANTES de que el GIF
 * cargue, así el texto no se mueve al llegar la imagen. Si el archivo no
 * existe, `onError` retira el <img> y la caja queda vacía (negra sobre negro):
 * degrada limpio, sin ícono de imagen rota.
 */
const GATE_GIF_SRC = "/backend-waking.gif";

export function BackendGate() {
  const { phase, content, contentVisible, retry } = useBackendGate();

  // Cero-impacto con el backend despierto: la superficie ni siquiera se monta.
  if (phase === "hidden") return null;

  return (
    <BackendGateSurface
      phase={phase}
      content={content}
      contentVisible={contentVisible}
      onRetry={retry}
    />
  );
}

interface BackendGateSurfaceProps {
  phase: GatePhase;
  content: GateContent;
  contentVisible: boolean;
  onRetry: () => void;
}

function BackendGateSurface({ phase, content, contentVisible, onRetry }: BackendGateSurfaceProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const [gifFailed, setGifFailed] = useState(false);

  // Mismo contrato de bloqueo de fondo que los modales (docs/design.md
  // §"Overflow de modales y bloqueo del fondo").
  useBodyScrollLock();

  /**
   * El fondo queda inerte mientras el gate está montado: sin esto, el Tab
   * entra en un login que no se ve. Se marcan los HERMANOS del gate en cada
   * nivel hasta <body> (no solo los hijos de <body>): el gate vive dentro del
   * árbol de providers, que puede o no introducir nodos DOM intermedios. Los
   * toasts, que portan a <body>, quedan cubiertos por el último nivel.
   */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const marked: Element[] = [];
    let node: Element = root;

    while (node.parentElement) {
      const parent = node.parentElement;
      for (const sibling of Array.from(parent.children)) {
        if (sibling !== node && !sibling.hasAttribute("inert")) {
          sibling.setAttribute("inert", "");
          marked.push(sibling);
        }
      }
      if (parent === document.body) break;
      node = parent;
    }

    return () => {
      marked.forEach((el) => el.removeAttribute("inert"));
    };
  }, []);

  /**
   * Al entrar en `error`, el foco va al botón: es la única acción de la
   * pantalla y el usuario puede haber dejado la pestaña hace tres minutos.
   */
  useEffect(() => {
    if (content === "error") retryRef.current?.focus();
  }, [content]);

  const isError = content === "error";

  return (
    <div
      ref={rootRef}
      data-testid="backend-gate"
      data-phase={phase}
      className="gate-surface"
      role={isError ? "alert" : "status"}
      aria-live={isError ? undefined : "polite"}
      aria-label={isError ? undefined : "Despertando el servidor"}
    >
      <div className="gate-block">
        <div className="gate-content" data-visible={contentVisible}>
          {isError ? (
            <>
              <TriangleAlert className="gate-error-glyph" size={40} aria-hidden="true" />
              <h2 className="gate-error-title">El servidor está tardando más de lo normal</h2>
              <p className="gate-error-sub">
                Puede estar arrancando todavía. Probá de nuevo en unos segundos.
              </p>
              <button
                ref={retryRef}
                type="button"
                className="gate-retry"
                onClick={onRetry}
                disabled={!contentVisible}
              >
                Reintentar
              </button>
            </>
          ) : (
            <>
              <div className="gate-gif-box">
                {!gifFailed && (
                  // Decorativo: el significado lo carga el texto de abajo.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={GATE_GIF_SRC}
                    alt=""
                    aria-hidden="true"
                    className="gate-gif"
                    onError={() => setGifFailed(true)}
                  />
                )}
              </div>
              <p className="gate-waking-text">Despertando el servidor…</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
