import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Helper `cn` para combinar clases de Tailwind de forma segura.
 * Combina clsx (condicionales) con tailwind-merge (deduplicación).
 * Uso: cn("px-4 py-2", isActive && "bg-primary", className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
