/**
 * Página de categorías — /categorias
 *
 * Re-estilado con tokens del DS "Precise Ledger" (Fase 3).
 *
 * Ruta privada: el middleware la protege (redirige a /login sin sesión).
 * La navegación global vive en el AppSidebar del layout (app).
 *
 * La lista se carga client-side con React Query en CategoriesList.
 * Esta página es un Server Component que provee el shell de la página.
 */

import { CategoriesList } from "./categories-list";

export const metadata = {
  title: "Categorías — Control",
  description: "Gestioná tus categorías de gastos e ingresos",
};

export default function CategoriasPage() {
  return (
    <div className="px-10 py-[34px] pb-20 max-w-[1120px] mx-auto animate-screen-fade">
      <CategoriesList />
    </div>
  );
}
