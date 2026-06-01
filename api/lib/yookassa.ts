import { TRPCError } from "@trpc/server";
import { orders, syncLogs, webhookEvents } from "@db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { enqueueMoyskladSyncJob } from "./moysklad-order-sync";
import { getOrderDbCapabilities } from "./order-compat";
import { getYooKassaRuntimeSettings } from "./payment-settings";

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
  }>;
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
        payment_subject: "commodity",
      })),
    },
  };

  try {
    const payment = await requestYooKassa<YooKassaPaymentObject>("/payments", {
      method: "POST",
      body,
      idempotenceKey: `techaks-order-${input.orderId}`,
    });

    if (!payment?.id) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "YooKassa не вернула ID платежа.",
      });
    }

    const paymentMetadataPatch = await buildAvailablePaymentMetadataPatch(payment);

    await getDb()
      .update(orders)
      .set({
        paymentMethod: "yookassa",
        paymentId: payment.id,
        paymentStatus:
          payment.status === "succeeded" ? "paid" : "awaiting_payment",
        paidAt: payment.status === "succeeded" ? new Date() : null,
        paidAmount: payment.status === "succeeded" ? input.totalPrice : 0,
        paymentError: null,
        ...paymentMetadataPatch,
        status: payment.status === "succeeded" ? "processing" : "awaiting_payment",
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
      totalPrice: orders.totalPrice,
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

  const payment = await fetchYooKassaPayment(
    order.paymentId,
    typeof order.paymentTest === "boolean"
      ? order.paymentTest
        ? "test"
        : "live"
      : undefined
  );
  const mapped = mapPaymentStatus(payment, payment.status || "payment.checked");
  const paymentMetadataPatch = await buildAvailablePaymentMetadataPatch(payment);
  await db
    .update(orders)
    .set({
      paymentStatus: mapped.paymentStatus,
      paidAmount:
        mapped.paidAmount === null ? order.totalPrice : mapped.paidAmount,
      paidAt: mapped.paidAt,
      paymentError: mapped.error,
      ...(mapped.orderStatus ? { status: mapped.orderStatus } : {}),
      ...paymentMetadataPatch,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id));

  await enqueueMoyskladPaymentSync(order.id, payment);

  await logYooKassaPayment("success", "YooKassa payment refreshed", {
    orderId: order.id,
    paymentId: order.paymentId,
    paymentStatus: payment.status,
    test: payment.test,
  });

  return {
    paymentId: order.paymentId,
    status: payment.status || null,
    test: typeof payment.test === "boolean" ? payment.test : null,
    cancellationDetails: payment.cancellation_details ?? null,
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
      totalPrice: orders.totalPrice,
      paymentTest: orders.paymentTest,
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

  const mapped = mapPaymentStatus(verifiedPayment, event);
  const paymentMetadataPatch =
    await buildAvailablePaymentMetadataPatch(verifiedPayment);
  await db
    .update(orders)
    .set({
      paymentStatus: mapped.paymentStatus,
      paidAmount:
        mapped.paidAmount === null ? order.totalPrice : mapped.paidAmount,
      paidAt: mapped.paidAt,
      paymentError: mapped.error,
      ...(mapped.orderStatus ? { status: mapped.orderStatus } : {}),
      ...paymentMetadataPatch,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id));

  await enqueueMoyskladPaymentSync(order.id, verifiedPayment);

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
    paymentStatus: mapped.paymentStatus,
    test: verifiedPayment.test,
  });

  return { ok: true, event, paymentId, orderId: order.id };
}
