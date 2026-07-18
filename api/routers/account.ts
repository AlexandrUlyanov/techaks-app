import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";

import {
  accountEmailChangeRequests,
  accountSecurityEvents,
  accountSessions,
  orders,
  userAddresses,
  userFavorites,
  userNotificationPreferences,
  users,
} from "@db/schema";
import { createRouter, protectedProcedure, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { sendAccountEmailChangedEmail, sendEmailConfirmationLinkEmail, sendPasswordChangedEmail } from "../lib/mail";
import { normalizeAccountPhone } from "../lib/account-validation";
import { env } from "../lib/env";

const phoneSchema = z.string().trim().max(20).nullable().optional().transform(value => {
  try {
    return normalizeAccountPhone(value);
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Проверьте номер телефона." });
  }
});

const addressInput = z.object({
  id: z.number().int().positive().optional(),
  label: z.string().trim().min(1).max(80),
  recipientName: z.string().trim().min(2).max(255),
  recipientPhone: z.string().trim().min(10).max(20),
  country: z.string().trim().min(2).max(100).default("Россия"),
  region: z.string().trim().max(160).nullable().optional(),
  city: z.string().trim().min(2).max(160),
  street: z.string().trim().min(2).max(255),
  house: z.string().trim().min(1).max(40),
  apartment: z.string().trim().max(40).nullable().optional(),
  postcode: z.string().trim().max(20).nullable().optional(),
  courierComment: z.string().trim().max(500).nullable().optional(),
  isDefault: z.boolean().default(false),
});

async function audit(userId: number, action: string, metadataJson?: Record<string, unknown>) {
  await getDb().insert(accountSecurityEvents).values({ userId, action, metadataJson });
}

export const accountRouter = createRouter({
  overview: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const userId = ctx.user.id;
    const [[stats], addresses, notificationRows, sessions] = await Promise.all([
      db.select({
        orderCount: sql<number>`count(distinct ${orders.id})`,
        favoriteCount: sql<number>`(select count(*) from user_favorites where user_id = ${userId})`,
      }).from(orders).where(eq(orders.userId, userId)),
      db.select().from(userAddresses).where(eq(userAddresses.userId, userId)).orderBy(desc(userAddresses.isDefault), desc(userAddresses.updatedAt)),
      db.select().from(userNotificationPreferences).where(eq(userNotificationPreferences.userId, userId)).limit(1),
      db.select({ id: accountSessions.id, deviceLabel: accountSessions.deviceLabel, userAgent: accountSessions.userAgent, createdAt: accountSessions.createdAt, lastSeenAt: accountSessions.lastSeenAt, revokedAt: accountSessions.revokedAt })
        .from(accountSessions).where(eq(accountSessions.userId, userId)).orderBy(desc(accountSessions.lastSeenAt)),
    ]);

    return {
      profile: {
        id: ctx.user.id, email: ctx.user.email, phone: ctx.user.phone,
        fullName: ctx.user.fullName, firstName: ctx.user.firstName,
        lastName: ctx.user.lastName, displayName: ctx.user.displayName,
        avatarUrl: ctx.user.avatarUrl, language: ctx.user.language,
        timezone: ctx.user.timezone, marketingConsent: ctx.user.marketingConsent,
        createdAt: ctx.user.createdAt,
      },
      stats: { orderCount: Number(stats?.orderCount || 0), favoriteCount: Number(stats?.favoriteCount || 0) },
      addresses,
      notifications: notificationRows[0] ?? {
        orderEmail: true, orderPush: true, orderInApp: true,
        marketingEmail: false, marketingPush: false,
        priceDropEmail: false, priceDropPush: false,
      },
      sessions: sessions.map(session => ({ ...session, isCurrent: session.id === ctx.sessionId })),
    };
  }),

  updateProfile: protectedProcedure.input(z.object({
    firstName: z.string().trim().max(120).nullable().optional(),
    lastName: z.string().trim().max(120).nullable().optional(),
    displayName: z.string().trim().max(160).nullable().optional(),
    phone: phoneSchema,
    language: z.enum(["ru", "en"]).default("ru"),
    timezone: z.string().trim().min(1).max(64).default("Europe/Moscow"),
  })).mutation(async ({ ctx, input }) => {
    const fullName = [input.firstName, input.lastName].filter(Boolean).join(" ") || input.displayName || null;
    await getDb().update(users).set({ ...input, fullName, updatedAt: new Date() }).where(eq(users.id, ctx.user.id));
    await audit(ctx.user.id, "profile_updated");
    return { success: true, fullName };
  }),

  requestEmailChange: protectedProcedure.input(z.object({
    newEmail: z.string().trim().toLowerCase().email(),
    currentPassword: z.string().min(1),
  })).mutation(async ({ ctx, input }) => {
    const db = getDb();
    if (!ctx.user.passwordHash || !(await bcrypt.compare(input.currentPassword, ctx.user.passwordHash))) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Текущий пароль указан неверно." });
    }
    const [duplicate] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.newEmail)).limit(1);
    if (duplicate) throw new TRPCError({ code: "CONFLICT", message: "Этот email уже используется." });
    const [recent] = await db.select({ count: sql<number>`count(*)` })
      .from(accountEmailChangeRequests)
      .where(and(
        eq(accountEmailChangeRequests.userId, ctx.user.id),
        gt(accountEmailChangeRequests.createdAt, new Date(Date.now() - 15 * 60 * 1000))
      ));
    if (Number(recent?.count || 0) >= 3) {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Слишком много писем. Повторите через 15 минут." });
    }
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await db.insert(accountEmailChangeRequests).values({ userId: ctx.user.id, oldEmail: ctx.user.email, newEmail: input.newEmail, tokenHash, expiresAt });
    const origin = env.isProduction ? "https://techaks.ru" : "http://localhost:5173";
    await sendEmailConfirmationLinkEmail({ email: input.newEmail, customerName: ctx.user.fullName, confirmEmailUrl: `${origin}/account?confirmEmail=${token}`, expiresAt });
    await audit(ctx.user.id, "email_change_requested", { newEmail: input.newEmail });
    return { success: true, expiresAt };
  }),

  confirmEmailChange: publicQuery.input(z.object({ token: z.string().min(40) })).mutation(async ({ input }) => {
    const db = getDb();
    const tokenHash = createHash("sha256").update(input.token).digest("hex");
    const [request] = await db.select().from(accountEmailChangeRequests).where(and(eq(accountEmailChangeRequests.tokenHash, tokenHash), isNull(accountEmailChangeRequests.usedAt), gt(accountEmailChangeRequests.expiresAt, new Date()))).limit(1);
    if (!request) throw new TRPCError({ code: "BAD_REQUEST", message: "Ссылка недействительна или устарела." });
    const [duplicate] = await db.select({ id: users.id }).from(users).where(and(eq(users.email, request.newEmail), ne(users.id, request.userId))).limit(1);
    if (duplicate) throw new TRPCError({ code: "CONFLICT", message: "Этот email уже используется." });
    await db.transaction(async tx => {
      await tx.update(users).set({ email: request.newEmail, updatedAt: new Date() }).where(eq(users.id, request.userId));
      await tx.update(accountEmailChangeRequests).set({ usedAt: new Date() }).where(eq(accountEmailChangeRequests.id, request.id));
    });
    await audit(request.userId, "email_changed", { oldEmail: request.oldEmail, newEmail: request.newEmail });
    await sendAccountEmailChangedEmail({
      email: request.oldEmail,
      previousEmail: request.oldEmail,
      newEmail: request.newEmail,
    });
    return { success: true, email: request.newEmail };
  }),

  changePassword: protectedProcedure.input(z.object({
    currentPassword: z.string().min(1), newPassword: z.string().min(8).max(128), revokeOtherSessions: z.boolean().default(true),
  })).mutation(async ({ ctx, input }) => {
    if (!ctx.user.passwordHash || !(await bcrypt.compare(input.currentPassword, ctx.user.passwordHash))) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Текущий пароль указан неверно." });
    }
    const passwordHash = await bcrypt.hash(input.newPassword, 12);
    await getDb().update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, ctx.user.id));
    if (input.revokeOtherSessions) {
      const conditions = [eq(accountSessions.userId, ctx.user.id), isNull(accountSessions.revokedAt)];
      if (ctx.sessionId) conditions.push(ne(accountSessions.id, ctx.sessionId));
      await getDb().update(accountSessions).set({ revokedAt: new Date() }).where(and(...conditions));
    }
    await audit(ctx.user.id, "password_changed");
    await sendPasswordChangedEmail({ email: ctx.user.email, customerName: ctx.user.fullName });
    return { success: true };
  }),

  saveAddress: protectedProcedure.input(addressInput).mutation(async ({ ctx, input }) => {
    const db = getDb();
    if (input.isDefault) await db.update(userAddresses).set({ isDefault: false }).where(eq(userAddresses.userId, ctx.user.id));
    const values = { ...input, userId: ctx.user.id, updatedAt: new Date() };
    if (input.id) {
      const addressId = input.id;
      const { id, ...update } = values;
      await db.update(userAddresses).set(update).where(and(eq(userAddresses.id, addressId), eq(userAddresses.userId, ctx.user.id)));
    } else {
      const { id: _id, ...insert } = values;
      await db.insert(userAddresses).values(insert);
    }
    return { success: true };
  }),

  deleteAddress: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await getDb().delete(userAddresses).where(and(eq(userAddresses.id, input.id), eq(userAddresses.userId, ctx.user.id)));
    return { success: true };
  }),

  updateNotifications: protectedProcedure.input(z.object({
    orderEmail: z.boolean(), orderPush: z.boolean(), orderInApp: z.boolean(),
    marketingEmail: z.boolean(), marketingPush: z.boolean(),
    priceDropEmail: z.boolean(), priceDropPush: z.boolean(),
  })).mutation(async ({ ctx, input }) => {
    await getDb().insert(userNotificationPreferences).values({ userId: ctx.user.id, ...input, consentUpdatedAt: new Date(), updatedAt: new Date() }).onDuplicateKeyUpdate({ set: { ...input, consentUpdatedAt: new Date(), updatedAt: new Date() } });
    await getDb().update(users).set({ marketingConsent: input.marketingEmail || input.marketingPush, marketingConsentAt: new Date(), updatedAt: new Date() }).where(eq(users.id, ctx.user.id));
    return { success: true };
  }),

  revokeSession: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    if (input.id === ctx.sessionId) throw new TRPCError({ code: "BAD_REQUEST", message: "Текущую сессию завершите через выход из аккаунта." });
    await getDb().update(accountSessions).set({ revokedAt: new Date() }).where(and(eq(accountSessions.id, input.id), eq(accountSessions.userId, ctx.user.id)));
    return { success: true };
  }),

  revokeOtherSessions: protectedProcedure.mutation(async ({ ctx }) => {
    const conditions = [eq(accountSessions.userId, ctx.user.id), isNull(accountSessions.revokedAt)];
    if (ctx.sessionId) conditions.push(ne(accountSessions.id, ctx.sessionId));
    await getDb().update(accountSessions).set({ revokedAt: new Date() }).where(and(...conditions));
    await audit(ctx.user.id, "other_sessions_revoked");
    return { success: true };
  }),

  exportData: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const [addresses, orderRows, favorites, securityEvents] = await Promise.all([
      db.select().from(userAddresses).where(eq(userAddresses.userId, ctx.user.id)),
      db.select().from(orders).where(eq(orders.userId, ctx.user.id)).orderBy(desc(orders.createdAt)),
      db.select().from(userFavorites).where(eq(userFavorites.userId, ctx.user.id)),
      db.select().from(accountSecurityEvents).where(eq(accountSecurityEvents.userId, ctx.user.id)).orderBy(desc(accountSecurityEvents.createdAt)),
    ]);
    const { passwordHash: _passwordHash, ...profile } = ctx.user;
    return { generatedAt: new Date(), profile, addresses, orders: orderRows, favorites, securityEvents };
  }),

  deactivate: protectedProcedure.input(z.object({ currentPassword: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    if (!ctx.user.passwordHash || !(await bcrypt.compare(input.currentPassword, ctx.user.passwordHash))) throw new TRPCError({ code: "UNAUTHORIZED", message: "Текущий пароль указан неверно." });
    await getDb().update(users).set({ status: "disabled", deactivatedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, ctx.user.id));
    await audit(ctx.user.id, "account_deactivated");
    return { success: true };
  }),

  requestDeletion: protectedProcedure.input(z.object({
    currentPassword: z.string().min(1),
    confirmation: z.literal("УДАЛИТЬ"),
  })).mutation(async ({ ctx, input }) => {
    if (!ctx.user.passwordHash || !(await bcrypt.compare(input.currentPassword, ctx.user.passwordHash))) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Текущий пароль указан неверно." });
    }
    await getDb().transaction(async tx => {
      await tx.update(users).set({ status: "disabled", deactivatedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, ctx.user.id));
      await tx.update(accountSessions).set({ revokedAt: new Date() }).where(and(eq(accountSessions.userId, ctx.user.id), isNull(accountSessions.revokedAt)));
      await tx.insert(accountSecurityEvents).values({
        userId: ctx.user.id,
        action: "account_deletion_requested",
        metadataJson: { preservation: "orders_payments_legal_records" },
      });
    });
    return { success: true };
  }),
});
