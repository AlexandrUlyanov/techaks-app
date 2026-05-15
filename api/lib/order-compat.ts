import { and, gte, inArray, lte, or, sql } from "drizzle-orm";
import { orderItems, orders } from "../../db/schema";
import type { getDb } from "../queries/connection";

export type DbClient = ReturnType<typeof getDb>;

export type OrderDbCapabilities = {
  detected: boolean;
  hasOrdersOrderNumber: boolean;
  hasOrdersDeliveryStatus: boolean;
  hasOrdersSubtotal: boolean;
  hasOrdersCustomerFields: boolean;
  hasOrdersSource: boolean;
  hasOrdersUpdatedAt: boolean;
  hasOrderItemsSku: boolean;
  hasOrderItemsTotal: boolean;
  hasOrderHistoryTable: boolean;
  hasOrderCommentsTable: boolean;
  hasUsersRoleStatusPasswordHash: boolean;
  hasUsersEmail: boolean;
  hasUsersFullName: boolean;
};

const DEFAULT_CAPABILITIES: OrderDbCapabilities = {
  detected: false,
  hasOrdersOrderNumber: false,
  hasOrdersDeliveryStatus: false,
  hasOrdersSubtotal: false,
  hasOrdersCustomerFields: false,
  hasOrdersSource: false,
  hasOrdersUpdatedAt: false,
  hasOrderItemsSku: false,
  hasOrderItemsTotal: false,
  hasOrderHistoryTable: false,
  hasOrderCommentsTable: false,
  hasUsersRoleStatusPasswordHash: false,
  hasUsersEmail: true,
  hasUsersFullName: true,
};

let capabilitiesCache: OrderDbCapabilities | null = null;

export function resetOrderDbCapabilitiesCache() {
  capabilitiesCache = null;
}

export function rowsFromExecute<T>(result: unknown): T[] {
  if (Array.isArray((result as any)?.[0])) {
    return (result as any)[0] as T[];
  }
  return (result as T[]) ?? [];
}

export type OrderExportRow = {
  id: number;
  orderNumber: string | number;
  createdAt: Date | string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  totalPrice: number;
  subtotal: number;
  discountTotal: number;
  deliveryPrice: number;
  status: string;
  paymentStatus: string;
  deliveryType: string;
  deliveryStatus: string;
  source: string;
  address: string;
};

export type LegacyListOrder = {
  id: number;
  orderNumber: string | null;
  userId?: number | null;
  status: string;
  totalPrice: number;
  subtotal: number;
  discountTotal: number;
  deliveryPrice: number;
  paidAmount: number;
  deliveryType: string;
  deliveryStatus: string;
  deliveryCity?: string | null;
  source: string;
  managerId?: number | null;
  address?: string | null;
  paymentType?: string | null;
  paymentStatus?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  itemsCount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
};

export type LegacyOrderDetails = LegacyListOrder & {
  paymentMethod: string | null;
  paymentId: string | null;
  paymentError: string | null;
  paidAt: Date | string | null;
  deliveryService: string | null;
  deliveryRegion: string | null;
  deliveryPostalCode: string | null;
  deliveryTrackNumber: string | null;
  deliveryComment: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerComment: string | null;
  internalComment: string | null;
};

export type LegacyOrderItem = {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  price: number;
  discount: number;
  total: number;
  sku: string | null;
  productName: string;
  image: string | null;
  stockStatus: string;
};

export function legacyDeliveryStatusFromRow(row: {
  status?: string | null;
  deliveryType?: string | null;
}) {
  if (row.deliveryType !== "delivery") return "not_required";
  switch (row.status) {
    case "delivered":
    case "completed":
      return "delivered";
    case "shipped":
    case "in_delivery":
      return "in_delivery";
    case "cancelled":
      return "delivery_error";
    default:
      return "unknown";
  }
}

export function mapLegacyListOrderRow(row: Record<string, unknown>): LegacyListOrder {
  return {
    ...row,
    id: Number(row.id),
    orderNumber: typeof row.orderNumber === "string" ? row.orderNumber : null,
    userId:
      typeof row.userId === "number"
        ? row.userId
        : row.userId !== undefined && row.userId !== null
          ? Number(row.userId)
          : null,
    status: typeof row.status === "string" ? row.status : "unknown",
    totalPrice: Number(row.totalPrice ?? 0),
    subtotal: Number(row.totalPrice ?? 0),
    discountTotal: 0,
    deliveryPrice: 0,
    paidAmount: 0,
    deliveryType: typeof row.deliveryType === "string" ? row.deliveryType : "pickup",
    deliveryCity: typeof row.deliveryCity === "string" ? row.deliveryCity : null,
    managerId:
      typeof row.managerId === "number"
        ? row.managerId
        : row.managerId !== undefined && row.managerId !== null
          ? Number(row.managerId)
          : null,
    address: typeof row.address === "string" ? row.address : null,
    paymentType: typeof row.paymentType === "string" ? row.paymentType : null,
    paymentStatus: typeof row.paymentStatus === "string" ? row.paymentStatus : null,
    createdAt:
      row.createdAt instanceof Date || typeof row.createdAt === "string"
        ? row.createdAt
        : null,
    updatedAt:
      row.updatedAt instanceof Date || typeof row.updatedAt === "string"
        ? row.updatedAt
        : null,
    itemsCount: Number(row.itemsCount ?? 0),
    source: typeof row.source === "string" ? row.source : "legacy",
    deliveryStatus:
      typeof row.deliveryStatus === "string"
        ? row.deliveryStatus
        : legacyDeliveryStatusFromRow({
            status: typeof row.status === "string" ? row.status : null,
            deliveryType:
              typeof row.deliveryType === "string" ? row.deliveryType : null,
          }),
    customerName:
      typeof row.customerName === "string" && row.customerName.trim().length > 0
        ? row.customerName
        : "Клиент не указан",
    customerEmail:
      typeof row.customerEmail === "string" && row.customerEmail.trim().length > 0
        ? row.customerEmail
        : "",
    customerPhone:
      typeof row.customerPhone === "string" ? row.customerPhone : "",
  };
}

export function mapLegacyOrderDetailsRow(row: Record<string, unknown>): LegacyOrderDetails {
  return {
    ...mapLegacyListOrderRow(row),
    paymentStatus:
      typeof row.paymentStatus === "string" ? row.paymentStatus : "unknown",
    paymentType: typeof row.paymentType === "string" ? row.paymentType : "cash",
    paymentMethod:
      typeof row.paymentMethod === "string" ? row.paymentMethod : null,
    paymentId: typeof row.paymentId === "string" ? row.paymentId : null,
    paymentError:
      typeof row.paymentError === "string" ? row.paymentError : null,
    paidAt:
      row.paidAt instanceof Date || typeof row.paidAt === "string"
        ? row.paidAt
        : null,
    deliveryService:
      typeof row.deliveryService === "string" ? row.deliveryService : null,
    deliveryCity: typeof row.deliveryCity === "string" ? row.deliveryCity : null,
    deliveryRegion:
      typeof row.deliveryRegion === "string" ? row.deliveryRegion : null,
    deliveryPostalCode:
      typeof row.deliveryPostalCode === "string" ? row.deliveryPostalCode : null,
    deliveryTrackNumber:
      typeof row.deliveryTrackNumber === "string" ? row.deliveryTrackNumber : null,
    deliveryComment:
      typeof row.deliveryComment === "string" ? row.deliveryComment : null,
    managerId: typeof row.managerId === "number" ? row.managerId : null,
    customerFirstName:
      typeof row.customerFirstName === "string" ? row.customerFirstName : null,
    customerLastName:
      typeof row.customerLastName === "string" ? row.customerLastName : null,
    customerComment:
      typeof row.customerComment === "string" ? row.customerComment : null,
    internalComment:
      typeof row.internalComment === "string" ? row.internalComment : null,
  };
}

export function mapLegacyOrderItemRow(row: Record<string, unknown>): LegacyOrderItem {
  return {
    ...row,
    id: Number(row.id),
    orderId: Number(row.orderId),
    productId: Number(row.productId),
    quantity: Number(row.quantity ?? 0),
    price: Number(row.price ?? 0),
    discount: Number(row.discount ?? 0),
    total:
      row.total !== undefined
        ? Number(row.total ?? 0)
        : Number(row.price ?? 0) * Number(row.quantity ?? 0),
    sku: typeof row.sku === "string" ? row.sku : null,
    productName:
      typeof row.productName === "string" && row.productName.trim().length > 0
        ? row.productName
        : `Товар #${row.productId}`,
    image: typeof row.image === "string" ? row.image : null,
    stockStatus:
      typeof row.stockStatus === "string" ? row.stockStatus : "unknown",
  };
}

export function normalizeOrderExportRow(row: Record<string, unknown>): OrderExportRow {
  const mapped = mapLegacyListOrderRow(row);
  return {
    id: Number(mapped.id),
    orderNumber: mapped.orderNumber || Number(mapped.id),
    createdAt: (row.createdAt as Date | string | null | undefined) ?? null,
    customerName:
      typeof mapped.customerName === "string" && mapped.customerName.trim().length > 0
        ? mapped.customerName
        : "Клиент не указан",
    customerPhone:
      typeof mapped.customerPhone === "string" ? mapped.customerPhone : "",
    customerEmail:
      typeof mapped.customerEmail === "string" ? mapped.customerEmail : "",
    totalPrice: Number(mapped.totalPrice ?? 0),
    subtotal:
      row.subtotal !== undefined ? Number(row.subtotal ?? 0) : Number(mapped.totalPrice ?? 0),
    discountTotal:
      row.discountTotal !== undefined ? Number(row.discountTotal ?? 0) : 0,
    deliveryPrice:
      row.deliveryPrice !== undefined ? Number(row.deliveryPrice ?? 0) : 0,
    status: typeof row.status === "string" ? row.status : "unknown",
    paymentStatus:
      typeof row.paymentStatus === "string" ? row.paymentStatus : "unknown",
    deliveryType:
      typeof row.deliveryType === "string" ? row.deliveryType : "pickup",
    deliveryStatus:
      typeof mapped.deliveryStatus === "string" ? mapped.deliveryStatus : "unknown",
    source: typeof mapped.source === "string" ? mapped.source : "legacy",
    address: typeof row.address === "string" ? row.address : "",
  };
}

export function buildOrdersExportTable(rows: Record<string, unknown>[]) {
  return rows.map(row => {
    const normalized = normalizeOrderExportRow(row);
    return {
      "Номер заказа": normalized.orderNumber,
      Дата: normalized.createdAt
        ? new Date(normalized.createdAt).toLocaleString("ru-RU")
        : "",
      Покупатель: normalized.customerName,
      Телефон: normalized.customerPhone,
      Email: normalized.customerEmail,
      Сумма: normalized.totalPrice,
      Подытог: normalized.subtotal,
      Скидка: normalized.discountTotal,
      Доставка: normalized.deliveryPrice,
      "Статус заказа": normalized.status,
      "Статус оплаты": normalized.paymentStatus,
      "Статус доставки": normalized.deliveryStatus,
      "Тип доставки": normalized.deliveryType,
      Источник: normalized.source,
      Адрес: normalized.address,
    };
  });
}

export function buildOrdersCsv(rows: Record<string, unknown>[]) {
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const header = [
    "Номер заказа",
    "Дата",
    "Покупатель",
    "Телефон",
    "Email",
    "Сумма",
    "Подытог",
    "Скидка",
    "Доставка",
    "Статус заказа",
    "Статус оплаты",
    "Статус доставки",
    "Тип доставки",
    "Источник",
    "Адрес",
  ];
  const table = buildOrdersExportTable(rows);
  const lines = [
    header.join(","),
    ...table.map(row =>
      [
        row["Номер заказа"],
        row.Дата,
        row.Покупатель,
        row.Телефон,
        row.Email,
        row.Сумма,
        row.Подытог,
        row.Скидка,
        row.Доставка,
        row["Статус заказа"],
        row["Статус оплаты"],
        row["Статус доставки"],
        row["Тип доставки"],
        row.Источник,
        row.Адрес,
      ]
        .map(escape)
        .join(",")
    ),
  ];
  return "\uFEFF" + lines.join("\n");
}

export async function getOrderDbCapabilities(db: DbClient) {
  if (capabilitiesCache) return capabilitiesCache;
  try {
    const columnsResult = await db.execute<{
      table_name: string;
      column_name: string;
    }[]>(sql`
      SELECT
        table_name,
        column_name
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name IN ('orders', 'order_items', 'users')
    `);
    const tablesResult = await db.execute<{ table_name: string }[]>(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name IN ('order_history', 'order_comments')
    `);

    const columns = rowsFromExecute<{ table_name: string; column_name: string }>(
      columnsResult
    );
    const tables = rowsFromExecute<{ table_name: string }>(tablesResult);
    const columnSet = new Set(
      columns.map(
        column => `${String(column.table_name)}.${String(column.column_name)}`
      )
    );
    const tableSet = new Set(tables.map(table => String(table.table_name)));

    capabilitiesCache = {
      detected: true,
      hasOrdersOrderNumber: columnSet.has("orders.order_number"),
      hasOrdersDeliveryStatus: columnSet.has("orders.delivery_status"),
      hasOrdersSubtotal: columnSet.has("orders.subtotal"),
      hasOrdersCustomerFields:
        columnSet.has("orders.customer_name") &&
        columnSet.has("orders.customer_email") &&
        columnSet.has("orders.customer_phone"),
      hasOrdersSource: columnSet.has("orders.source"),
      hasOrdersUpdatedAt: columnSet.has("orders.updated_at"),
      hasOrderItemsSku: columnSet.has("order_items.sku"),
      hasOrderItemsTotal: columnSet.has("order_items.total"),
      hasOrderHistoryTable: tableSet.has("order_history"),
      hasOrderCommentsTable: tableSet.has("order_comments"),
      hasUsersRoleStatusPasswordHash:
        columnSet.has("users.role") &&
        columnSet.has("users.status") &&
        columnSet.has("users.password_hash"),
      hasUsersEmail: columnSet.has("users.email"),
      hasUsersFullName: columnSet.has("users.full_name"),
    };
  } catch (error) {
    console.error("order capabilities detection failed", error);
    capabilitiesCache = { ...DEFAULT_CAPABILITIES };
  }

  return capabilitiesCache;
}

export function canUseRichOrdersSchema(capabilities: OrderDbCapabilities) {
  return (
    capabilities.hasOrdersOrderNumber &&
    capabilities.hasOrdersDeliveryStatus &&
    capabilities.hasOrdersSubtotal &&
    capabilities.hasOrdersCustomerFields &&
    capabilities.hasOrdersSource &&
    capabilities.hasOrderItemsTotal &&
    capabilities.hasOrderItemsSku
  );
}

export function buildModernOrderWhere(input?: {
  search?: string;
  statuses?: string[];
  paymentStatuses?: string[];
  deliveryStatuses?: string[];
  deliveryTypes?: string[];
  paymentTypes?: string[];
  sources?: string[];
  managerId?: number;
  dateFrom?: Date;
  dateTo?: Date;
}) {
  const whereConditions: any[] = [];
  if (input?.statuses?.length) whereConditions.push(inArray(orders.status, input.statuses));
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
  if (input?.sources?.length) whereConditions.push(inArray(orders.source, input.sources));
  if (typeof input?.managerId === "number") whereConditions.push(sql`${orders.managerId} = ${input.managerId}`);
  if (input?.dateFrom) whereConditions.push(gte(orders.createdAt, input.dateFrom));
  if (input?.dateTo) whereConditions.push(lte(orders.createdAt, input.dateTo));
  const search = input?.search?.trim();
  if (search) {
    const like = `%${search}%`;
    const searchAsNumber = Number(search);
    const isNumeric = Number.isFinite(searchAsNumber);
    whereConditions.push(
      or(
        sql`${orders.id} = ${isNumeric ? searchAsNumber : -1}`,
        sql`${orders.orderNumber} LIKE ${like}`,
        sql`${orders.customerName} LIKE ${like}`,
        sql`${orders.customerPhone} LIKE ${like}`,
        sql`${orders.customerEmail} LIKE ${like}`,
        sql`${orders.deliveryTrackNumber} LIKE ${like}`,
        sql`EXISTS (
          SELECT 1 FROM ${orderItems} oi
          WHERE oi.order_id = ${orders.id}
          AND (oi.sku LIKE ${like} OR oi.product_name LIKE ${like})
        )`
      )
    );
  }
  return whereConditions.length > 0 ? and(...whereConditions) : undefined;
}

export function buildLegacyOrderWhereSql(input?: {
  search?: string;
  statuses?: string[];
  paymentStatuses?: string[];
  deliveryTypes?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  supportsUserEmail?: boolean;
  supportsUserFullName?: boolean;
}) {
  const conditions = [sql`1 = 1`];
  if (input?.statuses?.length) {
    conditions.push(
      sql`o.status IN (${sql.join(input.statuses.map(value => sql`${value}`), sql`,`)})`
    );
  }
  if (input?.paymentStatuses?.length) {
    conditions.push(
      sql`o.payment_status IN (${sql.join(
        input.paymentStatuses.map(value => sql`${value}`),
        sql`,`
      )})`
    );
  }
  if (input?.deliveryTypes?.length) {
    conditions.push(
      sql`o.delivery_type IN (${sql.join(
        input.deliveryTypes.map(value => sql`${value}`),
        sql`,`
      )})`
    );
  }
  if (input?.dateFrom) conditions.push(sql`o.created_at >= ${input.dateFrom}`);
  if (input?.dateTo) conditions.push(sql`o.created_at <= ${input.dateTo}`);

  const search = input?.search?.trim();
  if (search) {
    const like = `%${search}%`;
    const searchAsNumber = Number(search);
    const isNumeric = Number.isFinite(searchAsNumber);
    const searchConditions = [
      isNumeric ? sql`o.id = ${searchAsNumber}` : sql`0 = 1`,
    ];
    if (input?.supportsUserEmail !== false) {
      searchConditions.push(sql`u.email LIKE ${like}`);
    }
    if (input?.supportsUserFullName !== false) {
      searchConditions.push(sql`u.full_name LIKE ${like}`);
    }
    conditions.push(
      sql`(${sql.join(searchConditions, sql` OR `)})`
    );
  }

  return sql`WHERE ${sql.join(conditions, sql` AND `)}`;
}
