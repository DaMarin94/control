/**
 * PaymentMethodIcon — único lugar que mapea una clave de la allowlist de íconos
 * de método de pago (types/payment-method.ts) a su glifo concreto.
 *
 * Fuente doble (docs/design.md, §Métodos de pago — identificador de ícono):
 * - Genéricos → lucide-react (outline, stroke).
 * - Marcas → simple-icons (glifo de un solo path, fill: currentColor).
 *
 * Renderizado SIEMPRE monocromo (currentColor / clases de tinta neutra pasadas
 * por className) — regla dura: nunca color semántico ni índigo de marca.
 * Una clave ausente del set (marca no disponible) cae al ícono "card" (fallback).
 */

import {
  CreditCard,
  Banknote,
  Coins,
  Wallet,
  Landmark,
  CircleDollarSign,
  QrCode,
  type LucideIcon,
} from "lucide-react";
import { siVisa, siMastercard, siAmericanexpress, siMercadopago, siPaypal } from "simple-icons";
import { normalizePaymentMethodIcon, type PaymentMethodIconKey } from "@/types/payment-method";

// ─── Genéricos (lucide) ────────────────────────────────────────────────────────

const GENERIC_ICON_COMPONENTS: Partial<Record<PaymentMethodIconKey, LucideIcon>> = {
  card: CreditCard,
  cash: Banknote,
  coins: Coins,
  wallet: Wallet,
  bank: Landmark,
  dollar: CircleDollarSign,
  qr: QrCode,
};

// ─── Marcas (simple-icons) ──────────────────────────────────────────────────────

interface BrandIconDef {
  title: string;
  path: string;
}

const BRAND_ICON_DEFS: Partial<Record<PaymentMethodIconKey, BrandIconDef>> = {
  visa: siVisa,
  mastercard: siMastercard,
  amex: siAmericanexpress,
  mercadopago: siMercadopago,
  paypal: siPaypal,
};

// ─── Componente ───────────────────────────────────────────────────────────────

export interface PaymentMethodIconProps {
  /** Clave del set curado (puede venir cualquier string del backend; se normaliza) */
  icon: string;
  size?: number;
  className?: string;
}

export function PaymentMethodIcon({ icon, size = 16, className }: PaymentMethodIconProps) {
  const key = normalizePaymentMethodIcon(icon);

  const Generic = GENERIC_ICON_COMPONENTS[key];
  if (Generic) {
    return <Generic size={size} className={className} strokeWidth={2} aria-hidden="true" />;
  }

  const brand = BRAND_ICON_DEFS[key];
  if (brand) {
    return (
      <svg
        role="img"
        aria-hidden="true"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={className}
        fill="currentColor"
      >
        <path d={brand.path} />
      </svg>
    );
  }

  // Fallback duro — no debería ocurrir: normalizePaymentMethodIcon ya cae a "card".
  return <CreditCard size={size} className={className} strokeWidth={2} aria-hidden="true" />;
}
