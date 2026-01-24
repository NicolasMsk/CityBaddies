import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Lazy initialization pour éviter erreur au build si DATABASE_URL n'est pas défini
const createPrismaClient = () => {
  if (!process.env.DATABASE_URL) {
    // Au build, retourne un proxy qui throw au runtime
    return new Proxy({} as PrismaClient, {
      get: () => {
        throw new Error('DATABASE_URL is not defined');
      },
    });
  }
  return new PrismaClient();
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
