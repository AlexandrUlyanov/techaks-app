import { z } from "zod";
import { createRouter, publicQuery, protectedProcedure, requireAbility } from "../middleware";
import { getDb } from "../queries/connection";
import { users, orders, orderItems } from "@db/schema";
import { desc, eq, sql } from "drizzle-orm";

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
        .orderBy(desc(orders.createdAt))
        .where(eq(orders.userId, user[0].id));
    }),

  listOrders: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(200).default(100),
          offset: z.number().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Order");
      const db = getDb();
      const limit = input?.limit ?? 100;
      const offset = input?.offset ?? 0;

      const items = await db
        .select({
          id: orders.id,
          userId: orders.userId,
          status: orders.status,
          totalPrice: orders.totalPrice,
          deliveryType: orders.deliveryType,
          address: orders.address,
          paymentType: orders.paymentType,
          paymentStatus: orders.paymentStatus,
          createdAt: orders.createdAt,
          customerName: users.fullName,
          customerPhone: users.phone,
          customerEmail: users.email,
          itemsCount: sql<number>`(
            SELECT count(*) FROM ${orderItems}
            WHERE ${orderItems.orderId} = ${orders.id}
          )`,
        })
        .from(orders)
        .leftJoin(users, eq(orders.userId, users.id))
        .orderBy(desc(orders.createdAt))
        .limit(limit)
        .offset(offset);

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(orders);

      return {
        orders: items,
        total: countResult[0]?.count ?? 0,
      };
    }),

  updateOrderStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum([
          "pending",
          "confirmed",
          "shipped",
          "delivered",
          "cancelled",
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "update", "Order");
      const db = getDb();
      await db
        .update(orders)
        .set({ status: input.status })
        .where(eq(orders.id, input.id));
      return { success: true };
    }),
});
