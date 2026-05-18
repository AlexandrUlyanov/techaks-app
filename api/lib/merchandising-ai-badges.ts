import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import * as schema from "@db/schema";
import { getDb } from "../queries/connection";
import { getAppSetting } from "./app-settings";
import { env } from "./env";

const BADGE_AI_PROMPT_VERSION = "v1";
const STORE_FRONT_BADGE_LIMIT = 2;

const suggestionSchema = z.object({
  suggestions: z.array(
    z.object({
      code: z.string().min(2).max(120),
      label: z.string().min(2).max(120),
      description: z.string().max(500).optional().default(""),
      whyThisBadgeExists: z.string().max(500).optional().default(""),
      estimatedCoverage: z.number().min(0).max(100).optional().default(0),
      confidence: z.number().min(0).max(100).optional().default(0),
      keywords: z.array(z.string().min(1).max(80)).optional().default([]),
      specMatches: z.array(
        z.object({
          key: z.string().min(1).max(120),
          values: z.array(z.string().min(1).max(120)).min(1).max(20),
        })
      ).optional().default([]),
      priceMin: z.number().optional(),
      priceMax: z.number().optional(),
      sampleProductNames: z.array(z.string().min(1).max(180)).optional().default([]),
    })
  ),
});

type BadgeCatalogRow = typeof schema.badgeCatalog.$inferSelect;
type BadgeAssignmentRuleRow = typeof schema.badgeAssignmentRules.$inferSelect;

function slugifyBadgeCode(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function toNumber(value: unknown) {
  return Number(value || 0);
}

async function getGeminiConfig() {
  const key = (await getAppSetting("gemini_api_key"))?.trim() || env.geminiApiKey || "";
  const model = (await getAppSetting("gemini_model"))?.trim() || env.geminiModel;
  const proxyBaseUrl = (await getAppSetting("ai_proxy_base_url"))?.trim() || env.aiProxyBaseUrl || "";
  const proxyToken = (await getAppSetting("ai_proxy_token"))?.trim() || env.aiProxyToken || "";
  return { key, model, proxyBaseUrl, proxyToken };
}

function assertGeminiAccess(config: Awaited<ReturnType<typeof getGeminiConfig>>) {
  if (!config.key && !config.proxyBaseUrl) {
    throw new Error("Нужно указать Gemini API key или AI Proxy URL в настройках.");
  }
}

async function executeGemini(body: Record<string, unknown>) {
  const config = await getGeminiConfig();
  assertGeminiAccess(config);

  if (config.proxyBaseUrl) {
    const proxyUrl = `${config.proxyBaseUrl.replace(/\/+$/, "")}/v1/gemini/generate-content`;
    const response = await fetch(proxyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.proxyToken
          ? {
              Authorization: `Bearer ${config.proxyToken}`,
            }
          : {}),
      },
      body: JSON.stringify({
        model: config.model,
        apiKey: config.key,
        body,
      }),
    });
    return { response, model: config.model };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": config.key,
      },
      body: JSON.stringify(body),
    }
  );
  return { response, model: config.model };
}

function collectDescendantCategoryIds(
  allCategories: Array<typeof schema.categories.$inferSelect>,
  categoryId: number
) {
  const ids = [categoryId];
  const stack = [categoryId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const children = allCategories
      .filter(category => category.parentId === current)
      .map(category => category.id);
    for (const childId of children) {
      ids.push(childId);
      stack.push(childId);
    }
  }
  return ids;
}

async function getScopedBadgeIds(categoryId?: number) {
  const db = getDb();
  const scopes = await db.select().from(schema.badgeCategoryScopes);
  if (!categoryId) {
    return Array.from(
      new Set(
        scopes
          .filter(scope => scope.isEnabled && scope.scopeType === "global")
          .map(scope => scope.badgeId)
      )
    );
  }

  const categories = await db.select().from(schema.categories);
  const descendantIds = new Set(collectDescendantCategoryIds(categories, categoryId));
  const matched = scopes.filter(scope => {
    if (!scope.isEnabled) return false;
    if (scope.scopeType === "global") return true;
    if (scope.scopeType === "category" && scope.scopeId) return descendantIds.has(scope.scopeId);
    if (scope.scopeType === "category_tree" && scope.scopeId) return descendantIds.has(scope.scopeId);
    return false;
  });
  return Array.from(new Set(matched.map(scope => scope.badgeId)));
}

export async function listBadgeCatalog(input?: {
  status?: string;
  source?: string;
  badgeType?: string;
  categoryId?: number;
  search?: string;
}) {
  const db = getDb();
  const conditions = [];
  if (input?.status) conditions.push(eq(schema.badgeCatalog.status, input.status));
  if (input?.source) conditions.push(eq(schema.badgeCatalog.source, input.source));
  if (input?.badgeType) conditions.push(eq(schema.badgeCatalog.badgeType, input.badgeType));
  if (input?.search?.trim()) {
    const search = `%${input.search.trim()}%`;
    conditions.push(
      or(
        sql`${schema.badgeCatalog.label} like ${search}`,
        sql`${schema.badgeCatalog.code} like ${search}`
      )
    );
  }

  let scopedBadgeIds: number[] | null = null;
  if (input?.categoryId) {
    scopedBadgeIds = await getScopedBadgeIds(input.categoryId);
    if (scopedBadgeIds.length === 0) {
      return [];
    }
    conditions.push(inArray(schema.badgeCatalog.id, scopedBadgeIds));
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: schema.badgeCatalog.id,
      code: schema.badgeCatalog.code,
      label: schema.badgeCatalog.label,
      description: schema.badgeCatalog.description,
      badgeType: schema.badgeCatalog.badgeType,
      audience: schema.badgeCatalog.audience,
      status: schema.badgeCatalog.status,
      source: schema.badgeCatalog.source,
      icon: schema.badgeCatalog.icon,
      colorToken: schema.badgeCatalog.colorToken,
      sortOrder: schema.badgeCatalog.sortOrder,
      maxProductsPerItem: schema.badgeCatalog.maxProductsPerItem,
      isVisibleOnSite: schema.badgeCatalog.isVisibleOnSite,
      notes: schema.badgeCatalog.notes,
      createdAt: schema.badgeCatalog.createdAt,
      updatedAt: schema.badgeCatalog.updatedAt,
      scopeCount: sql<number>`(
        select count(*) from badge_category_scope scope where scope.badge_id = ${schema.badgeCatalog.id} and scope.is_enabled = true
      )`,
      assignmentCount: sql<number>`(
        select count(*) from product_badge_assignments assign where assign.badge_id = ${schema.badgeCatalog.id} and assign.status in ('approved','applied')
      )`,
    })
    .from(schema.badgeCatalog)
    .where(where)
    .orderBy(desc(schema.badgeCatalog.updatedAt), schema.badgeCatalog.sortOrder, schema.badgeCatalog.label);

  return rows.map(row => ({
    ...row,
    scopeCount: toNumber(row.scopeCount),
    assignmentCount: toNumber(row.assignmentCount),
  }));
}

export async function upsertBadgeCatalog(input: {
  id?: number;
  code?: string;
  label: string;
  description?: string | null;
  badgeType?: string;
  audience?: string;
  status?: string;
  source?: string;
  icon?: string | null;
  colorToken?: string | null;
  sortOrder?: number;
  maxProductsPerItem?: number;
  isVisibleOnSite?: boolean;
  notes?: string | null;
  scopeType?: string;
  scopeId?: number | null;
  updatedBy?: string;
}) {
  const db = getDb();
  const code = slugifyBadgeCode(input.code || input.label);
  const payload = {
    code,
    label: input.label.trim().slice(0, 120),
    description: input.description ?? null,
    badgeType: input.badgeType ?? "manual",
    audience: input.audience ?? "customer",
    status: input.status ?? "draft",
    source: input.source ?? "manual",
    icon: input.icon ?? null,
    colorToken: input.colorToken ?? null,
    sortOrder: input.sortOrder ?? 0,
    maxProductsPerItem: input.maxProductsPerItem ?? 1,
    isVisibleOnSite: input.isVisibleOnSite ?? true,
    notes: input.notes ?? null,
    updatedAt: new Date(),
  };

  let badgeId = input.id;
  let oldValue: BadgeCatalogRow | null = null;

  if (badgeId) {
    const [existing] = await db
      .select()
      .from(schema.badgeCatalog)
      .where(eq(schema.badgeCatalog.id, badgeId))
      .limit(1);
    oldValue = existing ?? null;
    await db.update(schema.badgeCatalog).set(payload).where(eq(schema.badgeCatalog.id, badgeId));
  } else {
    const result = await db.insert(schema.badgeCatalog).values(payload);
    badgeId = result[0].insertId;
  }

  if (!badgeId) throw new Error("Badge id was not resolved");

  if (input.scopeType) {
    await db
      .insert(schema.badgeCategoryScopes)
      .values({
        badgeId,
        scopeType: input.scopeType,
        scopeId: input.scopeId ?? null,
        isEnabled: true,
        priority: 0,
        updatedAt: new Date(),
      })
      .onDuplicateKeyUpdate({
        set: {
          isEnabled: true,
          updatedAt: new Date(),
        },
      });
  }

  await db.insert(schema.badgeHistory).values({
    entityType: "badge_catalog",
    entityId: badgeId,
    actionType: input.id ? "update" : "create",
    oldValue: oldValue,
    newValue: payload,
    userId: input.updatedBy ?? "admin",
    comment: input.id ? "Badge updated" : "Badge created",
  });

  return { success: true, id: badgeId, code };
}

async function buildCategoryAiInput(categoryId: number, limit = 40) {
  const db = getDb();
  const [category] = await db
    .select()
    .from(schema.categories)
    .where(eq(schema.categories.id, categoryId))
    .limit(1);
  if (!category) throw new Error("Категория не найдена");

  const allCategories = await db.select().from(schema.categories);
  const categoryIds = collectDescendantCategoryIds(allCategories, categoryId);
  const products = await db
    .select({
      id: schema.products.id,
      name: schema.products.name,
      description: schema.products.description,
      price: schema.products.price,
      specs: schema.products.specs,
      image: schema.products.image,
      inStock: schema.products.inStock,
      categoryId: schema.products.categoryId,
    })
    .from(schema.products)
    .where(inArray(schema.products.categoryId, categoryIds))
    .orderBy(desc(schema.products.createdAt))
    .limit(limit);

  const existingBadges = await listBadgeCatalog({ categoryId });
  return {
    category,
    categoryTrail: allCategories
      .filter(item => categoryIds.includes(item.id))
      .map(item => ({ id: item.id, name: item.name, parentId: item.parentId })),
    products: products.map(product => ({
      id: product.id,
      name: product.name,
      description: (product.description || "").slice(0, 220),
      price: product.price,
      specs:
        product.specs && typeof product.specs === "object" && !Array.isArray(product.specs)
          ? product.specs
          : {},
      inStock: product.inStock,
    })),
    existingBadges: existingBadges.map(item => ({
      code: item.code,
      label: item.label,
      status: item.status,
      source: item.source,
      badgeType: item.badgeType,
    })),
  };
}

export async function generateCategoryBadgeSuggestions(input: {
  categoryId: number;
  updatedBy?: string;
}) {
  const db = getDb();
  const aiInput = await buildCategoryAiInput(input.categoryId);
  const runInsert = await db.insert(schema.badgeAiRuns).values({
    runType: "catalog_generation",
    categoryId: input.categoryId,
    model: (await getGeminiConfig()).model,
    promptVersion: BADGE_AI_PROMPT_VERSION,
    status: "running",
    inputSnapshot: aiInput,
  });
  const runId = runInsert[0].insertId;

  const prompt = [
    "Ты формируешь consumer-facing бейджи для интернет-магазина техники и аксессуаров.",
    "Задача: предложить короткие, полезные, понятные покупателю бейджи именно для этой категории.",
    "Нельзя выдавать общий маркетинговый шум вроде 'лучший товар', 'топовый выбор', 'супер качество'.",
    "Нужно опираться на реальные характеристики товаров, названия, описание, совместимость и use-case.",
    "Каждый бейдж должен быть коротким, полезным и пригодным для массового назначения.",
    "Код делай латиницей в snake_case.",
    "Если данных мало, лучше предложить меньше бейджей, но точных.",
    "Верни максимум 8 предложений.",
    "",
    `Категория: ${aiInput.category.name}`,
    "Существующие бейджи в категории:",
    JSON.stringify(aiInput.existingBadges, null, 2),
    "",
    "Примеры товаров:",
    JSON.stringify(aiInput.products.slice(0, 30), null, 2),
    "",
    "Для каждого предложения верни:",
    "- code",
    "- label",
    "- description",
    "- whyThisBadgeExists",
    "- estimatedCoverage (0..100)",
    "- confidence (0..100)",
    "- keywords (если есть)",
    "- specMatches [{ key, values[] }] если это можно уверенно вывести",
    "- priceMin / priceMax если это реально полезно",
    "- sampleProductNames",
  ].join("\n");

  try {
    const { response, model } = await executeGemini({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  label: { type: "string" },
                  description: { type: "string" },
                  whyThisBadgeExists: { type: "string" },
                  estimatedCoverage: { type: "number" },
                  confidence: { type: "number" },
                  keywords: { type: "array", items: { type: "string" } },
                  specMatches: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        key: { type: "string" },
                        values: { type: "array", items: { type: "string" } },
                      },
                      required: ["key", "values"],
                    },
                  },
                  priceMin: { type: "number" },
                  priceMax: { type: "number" },
                  sampleProductNames: { type: "array", items: { type: "string" } },
                },
                required: ["code", "label"],
              },
            },
          },
          required: ["suggestions"],
        },
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini request failed: ${response.status} ${errorText}`);
    }

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };
    const text =
      payload?.candidates?.[0]?.content?.parts?.find(part => typeof part.text === "string")?.text ?? "";
    if (!text) throw new Error("Gemini returned empty response");

    const parsed = suggestionSchema.parse(JSON.parse(text));

    const created: Array<{ id: number; label: string; code: string }> = [];
    for (const suggestion of parsed.suggestions) {
      const code = slugifyBadgeCode(suggestion.code || suggestion.label);
      const existingRows = await db
        .select()
        .from(schema.badgeCatalog)
        .where(eq(schema.badgeCatalog.code, code))
        .limit(1);

      let badgeId: number;
      if (existingRows[0]) {
        badgeId = existingRows[0].id;
        await db.update(schema.badgeCatalog).set({
          label: suggestion.label,
          description: suggestion.description,
          badgeType: "ai_suggested",
          status: "draft",
          source: "ai",
          notes: suggestion.whyThisBadgeExists,
          updatedAt: new Date(),
        }).where(eq(schema.badgeCatalog.id, badgeId));
      } else {
        const result = await db.insert(schema.badgeCatalog).values({
          code,
          label: suggestion.label,
          description: suggestion.description,
          badgeType: "ai_suggested",
          audience: "customer",
          status: "draft",
          source: "ai",
          sortOrder: 0,
          maxProductsPerItem: 1,
          isVisibleOnSite: false,
          notes: suggestion.whyThisBadgeExists,
        });
        badgeId = result[0].insertId;
      }

      await db
        .insert(schema.badgeCategoryScopes)
        .values({
          badgeId,
          scopeType: "category",
          scopeId: input.categoryId,
          isEnabled: true,
          priority: 0,
          updatedAt: new Date(),
        })
        .onDuplicateKeyUpdate({
          set: {
            isEnabled: true,
            updatedAt: new Date(),
          },
        });

      const ruleJson = {
        keywords: suggestion.keywords ?? [],
        specMatches: suggestion.specMatches ?? [],
        priceMin: suggestion.priceMin ?? null,
        priceMax: suggestion.priceMax ?? null,
        whyThisBadgeExists: suggestion.whyThisBadgeExists,
        sampleProductNames: suggestion.sampleProductNames ?? [],
        estimatedCoverage: suggestion.estimatedCoverage ?? 0,
      };

      const existingRule = await db
        .select()
        .from(schema.badgeAssignmentRules)
        .where(and(eq(schema.badgeAssignmentRules.badgeId, badgeId), eq(schema.badgeAssignmentRules.categoryId, input.categoryId)))
        .limit(1);

      if (existingRule[0]) {
        await db.update(schema.badgeAssignmentRules).set({
          ruleType: "ai_generated",
          ruleJson,
          confidenceThreshold: suggestion.confidence ?? 60,
          isEnabled: false,
          source: "ai",
          updatedAt: new Date(),
        }).where(eq(schema.badgeAssignmentRules.id, existingRule[0].id));
      } else {
        await db.insert(schema.badgeAssignmentRules).values({
          badgeId,
          categoryId: input.categoryId,
          ruleType: "ai_generated",
          ruleJson,
          confidenceThreshold: suggestion.confidence ?? 60,
          isEnabled: false,
          source: "ai",
        });
      }

      await db.insert(schema.badgeHistory).values({
        entityType: "badge_catalog",
        entityId: badgeId,
        actionType: "ai_suggested",
        oldValue: null,
        newValue: {
          suggestion,
          categoryId: input.categoryId,
        },
        comment: suggestion.whyThisBadgeExists,
        userId: input.updatedBy ?? "admin",
      });

      created.push({ id: badgeId, label: suggestion.label, code });
    }

    await db.update(schema.badgeAiRuns).set({
      model,
      status: "success",
      resultJson: parsed,
      finishedAt: new Date(),
    }).where(eq(schema.badgeAiRuns.id, runId));

    return {
      runId,
      suggestions: created,
      total: created.length,
    };
  } catch (error) {
    await db.update(schema.badgeAiRuns).set({
      status: "error",
      errorText: error instanceof Error ? error.message : String(error),
      finishedAt: new Date(),
    }).where(eq(schema.badgeAiRuns.id, runId));
    throw error;
  }
}

export async function listCategoryBadgeSuggestions(categoryId: number) {
  return listBadgeCatalog({
    categoryId,
    source: "ai",
  });
}

export async function reviewBadgeSuggestion(input: {
  badgeId: number;
  action: "approve" | "reject" | "archive";
  label?: string;
  description?: string | null;
  notes?: string | null;
  updatedBy?: string;
}) {
  const db = getDb();
  const [badge] = await db
    .select()
    .from(schema.badgeCatalog)
    .where(eq(schema.badgeCatalog.id, input.badgeId))
    .limit(1);
  if (!badge) throw new Error("Badge not found");

  const oldValue = badge;
  const nextStatus =
    input.action === "approve" ? "active" : input.action === "reject" ? "disabled" : "archived";

  await db.update(schema.badgeCatalog).set({
    label: input.label?.trim() || badge.label,
    description: input.description ?? badge.description,
    notes: input.notes ?? badge.notes,
    status: nextStatus,
    badgeType: nextStatus === "active" ? "rule" : badge.badgeType,
    isVisibleOnSite: nextStatus === "active",
    updatedAt: new Date(),
  }).where(eq(schema.badgeCatalog.id, input.badgeId));

  if (input.action === "approve") {
    await db.update(schema.badgeAssignmentRules).set({
      isEnabled: true,
      updatedAt: new Date(),
    }).where(eq(schema.badgeAssignmentRules.badgeId, input.badgeId));
  } else {
    await db.update(schema.badgeAssignmentRules).set({
      isEnabled: false,
      updatedAt: new Date(),
    }).where(eq(schema.badgeAssignmentRules.badgeId, input.badgeId));
  }

  await db.insert(schema.badgeHistory).values({
    entityType: "badge_catalog",
    entityId: input.badgeId,
    actionType: `review_${input.action}`,
    oldValue,
    newValue: {
      status: nextStatus,
      label: input.label ?? badge.label,
      description: input.description ?? badge.description,
      notes: input.notes ?? badge.notes,
    },
    comment: input.notes ?? null,
    userId: input.updatedBy ?? "admin",
  });

  return { success: true };
}

function matchRuleToProduct(
  product: {
    id: number;
    name: string;
    description: string;
    price: number;
    specs: Record<string, unknown>;
  },
  rule: BadgeAssignmentRuleRow
) {
  const ruleJson = (rule.ruleJson ?? {}) as {
    keywords?: string[];
    specMatches?: Array<{ key: string; values: string[] }>;
    priceMin?: number | null;
    priceMax?: number | null;
    whyThisBadgeExists?: string;
    sampleProductNames?: string[];
    estimatedCoverage?: number;
  };

  const haystack = `${product.name} ${product.description}`.toLowerCase();
  let score = 0;
  const evidence: string[] = [];

  for (const keyword of ruleJson.keywords ?? []) {
    if (haystack.includes(String(keyword).toLowerCase())) {
      score += 25;
      evidence.push(`keyword:${keyword}`);
    }
  }

  for (const specMatch of ruleJson.specMatches ?? []) {
    const actualValue = Object.entries(product.specs).find(
      ([key]) => key.trim().toLowerCase() === String(specMatch.key).trim().toLowerCase()
    )?.[1];
    if (!actualValue) continue;
    const actualText = String(actualValue).toLowerCase();
    if (specMatch.values.some(value => actualText.includes(String(value).toLowerCase()))) {
      score += 40;
      evidence.push(`spec:${specMatch.key}`);
    }
  }

  if (ruleJson.priceMin !== null && ruleJson.priceMin !== undefined && product.price >= ruleJson.priceMin) {
    score += 10;
    evidence.push("priceMin");
  }
  if (ruleJson.priceMax !== null && ruleJson.priceMax !== undefined && product.price <= ruleJson.priceMax) {
    score += 10;
    evidence.push("priceMax");
  }

  return {
    matched: score >= (rule.confidenceThreshold || 60),
    confidence: Math.max(0, Math.min(100, score)),
    explanation:
      evidence.length > 0
        ? `Совпадение по ${evidence.join(", ")}`
        : "Недостаточно уверенных совпадений",
  };
}

export async function getBadgeAssignmentPreview(input: { categoryId: number }) {
  const db = getDb();
  const categories = await db.select().from(schema.categories);
  const categoryIds = collectDescendantCategoryIds(categories, input.categoryId);

  const badges = await listBadgeCatalog({ categoryId: input.categoryId });
  const badgeIds = badges.map(item => item.id);
  const rules = badgeIds.length
    ? await db
        .select()
        .from(schema.badgeAssignmentRules)
        .where(and(inArray(schema.badgeAssignmentRules.badgeId, badgeIds), eq(schema.badgeAssignmentRules.isEnabled, true)))
    : [];

  const products = await db
    .select({
      id: schema.products.id,
      name: schema.products.name,
      categoryId: schema.products.categoryId,
      description: schema.products.description,
      price: schema.products.price,
      specs: schema.products.specs,
    })
    .from(schema.products)
    .where(inArray(schema.products.categoryId, categoryIds));

  const existingAssignments = badgeIds.length
    ? await db
        .select()
        .from(schema.productBadgeAssignments)
        .where(inArray(schema.productBadgeAssignments.badgeId, badgeIds))
    : [];

  const existingSet = new Set(existingAssignments.map(item => `${item.productId}:${item.badgeId}`));

  const preview = badges.map(badge => {
    const badgeRules = rules.filter(rule => rule.badgeId === badge.id);
    const candidates = products
      .map(product => {
        const matches = badgeRules
          .map(rule => matchRuleToProduct({
            id: product.id,
            name: product.name,
            description: product.description || "",
            price: product.price,
            specs:
              product.specs && typeof product.specs === "object" && !Array.isArray(product.specs)
                ? (product.specs as Record<string, unknown>)
                : {},
          }, rule))
          .filter(item => item.matched)
          .sort((a, b) => b.confidence - a.confidence);

        if (matches.length === 0) return null;
        const best = matches[0];
        return {
          productId: product.id,
          productName: product.name,
          confidence: best.confidence,
          explanation: best.explanation,
          alreadyApplied: existingSet.has(`${product.id}:${badge.id}`),
        };
      })
      .filter(Boolean) as Array<{
        productId: number;
        productName: string;
        confidence: number;
        explanation: string;
        alreadyApplied: boolean;
      }>;

    return {
      badgeId: badge.id,
      badgeCode: badge.code,
      badgeLabel: badge.label,
      badgeStatus: badge.status,
      totalMatches: candidates.length,
      newAssignments: candidates.filter(item => !item.alreadyApplied).length,
      sampleProducts: candidates.slice(0, 12),
    };
  });

  return preview;
}

export async function applyBadgeAssignments(input: {
  categoryId: number;
  updatedBy?: string;
}) {
  const db = getDb();
  const preview = await getBadgeAssignmentPreview({ categoryId: input.categoryId });
  let applied = 0;

  for (const badgePreview of preview) {
    for (const sample of badgePreview.sampleProducts) {
      await db
        .insert(schema.productBadgeAssignments)
        .values({
          productId: sample.productId,
          badgeId: badgePreview.badgeId,
          assignmentSource: "rule",
          confidence: sample.confidence,
          explanation: sample.explanation,
          status: "applied",
          isVisibleOnSite: true,
        })
        .onDuplicateKeyUpdate({
          set: {
            confidence: sample.confidence,
            explanation: sample.explanation,
            status: "applied",
            isVisibleOnSite: true,
            updatedAt: new Date(),
          },
        });
      applied += 1;
    }
  }

  await db.insert(schema.badgeHistory).values({
    entityType: "assignment_batch",
    entityId: input.categoryId,
    actionType: "apply_assignments",
    oldValue: null,
    newValue: {
      categoryId: input.categoryId,
      applied,
    },
    comment: "Batch apply from assignment preview",
    userId: input.updatedBy ?? "admin",
  });

  return { success: true, applied };
}

export async function getStorefrontBadgeLabels(productIds: number[]) {
  const db = getDb();
  if (productIds.length === 0) return new Map<number, string[]>();

  const rows = await db
    .select({
      productId: schema.productBadgeAssignments.productId,
      label: schema.badgeCatalog.label,
      sortOrder: schema.badgeCatalog.sortOrder,
    })
    .from(schema.productBadgeAssignments)
    .innerJoin(schema.badgeCatalog, eq(schema.badgeCatalog.id, schema.productBadgeAssignments.badgeId))
    .where(
      and(
        inArray(schema.productBadgeAssignments.productId, productIds),
        eq(schema.productBadgeAssignments.status, "applied"),
        eq(schema.productBadgeAssignments.isVisibleOnSite, true),
        eq(schema.badgeCatalog.status, "active"),
        eq(schema.badgeCatalog.isVisibleOnSite, true)
      )
    )
    .orderBy(schema.badgeCatalog.sortOrder, schema.badgeCatalog.label);

  const map = new Map<number, string[]>();
  for (const row of rows) {
    const list = map.get(row.productId) ?? [];
    if (list.length < STORE_FRONT_BADGE_LIMIT && !list.includes(row.label)) {
      list.push(row.label);
      map.set(row.productId, list);
    }
  }
  return map;
}

export async function getAiBadgeQualityDashboard() {
  const db = getDb();
  const [summary] = await db
    .select({
      totalBadges: sql<number>`count(*)`,
      activeBadges: sql<number>`sum(case when ${schema.badgeCatalog.status} = 'active' then 1 else 0 end)`,
      aiDraftBadges: sql<number>`sum(case when ${schema.badgeCatalog.source} = 'ai' and ${schema.badgeCatalog.status} = 'draft' then 1 else 0 end)`,
      visibleBadges: sql<number>`sum(case when ${schema.badgeCatalog.isVisibleOnSite} = true and ${schema.badgeCatalog.status} = 'active' then 1 else 0 end)`,
    })
    .from(schema.badgeCatalog);

  const categories = await db.select().from(schema.categories);
  const productCounts = await db
    .select({
      categoryId: schema.products.categoryId,
      count: sql<number>`count(*)`,
    })
    .from(schema.products)
    .groupBy(schema.products.categoryId);
  const assignmentCounts = await db
    .select({
      categoryId: schema.badgeAssignmentRules.categoryId,
      count: sql<number>`count(distinct ${schema.productBadgeAssignments.productId})`,
    })
    .from(schema.productBadgeAssignments)
    .innerJoin(schema.badgeAssignmentRules, eq(schema.badgeAssignmentRules.badgeId, schema.productBadgeAssignments.badgeId))
    .where(eq(schema.productBadgeAssignments.status, "applied"))
    .groupBy(schema.badgeAssignmentRules.categoryId);

  const assignmentsByCategory = new Map(assignmentCounts.map(item => [item.categoryId, toNumber(item.count)]));
  const lowCoverageCategories = productCounts
    .map(item => {
      const category = categories.find(cat => cat.id === item.categoryId);
      if (!category) return null;
      const assigned = assignmentsByCategory.get(item.categoryId) ?? 0;
      const coverage = item.count > 0 ? Math.round((assigned / item.count) * 100) : 0;
      return {
        categoryId: item.categoryId,
        categoryName: category.name,
        productCount: toNumber(item.count),
        assignedProductCount: assigned,
        coveragePercent: coverage,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a?.coveragePercent ?? 0) - (b?.coveragePercent ?? 0))
    .slice(0, 10) as Array<{
      categoryId: number;
      categoryName: string;
      productCount: number;
      assignedProductCount: number;
      coveragePercent: number;
    }>;

  const recentRuns = await db
    .select()
    .from(schema.badgeAiRuns)
    .orderBy(desc(schema.badgeAiRuns.startedAt))
    .limit(10);

  return {
    totalBadges: toNumber(summary?.totalBadges),
    activeBadges: toNumber(summary?.activeBadges),
    aiDraftBadges: toNumber(summary?.aiDraftBadges),
    visibleBadges: toNumber(summary?.visibleBadges),
    lowCoverageCategories,
    recentRuns,
  };
}
