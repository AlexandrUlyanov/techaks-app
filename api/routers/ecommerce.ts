import { z } from "zod";
import { createRouter, publicQuery, protectedProcedure, requireAbility } from "../middleware";
import { getDb } from "../queries/connection";
import { users, orders, orderItems, orderComments, orderHistory, products } from "@db/schema";
import { and, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import * as XLSX from "xlsx";
import { sendOrderNotificationEmail } from "../lib/mail";

const ORDER_STATUS_FLOW: Record<string, string[]> = {
  pending: ["confirmed", "awaiting_payment", "processing", "cancelled", "problem"],
  awaiting_payment: ["paid", "processing", "cancelled", "problem"],
  paid: ["processing", "confirmed_by_customer", "ready_for_pickup", "cancelled", "problem"],
  processing: ["confirmed_by_customer", "ready_for_pickup", "assembling", "cancelled", "problem"],
  confirmed: ["processing", "ready_for_pickup", "cancelled", "problem"],
  confirmed_by_customer: ["ready_for_pickup", "assembling", "cancelled", "problem"],
  ready_for_pickup: ["assembling", "assembled", "awaiting_dispatch", "cancelled", "problem"],
  assembling: ["assembled", "cancelled", "problem"],
  assembled: ["awaiting_dispatch", "handed_to_delivery", "cancelled", "problem"],
  awaiting_dispatch: ["handed_to_delivery", "in_delivery", "cancelled", "problem"],
  shipped: ["in_delivery", "delivered", "problem"],
  handed_to_delivery: ["in_delivery", "delivered", "problem"],
  in_delivery: ["delivered", "problem"],
  delivered: ["completed", "return_requested", "problem"],
  completed: ["return_requested"],
  cancelled: [],
  return_requested: ["cancelled", "problem"],
  problem: ["processing", "cancelled", "completed"],
};

const PAYMENT_STATUS_FLOW: Record<string, string[]> = {
  unpaid: ["awaiting_payment", "paid", "payment_error", "partially_paid", "refund"],
  awaiting_payment: ["paid", "payment_error", "partially_paid", "refund"],
  partially_paid: ["paid", "refund", "partial_refund", "payment_error"],
  paid: ["refund", "partial_refund"],
  payment_error: ["awaiting_payment", "paid", "cancelled"],
  refund: [],
  partial_refund: ["refund"],
};

const DELIVERY_STATUS_FLOW: Record<string, string[]> = {
  not_required: [],
  awaiting_processing: ["prepared", "handed_to_delivery", "in_delivery", "delivery_error"],
  prepared: ["handed_to_delivery", "in_delivery", "delivery_error"],
  handed_to_delivery: ["in_delivery", "delivered", "delivery_error"],
  in_delivery: ["delivered", "return_in_transit", "delivery_error"],
  delivered: ["return_in_transit"],
  return_in_transit: ["delivery_error"],
  delivery_error: ["awaiting_processing", "prepared", "handed_to_delivery"],
};

function ensureTransition(
  flow: Record<string, string[]>,
  fromStatus: string,
  toStatus: string,
  kind: "заказа" | "оплаты" | "доставки"
) {
  if (fromStatus === toStatus) return;
  const next = flow[fromStatus] ?? [];
  if (!next.includes(toStatus)) {
    throw new Error(
      `Недопустимый переход статуса ${kind}: "${fromStatus}" → "${toStatus}"`
    );
  }
}

function ensureOrderOperationAllowedByRole(
  role: string | undefined,
  operation:
    | "update_status"
    | "update_details"
    | "update_payment"
    | "update_delivery"
    | "update_item"
    | "remove_item"
    | "add_comment",
  payload?: { nextStatus?: string }
) {
  const safeRole = role ?? "customer";
  if (safeRole === "super_admin" || safeRole === "admin") return;

  if (safeRole === "warehouse") {
    if (operation === "update_status") {
      const allowed = ["ready_for_pickup", "assembling", "assembled", "problem"];
      if (!payload?.nextStatus || !allowed.includes(payload.nextStatus)) {
        throw new Error("Роль склада не может установить этот статус заказа");
      }
      return;
    }
    if (operation === "add_comment") return;
    throw new Error("Роль склада не имеет прав на это действие");
  }

  if (safeRole === "manager") {
    if (
      operation === "update_status" ||
      operation === "update_details" ||
      operation === "update_delivery" ||
      operation === "add_comment"
    ) {
      return;
    }
    throw new Error("Менеджеру недоступно это действие");
  }

  throw new Error("Недостаточно прав для операции с заказом");
}

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
      let newOrder;
      try {
        newOrder = await db.insert(orders).values({
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
          // Using legacy-safe status to support older enum schemas on production.
          deliveryStatus: "pending",
          paymentType: input.paymentType,
          paymentMethod: input.paymentType,
          status: "pending",
        });
      } catch (primaryInsertError) {
        console.error("placeOrder full insert failed, trying legacy fallback", primaryInsertError);
        // Fallback for partially migrated DBs (legacy orders schema with fewer columns).
        const legacyInsertResult = await db.execute(sql`
          INSERT INTO orders (
            user_id,
            status,
            total_price,
            delivery_type,
            address,
            payment_type,
            payment_status,
            created_at
          ) VALUES (
            ${userId},
            ${"pending"},
            ${trustedTotal},
            ${input.deliveryType},
            ${input.address},
            ${input.paymentType},
            ${"unpaid"},
            NOW()
          )
        `);
        const fallbackOrderId = Number(
          (legacyInsertResult as any)?.[0]?.insertId ??
          (legacyInsertResult as any)?.insertId ??
          0
        );
        if (!fallbackOrderId) {
          throw new Error("Не удалось получить ID созданного заказа");
        }
        newOrder = [{ insertId: fallbackOrderId }];
      }
      const orderId = newOrder[0].insertId;

      // 3. Create order items
      for (const item of input.items) {
        try {
          await db.insert(orderItems).values({
            orderId,
            productId: item.productId,
            total: item.price * item.quantity,
            quantity: item.quantity,
            price: item.price,
          });
        } catch (orderItemInsertError) {
          console.error("order item full insert failed, trying legacy fallback", orderItemInsertError);
          await db.execute(sql`
            INSERT INTO order_items (
              order_id,
              product_id,
              quantity,
              price
            ) VALUES (
              ${orderId},
              ${item.productId},
              ${item.quantity},
              ${item.price}
            )
          `);
        }
      }

      // 4. (Optional) Trigger Telegram Notification to Admin
      // This will be added in a separate utility
      if (normalizedEmail) {
        await sendOrderNotificationEmail({
          email: normalizedEmail,
          orderNumber,
          eventType: "order_created",
          message: `Ваш заказ ${orderNumber} успешно создан. Мы свяжемся с вами для подтверждения.`,
        }).catch(err => {
          console.error("order_created email failed", err);
        });
      }

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

      try {
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
          total: Number(countResult[0]?.count ?? 0),
        };
      } catch (listOrdersError) {
        console.error("listOrders full query failed, using legacy fallback", listOrdersError);

        const legacyResult = await db.execute<any[]>(sql`
          SELECT
            o.id,
            NULL AS orderNumber,
            o.user_id AS userId,
            o.status,
            o.total_price AS totalPrice,
            o.delivery_type AS deliveryType,
            'not_required' AS deliveryStatus,
            NULL AS deliveryCity,
            'site' AS source,
            NULL AS managerId,
            o.address,
            o.payment_type AS paymentType,
            o.payment_status AS paymentStatus,
            o.created_at AS createdAt,
            o.created_at AS updatedAt,
            u.full_name AS customerName,
            u.phone AS customerPhone,
            u.email AS customerEmail,
            (
              SELECT COUNT(*)
              FROM order_items oi
              WHERE oi.order_id = o.id
            ) AS itemsCount
          FROM orders o
          LEFT JOIN users u ON u.id = o.user_id
          ORDER BY o.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `);

        const legacyCountResult = await db.execute<any[]>(
          sql`SELECT COUNT(*) AS count FROM orders`
        );

        const legacyRows = Array.isArray((legacyResult as any)?.[0])
          ? (legacyResult as any)[0]
          : (legacyResult as any[]);
        const legacyCountRows = Array.isArray((legacyCountResult as any)?.[0])
          ? (legacyCountResult as any)[0]
          : (legacyCountResult as any[]);

        const normalized = (legacyRows as any[]).map((row: any) => ({
          ...row,
          id: Number(row.id),
          subtotal: Number(row.totalPrice ?? 0),
          discountTotal: 0,
          deliveryPrice: 0,
          paidAmount: 0,
          itemsCount: Number(row.itemsCount ?? 0),
        }));

        return {
          orders: normalized,
          total: Number((legacyCountRows as any[])[0]?.count ?? 0),
        };
      }
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
      ensureOrderOperationAllowedByRole(ctx.user?.role, "update_status", {
        nextStatus: input.status,
      });
      const db = getDb();
      const existing = await db
        .select({
          status: orders.status,
          customerEmail: orders.customerEmail,
          orderNumber: orders.orderNumber,
        })
        .from(orders)
        .where(eq(orders.id, input.id))
        .limit(1);
      if (!existing[0]) throw new Error("Заказ не найден");
      ensureTransition(ORDER_STATUS_FLOW, existing[0].status, input.status, "заказа");
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
      const notificationEmail = existing[0]?.customerEmail;
      const notificationOrderNumber = existing[0]?.orderNumber;
      if (notificationEmail && notificationOrderNumber) {
        await sendOrderNotificationEmail({
          email: notificationEmail,
          orderNumber: notificationOrderNumber,
          eventType:
            input.status === "cancelled"
              ? "order_cancelled"
              : input.status === "return_requested"
                ? "order_refund"
                : "order_status_changed",
          message: `Статус вашего заказа ${notificationOrderNumber} изменился на: ${input.status}.`,
        }).catch(err => {
          console.error("order_status email failed", err);
        });
      }
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
      ensureOrderOperationAllowedByRole(ctx.user?.role, "add_comment");
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
      ensureOrderOperationAllowedByRole(ctx.user?.role, "update_details");
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
      ensureOrderOperationAllowedByRole(ctx.user?.role, "update_payment");
      const db = getDb();
      const existing = await db
        .select({
          paymentStatus: orders.paymentStatus,
          customerEmail: orders.customerEmail,
          orderNumber: orders.orderNumber,
        })
        .from(orders)
        .where(eq(orders.id, input.id))
        .limit(1);
      if (!existing[0]) throw new Error("Заказ не найден");
      ensureTransition(
        PAYMENT_STATUS_FLOW,
        existing[0].paymentStatus,
        input.paymentStatus,
        "оплаты"
      );
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
      if (existing[0].customerEmail && existing[0].orderNumber && input.paymentStatus === "paid") {
        await sendOrderNotificationEmail({
          email: existing[0].customerEmail,
          orderNumber: existing[0].orderNumber,
          eventType: "payment_success",
          message: `Оплата по заказу ${existing[0].orderNumber} успешно получена.`,
        }).catch(err => {
          console.error("payment_success email failed", err);
        });
      }
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
      ensureOrderOperationAllowedByRole(ctx.user?.role, "update_delivery");
      const db = getDb();
      const existing = await db
        .select({
          deliveryStatus: orders.deliveryStatus,
          customerEmail: orders.customerEmail,
          orderNumber: orders.orderNumber,
        })
        .from(orders)
        .where(eq(orders.id, input.id))
        .limit(1);
      if (!existing[0]) throw new Error("Заказ не найден");
      ensureTransition(
        DELIVERY_STATUS_FLOW,
        existing[0].deliveryStatus,
        input.deliveryStatus,
        "доставки"
      );
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
      if (
        existing[0].customerEmail &&
        existing[0].orderNumber &&
        (input.deliveryStatus === "handed_to_delivery" ||
          input.deliveryStatus === "in_delivery")
      ) {
        await sendOrderNotificationEmail({
          email: existing[0].customerEmail,
          orderNumber: existing[0].orderNumber,
          eventType: "delivery_handed",
          message: `Заказ ${existing[0].orderNumber} передан в доставку.`,
        }).catch(err => {
          console.error("delivery_handed email failed", err);
        });
      }
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
      ensureOrderOperationAllowedByRole(ctx.user?.role, "update_item");
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
      ensureOrderOperationAllowedByRole(ctx.user?.role, "remove_item");
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

  bulkUpdateOrderStatus: protectedProcedure
    .input(
      z.object({
        orderIds: z.array(z.number()).min(1),
        status: z.string().trim().min(2),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "update", "Order");
      ensureOrderOperationAllowedByRole(ctx.user?.role, "update_status", {
        nextStatus: input.status,
      });
      const db = getDb();
      const targetOrders = await db
        .select({
          id: orders.id,
          status: orders.status,
        })
        .from(orders)
        .where(inArray(orders.id, input.orderIds));

      for (const order of targetOrders) {
        ensureTransition(ORDER_STATUS_FLOW, order.status, input.status, "заказа");
      }

      await db
        .update(orders)
        .set({ status: input.status, updatedAt: new Date() })
        .where(inArray(orders.id, input.orderIds));

      for (const order of targetOrders) {
        await db.insert(orderHistory).values({
          orderId: order.id,
          userId: ctx.user?.id ?? null,
          actionType: "bulk_status_changed",
          oldValue: { status: order.status } as any,
          newValue: { status: input.status } as any,
        });
      }

      return { success: true, updated: targetOrders.length };
    }),

  exportOrdersCsv: protectedProcedure
    .input(
      z
        .object({
          search: z.string().trim().optional(),
          statuses: z.array(z.string()).optional(),
          paymentStatuses: z.array(z.string()).optional(),
          deliveryTypes: z.array(z.string()).optional(),
          dateFrom: z.coerce.date().optional(),
          dateTo: z.coerce.date().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Order");
      const db = getDb();
      const whereConditions: any[] = [];
      if (input?.statuses?.length) whereConditions.push(inArray(orders.status, input.statuses));
      if (input?.paymentStatuses?.length)
        whereConditions.push(inArray(orders.paymentStatus, input.paymentStatuses));
      if (input?.deliveryTypes?.length)
        whereConditions.push(inArray(orders.deliveryType, input.deliveryTypes));
      if (input?.dateFrom) whereConditions.push(gte(orders.createdAt, input.dateFrom));
      if (input?.dateTo) whereConditions.push(lte(orders.createdAt, input.dateTo));

      const search = input?.search?.trim();
      if (search) {
        const like = `%${search}%`;
        whereConditions.push(
          or(
            sql`${orders.orderNumber} LIKE ${like}`,
            sql`${orders.customerName} LIKE ${like}`,
            sql`${orders.customerPhone} LIKE ${like}`,
            sql`${orders.customerEmail} LIKE ${like}`
          )
        );
      }

      const rows = await db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          createdAt: orders.createdAt,
          customerName: orders.customerName,
          customerPhone: orders.customerPhone,
          customerEmail: orders.customerEmail,
          totalPrice: orders.totalPrice,
          status: orders.status,
          paymentStatus: orders.paymentStatus,
          deliveryType: orders.deliveryType,
          address: orders.address,
        })
        .from(orders)
        .where(whereConditions.length ? and(...whereConditions) : undefined)
        .orderBy(desc(orders.createdAt))
        .limit(5000);

      const escape = (value: unknown) =>
        `"${String(value ?? "").replace(/"/g, '""')}"`;
      const header = [
        "Номер заказа",
        "Дата",
        "Покупатель",
        "Телефон",
        "Email",
        "Сумма",
        "Статус заказа",
        "Статус оплаты",
        "Доставка",
        "Адрес",
      ];
      const lines = [
        header.join(","),
        ...rows.map(row =>
          [
            row.orderNumber || row.id,
            new Date(row.createdAt).toLocaleString("ru-RU"),
            row.customerName,
            row.customerPhone,
            row.customerEmail,
            row.totalPrice,
            row.status,
            row.paymentStatus,
            row.deliveryType,
            row.address,
          ]
            .map(escape)
            .join(",")
        ),
      ];

      return {
        filename: `orders-export-${new Date().toISOString().slice(0, 10)}.csv`,
        contentType: "text/csv; charset=utf-8",
        csv: "\uFEFF" + lines.join("\n"),
        count: rows.length,
      };
    }),

  exportOrdersXlsx: protectedProcedure
    .input(
      z
        .object({
          search: z.string().trim().optional(),
          statuses: z.array(z.string()).optional(),
          paymentStatuses: z.array(z.string()).optional(),
          deliveryTypes: z.array(z.string()).optional(),
          dateFrom: z.coerce.date().optional(),
          dateTo: z.coerce.date().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Order");
      const db = getDb();
      const whereConditions: any[] = [];
      if (input?.statuses?.length) whereConditions.push(inArray(orders.status, input.statuses));
      if (input?.paymentStatuses?.length)
        whereConditions.push(inArray(orders.paymentStatus, input.paymentStatuses));
      if (input?.deliveryTypes?.length)
        whereConditions.push(inArray(orders.deliveryType, input.deliveryTypes));
      if (input?.dateFrom) whereConditions.push(gte(orders.createdAt, input.dateFrom));
      if (input?.dateTo) whereConditions.push(lte(orders.createdAt, input.dateTo));
      const search = input?.search?.trim();
      if (search) {
        const like = `%${search}%`;
        whereConditions.push(
          or(
            sql`${orders.orderNumber} LIKE ${like}`,
            sql`${orders.customerName} LIKE ${like}`,
            sql`${orders.customerPhone} LIKE ${like}`,
            sql`${orders.customerEmail} LIKE ${like}`
          )
        );
      }

      const rows = await db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          createdAt: orders.createdAt,
          customerName: orders.customerName,
          customerPhone: orders.customerPhone,
          customerEmail: orders.customerEmail,
          totalPrice: orders.totalPrice,
          status: orders.status,
          paymentStatus: orders.paymentStatus,
          deliveryType: orders.deliveryType,
          address: orders.address,
        })
        .from(orders)
        .where(whereConditions.length ? and(...whereConditions) : undefined)
        .orderBy(desc(orders.createdAt))
        .limit(5000);

      const table = rows.map(row => ({
        "Номер заказа": row.orderNumber || row.id,
        Дата: new Date(row.createdAt).toLocaleString("ru-RU"),
        Покупатель: row.customerName || "",
        Телефон: row.customerPhone || "",
        Email: row.customerEmail || "",
        Сумма: row.totalPrice,
        "Статус заказа": row.status,
        "Статус оплаты": row.paymentStatus,
        Доставка: row.deliveryType,
        Адрес: row.address || "",
      }));

      const ws = XLSX.utils.json_to_sheet(table);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Заказы");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      return {
        filename: `orders-export-${new Date().toISOString().slice(0, 10)}.xlsx`,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        base64: Buffer.from(buf).toString("base64"),
        count: rows.length,
      };
    }),
});
