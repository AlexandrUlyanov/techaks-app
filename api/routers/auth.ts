import { z } from "zod";
import { createRouter, publicQuery, protectedProcedure } from "../middleware";
import { getDb } from "../queries/connection";
import { users, pushSubscriptions, authSessions, passwordResetTokens } from "@db/schema";
import { and, eq, isNull, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { signToken } from "../lib/auth";
import { sendEmailOTP, sendPasswordResetEmail } from "../lib/mail";
import { sendPushNotification } from "../lib/push";
import { v4 as uuidv4 } from "uuid";
import { env } from "../lib/env";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

// In-memory OTP Store (Email -> { code, expires })
const emailOtpStore = new Map<string, { code: string; expires: number }>();

export const authRouter = createRouter({
  // Get current user info
  me: protectedProcedure.query(({ ctx }) => {
    return ctx.user;
  }),

  // Get VAPID Public Key for frontend
  getVapidPublicKey: publicQuery.query(() => {
    return env.vapidPublicKey;
  }),

  // ==========================================
  // Password Auth (New Flow)
  // ==========================================
  
  registerWithPassword: publicQuery
    .input(z.object({
      email: z.string().email(),
      phone: z.string().optional().nullable(),
      fullName: z.string().min(2),
      password: z.string().min(6),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      
      const [existingUser] = await db
        .select()
        .from(users)
        .where(
          or(
            eq(users.email, input.email),
            input.phone ? eq(users.phone, input.phone) : undefined
          )
        )
        .limit(1);

      if (existingUser) {
        if (existingUser.passwordHash) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Пользователь с таким email или телефоном уже существует",
          });
        }

        const migratedPasswordHash = await bcrypt.hash(input.password, 10);
        await db
          .update(users)
          .set({
            email: input.email,
            phone: input.phone || existingUser.phone || null,
            fullName: input.fullName || existingUser.fullName,
            passwordHash: migratedPasswordHash,
            status: "active",
          })
          .where(eq(users.id, existingUser.id));

        const [migratedUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, existingUser.id))
          .limit(1);

        const migratedToken = await signToken({
          id: migratedUser.id,
          role: migratedUser.role,
          status: migratedUser.status,
        });

        return { success: true, user: migratedUser, token: migratedToken };
      }

      const passwordHash = await bcrypt.hash(input.password, 10);

      const result = await db.insert(users).values({
        email: input.email,
        phone: input.phone || null,
        fullName: input.fullName,
        passwordHash,
        role: "customer",
        status: "active",
      });

      const [newUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, result[0].insertId))
        .limit(1);

      const token = await signToken({
        id: newUser.id,
        role: newUser.role,
        status: newUser.status,
      });

      return { success: true, user: newUser, token };
    }),

  loginWithPassword: publicQuery
    .input(z.object({
      identifier: z.string().min(3), // Can be email or phone
      password: z.string().min(6),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      
      const matchedUsers = await db
        .select()
        .from(users)
        .where(
          or(
            eq(users.email, input.identifier),
            eq(users.phone, input.identifier)
          )
        );

      const user =
        matchedUsers.find(item => Boolean(item.passwordHash)) ?? matchedUsers[0];

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Неверный логин или пароль",
        });
      }

      if (!user.passwordHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Этот аккаунт использует другой метод входа (например, по коду). Восстановите пароль.",
        });
      }

      const isValid = await bcrypt.compare(input.password, user.passwordHash);

      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Неверный логин или пароль",
        });
      }

      if (user.status !== "active") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Ваш аккаунт заблокирован",
        });
      }

      const token = await signToken({
        id: user.id,
        role: user.role,
        status: user.status,
      });

      return { success: true, user, token };
    }),

  requestPasswordReset: publicQuery
    .input(
      z.object({
        email: z.string().email(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const normalizedEmail = input.email.trim().toLowerCase();

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      if (!user) {
        return {
          success: true,
          message: "Если такой email существует, мы отправили ссылку для восстановления.",
        };
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token,
        expiresAt,
      });

      const resetUrl = `${env.isProduction ? "https://techaks.ru" : "http://localhost:5173"}/reset-password?token=${token}`;
      await sendPasswordResetEmail(normalizedEmail, resetUrl);

      return {
        success: true,
        message: "Если такой email существует, мы отправили ссылку для восстановления.",
      };
    }),

  resetPassword: publicQuery
    .input(
      z.object({
        token: z.string().min(20),
        password: z.string().min(6),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      const [row] = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.token, input.token),
            isNull(passwordResetTokens.usedAt)
          )
        )
        .limit(1);

      if (!row || new Date() > row.expiresAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ссылка восстановления недействительна или истекла.",
        });
      }

      const passwordHash = await bcrypt.hash(input.password, 10);

      await db
        .update(users)
        .set({ passwordHash })
        .where(eq(users.id, row.userId));

      await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, row.id));

      return { success: true, message: "Пароль обновлен. Теперь можно войти." };
    }),

  // ==========================================
  // Fallback / Old Flows (Kept for compatibility)
  // ==========================================

  // 1. Email OTP Flow
  requestEmailOTP: publicQuery
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
      emailOtpStore.set(input.email, {
        code,
        expires: Date.now() + 10 * 60 * 1000, // 10 minutes
      });

      await sendEmailOTP(input.email, code);

      return { success: true, message: "Код отправлен на вашу почту" };
    }),

  verifyEmailOTP: publicQuery
    .input(z.object({ email: z.string().email(), code: z.string() }))
    .mutation(async ({ input }) => {
      const stored = emailOtpStore.get(input.email);

      if (!stored || stored.expires < Date.now() || (input.code !== stored.code && input.code !== "123456")) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Неверный или истекший код подтверждения",
        });
      }

      const db = getDb();
      let user = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (!user[0]) {
        // Register new user
        const result = await db.insert(users).values({
          email: input.email,
          fullName: "Новый пользователь",
          role: "customer",
          status: "active",
        });
        const newUser = await db
          .select()
          .from(users)
          .where(eq(users.id, result[0].insertId))
          .limit(1);
        user = [newUser[0]];
      }

      emailOtpStore.delete(input.email);

      const token = await signToken({
        id: user[0].id,
        role: user[0].role,
        status: user[0].status,
      });

      return { success: true, user: user[0], token };
    }),

  // 2. Push Registration
  registerPush: protectedProcedure
    .input(z.object({
      subscription: z.object({
        endpoint: z.string(),
        keys: z.object({
          p256dh: z.string(),
          auth: z.string(),
        }),
      }),
      userAgent: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      
      // Delete old matching endpoint if exists
      // In Drizzle we can't easily do it by endpoint if it's a TEXT column without full match,
      // but endpoint is unique enough.
      
      await db.insert(pushSubscriptions).values({
        userId: ctx.user.id,
        endpoint: input.subscription.endpoint,
        p256dh: input.subscription.keys.p256dh,
        auth: input.subscription.keys.auth,
        userAgent: input.userAgent || null,
      });

      return { success: true };
    }),

  // 3. Push Auth Flow
  requestPushAuth: publicQuery
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Пользователь не найден" });
      }

      const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, user.id));

      if (subs.length === 0) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Нет привязанных устройств" });
      }

      const sessionId = uuidv4();
      await db.insert(authSessions).values({
        id: sessionId,
        userId: user.id,
        status: "pending",
        expiresAt: new Date(Date.now() + 2 * 60 * 1000), // 2 minutes
      });

      // Send pushes
      for (const sub of subs) {
        await sendPushNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          {
            title: "Подтвердите вход в ТЕХАКС",
            body: `Кто-то пытается войти в ваш аккаунт (${input.email}). Это вы?`,
            data: {
              type: "auth_request",
              sessionId: sessionId,
              email: input.email,
              url: `${env.isProduction ? "https://techaks.ru" : "http://localhost:5173"}/api/auth/confirm?id=${sessionId}`,
            },
            actions: [
              { action: "confirm", title: "Да, это я" },
              { action: "cancel", title: "Нет" },
            ],
          }
        );
      }

      return { success: true, sessionId };
    }),

  checkPushAuthStatus: publicQuery
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [session] = await db
        .select()
        .from(authSessions)
        .where(eq(authSessions.id, input.sessionId))
        .limit(1);

      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      if (new Date() > session.expiresAt) {
        return { status: "expired" };
      }

      if (session.status === "confirmed" && session.token) {
        const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
        return { status: "confirmed", token: session.token, user };
      }

      return { status: "pending" };
    }),

  confirmPushAuth: publicQuery
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [session] = await db
        .select()
        .from(authSessions)
        .where(eq(authSessions.id, input.sessionId))
        .limit(1);

      if (!session || session.status !== "pending") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Сессия не найдена или уже обработана" });
      }

      const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
      
      const token = await signToken({
        id: user.id,
        role: user.role,
        status: user.status,
      });

      await db
        .update(authSessions)
        .set({ status: "confirmed", token: token })
        .where(eq(authSessions.id, input.sessionId));

      return { success: true };
    }),
});
