/**
 * Página de métodos de pago — /metodos-pago
 *
 * Espejo 1:1 de /categorias en estructura y estados (RF-PM-001..006).
 *
 * Ruta privada: el middleware la protege (redirige a /login sin sesión).
 * La navegación global vive en el AppSidebar del layout (app).
 *
 * La lista se carga client-side con React Query en PaymentMethodsList.
 * Esta página es un Server Component que provee el shell de la página.
 */

import { PaymentMethodsList } from "./payment-methods-list";

export const metadata = {
  title: "Métodos de pago — Control",
  description: "Gestioná tus métodos de pago (tarjetas, efectivo, etc.)",
};

export default function MetodosPagoPage() {
  return (
    <div className="px-10 py-[34px] pb-20 max-w-[1120px] mx-auto animate-screen-fade">
      <PaymentMethodsList />
    </div>
  );
}
