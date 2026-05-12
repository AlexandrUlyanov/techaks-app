import { z } from "zod";
import { createRouter, protectedProcedure, requireAbility } from "../middleware";
import { getDb } from "../queries/connection";
import { users } from "@db/schema";
import { eq, desc } from "drizzle-orm";

export const userRouter = createRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "User");
    const db = getDb();
    return await db
      .select({
        id: users.id,
        phone: users.phone,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        fullName: z.string().max(255).optional().nullable(),
        phone: z.string().max(20).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(users)
        .set({
          fullName: input.fullName,
          phone: input.phone,
        })
        .where(eq(users.id, ctx.user!.id));
      return { success: true };
    }),

  updateRole: protectedProcedure
    .input(z.object({ id: z.number(), role: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "User");
      
      if (input.id === ctx.user?.id) {
        throw new Error("Вы не можете изменить роль самому себе.");
      }

      const db = getDb();
      await db.update(users).set({ role: input.role }).where(eq(users.id, input.id));
      return { success: true };
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.number(), status: z.enum(["active", "disabled"]) }))
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "User");

      if (input.id === ctx.user?.id) {
        throw new Error("Вы не можете заблокировать себя.");
      }

      const db = getDb();
      await db.update(users).set({ status: input.status }).where(eq(users.id, input.id));
      return { success: true };
    }),
});
