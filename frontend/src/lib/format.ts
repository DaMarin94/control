/**
 * Helpers de formato centralizados para la UI.
 * Un único lugar para cambiar locale, símbolo de moneda y formatos de fecha.
 *
 * Moneda: centavos → pesos con 2 decimales, locale es-AR, símbolo $.
 * Fechas: Intl.DateTimeFormat, locale es-AR, en la timezone del registro.
 */

// ─── Moneda ───────────────────────────────────────────────────────────────────

const CURRENCY_LOCALE = "es-AR";
const CURRENCY_SYMBOL = "$";
const CURRENCY_DECIMALS = 2;

/**
 * Convierte centavos a pesos y formatea con símbolo y separadores.
 * Ej: 150050 → "$1.500,50"
 */
export function formatCurrency(amountCents: number): string {
  const amount = amountCents / 100;
  const formatted = new Intl.NumberFormat(CURRENCY_LOCALE, {
    minimumFractionDigits: CURRENCY_DECIMALS,
    maximumFractionDigits: CURRENCY_DECIMALS,
  }).format(amount);
  return `${CURRENCY_SYMBOL}${formatted}`;
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
  return new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
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
