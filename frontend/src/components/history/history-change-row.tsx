/**
 * Una fila del bloque "Qué cambió" (docs/design.md §3 — patrón rótulo·valor,
 * mismo molde que `DetailRow` de la card de detalle de movimiento).
 *
 * Puramente presentacional: recibe la forma ya resuelta por
 * `describeHistoryChange` (lib/history.ts) y solo aplica layout/tipografía/tono.
 * - `leftText === null` → sin par (eliminación en modo de valor único, o el
 *   campo `autoDebit`, que nunca tiene par): se pinta solo `rightText`.
 * - `promoted` (exclusivo de `amount`) → escala 15.5px/600 en vez de 13px.
 * - `truncatable` → texto trunca con elipsis; el resto ENVUELVE entero, nunca
 *   se corta a la mitad (regla dura — ninguna cifra se trunca jamás).
 */

import type { HistoryChangeDisplay } from "@/lib/history";
import { cn } from "@/lib/utils";

function CategoryDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-[6px] w-[6px] rounded-full shrink-0"
      style={{ background: color }}
      aria-hidden="true"
    />
  );
}

export function HistoryChangeRow({ display }: { display: HistoryChangeDisplay }) {
  const rightToneClass = display.rightColorClass ?? (display.isState ? "text-ink-2" : "text-ink");
  const sizeClass = display.promoted ? "text-[15.5px] font-semibold" : "text-[13px]";
  const monoClass = display.mono ? "mono" : "";
  const valueWrapClass = display.truncatable ? "truncate min-w-0" : "whitespace-nowrap";

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-[16px] gap-y-[2px]">
      <span className="text-[12.5px] font-medium text-muted shrink-0">{display.label}</span>

      <span className="flex flex-wrap items-baseline justify-end gap-x-[8px] gap-y-[2px] min-w-0">
        {display.leftText !== null && (
          <span className={cn("inline-flex items-baseline gap-[5px] text-muted", sizeClass, monoClass, valueWrapClass)}>
            {display.leftDotColor && <CategoryDot color={display.leftDotColor} />}
            {display.leftText}
          </span>
        )}

        <span
          className={cn(
            "inline-flex items-baseline gap-[5px]",
            display.truncatable ? "min-w-0" : "whitespace-nowrap",
            sizeClass,
            monoClass,
            rightToneClass,
          )}
        >
          {display.leftText !== null && (
            <span className="text-faint" aria-hidden="true">
              →
            </span>
          )}
          {display.rightDotColor && <CategoryDot color={display.rightDotColor} />}
          <span className={display.truncatable ? "truncate min-w-0" : ""}>{display.rightText}</span>
        </span>
      </span>
    </div>
  );
}
