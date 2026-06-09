"use client";

/**
 * Wrapper cliente para la Vista del mes.
 *
 * Lee ?month=YYYY-MM del query. Si no viene, usa el mes actual del navegador.
 * Pasa el mes resuelto a MonthViewClient.
 *
 * Separado en su propio componente para poder envolverlo en <Suspense>
 * desde la page (Server Component), ya que useSearchParams requiere Suspense
 * en el App Router.
 */

import { useSearchParams } from "next/navigation";
import { MonthViewClient } from "@/components/movements/month-view-client";
import { getCurrentMonth } from "@/lib/format";

export function MonthViewWrapper() {
  const searchParams = useSearchParams();
  const monthParam = searchParams.get("month");

  // Si no viene ?month=, default = mes actual del navegador
  const month = monthParam ?? getCurrentMonth();

  return <MonthViewClient month={month} />;
}
