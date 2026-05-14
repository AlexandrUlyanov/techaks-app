import { z } from "zod";
import { createRouter, publicQuery, protectedProcedure, requireAbility } from "../middleware";
import { getDb } from "../queries/connection";
import { users, orders, orderItems } from "@db/schema";
import { eq } from "drizzle-orm";

export const ecommerceRouter = createRouter({
  // Order creation (Progressive Checkout)
  placeOrder: publicQuery
    .input(
      z.object({
        customer: z.object({
          phone: z.string().min(10),
          fullName: z.string().min(2),
          email: z.string().email().optional().nullable(),
        }),
        items: z.array(
          z.object({
            productId: z.number(),
            quantity: z.number().min(1),
            price: z.number(),
          })
        ),
        deliveryType: z.enum(["pickup", "delivery"]),
        address: z.string().optional().nullable(),
        paymentType: z.enum(["cash", "card", "sbp"]),
        totalPrice: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      if (input.items.length === 0) {
        throw new Error("Корзина пуста");
      }

      const normalizedPhone = input.customer.phone.trim();
      const normalizedFullName = input.customer.fullName.trim();
      const normalizedEmailRaw = input.customer.email?.trim();
      const normalizedEmail =
        normalizedEmailRaw && normalizedEmailRaw.length > 0
          ? normalizedEmailRaw.toLowerCase()
          : null;

      const trustedTotal = input.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      // 1. Find or create user
      let userId: number | null = null;
      const email =
        normalizedEmail ||
        `${normalizedPhone.replace(/[^0-9]/g, "")}@placeholder.techaks.ru`;
      
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser[0]) {
        userId = existingUser[0].id;
      } else {
        const newUser = await db.insert(users).values({
          email,
          phone: normalizedPhone,
          fullName: normalizedFullName,
          role: "customer",
          status: "active",
        });
        userId = newUser[0].insertId;
      }

      // 2. Create order
      const newOrder = await db.insert(orders).values({
        userId,
        totalPrice: trustedTotal,
        deliveryType: input.deliveryType,
        address: input.address,
        paymentType: input.paymentType,
        status: "pending",
      });
      const orderId = newOrder[0].insertId;

      // 3. Create order items
      for (const item of input.items) {
        await db.insert(orderItems).values({
          orderId,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        });
      }

      // 4. (Optional) Trigger Telegram Notification to Admin
      // This will be added in a separate utility

      return { success: true, orderId };
    }),

  // User orders for Account section
  getUserOrders: protectedProcedure
    .input(z.object({ phone: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      
      // If not admin, check if phone matches current user
      if (!ctx.ability.can("read", "User")) {
        if (ctx.user.phone !== input.phone) {
          requireAbility(ctx, "read", "Order", { userId: ctx.user.id });
        }
      }

      const user = await db
        .select()
        .from(users)
        .where(eq(users.phone, input.phone))
        .limit(1);
      if (!user[0]) return [];

      return await db
        .select()
        .from(orders)
        .where(eq(orders.userId, user[0].id));
    }),
});
