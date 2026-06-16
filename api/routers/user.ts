import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, createRouter, protectedProcedure, requireAbility } from "../middleware";
import { getDb } from "../queries/connection";
import { signToken } from "../lib/auth";
import {
  authSessions,
  orderComments,
  orderHistory,
  orders,
  passwordResetTokens,
  products,
  pushSubscriptions,
  syncLogs,
  userFavorites,
  users,
  categories,
} from "@db/schema";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import {
  attachVisibleMerchandisingBadges,
  publicProductSelectFields,
  publicProductVisibilityCondition,
} from "../lib/public-products";
import * as schema from "@db/schema";

export const userRouter = createRouter({
  getFavoriteIds: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select({ productId: userFavorites.productId })
      .from(userFavorites)
      .innerJoin(products, eq(products.id, userFavorites.productId))
      .where(
        and(
          eq(userFavorites.userId, ctx.user!.id),
          publicProductVisibilityCondition
        )
      )
      .orderBy(desc(userFavorites.createdAt));

    return rows.map(row => row.productId);
  }),

  getFavorites: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select(publicProductSelectFields)
      .from(userFavorites)
      .innerJoin(products, eq(products.id, userFavorites.productId))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(
        schema.productMerchandising,
        eq(schema.productMerchandising.productId, products.id)
      )
      .where(
        and(
          eq(userFavorites.userId, ctx.user!.id),
          publicProductVisibilityCondition
        )
      )
      .orderBy(desc(userFavorites.createdAt));

    return attachVisibleMerchandisingBadges(rows);
  }),

  setFavorite: protectedProcedure
    .input(
      z.object({
        productId: z.number().int().positive(),
        isFavorite: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      if (!input.isFavorite) {
        await db
          .delete(userFavorites)
          .where(
            and(
              eq(userFavorites.userId, ctx.user!.id),
              eq(userFavorites.productId, input.productId)
            )
          );

        return {
          success: true,
          productId: input.productId,
          isFavorite: false,
        };
      }

      const [product] = await db
        .select({
          id: products.id,
        })
        .from(products)
        .where(
          and(eq(products.id, input.productId), publicProductVisibilityCondition)
        )
        .limit(1);

      if (!product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Товар не найден или недоступен.",
        });
      }

      await db
        .insert(userFavorites)
        .values({
          userId: ctx.user!.id,
          productId: input.productId,
        })
        .onDuplicateKeyUpdate({
          set: {
            createdAt: new Date(),
          },
        });

      return {
        success: true,
        productId: input.productId,
        isFavorite: true,
      };
    }),

  syncFavorites: protectedProcedure
    .input(
      z.object({
        productIds: z.array(z.number().int().positive()).max(200).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const normalizedIds = Array.from(new Set(input.productIds));

      if (normalizedIds.length > 0) {
        const visibleProducts = await db
          .select({ id: products.id })
          .from(products)
          .where(
            and(
              inArray(products.id, normalizedIds),
              publicProductVisibilityCondition
            )
          );

        const visibleIds = visibleProducts.map(product => product.id);

        if (visibleIds.length > 0) {
          await db
            .insert(userFavorites)
            .values(
              visibleIds.map(productId => ({
                userId: ctx.user!.id,
                productId,
              }))
            )
            .onDuplicateKeyUpdate({
              set: {
                createdAt: new Date(),
              },
            });
        }
      }

      const rows = await db
        .select({ productId: userFavorites.productId })
        .from(userFavorites)
        .innerJoin(products, eq(products.id, userFavorites.productId))
        .where(
          and(
            eq(userFavorites.userId, ctx.user!.id),
            publicProductVisibilityCondition
          )
        )
        .orderBy(desc(userFavorites.createdAt));

      return {
        productIds: rows.map(row => row.productId),
      };
    }),

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

  impersonate: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.user?.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Вы уже авторизованы под этим пользователем.",
        });
      }

      const db = getDb();
      const [targetUser] = await db
        .select({
          id: users.id,
          phone: users.phone,
          fullName: users.fullName,
          email: users.email,
          role: users.role,
          status: users.status,
        })
        .from(users)
        .where(eq(users.id, input.id))
        .limit(1);

      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Пользователь не найден." });
      }

      if (targetUser.status !== "active") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Нельзя войти под заблокированным пользователем.",
        });
      }

      if (targetUser.role === "super_admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Нельзя авторизоваться под другим супер-администратором.",
        });
      }

      const token = await signToken({
        id: targetUser.id,
        role: targetUser.role,
        status: targetUser.status,
      });

      await db.insert(syncLogs).values({
        type: "user_impersonation",
        status: "success",
        message: "Администратор авторизовался под пользователем",
        details: {
          actorUserId: ctx.user!.id,
          actorEmail: ctx.user!.email,
          targetUserId: targetUser.id,
          targetEmail: targetUser.email,
          targetRole: targetUser.role,
        },
      });

      return { success: true, user: targetUser, token };
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
