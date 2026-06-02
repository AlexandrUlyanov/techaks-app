import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { adminAuditLogs } from "@db/schema";
import type { TrpcContext } from "../context";
import { getDb } from "../queries/connection";

type AuditValue =
  | string
  | number
  | boolean
  | null
  | AuditValue[]
  | { [key: string]: AuditValue };

type WriteAdminAuditLogInput = {
  ctx: TrpcContext;
  action: string;
  entityType: string;
  entityId?: number | null;
  entityLabel?: string | null;
  before?: unknown;
  after?: unknown;
  meta?: unknown;
};

const SENSITIVE_KEY_PATTERN =
  /(secret|token|password|pass|privatekey|apikey|encrypted|smtp|webhooksecret)/i;

function maskSensitiveValue(value: unknown): AuditValue {
  if (typeof value === "string") {
    return value ? "[REDACTED]" : "";
  }

  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return "[REDACTED]";
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeAuditPayload(item));
  }

  if (value && typeof value === "object") {
    const next: Record<string, AuditValue> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      next[key] = sanitizeAuditPayload(nestedValue);
    }
    return next;
  }

  return "[REDACTED]";
}

export function sanitizeAuditPayload(value: unknown): AuditValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value as AuditValue;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeAuditPayload(item));
  }

  if (value && typeof value === "object") {
    const next: Record<string, AuditValue> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      if (nestedValue === undefined) continue;
      next[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? maskSensitiveValue(nestedValue)
        : sanitizeAuditPayload(nestedValue);
    }
    return next;
  }

  return String(value);
}

function getRequestIp(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwardedFor ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    null
  );
}

function getRequestUserAgent(req: Request) {
  return req.headers.get("user-agent")?.trim() || null;
}

export async function writeAdminAuditLog(input: WriteAdminAuditLogInput) {
  const db = getDb();
  await db.insert(adminAuditLogs).values({
    actorUserId: input.ctx.user?.id ?? null,
    actorEmail: input.ctx.user?.email ?? null,
    actorRole: input.ctx.user?.role ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    entityLabel: input.entityLabel ?? null,
    beforeJson:
      input.before === undefined ? null : sanitizeAuditPayload(input.before),
    afterJson: input.after === undefined ? null : sanitizeAuditPayload(input.after),
    metaJson: input.meta === undefined ? null : sanitizeAuditPayload(input.meta),
    ip: getRequestIp(input.ctx.req),
    userAgent: getRequestUserAgent(input.ctx.req),
  });
}

export type AuditLogListInput = {
  search?: string;
  entityType?: string;
  action?: string;
  limit?: number;
};

export async function listAdminAuditLogs(input: AuditLogListInput = {}) {
  const db = getDb();
  const normalizedSearch = input.search?.trim() || "";
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 250);
  const conditions = [];

  if (normalizedSearch) {
    const searchLike = `%${normalizedSearch}%`;
    conditions.push(
      or(
        like(adminAuditLogs.actorEmail, searchLike),
        like(adminAuditLogs.entityLabel, searchLike),
        like(adminAuditLogs.action, searchLike),
        like(adminAuditLogs.entityType, searchLike)
      )
    );
  }

  if (input.entityType?.trim()) {
    conditions.push(eq(adminAuditLogs.entityType, input.entityType.trim()));
  }

  if (input.action?.trim()) {
    conditions.push(eq(adminAuditLogs.action, input.action.trim()));
  }

  const whereClause = conditions.length ? and(...conditions) : undefined;

  const [items, summaryRows, entityRows, actionRows, uniqueActorsRows] =
    await Promise.all([
      db
        .select()
        .from(adminAuditLogs)
        .where(whereClause)
        .orderBy(desc(adminAuditLogs.createdAt))
        .limit(limit),
      db
        .select({
          total: sql<number>`count(*)`,
          last24h: sql<number>`sum(case when ${adminAuditLogs.createdAt} >= now() - interval 1 day then 1 else 0 end)`,
          settingsChanges: sql<number>`sum(case when ${adminAuditLogs.entityType} = 'settings' then 1 else 0 end)`,
        })
        .from(adminAuditLogs),
      db
        .select({ value: adminAuditLogs.entityType })
        .from(adminAuditLogs)
        .groupBy(adminAuditLogs.entityType)
        .orderBy(adminAuditLogs.entityType),
      db
        .select({ value: adminAuditLogs.action })
        .from(adminAuditLogs)
        .groupBy(adminAuditLogs.action)
        .orderBy(adminAuditLogs.action),
      db
        .select({ value: sql<number>`count(distinct ${adminAuditLogs.actorUserId})` })
        .from(adminAuditLogs),
    ]);

  return {
    items,
    facets: {
      entityTypes: entityRows.map(row => row.value).filter(Boolean),
      actions: actionRows.map(row => row.value).filter(Boolean),
    },
    summary: {
      total: Number(summaryRows[0]?.total ?? 0),
      last24h: Number(summaryRows[0]?.last24h ?? 0),
      settingsChanges: Number(summaryRows[0]?.settingsChanges ?? 0),
      uniqueActors: Number(uniqueActorsRows[0]?.value ?? 0),
    },
  };
}

