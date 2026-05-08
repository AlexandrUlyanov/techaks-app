import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { leads } from "@db/schema";
import { desc, eq, sql } from "drizzle-orm";

export const leadRouter = createRouter({
  create: publicQuery
    .input(
      z.object({
        name: z.string().min(1, "Имя обязательно").max(255),
        phone: z.string().min(5, "Телефон обязателен").max(20),
        message: z.string().max(1000).optional(),
        type: z
          .enum(["callback", "availability", "question", "service"])
          .default("callback"),
        source: z.string().max(100).default("website"),
        metadata: z.any().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(leads).values({
        name: input.name,
        phone: input.phone,
        message: input.message || null,
        type: input.type,
        source: input.source,
        metadata: input.metadata || null,
        status: "new",
      });
      return { success: true, id: Number(result[0].insertId) };
    }),

  list: publicQuery
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;

      const items = await db
        .select()
        .from(leads)
        .orderBy(desc(leads.createdAt))
        .limit(limit)
        .offset(offset);

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(leads);

      return {
        leads: items,
        total: countResult[0].count,
      };
    }),

  updateStatus: publicQuery
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["new", "processing", "completed", "cancelled"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(leads)
        .set({ status: input.status })
        .where(eq(leads.id, input.id));
      return { success: true };
    }),

  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(leads).where(eq(leads.id, input.id));
      return { success: true };
    }),
});
