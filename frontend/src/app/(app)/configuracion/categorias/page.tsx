/**
 * Sección "Categorías" de /configuracion (P6 — hub de administración).
 *
 * Ruta anidada deep-linkable: /configuracion/categorias. El shell de página
 * (.phead, nav vertical) vive en el layout compartido del hub
 * (`../layout.tsx`); esta ruta solo aporta el contenido de la sección.
 *
 * Ruta privada: el middleware la protege (redirige a /login sin sesión).
 * La lista se carga client-side con React Query en CategoriesList.
 */

import { CategoriesList } from "./categories-list";

export const metadata = {
  title: "Categorías — Control",
  description: "Gestioná tus categorías de gastos e ingresos",
};

export default function ConfiguracionCategoriasPage() {
  return <CategoriesList />;
}
