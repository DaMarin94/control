import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Importar la validación de env para que falle en build si falta alguna variable
  // La importación ocurre en src/lib/env.ts a través del import en layout.tsx

  // /configuracion pasó a ser el hub de administración de la cuenta (P6):
  // Categorías y Métodos de pago se anidaron bajo /configuracion/*. Redirects
  // permanentes para no romper bookmarks/links externos a las rutas viejas.
  async redirects() {
    return [
      {
        source: "/categorias",
        destination: "/configuracion/categorias",
        permanent: true,
      },
      {
        source: "/metodos-pago",
        destination: "/configuracion/metodos-pago",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
