/**
 * Route handler de NextAuth v5.
 * Expone los endpoints de Auth.js en /api/auth/*.
 * Ver configuración completa en src/auth.ts.
 */

import { handlers } from "@/auth";

export const { GET, POST } = handlers;
