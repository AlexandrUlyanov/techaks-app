import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// Simple Mock OTP Store (In-memory for demo, should be Redis in production)
const otpStore = new Map<string, string>();

export const authRouter = createRouter({
  // Request OTP via SMS (Mock)
  requestOTP: publicQuery
    .input(z.object({ phone: z.string().min(10) }))
    .mutation(async ({ input }) => {
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      otpStore.set(input.phone, code);

      console.log(`[MOCK SMS] Verification code for ${input.phone}: ${code}`);

      return { success: true, message: "Код отправлен (см. консоль сервера)" };
    }),

  // Verify OTP and Login/Register
  verifyOTP: publicQuery
    .input(
      z.object({
        phone: z.string().min(10),
        code: z.string().length(4),
      })
    )
    .mutation(async ({ input }) => {
      const storedCode = otpStore.get(input.phone);

      if (input.code !== storedCode && input.code !== "1234") {
        // "1234" is universal debug code
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Неверный код подтверждения",
        });
      }

      const db = getDb();
      let user = await db
        .select()
        .from(users)
        .where(eq(users.phone, input.phone))
        .limit(1);

      if (!user[0]) {
        // Register new user
        const result = await db.insert(users).values({
          phone: input.phone,
          fullName: "Новый покупатель",
        });
        const newUser = await db
          .select()
          .from(users)
          .where(eq(users.id, result[0].insertId))
          .limit(1);
        user = [newUser[0]];
      }

      otpStore.delete(input.phone);

      return {
        success: true,
        user: user[0],
        token: "mock-jwt-token", // In a real app, generate a real JWT
      };
    }),
});
