/**
 * Sección "Métodos de pago" de /configuracion (P6 — hub de administración).
 *
 * Ruta anidada deep-linkable: /configuracion/metodos-pago. El shell de
 * página (.phead, nav vertical) vive en el layout compartido del hub
 * (`../layout.tsx`); esta ruta solo aporta el contenido de la sección.
 *
 * Ruta privada: el middleware la protege (redirige a /login sin sesión).
 * La lista se carga client-side con React Query en PaymentMethodsList.
 */

import { PaymentMethodsList } from "./payment-methods-list";

export const metadata = {
  title: "Métodos de pago — Control",
  description: "Gestioná tus métodos de pago (tarjetas, efectivo, etc.)",
};

export default function ConfiguracionMetodosPagoPage() {
  return <PaymentMethodsList />;
}
