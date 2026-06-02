import nodemailer from "nodemailer";
import dns from "node:dns/promises";
import { env } from "./env";
import { getAppSettings } from "./app-settings";
import { getSiteEmailBranding, type SiteEmailBranding } from "./site-profile-settings";

const BRAND = {
  siteName: "ТЕХАКС",
  tagline: "Техника и аксессуары",
  siteUrl: "https://techaks.ru",
  supportEmail: "info@techaks.ru",
  background: "#464A50",
  accent: "#05C3D4",
  cardBackground: "#FFFFFF",
  textPrimary: "#14171B",
  textSecondary: "#67707A",
  border: "#D9E0E7",
  mutedSurface: "#F5F8FA",
  logoUrl: "https://techaks.ru/images/logo-light.svg",
};

type OrderEventType =
  | "order_created"
  | "order_status_changed"
  | "payment_success"
  | "delivery_handed"
  | "order_cancelled"
  | "order_refund";

type TransactionalEmailType =
  | "AUTH_REGISTERED"
  | "AUTH_EMAIL_CONFIRM"
  | "AUTH_PASSWORD_RESET"
  | "AUTH_PASSWORD_CHANGED"
  | "AUTH_LOGIN_CODE"
  | "ORDER_REVIEW_REQUEST"
  | "ORDER_CREATED"
  | "ORDER_PENDING_PAYMENT"
  | "ORDER_PAID"
  | "ORDER_STATUS_CHANGED"
  | "ORDER_READY_FOR_PICKUP"
  | "ORDER_SHIPPED"
  | "ORDER_COMPLETED"
  | "ORDER_CANCELLED"
  | "ORDER_REFUNDED"
  | "ADMIN_NEW_ORDER"
  | "ADMIN_PAYMENT_FAILED";

type EmailAction = {
  label: string;
  url: string;
};

type EmailSummaryRow = {
  label: string;
  value?: string | number | null;
};

type EmailItem = {
  title: string;
  sku?: string | null;
  quantity: number;
  price: number;
  total: number;
};

export type EmailTemplateData = {
  siteName?: string;
  siteUrl?: string;
  supportEmail?: string;

  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;

  orderNumber?: string | null;
  orderDate?: string | Date | null;
  orderStatus?: string | null;
  previousStatus?: string | null;
  newStatus?: string | null;

  items?: EmailItem[];

  subtotal?: number | null;
  deliveryPrice?: number | null;
  discount?: number | null;
  totalAmount?: number | null;
  paidAmount?: number | null;

  paymentMethod?: string | null;
  paymentStatus?: string | null;
  paymentUrl?: string | null;
  paymentExpiresAt?: string | Date | null;
  paidAt?: string | Date | null;
  paymentError?: string | null;

  deliveryMethod?: string | null;
  deliveryStatus?: string | null;
  deliveryAddress?: string | null;
  deliveryService?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  estimatedDeliveryDate?: string | Date | null;

  pickupAddress?: string | null;
  pickupWorkingHours?: string | null;
  pickupCode?: string | null;
  storageUntil?: string | Date | null;

  resetPasswordUrl?: string | null;
  confirmEmailUrl?: string | null;
  accountUrl?: string | null;
  orderUrl?: string | null;
  adminOrderUrl?: string | null;
  expiresAt?: string | Date | null;

  registrationDate?: string | Date | null;
  changedAt?: string | Date | null;
  managerComment?: string | null;
  customerComment?: string | null;
  cancelReason?: string | null;
  refundInfo?: string | null;
  productName?: string | null;
  isReminder?: boolean | null;

  requestIp?: string | null;
  requestLocation?: string | null;
};

type TemplateConfig = {
  brand: SiteEmailBranding;
  subject: string;
  title: string;
  intro: string;
  action?: EmailAction;
  summaryRows?: EmailSummaryRow[];
  items?: EmailItem[];
  detailBlocks?: Array<{ title?: string; content: string }>;
  note?: string;
  warning?: string;
};

async function getTransporter() {
  const settings = await getAppSettings([
    "smtp_host",
    "smtp_port",
    "smtp_user",
    "smtp_pass",
  ]);

  const host = settings.smtp_host || env.smtpHost;
  const port = parseInt(settings.smtp_port || env.smtpPort.toString() || "587");
  const user = settings.smtp_user || env.smtpUser;
  const pass = settings.smtp_pass || env.smtpPass;

  if (!host) return null;

  let transportHost = host;
  try {
    const resolved = await dns.lookup(host, { family: 4 });
    if (resolved?.address) {
      transportHost = resolved.address;
    }
  } catch {
    transportHost = host;
  }

  return nodemailer.createTransport({
    host: transportHost,
    port,
    secure: port === 465,
    tls: { servername: host },
    auth: user ? { user, pass } : undefined,
  });
}

async function getSenderAddress() {
  const settings = await getAppSettings(["smtp_from"]);
  return settings.smtp_from || env.smtpFrom || "ТЕХАКС <info@techaks.ru>";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nl2br(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

function formatMoney(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

function formatDate(value?: string | Date | null) {
  if (!value) return "—";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function normalizeString(value?: string | number | null) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function isFilled(value?: string | number | null) {
  return normalizeString(value).length > 0;
}

function mapOrderStatus(status?: string | null) {
  const map: Record<string, string> = {
    pending: "Заказ создан",
    awaiting_payment: "Ожидает оплаты",
    paid: "Оплачен",
    processing: "В обработке",
    confirmed: "Подтверждён",
    confirmed_by_customer: "Подтверждён клиентом",
    assembling: "Собирается",
    assembled: "Собран",
    ready_for_pickup: "Готов к выдаче",
    awaiting_dispatch: "Ожидает отправки",
    handed_to_delivery: "Передан в доставку",
    in_delivery: "В пути",
    delivered: "Доставлен",
    completed: "Выполнен",
    cancelled: "Отменён",
    return_requested: "Оформлен возврат",
    refunded: "Возврат выполнен",
    problem: "Требует проверки",
  };
  return map[normalizeString(status)] || normalizeString(status) || "Не указан";
}

function mapPaymentStatus(status?: string | null) {
  const map: Record<string, string> = {
    unpaid: "Не оплачен",
    awaiting_payment: "Ожидает оплаты",
    paid: "Оплачен",
    partially_paid: "Частично оплачен",
    partial_refund: "Частичный возврат",
    refund: "Возврат выполнен",
    payment_error: "Ошибка оплаты",
  };
  return map[normalizeString(status)] || normalizeString(status) || "Не указан";
}

function mapDeliveryMethod(value?: string | null) {
  const map: Record<string, string> = {
    pickup: "Самовывоз",
    delivery: "Доставка",
  };
  return map[normalizeString(value)] || normalizeString(value) || "Не указан";
}

function mapPaymentMethod(value?: string | null) {
  const map: Record<string, string> = {
    cash: "Наличными",
    card: "Банковской картой",
    sbp: "СБП",
    yookassa: "Онлайн-оплата",
  };
  return map[normalizeString(value)] || normalizeString(value) || "Не указан";
}

function mapDeliveryStatus(value?: string | null) {
  const map: Record<string, string> = {
    not_required: "Не требуется",
    awaiting_processing: "Ожидает обработки",
    prepared: "Подготовлен",
    handed_to_delivery: "Передан в доставку",
    in_delivery: "В пути",
    delivered: "Доставлен",
    return_in_transit: "Возвращается",
    delivery_error: "Ошибка доставки",
  };
  return map[normalizeString(value)] || normalizeString(value) || "Не задано";
}

function renderSummaryRows(rows: EmailSummaryRow[] = []) {
  const safeRows = rows.filter(row => isFilled(row.value));
  if (safeRows.length === 0) return "";

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${BRAND.mutedSurface};border:1px solid ${BRAND.border};border-radius:18px;overflow:hidden;">
      ${safeRows
        .map(
          row => `
            <tr>
              <td style="padding:12px 18px;border-bottom:1px solid ${BRAND.border};font-size:13px;line-height:20px;color:${BRAND.textSecondary};width:42%;vertical-align:top;">
                ${escapeHtml(row.label)}
              </td>
              <td style="padding:12px 18px;border-bottom:1px solid ${BRAND.border};font-size:14px;line-height:20px;color:${BRAND.textPrimary};font-weight:700;vertical-align:top;">
                ${escapeHtml(normalizeString(row.value))}
              </td>
            </tr>
          `
        )
        .join("")
        .replace(/border-bottom:1px solid #[^;]+;(?=[\s\S]*$)/, "")}
    </table>
  `;
}

function renderItemsTable(items: EmailItem[] = []) {
  if (!items.length) return "";

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${BRAND.border};border-radius:18px;overflow:hidden;">
      <thead>
        <tr style="background:${BRAND.mutedSurface};">
          <th align="left" style="padding:12px 16px;font-size:12px;line-height:16px;color:${BRAND.textSecondary};text-transform:uppercase;letter-spacing:0.08em;">Товар</th>
          <th align="center" style="padding:12px 12px;font-size:12px;line-height:16px;color:${BRAND.textSecondary};text-transform:uppercase;letter-spacing:0.08em;">Кол-во</th>
          <th align="right" style="padding:12px 16px;font-size:12px;line-height:16px;color:${BRAND.textSecondary};text-transform:uppercase;letter-spacing:0.08em;">Сумма</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            item => `
              <tr>
                <td style="padding:14px 16px;border-top:1px solid ${BRAND.border};font-size:14px;line-height:20px;color:${BRAND.textPrimary};vertical-align:top;">
                  <div style="font-weight:700;">${escapeHtml(item.title)}</div>
                  ${
                    item.sku
                      ? `<div style="margin-top:4px;font-size:12px;line-height:18px;color:${BRAND.textSecondary};">Артикул: ${escapeHtml(item.sku)}</div>`
                      : ""
                  }
                  <div style="margin-top:4px;font-size:12px;line-height:18px;color:${BRAND.textSecondary};">Цена за единицу: ${formatMoney(item.price)}</div>
                </td>
                <td align="center" style="padding:14px 12px;border-top:1px solid ${BRAND.border};font-size:14px;line-height:20px;color:${BRAND.textPrimary};font-weight:700;vertical-align:top;">
                  ${item.quantity}
                </td>
                <td align="right" style="padding:14px 16px;border-top:1px solid ${BRAND.border};font-size:14px;line-height:20px;color:${BRAND.textPrimary};font-weight:700;vertical-align:top;">
                  ${formatMoney(item.total)}
                </td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderDetailBlocks(blocks: Array<{ title?: string; content: string }> = []) {
  const safeBlocks = blocks.filter(block => normalizeString(block.content).length > 0);
  if (!safeBlocks.length) return "";

  return safeBlocks
    .map(
      block => `
        <div style="margin-top:18px;padding:16px 18px;border:1px solid ${BRAND.border};border-radius:18px;background:${BRAND.cardBackground};">
          ${
            block.title
              ? `<div style="margin-bottom:8px;font-size:12px;line-height:16px;color:${BRAND.textSecondary};text-transform:uppercase;letter-spacing:0.08em;font-weight:800;">${escapeHtml(block.title)}</div>`
              : ""
          }
          <div style="font-size:14px;line-height:22px;color:${BRAND.textPrimary};">${nl2br(
            block.content
          )}</div>
        </div>
      `
    )
    .join("");
}

function buildTextVersion(config: TemplateConfig) {
  const parts: string[] = [config.subject, "", config.intro];

  if (config.summaryRows?.length) {
    parts.push("");
    for (const row of config.summaryRows) {
      if (isFilled(row.value)) {
        parts.push(`${row.label}: ${normalizeString(row.value)}`);
      }
    }
  }

  if (config.items?.length) {
    parts.push("", "Состав заказа:");
    for (const item of config.items) {
      parts.push(
        `- ${item.title} — ${item.quantity} шт. × ${formatMoney(item.price)} = ${formatMoney(
          item.total
        )}`
      );
    }
  }

  if (config.detailBlocks?.length) {
    for (const block of config.detailBlocks) {
      parts.push("");
      if (block.title) parts.push(`${block.title}:`);
      parts.push(block.content);
    }
  }

  if (config.action?.url) {
    parts.push("", `${config.action.label}: ${config.action.url}`);
  }

  if (config.warning) parts.push("", config.warning);
  if (config.note) parts.push("", config.note);
  parts.push(
    "",
    `${config.brand.siteName} — ${config.brand.siteUrl}`,
    config.brand.supportEmail
  );

  return parts.join("\n");
}

function renderEmailLayout(config: TemplateConfig) {
  const summary = renderSummaryRows(config.summaryRows);
  const items = renderItemsTable(config.items);
  const detailBlocks = renderDetailBlocks(config.detailBlocks);

  return `
    <!doctype html>
    <html lang="ru">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(config.subject)}</title>
      </head>
      <body style="margin:0;padding:0;background:${BRAND.background};font-family:Arial,Helvetica,sans-serif;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
          ${escapeHtml(config.intro)}
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${BRAND.background};">
          <tr>
            <td align="center" style="padding:32px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;max-width:680px;">
                <tr>
                  <td style="padding:0 0 20px 0;text-align:center;">
                    <img src="${config.brand.logoUrl}" alt="${config.brand.siteName}" width="210" style="display:block;margin:0 auto 10px auto;width:210px;max-width:100%;height:auto;" />
                    <div style="font-size:12px;line-height:18px;color:#DDE7EA;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">${config.brand.tagline}</div>
                  </td>
                </tr>
                <tr>
                  <td style="background:${BRAND.cardBackground};border-radius:28px;padding:32px 32px 28px 32px;border:1px solid rgba(255,255,255,0.12);box-shadow:0 16px 40px rgba(0,0,0,0.12);">
                    <div style="font-size:30px;line-height:36px;color:${BRAND.textPrimary};font-weight:900;margin-bottom:12px;">
                      ${escapeHtml(config.title)}
                    </div>
                    <div style="font-size:15px;line-height:24px;color:${BRAND.textSecondary};margin-bottom:24px;">
                      ${escapeHtml(config.intro)}
                    </div>
                    ${summary}
                    ${items ? `<div style="margin-top:20px;">${items}</div>` : ""}
                    ${detailBlocks}
                    ${
                      config.action
                        ? `
                      <div style="margin-top:28px;text-align:left;">
                        <a href="${escapeHtml(config.action.url)}" style="display:inline-block;padding:14px 24px;border-radius:16px;background:${BRAND.accent};color:#0E161A;text-decoration:none;font-size:14px;line-height:20px;font-weight:900;">
                          ${escapeHtml(config.action.label)}
                        </a>
                      </div>
                    `
                        : ""
                    }
                    ${
                      config.warning
                        ? `
                      <div style="margin-top:22px;padding:14px 16px;border-radius:16px;background:#FFF7E6;color:${BRAND.textPrimary};font-size:13px;line-height:20px;border:1px solid #F2D8A6;">
                        ${nl2br(config.warning)}
                      </div>
                    `
                        : ""
                    }
                    ${
                      config.note
                        ? `
                      <div style="margin-top:18px;font-size:12px;line-height:20px;color:${BRAND.textSecondary};">
                        ${nl2br(config.note)}
                      </div>
                    `
                        : ""
                    }
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 8px 0 8px;text-align:center;">
                    <div style="font-size:12px;line-height:20px;color:#DDE7EA;font-weight:800;">${config.brand.siteName}</div>
                    <div style="font-size:12px;line-height:20px;color:#DDE7EA;">
                      <a href="${config.brand.siteUrl}" style="color:#DDE7EA;text-decoration:none;">${config.brand.siteUrl.replace(/^https?:\/\//, "")}</a>
                      &nbsp;&nbsp;•&nbsp;&nbsp;
                      <a href="mailto:${config.brand.supportEmail}" style="color:#DDE7EA;text-decoration:none;">${config.brand.supportEmail}</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function buildOrderSummaryRows(data: EmailTemplateData): EmailSummaryRow[] {
  return [
    { label: "Номер заказа", value: data.orderNumber },
    { label: "Статус", value: data.orderStatus ? mapOrderStatus(data.orderStatus) : null },
    { label: "Дата", value: data.orderDate ? formatDate(data.orderDate) : null },
    { label: "Сумма", value: typeof data.totalAmount === "number" ? formatMoney(data.totalAmount) : null },
    { label: "Оплата", value: data.paymentMethod ? mapPaymentMethod(data.paymentMethod) : null },
    { label: "Статус оплаты", value: data.paymentStatus ? mapPaymentStatus(data.paymentStatus) : null },
    { label: "Способ доставки", value: data.deliveryMethod ? mapDeliveryMethod(data.deliveryMethod) : null },
    {
      label: "Адрес или пункт выдачи",
      value:
        data.deliveryAddress ||
        data.pickupAddress ||
        (data.deliveryMethod === "pickup" ? "Самовывоз из магазина" : null),
    },
  ];
}

function createTemplateConfig(
  type: TransactionalEmailType,
  data: EmailTemplateData,
  brand: SiteEmailBranding
): TemplateConfig {
  const customerName = data.customerName || "клиент";
  const accountUrl = data.accountUrl || brand.accountUrl;
  const orderUrl = data.orderUrl || brand.accountUrl;

  switch (type) {
    case "AUTH_REGISTERED":
      return {
        brand,
        subject: "Добро пожаловать в ТЕХАКС",
        title: "Добро пожаловать в ТЕХАКС",
        intro: `Здравствуйте, ${customerName}! Вы успешно зарегистрировались в интернет-магазине ТЕХАКС.`,
        action: { label: "Перейти в личный кабинет", url: accountUrl },
        summaryRows: [
          { label: "Имя", value: data.customerName },
          { label: "Электронная почта", value: data.customerEmail },
          { label: "Дата регистрации", value: data.registrationDate ? formatDate(data.registrationDate) : null },
        ],
        note:
          "Теперь вы можете отслеживать заказы, сохранять данные доставки и быстрее оформлять покупки.",
      };
    case "AUTH_EMAIL_CONFIRM":
      return {
        brand,
        subject: "Подтвердите email для аккаунта ТЕХАКС",
        title: "Подтвердите электронную почту",
        intro: `Здравствуйте, ${customerName}! Для завершения регистрации подтвердите ваш email.`,
        action: data.confirmEmailUrl
          ? { label: "Подтвердить email", url: data.confirmEmailUrl }
          : undefined,
        summaryRows: [
          { label: "Электронная почта", value: data.customerEmail },
          { label: "Ссылка действует до", value: data.expiresAt ? formatDate(data.expiresAt) : null },
        ],
        warning:
          "Если вы не создавали аккаунт в ТЕХАКС, просто проигнорируйте это письмо.",
      };
    case "AUTH_PASSWORD_RESET":
      return {
        brand,
        subject: "Восстановление пароля в ТЕХАКС",
        title: "Восстановление пароля",
        intro: `Здравствуйте, ${customerName}! Мы получили запрос на восстановление пароля для вашего аккаунта в ТЕХАКС.`,
        action: data.resetPasswordUrl
          ? { label: "Сбросить пароль", url: data.resetPasswordUrl }
          : undefined,
        summaryRows: [
          { label: "Электронная почта", value: data.customerEmail },
          { label: "Ссылка действует до", value: data.expiresAt ? formatDate(data.expiresAt) : null },
          { label: "IP запроса", value: data.requestIp },
          { label: "Город", value: data.requestLocation },
        ],
        warning:
          "Если вы не запрашивали восстановление пароля, просто проигнорируйте это письмо. Пароль никогда не отправляется по email.",
      };
    case "AUTH_PASSWORD_CHANGED":
      return {
        brand,
        subject: "Пароль в ТЕХАКС изменён",
        title: "Пароль изменён",
        intro: `Здравствуйте, ${customerName}! Пароль от вашего аккаунта в ТЕХАКС был успешно изменён.`,
        summaryRows: [
          { label: "Дата и время", value: data.changedAt ? formatDate(data.changedAt) : null },
          { label: "Электронная почта", value: data.customerEmail },
        ],
        warning:
          "Если это были не вы, срочно свяжитесь с нами: info@techaks.ru",
      };
    case "AUTH_LOGIN_CODE":
      return {
        brand,
        subject: "Код подтверждения входа в ТЕХАКС",
        title: "Код подтверждения входа",
        intro: `Здравствуйте! Используйте этот код, чтобы подтвердить вход в аккаунт ТЕХАКС.`,
        summaryRows: [
          { label: "Код подтверждения", value: data.pickupCode },
          { label: "Ссылка действует до", value: data.expiresAt ? formatDate(data.expiresAt) : null },
        ],
        warning:
          "Если вы не запрашивали код подтверждения, просто проигнорируйте письмо.",
      };
    case "ORDER_CREATED":
      return {
        brand,
        subject: `Заказ ${data.orderNumber} создан`,
        title: "Заказ создан",
        intro: `Здравствуйте, ${customerName}! Ваш заказ ${data.orderNumber || ""} успешно создан.`,
        action: { label: "Открыть заказ", url: orderUrl },
        summaryRows: buildOrderSummaryRows(data),
        items: data.items,
        detailBlocks: data.customerComment
          ? [{ title: "Комментарий к заказу", content: data.customerComment }]
          : undefined,
        note: "Мы свяжемся с вами, если потребуется дополнительное подтверждение заказа.",
      };
    case "ORDER_REVIEW_REQUEST":
      return {
        brand,
        subject: data.isReminder
          ? `Напоминаем про отзыв о товаре ${data.productName || ""}`
          : `Оставьте отзыв о товаре ${data.productName || ""}`,
        title: data.isReminder ? "Напоминаем об отзыве" : "Поделитесь впечатлением о товаре",
        intro: data.isReminder
          ? `Здравствуйте, ${customerName}! Напоминаем: вы всё ещё можете оставить отзыв о товаре ${data.productName || ""}.`
          : `Здравствуйте, ${customerName}! Вы недавно получили товар ${data.productName || ""}. Будем рады вашему отзыву.`,
        action: data.orderUrl
          ? { label: "Оставить отзыв", url: data.orderUrl }
          : undefined,
        summaryRows: [
          { label: "Товар", value: data.productName },
          { label: "Номер заказа", value: data.orderNumber },
        ],
        note:
          "Ваш отзыв поможет другим покупателям выбрать подходящий товар, а нам — лучше улучшать ассортимент и карточки товаров.",
      };
    case "ORDER_PENDING_PAYMENT":
      return {
        brand,
        subject: `Заказ ${data.orderNumber} ожидает оплаты`,
        title: "Заказ ожидает оплаты",
        intro: `Здравствуйте, ${customerName}! Ваш заказ ${data.orderNumber || ""} ожидает оплаты.`,
        action: data.paymentUrl ? { label: "Оплатить заказ", url: data.paymentUrl } : undefined,
        summaryRows: [
          { label: "Номер заказа", value: data.orderNumber },
          { label: "Сумма к оплате", value: typeof data.totalAmount === "number" ? formatMoney(data.totalAmount) : null },
          { label: "Способ оплаты", value: data.paymentMethod ? mapPaymentMethod(data.paymentMethod) : null },
          { label: "Срок оплаты", value: data.paymentExpiresAt ? formatDate(data.paymentExpiresAt) : null },
        ],
      };
    case "ORDER_PAID":
      return {
        brand,
        subject: `Оплата по заказу ${data.orderNumber} получена`,
        title: "Оплата получена",
        intro: `Здравствуйте, ${customerName}! Мы получили оплату по заказу ${data.orderNumber || ""}.`,
        action: { label: "Открыть заказ", url: orderUrl },
        summaryRows: [
          { label: "Номер заказа", value: data.orderNumber },
          { label: "Сумма оплаты", value: typeof data.paidAmount === "number" ? formatMoney(data.paidAmount) : null },
          { label: "Дата оплаты", value: data.paidAt ? formatDate(data.paidAt) : null },
          { label: "Способ оплаты", value: data.paymentMethod ? mapPaymentMethod(data.paymentMethod) : null },
          { label: "Статус заказа", value: data.orderStatus ? mapOrderStatus(data.orderStatus) : null },
        ],
      };
    case "ORDER_STATUS_CHANGED":
      return {
        brand,
        subject: `Статус заказа ${data.orderNumber} изменён`,
        title: "Статус заказа изменён",
        intro: `Здравствуйте, ${customerName}! Статус вашего заказа ${data.orderNumber || ""} обновлён.`,
        action: { label: "Открыть заказ", url: orderUrl },
        summaryRows: [
          { label: "Номер заказа", value: data.orderNumber },
          { label: "Предыдущий статус", value: data.previousStatus ? mapOrderStatus(data.previousStatus) : null },
          { label: "Новый статус", value: data.newStatus ? mapOrderStatus(data.newStatus) : data.orderStatus ? mapOrderStatus(data.orderStatus) : null },
          { label: "Дата обновления", value: data.orderDate ? formatDate(data.orderDate) : null },
        ],
        detailBlocks: data.managerComment
          ? [{ title: "Комментарий менеджера", content: data.managerComment }]
          : undefined,
      };
    case "ORDER_READY_FOR_PICKUP":
      return {
        brand,
        subject: `Заказ ${data.orderNumber} готов к выдаче`,
        title: "Заказ готов к выдаче",
        intro: `Здравствуйте, ${customerName}! Ваш заказ ${data.orderNumber || ""} готов к выдаче.`,
        action: { label: "Открыть заказ", url: orderUrl },
        summaryRows: [
          { label: "Номер заказа", value: data.orderNumber },
          { label: "Пункт выдачи", value: data.pickupAddress },
          { label: "График работы", value: data.pickupWorkingHours },
          { label: "Код получения", value: data.pickupCode },
          { label: "Срок хранения", value: data.storageUntil ? formatDate(data.storageUntil) : null },
        ],
      };
    case "ORDER_SHIPPED":
      return {
        brand,
        subject: `Заказ ${data.orderNumber} передан в доставку`,
        title: "Заказ передан в доставку",
        intro: `Здравствуйте, ${customerName}! Ваш заказ ${data.orderNumber || ""} передан в доставку.`,
        action: data.trackingUrl
          ? { label: "Отследить заказ", url: data.trackingUrl }
          : { label: "Открыть заказ", url: orderUrl },
        summaryRows: [
          { label: "Номер заказа", value: data.orderNumber },
          { label: "Служба доставки", value: data.deliveryService },
          { label: "Трек-номер", value: data.trackingNumber },
          { label: "Статус доставки", value: data.deliveryStatus ? mapDeliveryStatus(data.deliveryStatus) : null },
          { label: "Ориентировочная дата", value: data.estimatedDeliveryDate ? formatDate(data.estimatedDeliveryDate) : null },
          { label: "Адрес доставки", value: data.deliveryAddress },
        ],
      };
    case "ORDER_COMPLETED":
      return {
        brand,
        subject: `Заказ ${data.orderNumber} выполнен`,
        title: "Заказ выполнен",
        intro: `Здравствуйте, ${customerName}! Заказ ${data.orderNumber || ""} успешно выполнен.`,
        action: { label: "Открыть заказ", url: orderUrl },
        summaryRows: [
          { label: "Номер заказа", value: data.orderNumber },
          { label: "Дата выполнения", value: data.orderDate ? formatDate(data.orderDate) : null },
        ],
        items: data.items,
        note: "Спасибо, что выбрали ТЕХАКС. Будем рады видеть вас снова.",
      };
    case "ORDER_CANCELLED":
      return {
        brand,
        subject: `Заказ ${data.orderNumber} отменён`,
        title: "Заказ отменён",
        intro: `Здравствуйте, ${customerName}! Заказ ${data.orderNumber || ""} был отменён.`,
        action: { label: "Открыть заказ", url: orderUrl },
        summaryRows: [
          { label: "Номер заказа", value: data.orderNumber },
          { label: "Дата отмены", value: data.orderDate ? formatDate(data.orderDate) : null },
          { label: "Статус оплаты", value: data.paymentStatus ? mapPaymentStatus(data.paymentStatus) : null },
        ],
        detailBlocks: [
          ...(data.cancelReason ? [{ title: "Причина отмены", content: data.cancelReason }] : []),
          ...(data.refundInfo ? [{ title: "Информация о возврате", content: data.refundInfo }] : []),
        ],
      };
    case "ORDER_REFUNDED":
      return {
        brand,
        subject: `Возврат по заказу ${data.orderNumber}`,
        title: "Возврат по заказу",
        intro: `Здравствуйте, ${customerName}! По заказу ${data.orderNumber || ""} зафиксировано обновление по возврату.`,
        action: { label: "Открыть заказ", url: orderUrl },
        summaryRows: [
          { label: "Номер заказа", value: data.orderNumber },
          { label: "Статус заказа", value: data.orderStatus ? mapOrderStatus(data.orderStatus) : null },
          { label: "Статус оплаты", value: data.paymentStatus ? mapPaymentStatus(data.paymentStatus) : null },
        ],
        detailBlocks: data.refundInfo
          ? [{ title: "Информация о возврате", content: data.refundInfo }]
          : undefined,
      };
    case "ADMIN_NEW_ORDER":
      return {
        brand,
        subject: `Новый заказ ${data.orderNumber} на сайте ТЕХАКС`,
        title: "Новый заказ на сайте",
        intro: `На сайте ТЕХАКС создан новый заказ ${data.orderNumber || ""}.`,
        action: {
          label: "Открыть заказ в админке",
          url: data.adminOrderUrl || brand.adminOrdersUrl,
        },
        summaryRows: [
          { label: "Номер заказа", value: data.orderNumber },
          { label: "Дата", value: data.orderDate ? formatDate(data.orderDate) : null },
          { label: "Клиент", value: data.customerName },
          { label: "Телефон", value: data.customerPhone },
          { label: "Email", value: data.customerEmail },
          { label: "Итого", value: typeof data.totalAmount === "number" ? formatMoney(data.totalAmount) : null },
          { label: "Оплата", value: data.paymentMethod ? mapPaymentMethod(data.paymentMethod) : null },
          { label: "Доставка", value: data.deliveryMethod ? mapDeliveryMethod(data.deliveryMethod) : null },
        ],
        items: data.items,
        detailBlocks: data.customerComment
          ? [{ title: "Комментарий клиента", content: data.customerComment }]
          : undefined,
      };
    case "ADMIN_PAYMENT_FAILED":
      return {
        brand,
        subject: `Проблема с оплатой заказа ${data.orderNumber}`,
        title: "Проблема с оплатой",
        intro: `По заказу ${data.orderNumber || ""} произошла ошибка оплаты.`,
        action: {
          label: "Открыть заказ в админке",
          url: data.adminOrderUrl || brand.adminOrdersUrl,
        },
        summaryRows: [
          { label: "Номер заказа", value: data.orderNumber },
          { label: "Клиент", value: data.customerName },
          { label: "Сумма", value: typeof data.totalAmount === "number" ? formatMoney(data.totalAmount) : null },
          { label: "Способ оплаты", value: data.paymentMethod ? mapPaymentMethod(data.paymentMethod) : null },
        ],
        detailBlocks: data.paymentError
          ? [{ title: "Описание ошибки", content: data.paymentError }]
          : undefined,
      };
    default:
      return {
        brand,
        subject: brand.siteName,
        title: brand.siteName,
        intro: "У вас новое уведомление от интернет-магазина ТЕХАКС.",
      };
  }
}

async function sendTemplateEmail(
  to: string,
  type: TransactionalEmailType,
  data: EmailTemplateData
) {
  const transporter = await getTransporter();
  const from = await getSenderAddress();
  const baseBrand = await getSiteEmailBranding();
  const brand: SiteEmailBranding = {
    ...baseBrand,
    siteName: data.siteName || baseBrand.siteName,
    siteUrl: data.siteUrl || baseBrand.siteUrl,
    supportEmail: data.supportEmail || baseBrand.supportEmail,
  };
  const config = createTemplateConfig(type, data, brand);

  if (!env.isProduction || !transporter) {
    console.log(`[MOCK EMAIL] ${type} for ${to}`);
    return;
  }

  await transporter.sendMail({
    from,
    to,
    subject: config.subject,
    text: buildTextVersion(config),
    html: renderEmailLayout(config),
  });
}

export async function sendEmailOTP(email: string, code: string) {
  await sendTemplateEmail(email, "AUTH_LOGIN_CODE", {
    customerEmail: email,
    pickupCode: code,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
}

export async function sendRegistrationWelcomeEmail(input: {
  email: string;
  customerName?: string | null;
  registrationDate?: string | Date | null;
  accountUrl?: string | null;
}) {
  const brand = await getSiteEmailBranding();
  await sendTemplateEmail(input.email, "AUTH_REGISTERED", {
    customerName: input.customerName,
    customerEmail: input.email,
    registrationDate: input.registrationDate ?? new Date(),
    accountUrl: input.accountUrl || brand.accountUrl,
  });
}

export async function sendEmailConfirmationLinkEmail(input: {
  email: string;
  customerName?: string | null;
  confirmEmailUrl: string;
  expiresAt?: string | Date | null;
}) {
  await sendTemplateEmail(input.email, "AUTH_EMAIL_CONFIRM", {
    customerName: input.customerName,
    customerEmail: input.email,
    confirmEmailUrl: input.confirmEmailUrl,
    expiresAt: input.expiresAt,
  });
}

export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string,
  options?: {
    customerName?: string | null;
    expiresAt?: string | Date | null;
    requestIp?: string | null;
    requestLocation?: string | null;
  }
) {
  await sendTemplateEmail(email, "AUTH_PASSWORD_RESET", {
    customerName: options?.customerName,
    customerEmail: email,
    resetPasswordUrl: resetUrl,
    expiresAt: options?.expiresAt ?? new Date(Date.now() + 30 * 60 * 1000),
    requestIp: options?.requestIp,
    requestLocation: options?.requestLocation,
  });
}

export async function sendPasswordChangedEmail(input: {
  email: string;
  customerName?: string | null;
  changedAt?: string | Date | null;
}) {
  await sendTemplateEmail(input.email, "AUTH_PASSWORD_CHANGED", {
    customerName: input.customerName,
    customerEmail: input.email,
    changedAt: input.changedAt ?? new Date(),
  });
}

export async function sendAdminNewOrderEmail(input: {
  email: string;
  data: EmailTemplateData;
}) {
  await sendTemplateEmail(input.email, "ADMIN_NEW_ORDER", input.data);
}

export async function sendAdminPaymentFailedEmail(input: {
  email: string;
  data: EmailTemplateData;
}) {
  await sendTemplateEmail(input.email, "ADMIN_PAYMENT_FAILED", input.data);
}

export async function sendOrderNotificationEmail(input: {
  email: string;
  orderNumber: string;
  eventType: OrderEventType;
  title?: string;
  message?: string;
  data?: EmailTemplateData;
}) {
  const templateTypeMap: Record<OrderEventType, TransactionalEmailType> = {
    order_created: "ORDER_CREATED",
    order_status_changed: "ORDER_STATUS_CHANGED",
    payment_success: "ORDER_PAID",
    delivery_handed: "ORDER_SHIPPED",
    order_cancelled: "ORDER_CANCELLED",
    order_refund: "ORDER_REFUNDED",
  };
  const brand = await getSiteEmailBranding();

  const data: EmailTemplateData = {
    orderNumber: input.orderNumber,
    orderUrl: brand.accountUrl,
    ...(input.data || {}),
  };

  const type = templateTypeMap[input.eventType];
  const config = createTemplateConfig(type, data, brand);
  if (input.title) {
    config.subject = input.title;
    config.title = input.title;
  }
  if (input.message) {
    config.detailBlocks = [
      ...(config.detailBlocks || []),
      { title: "Комментарий", content: input.message },
    ];
  }

  const transporter = await getTransporter();
  const from = await getSenderAddress();

  if (!env.isProduction || !transporter) {
    console.log(
      `[MOCK EMAIL] order event for ${input.email}: ${input.eventType} / ${input.orderNumber}`
    );
    return;
  }

  await transporter.sendMail({
    from,
    to: input.email,
    subject: config.subject,
    text: buildTextVersion(config),
    html: renderEmailLayout(config),
  });
}

export async function sendReviewRequestEmail(input: {
  email: string;
  customerName?: string | null;
  orderNumber?: string | null;
  productName: string;
  reviewUrl: string;
  isReminder?: boolean;
}) {
  await sendTemplateEmail(input.email, "ORDER_REVIEW_REQUEST", {
    customerName: input.customerName,
    customerEmail: input.email,
    orderNumber: input.orderNumber,
    productName: input.productName,
    orderUrl: input.reviewUrl,
    isReminder: input.isReminder ?? false,
  });
}

