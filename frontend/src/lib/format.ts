/**
 * Helpers de formato centralizados para la UI.
 * Un único lugar para cambiar locale, símbolo de moneda y formatos de fecha.
 *
 * Moneda: centavos → cifra con símbolo de moneda y separadores, locale es-AR.
 *   El símbolo se elige por código de moneda desde CURRENCY_SYMBOLS (mapa único y extensible).
 *   Sumar una moneda futura = una entrada en ese mapa.
 * Fechas: Intl.DateTimeFormat, locale es-AR, en la timezone del registro.
 */

// ─── Moneda ───────────────────────────────────────────────────────────────────

const CURRENCY_LOCALE = "es-AR";
const CURRENCY_DECIMALS = 2;

/**
 * Mapa de código de moneda → símbolo de prefijo.
 * Fuente de verdad única. Extensible: sumar una moneda = una entrada.
 *
 * Spec (docs/design.md §"Símbolos de moneda por código" / §"Monedas configurables — Fase 1.2.4"):
 *   ARS → "$"   (convención argentina, back-compat)
 *   USD → "US$" (prefijo internacional inequívoco del dólar estadounidense)
 *   EUR → "€"   (símbolo universal del euro)
 *   BRL → "R$"  (real brasileño — prefijo estándar)
 */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  ARS: "$",
  USD: "US$",
  EUR: "€",
  BRL: "R$",
};

/** Símbolo de fallback cuando el código no está en el mapa. */
const CURRENCY_SYMBOL_FALLBACK = "$";

/**
 * Convierte centavos a cifra formateada con el símbolo de la moneda indicada.
 * Prefijo pegado a la cifra, SIN espacio — "US$1.500,00", "$219.400,00".
 *
 * @param amountCents  Monto en centavos (puede ser negativo para calculados).
 * @param currency     Código de moneda (default "ARS" para back-compat).
 *
 * El signo NO se incluye en esta función — el llamador prepone "−" o "+" según
 * la regla de presentación de cada contexto (tipo del movimiento, balance, etc.).
 * Ej: 150050, "ARS" → "$1.500,50"
 *     150000, "USD" → "US$1.500,00"
 */
export function formatCurrency(amountCents: number, currency = "ARS"): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? CURRENCY_SYMBOL_FALLBACK;
  const amount = amountCents / 100;
  const formatted = new Intl.NumberFormat(CURRENCY_LOCALE, {
    minimumFractionDigits: CURRENCY_DECIMALS,
    maximumFractionDigits: CURRENCY_DECIMALS,
  }).format(amount);
  return `${symbol}${formatted}`;
}

/**
 * Tope de monto aceptado por el backend: 2^31 − 1 (entero de 32 bits de la
 * columna `amountCents`). Aplica a transactions, recurring e installments (en
 * cuotas, POR CUOTA) — espejo de UX del `@Max(2147483647)` de los DTOs del
 * backend (fuente de verdad real). Ver docs/technical.md §Validación.
 */
export const MAX_AMOUNT_CENTS = 2_147_483_647;

/**
 * Sanitiza el input crudo de un campo de monto a medida que se tipea: conserva
 * solo dígitos y un único separador decimal (coma o punto — el primero que
 * aparece), descarta cualquier otro carácter (letras, símbolos, separadores
 * de más). No cambia el formato de guardado — sigue aceptando punto o coma,
 * igual que `parseCurrencyInput`.
 * Ej: "abc-12.34e5,99xyz" → "12.34599"
 */
export function sanitizeAmountInput(raw: string): string {
  let result = "";
  let hasSeparator = false;
  for (const char of raw) {
    if (char >= "0" && char <= "9") {
      result += char;
    } else if ((char === "," || char === ".") && !hasSeparator) {
      result += char;
      hasSeparator = true;
    }
  }
  return result;
}

/**
 * Convierte un string de monto ingresado por el usuario (pesos con decimales)
 * a centavos enteros para enviar al backend.
 *
 * Acepta tanto punto como coma como separador decimal.
 * Ej: "15,50" → 1550, "15.50" → 1550, "1500" → 150000
 *
 * Retorna null si el valor no es un número válido > 0.
 */
export function parseCurrencyInput(value: string): number | null {
  // Reemplazar coma por punto para parsear correctamente
  const normalized = value.trim().replace(",", ".");

  const parsed = parseFloat(normalized);

  if (isNaN(parsed) || parsed <= 0) {
    return null;
  }

  // Redondear para evitar problemas de punto flotante
  return Math.round(parsed * 100);
}

/**
 * Convierte un string de cotización ingresado por el usuario (con decimales)
 * a un número flotante para enviar al backend.
 *
 * La cotización es ARS por 1 USD — NO se convierte a centavos (es un factor, no un monto).
 * Acepta tanto punto como coma como separador decimal.
 * Ej: "1.480,50" → 1480.5 (con separador de miles punto y decimal coma, locale AR)
 * Ej: "1480.50" → 1480.5
 *
 * Retorna null si el valor no es un número válido > 0.
 */
export function parseExchangeRateInput(value: string): number | null {
  // En locale es-AR: punto = separador de miles, coma = decimal.
  // Normalizar: quitar puntos de miles, reemplazar coma decimal por punto.
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const parsed = parseFloat(normalized);
  if (isNaN(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

/**
 * Formatea un número de cotización para mostrar en el input (locale es-AR).
 * Ej: 1480.5 → "1.480,50"
 */
export function formatExchangeRate(rate: number): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rate);
}

// ─── Fechas ───────────────────────────────────────────────────────────────────

const DATE_LOCALE = "es-AR";

/**
 * Formatea un instante UTC en la timezone dada, mostrando fecha dd/mm/aaaa.
 * Ej: "2026-06-17T14:30:00Z", "America/Argentina/Buenos_Aires" → "17/06/2026"
 */
export function formatDate(isoUtc: string, timezone: string): string {
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: timezone,
  }).format(new Date(isoUtc));
}

/**
 * Formatea un instante UTC en la timezone dada, mostrando hora en formato 24h.
 * Ej: "2026-06-17T17:30:00Z", "America/Argentina/Buenos_Aires" → "14:30"
 */
export function formatTime(isoUtc: string, timezone: string): string {
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(new Date(isoUtc));
}

/**
 * Formatea un instante UTC para el encabezado de mes: "Junio 2026".
 */
export function formatMonthHeading(isoUtc: string, timezone: string): string {
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    month: "long",
    year: "numeric",
    timeZone: timezone,
  }).format(new Date(isoUtc));
}

// ─── Conversión local → UTC ───────────────────────────────────────────────────

/**
 * Obtiene la zona IANA del navegador.
 * Ej: "America/Argentina/Buenos_Aires"
 */
export function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Obtiene el mes actual del navegador en formato YYYY-MM.
 * Usa la zona horaria local del navegador para determinar el mes calendario.
 * Ej: "2026-06"
 */
export function getCurrentMonth(): string {
  const tz = getBrowserTimezone();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  return `${year}-${month}`;
}

/**
 * Formatea un mes en formato YYYY-MM como encabezado legible.
 * Ej: "2026-06" → "Junio 2026"
 */
export function formatMonthLabel(month: string): string {
  // Construir un Date en el primer día del mes a mediodía UTC para evitar
  // desfases de zona que cambien el mes.
  const date = new Date(`${month}-01T12:00:00Z`);
  // Extraer mes y año por separado para evitar la preposición "de" que
  // Intl.DateTimeFormat inserta al formatear ambos juntos en es-AR
  // (ej. "junio de 2026"). Resultado: "junio 2026".
  const formatter = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const parts = formatter.formatToParts(date);
  const monthPart = parts.find((p) => p.type === "month")?.value ?? "";
  const yearPart = parts.find((p) => p.type === "year")?.value ?? "";
  return `${monthPart} ${yearPart}`;
}

/**
 * Dado un mes YYYY-MM, devuelve el mes anterior en formato YYYY-MM.
 * Ej: "2026-01" → "2025-12"
 */
export function prevMonth(month: string): string {
  const [yearStr, monthStr] = month.split("-");
  const date = new Date(Number(yearStr), Number(monthStr) - 1 - 1, 1);
  const year = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${m}`;
}

/**
 * Dado un mes YYYY-MM, devuelve el mes siguiente en formato YYYY-MM.
 * Ej: "2025-12" → "2026-01"
 */
export function nextMonth(month: string): string {
  const [yearStr, monthStr] = month.split("-");
  const date = new Date(Number(yearStr), Number(monthStr) - 1 + 1, 1);
  const year = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${m}`;
}

/**
 * Convierte una fecha (YYYY-MM-DD) y hora local (HH:MM) en la timezone
 * dada a un instante ISO 8601 UTC.
 *
 * Estrategia: construir un string con el offset explícito de la zona en
 * esa fecha/hora para luego crear un Date que JavaScript interpreta correctamente.
 *
 * Usa Intl.DateTimeFormat para obtener el offset real de la zona IANA en ese
 * instante (considera horario de verano).
 */
export function localToUtcIso(dateStr: string, timeStr: string, timezone: string): string {
  // Construir un Date asumiendo UTC primero para luego calcular el offset real
  const tentativeUtc = new Date(`${dateStr}T${timeStr}:00Z`);

  // Obtener la representación local en la timezone dada
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(tentativeUtc);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";

  const localYear = get("year");
  const localMonth = get("month");
  const localDay = get("day");
  const localHour = get("hour") === "24" ? "00" : get("hour");
  const localMinute = get("minute");

  // Diferencia entre lo que queríamos (dateStr/timeStr) y lo que salió en local
  const wantedMs = new Date(`${dateStr}T${timeStr}:00Z`).getTime();
  const gotLocalMs = new Date(
    `${localYear}-${localMonth}-${localDay}T${localHour}:${localMinute}:00Z`,
  ).getTime();

  const offsetMs = wantedMs - gotLocalMs;
  const correctedUtcMs = tentativeUtc.getTime() + offsetMs;

  return new Date(correctedUtcMs).toISOString();
}

/**
 * Dada una fecha UTC ISO y una timezone, devuelve la fecha local en formato YYYY-MM-DD.
 * Usado para precargar el campo de fecha en el form de edición.
 */
export function utcToLocalDate(isoUtc: string, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date(isoUtc));
}

/**
 * Dada una fecha UTC ISO y una timezone, devuelve la hora local en formato HH:MM.
 * Usado para precargar el campo de hora en el form de edición.
 */
export function utcToLocalTime(isoUtc: string, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const formatted = formatter.format(new Date(isoUtc));
  // Normalizar formato "HH:MM" (en-CA puede devolver "HH:MM" directamente)
  return formatted.substring(0, 5);
}
