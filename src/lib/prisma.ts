import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { bumpSync } from "@/lib/sync";
import { isReadOnlyDemo, READ_ONLY_MESSAGE } from "@/lib/demo";

const WRITE_OPS = new Set([
  "create",
  "update",
  "delete",
  "upsert",
  "createMany",
  "updateMany",
  "deleteMany",
  "createManyAndReturn",
  "updateManyAndReturn",
]);

// Raw SQL that can change data. Read-only raw queries ($queryRaw) stay allowed.
const RAW_WRITE_OPS = new Set(["$executeRaw", "$executeRawUnsafe", "$queryRawUnsafe"]);

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const base = new PrismaClient({ adapter });

  return base.$extends({
    query: {
      $allOperations({ operation, args, query }) {
        // Second lock for the read-only demo, independent of middleware:
        // even if a request slipped past it, no write ever reaches the database.
        if (isReadOnlyDemo() && (WRITE_OPS.has(operation) || RAW_WRITE_OPS.has(operation))) {
          throw new Error(READ_ONLY_MESSAGE);
        }
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
