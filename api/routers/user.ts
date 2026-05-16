import { z } from "zod";
import { adminProcedure, createRouter, protectedProcedure, requireAbility } from "../middleware";
import { getDb } from "../queries/connection";
import {
  authSessions,
  orderComments,
  orderHistory,
  orders,
  passwordResetTokens,
  pushSubscriptions,
  users,
} from "@db/schema";
import { and, desc, eq, ne, sql } from "drizzle-orm";

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

  deleteUser: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.user?.id) {
        throw new Error("Вы не можете удалить самого себя.");
      }

      const db = getDb();
      const [targetUser] = await db
        .select({
          id: users.id,
          role: users.role,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, input.id))
        .limit(1);

      if (!targetUser) {
        throw new Error("Пользователь не найден.");
      }

      if (targetUser.role === "super_admin") {
        const [remainingSuperAdmins] = await db
          .select({
            total: sql<number>`count(*)`,
          })
          .from(users)
          .where(and(eq(users.role, "super_admin"), ne(users.id, input.id)));

        if ((remainingSuperAdmins?.total ?? 0) < 1) {
          throw new Error("Нельзя удалить последнего супер-админа.");
        }
      }

      await db.update(orders).set({ userId: null }).where(eq(orders.userId, input.id));
      await db
        .update(orderComments)
        .set({ userId: null })
        .where(eq(orderComments.userId, input.id));
      await db
        .update(orderHistory)
        .set({ userId: null })
        .where(eq(orderHistory.userId, input.id));

      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, input.id));
      await db.delete(authSessions).where(eq(authSessions.userId, input.id));
      await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, input.id));
      await db.delete(users).where(eq(users.id, input.id));

      return { success: true, deletedUserId: input.id, email: targetUser.email };
    }),
});
