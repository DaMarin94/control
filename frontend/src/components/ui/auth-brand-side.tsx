/**
 * Panel de marca — lado izquierdo del layout split auth (Login / Registro).
 *
 * Fase 3 — Design system "Precise Ledger":
 *   Fondo: gradiente diagonal del acento (150deg, accent-press → accent → hue+30).
 *   Textura: grilla de líneas blancas/7% + máscara radial (clase .auth-grid-bg).
 *   Glow: radial blanco/18% en esquina inferior-derecha (clase .auth-glow).
 *   Contenido en space-between vertical:
 *     - Logo: gem cuadrado blanco 44px r-13px con "C" en accent-ink + wordmark.
 *     - Hero: h2 42px + párrafo copy.
 *     - Footer: ícono escudo + línea de privacidad.
 *
 * Los pseudo-elementos para grilla y glow se implementan con divs absolutos
 * porque Tailwind v4 no permite mascaras arbitrarias en before/after sin plugin.
 */

export function BrandSide() {
  return (
    <div
      className="relative overflow-hidden flex flex-col justify-between p-14 text-white max-[940px]:min-h-[280px]"
      style={{
        background:
          "linear-gradient(150deg, var(--accent-press), var(--accent) 60%, oklch(0.46 0.16 294))",
      }}
    >
      {/* Textura de grilla sutil con máscara radial */}
      <div className="auth-grid-bg" aria-hidden="true" />

      {/* Glow radial en esquina inferior-derecha */}
      <div className="auth-glow" aria-hidden="true" />

      {/* Logo */}
      <div className="relative flex items-center gap-[13px]">
        <div
          className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[13px] shadow-[0_6px_18px_oklch(0.2_0.05_270_/_0.3)]"
          style={{ background: "#fff" }}
          aria-label="Control"
        >
          <div className="h-[34px] w-[34px] rounded-[9px] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand-icon.svg"
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
        <b className="text-[22px] font-bold tracking-[-0.01em]">Control</b>
      </div>

      {/* Hero */}
      <div className="relative max-w-[440px]">
        <h2 className="m-0 mb-4 text-[42px] font-bold leading-[1.04] tracking-[-0.03em]">
          Tus finanzas del mes, sin sorpresas.
        </h2>
        <p className="m-0 text-[16px] leading-[1.55]" style={{ color: "oklch(1 0 0 / 0.82)" }}>
          Registrá gastos e ingresos, separá lo único de lo fijo y las cuotas, y mirá tu
          balance real de un vistazo.
        </p>
      </div>

      {/* Footer privacidad */}
      <div
        className="relative flex items-center gap-[9px] text-[13px]"
        style={{ color: "oklch(1 0 0 / 0.7)" }}
      >
        <ShieldCheckIcon />
        Privado · solo vos ves tus números.
      </div>
    </div>
  );
}

function ShieldCheckIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
