import { TRPCError } from "@trpc/server";
import { orders, syncLogs, webhookEvents } from "@db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { syncOrderLoyaltyFromMoysklad } from "./moysklad-loyalty";
import { enqueueMoyskladSyncJob } from "./moysklad-order-sync";
import { getOrderDbCapabilities } from "./order-compat";
import { getYooKassaRuntimeSettings } from "./payment-settings";
import {
  sendAdminPaymentFailedEmail,
  sendOrderNotificationEmail,
} from "./mail";
import { getSiteEmailBranding } from "./site-profile-settings";
import { extractReceiptUrl } from "./order-receipts";

type YooKassaConfirmationType = "embedded" | "redirect";

type YooKassaConfirmation = {
  type?: YooKassaConfirmationType;
  confirmation_url?: string;
  confirmation_token?: string;
};

type YooKassaPaymentObject = {
  id?: string;
  status?: string;
  paid?: boolean;
  amount?: {
    value?: string;
    currency?: string;
  };
  cancellation_details?: {
    reason?: string;
    party?: string;
  };
  confirmation?: YooKassaConfirmation;
  metadata?: Record<string, unknown>;
  test?: boolean;
  fiscal_receipt?: YooKassaReceiptObject | null;
  receiptUrl?: string | null;
  receiptPdfUrl?: string | null;
};

type YooKassaReceiptObject = {
  id?: string;
  status?: string;
  type?: string;
  payment_id?: string;
  fiscal_storage_number?: string | number;
  fiscal_document_number?: string | number;
  fiscal_document_attribute?: string | number;
  receipt_registration_number?: string | number;
  receiptUrl?: string | null;
  receiptPdfUrl?: string | null;
  [key: string]: unknown;
};

type YooKassaReceiptListResponse = {
  type?: string;
  items?: YooKassaReceiptObject[];
};

type YooKassaWebhookPayload = {
  type?: string;
  event?: string;
  object?: YooKassaPaymentObject & {
    payment_id?: string;
  };
};

type CreateYooKassaPaymentInput = {
  orderId: number;
  orderNumber: string | null;
  totalPrice: number;
  customerPhone: string;
  customerEmail?: string | null;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    paymentSubject?: "commodity" | "service";
  }>;
  paymentAttemptKey?: string;
  preserveOrderStatus?: boolean;
  paidAmountBefore?: number;
  aggregateTotalPrice?: number;
};

function buildCredentials(shopId: string, secretKey: string) {
  return Buffer.from(`${shopId}:${secretKey}`, "utf8").toString("base64");
}

function formatRubAmount(value: number) {
  return (Math.max(0, value) || 0).toFixed(2);
}

function normalizeReceiptPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) {
    return `7${digits.slice(1)}`;
  }
  return digits;
}

function normalizeReceiptDescription(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.slice(0, 128) || "Товар";
}

function buildPaymentMetadataPatch(payment: YooKassaPaymentObject) {
  return {
    paymentProviderStatus: payment.status ?? null,
    paymentTest: typeof payment.test === "boolean" ? payment.test : null,
    paymentCancellationParty: payment.cancellation_details?.party ?? null,
    paymentCancellationReason: payment.cancellation_details?.reason ?? null,
    paymentRawResponseJson: payment as any,
  };
}

async function buildAvailablePaymentMetadataPatch(payment: YooKassaPaymentObject) {
  const capabilities = await getOrderDbCapabilities(getDb());
  return capabilities.hasOrdersPaymentProviderMetadata
    ? buildPaymentMetadataPatch(payment)
    : {};
}

type PaymentNotificationOrderSnapshot = {
  id: number;
  orderNumber: string | null;
  customerName: string | null;
  customerEmail: string | null;
  totalPrice: number;
  status: string | null;
  paymentStatus: string | null;
  paymentMethod: string | null;
};

async function notifyAboutPaymentTransition(
  order: PaymentNotificationOrderSnapshot,
  next: {
    paymentStatus: string;
    paymentError: string | null;
    paidAt: Date | null;
  },
  payment: YooKassaPaymentObject,
  options?: {
    paymentUrl?: string | null;
  }
) {
  if (order.paymentStatus === next.paymentStatus) return;

  if (order.customerEmail && next.paymentStatus === "paid" && order.orderNumber) {
    const receiptUrl = extractReceiptUrl(payment);
    await sendOrderNotificationEmail({
      email: order.customerEmail,
      orderNumber: order.orderNumber,
      eventType: "payment_success",
      data: {
        customerName: order.customerName,
        orderStatus: "processing",
        paymentMethod: order.paymentMethod || "yookassa",
        paymentStatus: next.paymentStatus,
        paidAmount: order.totalPrice,
        paidAt: next.paidAt,
        totalAmount: order.totalPrice,
        receiptUrl,
      },
      message: "Оплата подтверждена. Заказ уже передан в обработку.",
    }).catch(error => {
      console.error("yookassa payment success email failed", error);
    });
  }

  if (
    order.customerEmail &&
    next.paymentStatus === "payment_error" &&
    order.orderNumber
  ) {
    await sendOrderNotificationEmail({
      email: order.customerEmail,
      orderNumber: order.orderNumber,
      eventType: "payment_failed",
      data: {
        customerName: order.customerName,
        orderStatus: order.status,
        paymentMethod: order.paymentMethod || "yookassa",
        paymentStatus: next.paymentStatus,
        totalAmount: order.totalPrice,
        paymentError: next.paymentError,
        paymentUrl: options?.paymentUrl ?? null,
      },
      message:
        "Платёж не был подтверждён. Заказ сохранён, можно попробовать оплатить его повторно.",
    }).catch(error => {
      console.error("yookassa payment failed email failed", error);
    });
  }

  if (next.paymentStatus === "payment_error" && order.orderNumber) {
    const brand = await getSiteEmailBranding();
    await sendAdminPaymentFailedEmail({
      email: brand.supportEmail,
      data: {
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        totalAmount: order.totalPrice,
        paymentMethod: order.paymentMethod || "yookassa",
        paymentError: next.paymentError,
      },
    }).catch(error => {
      console.error("yookassa admin payment failed email failed", error);
    });
  }
}

function toReturnUrl(baseUrl: string, orderId: number, orderNumber: string | null) {
  const url = new URL(baseUrl);
  url.searchParams.set("orderId", String(orderId));
  if (orderNumber) {
    url.searchParams.set("order", orderNumber);
  }
  return url.toString();
}

async function logYooKassaPayment(
  status: "success" | "error" | "info",
  message: string,
  details?: Record<string, unknown>
) {
  await getDb().insert(syncLogs).values({
    type: "yookassa",
    status,
    message,
    details: details ?? null,
  });
}

async function enqueueMoyskladPaymentSync(orderId: number, payment: YooKassaPaymentObject) {
  if (!(payment.status === "succeeded" || payment.paid)) return;
  try {
    await enqueueMoyskladSyncJob({
      entityType: "payment",
      entityId: orderId,
      action: "payment",
      payloadSnapshot: {
        provider: "yookassa",
        paymentId: payment.id ?? null,
        status: payment.status ?? null,
        test: typeof payment.test === "boolean" ? payment.test : null,
      },
    });
  } catch (error) {
    await logYooKassaPayment("error", "MoySklad payment sync enqueue failed", {
      orderId,
      paymentId: payment.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function requestYooKassa<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: unknown;
    idempotenceKey?: string;
    mode?: "test" | "live";
  } = {}
) {
  const runtime = await getYooKassaRuntimeSettings(options.mode);
  if (!runtime.isConfigured) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "YooKassa не настроена или выключена.",
    });
  }

  const response = await fetch(`https://api.yookassa.ru/v3${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Basic ${buildCredentials(runtime.shopId, runtime.secretKey)}`,
      "Content-Type": "application/json",
      ...(options.idempotenceKey
        ? { "Idempotence-Key": options.idempotenceKey }
        : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = (await response.json().catch(() => null)) as T | null;

  if (!response.ok) {
    const description =
      data && typeof data === "object" && "description" in data
        ? String((data as { description?: unknown }).description)
        : `HTTP ${response.status}`;
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `YooKassa вернула ошибку: ${description}`,
    });
  }

  return data as T;
}

function pickBestYooKassaReceipt(
  items: YooKassaReceiptObject[] | null | undefined
): YooKassaReceiptObject | null {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    items.find(item => {
      const status = String(item?.status || "").toLowerCase();
      return (
        status === "succeeded" ||
        status === "succeeded_waiting_for_capture" ||
        status === "ready"
      );
    }) ||
    items.find(item => {
      return Boolean(
        item?.fiscal_storage_number ||
          item?.fiscal_document_number ||
          item?.fiscal_document_attribute
      );
    }) ||
    items[0] ||
    null
  );
}

export async function fetchYooKassaReceiptForPayment(
  paymentId: string,
  mode?: "test" | "live"
) {
  const response = await requestYooKassa<YooKassaReceiptListResponse>(
    `/receipts?payment_id=${encodeURIComponent(paymentId)}`,
    { mode }
  );

  return pickBestYooKassaReceipt(response?.items);
}

async function enrichYooKassaPaymentWithReceipt(
  payment: YooKassaPaymentObject,
  mode?: "test" | "live"
) {
  if (!payment?.id) return payment;

  try {
    const receipt = await fetchYooKassaReceiptForPayment(payment.id, mode);
    if (!receipt) return payment;

    const enrichedPayment: YooKassaPaymentObject = {
      ...payment,
      fiscal_receipt: receipt,
    };
    const receiptUrl = extractReceiptUrl(enrichedPayment);
    if (receiptUrl) {
      enrichedPayment.receiptUrl = receiptUrl;
    }
    return enrichedPayment;
  } catch (error) {
    await logYooKassaPayment(
      "info",
      "YooKassa receipt fetch skipped",
      {
        paymentId: payment.id,
        mode: mode ?? null,
        error: error instanceof Error ? error.message : String(error),
      }
    ).catch(() => undefined);
    return payment;
  }
}

export async function createYooKassaPaymentForOrder(
  input: CreateYooKassaPaymentInput
) {
  const runtime = await getYooKassaRuntimeSettings();
  if (!runtime.isConfigured) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "YooKassa не настроена или выключена.",
    });
  }

  const body = {
    amount: {
      value: formatRubAmount(input.totalPrice),
      currency: "RUB",
    },
    capture: runtime.capture,
    confirmation:
      runtime.confirmationType === "embedded"
        ? { type: "embedded" }
        : {
            type: "redirect",
            return_url: toReturnUrl(
              runtime.returnUrl,
              input.orderId,
              input.orderNumber
            ),
          },
    description: `Заказ ${input.orderNumber || `#${input.orderId}`} в ТЕХАКС`,
    metadata: {
      orderId: String(input.orderId),
      orderNumber: input.orderNumber || "",
      source: "techaks",
      testMode: runtime.testMode ? "true" : "false",
      mode: runtime.mode,
      paymentPurpose: input.preserveOrderStatus ? "additional_payment" : "order_payment",
    },
    receipt: {
      customer: {
        phone: normalizeReceiptPhone(input.customerPhone),
        ...(input.customerEmail ? { email: input.customerEmail } : {}),
      },
      items: input.items.map(item => ({
        description: normalizeReceiptDescription(item.name),
        quantity: String(item.quantity),
        amount: {
          value: formatRubAmount(item.price),
          currency: "RUB",
        },
        vat_code: 1,
        payment_mode: "full_payment",
        payment_subject: item.paymentSubject ?? "commodity",
      })),
    },
  };

  try {
    const payment = await requestYooKassa<YooKassaPaymentObject>("/payments", {
      method: "POST",
      body,
      idempotenceKey: input.paymentAttemptKey
        ? `techaks-order-${input.orderId}-${input.paymentAttemptKey}`
        : `techaks-order-${input.orderId}`,
    });

    if (!payment?.id) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "YooKassa не вернула ID платежа.",
      });
    }

    const paymentMetadataPatch = await buildAvailablePaymentMetadataPatch(payment);
    const paidAmountBefore = Math.max(0, input.paidAmountBefore ?? 0);
    const aggregateTotalPrice = Math.max(
      input.totalPrice,
      input.aggregateTotalPrice ?? input.totalPrice
    );
    const nextPaidAmount =
      payment.status === "succeeded"
        ? Math.min(aggregateTotalPrice, paidAmountBefore + input.totalPrice)
        : paidAmountBefore;
    const nextPaymentStatus =
      payment.status === "succeeded"
        ? nextPaidAmount >= aggregateTotalPrice
          ? "paid"
          : "partially_paid"
        : paidAmountBefore > 0
          ? "partially_paid"
          : "awaiting_payment";

    await getDb()
      .update(orders)
      .set({
        paymentMethod: "yookassa",
        paymentId: payment.id,
        paymentStatus: nextPaymentStatus,
        paidAt: payment.status === "succeeded" ? new Date() : null,
        paidAmount: nextPaidAmount,
        paymentError: null,
        ...paymentMetadataPatch,
        ...(input.preserveOrderStatus
          ? {}
          : {
              status:
                payment.status === "succeeded" ? "processing" : "awaiting_payment",
            }),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, input.orderId));

    await enqueueMoyskladPaymentSync(input.orderId, payment);

    await logYooKassaPayment("success", "YooKassa payment created", {
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      paymentId: payment.id,
      paymentStatus: payment.status,
      test: payment.test,
      confirmationType: runtime.confirmationType,
      mode: runtime.mode,
    });

    return {
      id: payment.id,
      status: payment.status || "pending",
      confirmationUrl: payment.confirmation?.confirmation_url || null,
      confirmationToken: payment.confirmation?.confirmation_token || null,
      confirmationType: runtime.confirmationType,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось создать платёж YooKassa";

    await getDb()
      .update(orders)
      .set({
        paymentMethod: "yookassa",
        paymentStatus: "payment_error",
        paymentError: message,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, input.orderId));

    await logYooKassaPayment("error", "YooKassa payment create failed", {
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      error: message,
    });

    throw error;
  }
}

export async function fetchYooKassaPayment(
  paymentId: string,
  mode?: "test" | "live"
) {
  return requestYooKassa<YooKassaPaymentObject>(
    `/payments/${encodeURIComponent(paymentId)}`,
    { mode }
  );
}

export async function refreshYooKassaPaymentForOrder(orderId: number) {
  const db = getDb();
  const orderRows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      customerEmail: orders.customerEmail,
      totalPrice: orders.totalPrice,
      paidAmount: orders.paidAmount,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      paymentMethod: orders.paymentMethod,
      paymentId: orders.paymentId,
      paymentTest: orders.paymentTest,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  const order = orderRows[0];
  if (!order?.paymentId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "У заказа нет payment_id YooKassa.",
    });
  }

  const paymentMode =
    typeof order.paymentTest === "boolean"
      ? order.paymentTest
        ? "test"
        : "live"
      : undefined;

  const payment = await fetchYooKassaPayment(
    order.paymentId,
    paymentMode
  );
  const paymentWithReceipt =
    payment.status === "succeeded" || payment.paid
      ? await enrichYooKassaPaymentWithReceipt(payment, paymentMode)
      : payment;
  const mapped = mapPaymentStatus(
    paymentWithReceipt,
    paymentWithReceipt.status || "payment.checked"
  );
  const paymentMetadataPatch = await buildAvailablePaymentMetadataPatch(
    paymentWithReceipt
  );
  const nextPaidAt = mapped.paidAt;
  const nextPaymentError = mapped.error;
  const currentPaidAmount = Math.max(0, order.paidAmount || 0);
  const nextPaidAmount =
    mapped.paidAmount === null
      ? order.totalPrice
      : mapped.paymentStatus === "refund"
        ? mapped.paidAmount
        : currentPaidAmount;
  const nextPaymentStatus =
    mapped.paymentStatus === "paid" || mapped.paymentStatus === "refund"
      ? mapped.paymentStatus
      : currentPaidAmount > 0
        ? "partially_paid"
        : mapped.paymentStatus;
  const preserveOrderStatus =
    paymentWithReceipt.metadata?.paymentPurpose === "additional_payment";
  await db
    .update(orders)
    .set({
      paymentStatus: nextPaymentStatus,
      paidAmount: nextPaidAmount,
      paidAt: nextPaidAt,
      paymentError: nextPaymentError,
      ...(mapped.orderStatus && !preserveOrderStatus
        ? { status: mapped.orderStatus }
        : {}),
      ...paymentMetadataPatch,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id));

  await notifyAboutPaymentTransition(
    order,
    {
      paymentStatus: nextPaymentStatus,
      paymentError: nextPaymentError,
      paidAt: nextPaidAt,
    },
    paymentWithReceipt
  );

  await enqueueMoyskladPaymentSync(order.id, paymentWithReceipt);
  await syncOrderLoyaltyFromMoysklad(order.id).catch(error => {
    console.error("loyalty sync after YooKassa refresh failed", error);
  });

  await logYooKassaPayment("success", "YooKassa payment refreshed", {
    orderId: order.id,
    paymentId: order.paymentId,
    paymentStatus: paymentWithReceipt.status,
    test: paymentWithReceipt.test,
  });

  return {
    paymentId: order.paymentId,
    status: paymentWithReceipt.status || null,
    test:
      typeof paymentWithReceipt.test === "boolean"
        ? paymentWithReceipt.test
        : null,
    cancellationDetails: paymentWithReceipt.cancellation_details ?? null,
  };
}

function mapPaymentStatus(payment: YooKassaPaymentObject, event: string) {
  if (event === "refund.succeeded") {
    return {
      paymentStatus: "refund",
      paidAmount: 0,
      paidAt: null,
      orderStatus: null,
      error: null,
    };
  }

  if (payment.status === "succeeded" || payment.paid || event === "payment.succeeded") {
    return {
      paymentStatus: "paid",
      paidAmount: null,
      paidAt: new Date(),
      orderStatus: "processing",
      error: null,
    };
  }

  if (payment.status === "canceled" || event === "payment.canceled") {
    const details = payment.cancellation_details;
    const reason = [details?.party, details?.reason].filter(Boolean).join(": ");
    return {
      paymentStatus: "payment_error",
      paidAmount: 0,
      paidAt: null,
      orderStatus: null,
      error: reason || "Платёж отменён в YooKassa.",
    };
  }

  return {
    paymentStatus: "awaiting_payment",
    paidAmount: 0,
    paidAt: null,
    orderStatus: null,
    error: null,
  };
}

export async function handleYooKassaWebhook(payload: YooKassaWebhookPayload) {
  const db = getDb();
  const event = payload.event || payload.type || "unknown";
  const object = payload.object ?? {};
  const paymentId = object.id || object.payment_id || "";

  if (!paymentId) {
    throw new Error("YooKassa webhook payload does not contain payment id");
  }

  const eventKey = `${event}:${paymentId}`;
  await db
    .insert(webhookEvents)
    .values({
      provider: "yookassa",
      eventType: event,
      eventKey,
      payloadJson: payload,
      status: "new",
      attempts: 0,
    })
    .onDuplicateKeyUpdate({
      set: {
        eventType: event,
      },
    });

  const metadata = object.metadata ?? {};
  const orderIdFromMetadata = Number(metadata.orderId || 0);
  const orderRows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      customerEmail: orders.customerEmail,
      totalPrice: orders.totalPrice,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      paymentMethod: orders.paymentMethod,
      paymentTest: orders.paymentTest,
      paidAmount: orders.paidAmount,
    })
    .from(orders)
    .where(
      orderIdFromMetadata > 0
        ? and(eq(orders.id, orderIdFromMetadata), eq(orders.paymentId, paymentId))
        : eq(orders.paymentId, paymentId)
    )
    .limit(1);

  const order = orderRows[0];
  if (!order) {
    await db
      .update(webhookEvents)
      .set({
        status: "failed",
        attempts: sql`${webhookEvents.attempts} + 1`,
        lastError: "Order not found for YooKassa payment",
        processedAt: new Date(),
      })
      .where(and(eq(webhookEvents.provider, "yookassa"), eq(webhookEvents.eventKey, eventKey)));
    return { ok: false, event, paymentId, orderId: null };
  }

  let verifiedPayment: YooKassaPaymentObject = object;
  if (event.startsWith("payment.")) {
    const paymentMode =
      typeof order.paymentTest === "boolean"
        ? order.paymentTest
          ? "test"
          : "live"
        : typeof object.test === "boolean"
          ? object.test
            ? "test"
            : "live"
          : undefined;

    try {
      verifiedPayment = await fetchYooKassaPayment(paymentId, paymentMode);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "YooKassa payment fetch failed";
      await logYooKassaPayment(
        "error",
        "YooKassa payment fetch failed, using webhook payload",
        {
          event,
          paymentId,
          orderId: order.id,
          paymentMode,
          error: message,
        }
      );
      verifiedPayment = object;
    }
  }

  if (verifiedPayment.status === "succeeded" || verifiedPayment.paid) {
    const paymentMode =
      typeof order.paymentTest === "boolean"
        ? order.paymentTest
          ? "test"
          : "live"
        : typeof verifiedPayment.test === "boolean"
          ? verifiedPayment.test
            ? "test"
            : "live"
          : undefined;
    verifiedPayment = await enrichYooKassaPaymentWithReceipt(
      verifiedPayment,
      paymentMode
    );
  }

  const mapped = mapPaymentStatus(verifiedPayment, event);
  const paymentMetadataPatch =
    await buildAvailablePaymentMetadataPatch(verifiedPayment);
  const nextPaidAt = mapped.paidAt;
  const nextPaymentError = mapped.error;
  const currentPaidAmount = Math.max(0, order.paidAmount || 0);
  const nextPaidAmount =
    mapped.paidAmount === null
      ? order.totalPrice
      : mapped.paymentStatus === "refund"
        ? mapped.paidAmount
        : currentPaidAmount;
  const nextPaymentStatus =
    mapped.paymentStatus === "paid" || mapped.paymentStatus === "refund"
      ? mapped.paymentStatus
      : currentPaidAmount > 0
        ? "partially_paid"
        : mapped.paymentStatus;
  const preserveOrderStatus =
    verifiedPayment.metadata?.paymentPurpose === "additional_payment";
  await db
    .update(orders)
    .set({
      paymentStatus: nextPaymentStatus,
      paidAmount: nextPaidAmount,
      paidAt: nextPaidAt,
      paymentError: nextPaymentError,
      ...(mapped.orderStatus && !preserveOrderStatus
        ? { status: mapped.orderStatus }
        : {}),
      ...paymentMetadataPatch,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id));

  await notifyAboutPaymentTransition(
    order,
    {
      paymentStatus: nextPaymentStatus,
      paymentError: nextPaymentError,
      paidAt: nextPaidAt,
    },
    verifiedPayment
  );

  await enqueueMoyskladPaymentSync(order.id, verifiedPayment);
  await syncOrderLoyaltyFromMoysklad(order.id).catch(error => {
    console.error("loyalty sync after YooKassa webhook failed", error);
  });

  await db
    .update(webhookEvents)
    .set({
      status: "processed",
      processedAt: new Date(),
      lastError: null,
    })
    .where(and(eq(webhookEvents.provider, "yookassa"), eq(webhookEvents.eventKey, eventKey)));

  await logYooKassaPayment("success", "YooKassa webhook processed", {
    event,
    paymentId,
    orderId: order.id,
    paymentStatus: nextPaymentStatus,
    test: verifiedPayment.test,
  });

  return { ok: true, event, paymentId, orderId: order.id };
}
