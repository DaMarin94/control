import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Importar la validación de env para que falle en build si falta alguna variable
  // La importación ocurre en src/lib/env.ts a través del import en layout.tsx
};

export default nextConfig;
