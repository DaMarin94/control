import { Currency } from '@prisma/client';

/**
 * Convierte un monto en centavos de su moneda original a la moneda default del usuario.
 *
 * La cotización es ARS/1 USD (cuántos ARS vale 1 USD).
 *
 * Conversiones:
 *   - ARS → ARS: sin cambio (× 1)
 *   - USD → USD: sin cambio (× 1)
 *   - ARS → USD: amountCents / exchangeRate  (ARS dividido por cuántos ARS vale 1 USD)
 *   - USD → ARS: amountCents × exchangeRate  (USD multiplicado por cuántos ARS vale 1 USD)
 *
 * El resultado se redondea a centavos enteros (Math.round).
 *
 * @param amountCents    Monto en centavos de la moneda original.
 * @param currency       Moneda original del movimiento.
 * @param exchangeRate   Cotización ARS/1 USD del movimiento (como número JS, ya parseado de Decimal).
 * @param defaultCurrency Moneda default del usuario (a la que se convierte).
 * @returns Monto convertido en centavos enteros de la moneda default.
 */
export function convertToDefaultCurrency(
  amountCents: number,
  currency: Currency,
  exchangeRate: number,
  defaultCurrency: Currency,
): number {
  if (currency === defaultCurrency) {
    // Sin cambio: ya está en la moneda default
    return amountCents;
  }

  if (currency === Currency.USD && defaultCurrency === Currency.ARS) {
    // USD → ARS: multiplicar por la cotización
    return Math.round(amountCents * exchangeRate);
  }

  if (currency === Currency.ARS && defaultCurrency === Currency.USD) {
    // ARS → USD: dividir por la cotización
    if (exchangeRate === 0) return 0; // guard: nunca debe ser 0, pero por seguridad
    return Math.round(amountCents / exchangeRate);
  }

  // Fallback (no debería alcanzarse con el enum de 2 valores)
  return amountCents;
}
