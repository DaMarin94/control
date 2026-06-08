import 'dotenv/config';
import { defineConfig, env } from '@prisma/config';

/**
 * Configuración de Prisma para desarrollo y producción.
 *
 * En Prisma 7 la URL de conexión ya no va en datasource del schema.prisma.
 * Se define aquí y se pasa al PrismaClient vía constructor o adapter.
 *
 * Ver: https://pris.ly/d/config-datasource
 *
 * Nota: `import 'dotenv/config'` es necesario porque el CLI de Prisma 7
 * NO carga el .env automáticamente cuando hay un prisma.config.ts.
 * dotenv carga el .env del cwd (debe correrse desde backend/).
 */
export default defineConfig({
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    path: 'prisma/migrations',
  },
});
