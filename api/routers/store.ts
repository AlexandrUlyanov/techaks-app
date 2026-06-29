import { z } from "zod";
import { createRouter, publicQuery, protectedProcedure, requireAbility } from "../middleware";
import { getDb } from "../queries/connection";
import { stores } from "@db/schema";
import { asc, eq } from "drizzle-orm";
import { writeAdminAuditLog } from "../lib/admin-audit";

function normalizeStoreMapUrl(value: string | null | undefined) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;

  const iframeSrcMatch = raw.match(/src=["']([^"']+)["']/i);
  const hrefMatch = raw.match(/href=["']([^"']+)["']/i);
  const extracted = iframeSrcMatch?.[1] || hrefMatch?.[1] || raw;
  const decoded = extracted
    .replace(/&amp;/gi, "&")
    .trim();

  if (/^https?:\/\//i.test(decoded)) {
    return decoded;
  }

  if (/^(yandex|2gis|go\.2gis|maps\.yandex)\./i.test(decoded)) {
    return `https://${decoded}`;
  }

  return decoded;
}

const storeSchema = z.object({
  msId: z.string().nullable().optional(),
  name: z.string(),
  address: z.string(),
  hours: z.string(),
  phone: z.string(),
  rating: z.string(),
  reviewCount: z.number(),
  image: z.string(),
  mapUrl: z.string().nullable().transform(normalizeStoreMapUrl),
  sortOrder: z.number(),
});

export const storeRouter = createRouter({
  getAll: publicQuery.query(async () => {
    const db = getDb();
    return await db.select().from(stores).orderBy(asc(stores.sortOrder));
  }),

  upsert: protectedProcedure
    .input(
      z.object({
        id: z.number().optional(),
        data: storeSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Store");
      const db = getDb();
      if (input.id) {
        const [previousStore] = await db
          .select()
          .from(stores)
          .where(eq(stores.id, input.id))
          .limit(1);
        await db.update(stores).set(input.data).where(eq(stores.id, input.id));
        await writeAdminAuditLog({
          ctx,
          action: "store.update",
          entityType: "store",
          entityId: input.id,
          entityLabel: input.data.name,
          before: previousStore,
          after: {
            id: input.id,
            ...input.data,
          },
        });
        return { success: true, id: input.id };
      } else {
        const result = await db.insert(stores).values(input.data);
        await writeAdminAuditLog({
          ctx,
          action: "store.create",
          entityType: "store",
          entityId: result[0].insertId,
          entityLabel: input.data.name,
          after: {
            id: result[0].insertId,
            ...input.data,
          },
        });
        return { success: true, id: result[0].insertId };
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "delete", "Store");
      const db = getDb();
      const [previousStore] = await db
        .select()
        .from(stores)
        .where(eq(stores.id, input.id))
        .limit(1);
      await db.delete(stores).where(eq(stores.id, input.id));
      if (previousStore) {
        await writeAdminAuditLog({
          ctx,
          action: "store.delete",
          entityType: "store",
          entityId: previousStore.id,
          entityLabel: previousStore.name,
          before: previousStore,
        });
      }
      return { success: true };
    }),
});
