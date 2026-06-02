import { z } from "zod";
import { createRouter, publicQuery, protectedProcedure, requireAbility } from "../middleware";
import { getDb } from "../queries/connection";
import { banners } from "@db/schema";
import { asc, eq } from "drizzle-orm";
import { writeAdminAuditLog } from "../lib/admin-audit";

const bannerSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  image: z.string().min(1),
  link: z.string().optional().nullable(),
  active: z.boolean().default(true),
  sortOrder: z.number().default(0),
});

export const bannerRouter = createRouter({
  getAll: publicQuery.query(async () => {
    const db = getDb();
    return await db.select().from(banners).orderBy(asc(banners.sortOrder));
  }),

  getActive: publicQuery.query(async () => {
    const db = getDb();
    return await db
      .select()
      .from(banners)
      .where(eq(banners.active, true))
      .orderBy(asc(banners.sortOrder));
  }),

  getBySlug: publicQuery
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const result = await db
        .select()
        .from(banners)
        .where(eq(banners.slug, input.slug))
        .limit(1);
      return result[0] || null;
    }),

  upsert: protectedProcedure
    .input(
      z.object({
        id: z.number().optional(),
        data: bannerSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Banner");
      const db = getDb();
      if (input.id) {
        const [previousBanner] = await db
          .select()
          .from(banners)
          .where(eq(banners.id, input.id))
          .limit(1);
        await db
          .update(banners)
          .set(input.data)
          .where(eq(banners.id, input.id));
        await writeAdminAuditLog({
          ctx,
          action: "banner.update",
          entityType: "banner",
          entityId: input.id,
          entityLabel: input.data.title,
          before: previousBanner,
          after: {
            id: input.id,
            ...input.data,
          },
        });
        return { success: true, id: input.id };
      } else {
        const result = await db.insert(banners).values(input.data);
        await writeAdminAuditLog({
          ctx,
          action: "banner.create",
          entityType: "banner",
          entityId: result[0].insertId,
          entityLabel: input.data.title,
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
      requireAbility(ctx, "delete", "Banner");
      const db = getDb();
      const [previousBanner] = await db
        .select()
        .from(banners)
        .where(eq(banners.id, input.id))
        .limit(1);
      await db.delete(banners).where(eq(banners.id, input.id));
      if (previousBanner) {
        await writeAdminAuditLog({
          ctx,
          action: "banner.delete",
          entityType: "banner",
          entityId: previousBanner.id,
          entityLabel: previousBanner.title,
          before: previousBanner,
        });
      }
      return { success: true };
    }),
});
