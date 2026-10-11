import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { bumpSync } from "@/lib/sync";

const WRITE_OPS = new Set([
  "create",
  "update",
  "delete",
  "upsert",
  "createMany",
  "updateMany",
  "deleteMany",
  "createManyAndReturn",
]);

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const base = new PrismaClient({ adapter });

  return base.$extends({
    query: {
      $allOperations({ operation, args, query }) {
        const result = query(args);
        if (WRITE_OPS.has(operation)) {
          // Bump sync version after successful write so other devices refetch
          void (result as Promise<unknown>).then(() => bumpSync());
        }
        return result;
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
