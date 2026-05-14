import { z } from "zod";
import { createRouter, publicQuery, protectedProcedure, requireAbility } from "../middleware";
import { getDb } from "../queries/connection";
import { users, orders, orderItems, orderComments, orderHistory, products } from "@db/schema";
import { and, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";

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
      const orderNumber = `TA-${Date.now().toString().slice(-9)}-${Math.floor(
        100 + Math.random() * 900
      )}`;

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
        orderNumber,
        customerName: normalizedFullName,
        customerPhone: normalizedPhone,
        customerEmail: normalizedEmail,
        source: "site",
        totalPrice: trustedTotal,
        subtotal: trustedTotal,
        paidAmount: 0,
        deliveryType: input.deliveryType,
        address: input.address,
        deliveryStatus:
          input.deliveryType === "pickup" ? "not_required" : "awaiting_processing",
        paymentType: input.paymentType,
        paymentMethod: input.paymentType,
        status: "pending",
      });
      const orderId = newOrder[0].insertId;

      // 3. Create order items
      for (const item of input.items) {
        await db.insert(orderItems).values({
          orderId,
          productId: item.productId,
          total: item.price * item.quantity,
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
          limit: z.number().min(1).max(200).default(25),
          offset: z.number().min(0).default(0),
          search: z.string().trim().optional(),
          statuses: z.array(z.string()).optional(),
          paymentStatuses: z.array(z.string()).optional(),
          deliveryStatuses: z.array(z.string()).optional(),
          deliveryTypes: z.array(z.string()).optional(),
          paymentTypes: z.array(z.string()).optional(),
          sources: z.array(z.string()).optional(),
          managerId: z.number().optional(),
          dateFrom: z.coerce.date().optional(),
          dateTo: z.coerce.date().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Order");
      const db = getDb();
      const limit = input?.limit ?? 25;
      const offset = input?.offset ?? 0;
      const whereConditions: any[] = [];

      if (input?.statuses?.length) {
        whereConditions.push(inArray(orders.status, input.statuses));
      }
      if (input?.paymentStatuses?.length) {
        whereConditions.push(inArray(orders.paymentStatus, input.paymentStatuses));
      }
      if (input?.deliveryStatuses?.length) {
        whereConditions.push(inArray(orders.deliveryStatus, input.deliveryStatuses));
      }
      if (input?.deliveryTypes?.length) {
        whereConditions.push(inArray(orders.deliveryType, input.deliveryTypes));
      }
      if (input?.paymentTypes?.length) {
        whereConditions.push(inArray(orders.paymentType, input.paymentTypes));
      }
      if (input?.sources?.length) {
        whereConditions.push(inArray(orders.source, input.sources));
      }
      if (typeof input?.managerId === "number") {
        whereConditions.push(eq(orders.managerId, input.managerId));
      }
      if (input?.dateFrom) {
        whereConditions.push(gte(orders.createdAt, input.dateFrom));
      }
      if (input?.dateTo) {
        whereConditions.push(lte(orders.createdAt, input.dateTo));
      }

      const search = input?.search?.trim();
      if (search) {
        const searchLike = `%${search}%`;
        const searchAsNumber = Number(search);
        const isNumeric = Number.isFinite(searchAsNumber);

        whereConditions.push(
          or(
            sql`${orders.id} = ${isNumeric ? searchAsNumber : -1}`,
            sql`${orders.orderNumber} LIKE ${searchLike}`,
            sql`${orders.customerName} LIKE ${searchLike}`,
            sql`${orders.customerPhone} LIKE ${searchLike}`,
            sql`${orders.customerEmail} LIKE ${searchLike}`,
            sql`${orders.deliveryTrackNumber} LIKE ${searchLike}`,
            sql`EXISTS (
              SELECT 1 FROM ${orderItems} oi
              WHERE oi.order_id = ${orders.id}
              AND (
                oi.sku LIKE ${searchLike}
                OR oi.product_name LIKE ${searchLike}
              )
            )`
          )
        );
      }

      const whereClause =
        whereConditions.length > 0 ? and(...whereConditions) : undefined;

      const items = await db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          userId: orders.userId,
          status: orders.status,
          totalPrice: orders.totalPrice,
          subtotal: orders.subtotal,
          discountTotal: orders.discountTotal,
          deliveryPrice: orders.deliveryPrice,
          paidAmount: orders.paidAmount,
          deliveryType: orders.deliveryType,
          deliveryStatus: orders.deliveryStatus,
          deliveryCity: orders.deliveryCity,
          source: orders.source,
          managerId: orders.managerId,
          address: orders.address,
          paymentType: orders.paymentType,
          paymentStatus: orders.paymentStatus,
          createdAt: orders.createdAt,
          updatedAt: orders.updatedAt,
          customerName: sql<string>`coalesce(${orders.customerName}, ${users.fullName})`,
          customerPhone: sql<string>`coalesce(${orders.customerPhone}, ${users.phone})`,
          customerEmail: sql<string>`coalesce(${orders.customerEmail}, ${users.email})`,
          itemsCount: sql<number>`(
            SELECT count(*) FROM ${orderItems}
            WHERE ${orderItems.orderId} = ${orders.id}
          )`,
        })
        .from(orders)
        .leftJoin(users, eq(orders.userId, users.id))
        .where(whereClause)
        .orderBy(desc(orders.createdAt))
        .limit(limit)
        .offset(offset);

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(orders)
        .where(whereClause);

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
          "new",
          "awaiting_payment",
          "paid",
          "processing",
          "confirmed_by_customer",
          "ready_for_pickup",
          "assembling",
          "assembled",
          "awaiting_dispatch",
          "handed_to_delivery",
          "in_delivery",
          "completed",
          "return_requested",
          "problem",
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "update", "Order");
      const db = getDb();
      const existing = await db
        .select({
          status: orders.status,
        })
        .from(orders)
        .where(eq(orders.id, input.id))
        .limit(1);
      await db
        .update(orders)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(orders.id, input.id));
      await db.insert(orderHistory).values({
        orderId: input.id,
        userId: ctx.user?.id ?? null,
        actionType: "status_changed",
        oldValue: { status: existing[0]?.status ?? null } as any,
        newValue: { status: input.status } as any,
      });
      return { success: true };
    }),

  getOrderById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Order");
      const db = getDb();

      const orderRows = await db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          status: orders.status,
          paymentStatus: orders.paymentStatus,
          deliveryStatus: orders.deliveryStatus,
          totalPrice: orders.totalPrice,
          subtotal: orders.subtotal,
          discountTotal: orders.discountTotal,
          deliveryPrice: orders.deliveryPrice,
          paidAmount: orders.paidAmount,
          paymentType: orders.paymentType,
          paymentMethod: orders.paymentMethod,
          paymentId: orders.paymentId,
          paymentError: orders.paymentError,
          paidAt: orders.paidAt,
          deliveryType: orders.deliveryType,
          deliveryService: orders.deliveryService,
          deliveryCity: orders.deliveryCity,
          deliveryRegion: orders.deliveryRegion,
          deliveryPostalCode: orders.deliveryPostalCode,
          deliveryTrackNumber: orders.deliveryTrackNumber,
          deliveryComment: orders.deliveryComment,
          address: orders.address,
          source: orders.source,
          managerId: orders.managerId,
          customerName: sql<string>`coalesce(${orders.customerName}, ${users.fullName})`,
          customerPhone: sql<string>`coalesce(${orders.customerPhone}, ${users.phone})`,
          customerEmail: sql<string>`coalesce(${orders.customerEmail}, ${users.email})`,
          customerFirstName: orders.customerFirstName,
          customerLastName: orders.customerLastName,
          customerComment: orders.customerComment,
          internalComment: orders.internalComment,
          createdAt: orders.createdAt,
          updatedAt: orders.updatedAt,
        })
        .from(orders)
        .leftJoin(users, eq(orders.userId, users.id))
        .where(eq(orders.id, input.id))
        .limit(1);

      if (!orderRows[0]) {
        throw new Error("Заказ не найден");
      }

      const items = await db
        .select({
          id: orderItems.id,
          orderId: orderItems.orderId,
          productId: orderItems.productId,
          sku: orderItems.sku,
          productName: sql<string>`coalesce(${orderItems.productName}, ${products.name})`,
          image: sql<string>`coalesce(${orderItems.image}, ${products.image})`,
          quantity: orderItems.quantity,
          price: orderItems.price,
          discount: orderItems.discount,
          total: orderItems.total,
          stockStatus: orderItems.stockStatus,
        })
        .from(orderItems)
        .leftJoin(products, eq(orderItems.productId, products.id))
        .where(eq(orderItems.orderId, input.id))
        .orderBy(orderItems.id);

      return {
        ...orderRows[0],
        items,
      };
    }),

  addOrderComment: protectedProcedure
    .input(
      z.object({
        orderId: z.number(),
        comment: z.string().trim().min(1),
        commentType: z.enum(["internal", "client"]).default("internal"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "update", "Order");
      const db = getDb();

      await db.insert(orderComments).values({
        orderId: input.orderId,
        userId: ctx.user?.id ?? null,
        commentType: input.commentType,
        comment: input.comment,
      });

      await db.insert(orderHistory).values({
        orderId: input.orderId,
        userId: ctx.user?.id ?? null,
        actionType: "comment_added",
        newValue: { commentType: input.commentType, comment: input.comment } as any,
      });

      return { success: true };
    }),

  getOrderHistory: protectedProcedure
    .input(z.object({ orderId: z.number() }))
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Order");
      const db = getDb();

      const history = await db
        .select({
          id: orderHistory.id,
          orderId: orderHistory.orderId,
          userId: orderHistory.userId,
          actionType: orderHistory.actionType,
          oldValue: orderHistory.oldValue,
          newValue: orderHistory.newValue,
          comment: orderHistory.comment,
          createdAt: orderHistory.createdAt,
        })
        .from(orderHistory)
        .where(eq(orderHistory.orderId, input.orderId))
        .orderBy(desc(orderHistory.createdAt));

      const comments = await db
        .select({
          id: orderComments.id,
          orderId: orderComments.orderId,
          userId: orderComments.userId,
          commentType: orderComments.commentType,
          comment: orderComments.comment,
          createdAt: orderComments.createdAt,
        })
        .from(orderComments)
        .where(eq(orderComments.orderId, input.orderId))
        .orderBy(desc(orderComments.createdAt));

      return { history, comments };
    }),

  updateOrderDetails: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        customerName: z.string().trim().min(2).optional(),
        customerPhone: z.string().trim().min(6).optional(),
        customerEmail: z.string().trim().email().optional().or(z.literal("")),
        address: z.string().trim().optional(),
        deliveryType: z.enum(["pickup", "delivery"]).optional(),
        deliveryCity: z.string().trim().optional(),
        deliveryRegion: z.string().trim().optional(),
        deliveryPostalCode: z.string().trim().optional(),
        customerComment: z.string().trim().optional(),
        internalComment: z.string().trim().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "update", "Order");
      const db = getDb();
      const existing = await db
        .select()
        .from(orders)
        .where(eq(orders.id, input.id))
        .limit(1);
      if (!existing[0]) throw new Error("Заказ не найден");

      const patch: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (typeof input.customerName === "string") patch.customerName = input.customerName;
      if (typeof input.customerPhone === "string") patch.customerPhone = input.customerPhone;
      if (typeof input.customerEmail === "string")
        patch.customerEmail = input.customerEmail.trim() || null;
      if (typeof input.address === "string") patch.address = input.address || null;
      if (typeof input.deliveryType === "string") patch.deliveryType = input.deliveryType;
      if (typeof input.deliveryCity === "string") patch.deliveryCity = input.deliveryCity || null;
      if (typeof input.deliveryRegion === "string")
        patch.deliveryRegion = input.deliveryRegion || null;
      if (typeof input.deliveryPostalCode === "string")
        patch.deliveryPostalCode = input.deliveryPostalCode || null;
      if (typeof input.customerComment === "string")
        patch.customerComment = input.customerComment || null;
      if (typeof input.internalComment === "string")
        patch.internalComment = input.internalComment || null;

      await db.update(orders).set(patch as any).where(eq(orders.id, input.id));
      await db.insert(orderHistory).values({
        orderId: input.id,
        userId: ctx.user?.id ?? null,
        actionType: "order_details_updated",
        oldValue: existing[0] as any,
        newValue: patch as any,
      });
      return { success: true };
    }),

  updateOrderPayment: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        paymentStatus: z.string().trim().min(2),
        paidAmount: z.number().int().min(0).optional(),
        paymentMethod: z.string().trim().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "update", "Order");
      const db = getDb();
      await db
        .update(orders)
        .set({
          paymentStatus: input.paymentStatus,
          paidAmount: input.paidAmount,
          paymentMethod: input.paymentMethod,
          updatedAt: new Date(),
        } as any)
        .where(eq(orders.id, input.id));
      await db.insert(orderHistory).values({
        orderId: input.id,
        userId: ctx.user?.id ?? null,
        actionType: "payment_updated",
        newValue: input as any,
      });
      return { success: true };
    }),

  updateOrderDelivery: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        deliveryStatus: z.string().trim().min(2),
        deliveryService: z.string().trim().optional(),
        deliveryTrackNumber: z.string().trim().optional(),
        deliveryPrice: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "update", "Order");
      const db = getDb();
      await db
        .update(orders)
        .set({
          deliveryStatus: input.deliveryStatus,
          deliveryService: input.deliveryService,
          deliveryTrackNumber: input.deliveryTrackNumber,
          deliveryPrice: input.deliveryPrice,
          updatedAt: new Date(),
        } as any)
        .where(eq(orders.id, input.id));
      await db.insert(orderHistory).values({
        orderId: input.id,
        userId: ctx.user?.id ?? null,
        actionType: "delivery_updated",
        newValue: input as any,
      });
      return { success: true };
    }),

  updateOrderItemQuantity: protectedProcedure
    .input(
      z.object({
        orderId: z.number(),
        itemId: z.number(),
        quantity: z.number().int().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "update", "Order");
      const db = getDb();
      const item = await db
        .select()
        .from(orderItems)
        .where(and(eq(orderItems.id, input.itemId), eq(orderItems.orderId, input.orderId)))
        .limit(1);
      if (!item[0]) throw new Error("Позиция заказа не найдена");

      const nextTotal = item[0].price * input.quantity - (item[0].discount ?? 0);
      await db
        .update(orderItems)
        .set({
          quantity: input.quantity,
          total: nextTotal,
        })
        .where(eq(orderItems.id, input.itemId));

      const totals = await db
        .select({
          subtotal: sql<number>`coalesce(sum(${orderItems.price} * ${orderItems.quantity}), 0)`,
          discountTotal: sql<number>`coalesce(sum(${orderItems.discount}), 0)`,
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, input.orderId));
      const subtotal = totals[0]?.subtotal ?? 0;
      const discountTotal = totals[0]?.discountTotal ?? 0;
      const orderRow = await db
        .select({ deliveryPrice: orders.deliveryPrice })
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);
      const deliveryPrice = orderRow[0]?.deliveryPrice ?? 0;
      const totalPrice = subtotal - discountTotal + deliveryPrice;

      await db
        .update(orders)
        .set({ subtotal, discountTotal, totalPrice, updatedAt: new Date() })
        .where(eq(orders.id, input.orderId));

      await db.insert(orderHistory).values({
        orderId: input.orderId,
        userId: ctx.user?.id ?? null,
        actionType: "order_item_quantity_updated",
        oldValue: { itemId: input.itemId, quantity: item[0].quantity } as any,
        newValue: { itemId: input.itemId, quantity: input.quantity } as any,
      });
      return { success: true };
    }),

  removeOrderItem: protectedProcedure
    .input(z.object({ orderId: z.number(), itemId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "update", "Order");
      const db = getDb();
      await db
        .delete(orderItems)
        .where(and(eq(orderItems.id, input.itemId), eq(orderItems.orderId, input.orderId)));
      await db.insert(orderHistory).values({
        orderId: input.orderId,
        userId: ctx.user?.id ?? null,
        actionType: "order_item_removed",
        newValue: { itemId: input.itemId } as any,
      });
      return { success: true };
    }),
});
