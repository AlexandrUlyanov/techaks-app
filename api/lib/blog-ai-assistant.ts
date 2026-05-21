import { z } from "zod";
import { blogAiRuns, blogAiSuggestions, categories, manufacturers, products } from "@db/schema";
import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { getGeminiConfig } from "./gemini-spec-standardization";
import type { BlogStatus } from "./blog-content";

const BLOG_AI_PROMPT_VERSION = "v1";

const modeSchema = z.enum([
  "title",
  "excerpt",
  "outline",
  "seo",
  "rewrite",
  "ideas",
  "internal_links",
]);

export const blogAiInputSchema = z.object({
  postId: z.number().optional(),
  mode: modeSchema,
  title: z.string().trim().min(1).max(255),
  excerpt: z.string().trim().max(500).optional().default(""),
  content: z.string().trim().max(25000).optional().default(""),
  category: z.string().trim().max(80).optional().default("Новости"),
  metaTitle: z.string().trim().max(255).optional().default(""),
  metaDescription: z.string().trim().max(500).optional().default(""),
  slug: z.string().trim().max(255).optional().default(""),
  featured: z.boolean().optional().default(false),
  status: z
    .enum(["draft", "scheduled", "published", "archived"] satisfies [BlogStatus, ...BlogStatus[]])
    .optional()
    .default("draft"),
});

type CatalogLinkTarget = {
  label: string;
  url: string;
  entityType: "category" | "manufacturer" | "product";
};

const aiSuggestionResultSchema = z.object({
  titleOptions: z.array(z.string()).default([]),
  suggestedSlug: z.string().default(""),
  excerpt: z.string().default(""),
  outline: z.array(z.string()).default([]),
  rewrite: z.string().default(""),
  seoTitle: z.string().default(""),
  seoDescription: z.string().default(""),
  cta: z.string().default(""),
  ideas: z.array(z.string()).default([]),
  internalLinks: z
    .array(
      z.object({
        label: z.string(),
        reason: z.string(),
        url: z.string().default(""),
        entityType: z.enum(["category", "manufacturer", "product"]).default("category"),
      })
    )
    .default([]),
  rationale: z.string().default(""),
});

export async function generateBlogAiSuggestions(input: z.infer<typeof blogAiInputSchema>, actorUserId?: number) {
  const parsed = blogAiInputSchema.parse(input);
  const config = await getGeminiConfig();
  assertGeminiAccess(config);

  const db = getDb();
  const selectedCategory = parsed.category
    ? await db
        .select({
          id: categories.id,
          name: categories.name,
          slug: categories.slug,
        })
        .from(categories)
        .where(eq(categories.name, parsed.category))
        .limit(1)
        .then(rows => rows[0] ?? null)
    : null;

  const [categoryRows, manufacturerRows, productRows] = await Promise.all([
    db
      .select({ name: categories.name, slug: categories.slug })
      .from(categories)
      .limit(12),
    db
      .select({ name: manufacturers.name, slug: manufacturers.slug })
      .from(manufacturers)
      .where(eq(manufacturers.isVisible, true))
      .limit(12),
    db
      .select({
        name: products.name,
        slug: products.slug,
        categoryId: products.categoryId,
        price: products.price,
      })
      .from(products)
      .where(
        and(
          eq(products.isActive, true),
          eq(products.isAutoBlocked, false),
          gt(products.price, 0),
          selectedCategory ? eq(products.categoryId, selectedCategory.id) : undefined
        )
      )
      .orderBy(desc(products.createdAt))
      .limit(12),
  ]);

  const catalogTargets: CatalogLinkTarget[] = [
    ...categoryRows.map(item => ({
      label: item.name,
      url: `/catalog?cat=${item.slug}`,
      entityType: "category" as const,
    })),
    ...manufacturerRows.map(item => ({
      label: item.name,
      url: `/catalog?view=brands&brand=${item.slug}`,
      entityType: "manufacturer" as const,
    })),
    ...productRows.map(item => ({
      label: item.name,
      url: `/product/${item.slug}`,
      entityType: "product" as const,
    })),
  ];

  const runInsert = await db.insert(blogAiRuns).values({
    postId: parsed.postId ?? null,
    mode: parsed.mode,
    promptVersion: BLOG_AI_PROMPT_VERSION,
    model: config.model,
    status: "running",
    inputSnapshot: parsed,
    createdByUserId: actorUserId ?? null,
  });
  const runId = runInsert[0].insertId;

  try {
    const prompt = buildPrompt(parsed, {
      categoryNames: categoryRows.map(item => item.name),
      manufacturerNames: manufacturerRows.map(item => item.name),
      catalogTargets,
    });

    const response = await executeGemini(config, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: parsed.mode === "seo" ? 0.3 : 0.5,
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          properties: {
            titleOptions: { type: "array", items: { type: "string" } },
            suggestedSlug: { type: "string" },
            excerpt: { type: "string" },
            outline: { type: "array", items: { type: "string" } },
            rewrite: { type: "string" },
            seoTitle: { type: "string" },
            seoDescription: { type: "string" },
            cta: { type: "string" },
            ideas: { type: "array", items: { type: "string" } },
            internalLinks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  reason: { type: "string" },
                  url: { type: "string" },
                  entityType: { type: "string", enum: ["category", "manufacturer", "product"] },
                },
                required: ["label", "reason", "url", "entityType"],
              },
            },
            rationale: { type: "string" },
          },
        },
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini request failed: ${response.status} ${errorText}`);
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text =
      payload?.candidates?.[0]?.content?.parts?.find(part => typeof part.text === "string")
        ?.text ?? "";

    if (!text) {
      throw new Error("Gemini returned empty response");
    }

    const result = aiSuggestionResultSchema.parse(JSON.parse(text));
    await db.update(blogAiRuns).set({
      status: "success",
      resultJson: result,
      finishedAt: new Date(),
    }).where(eq(blogAiRuns.id, runId));

    const suggestionRows = buildSuggestionRows(runId, parsed.postId, parsed.mode, result);
    if (suggestionRows.length > 0) {
      await db.insert(blogAiSuggestions).values(suggestionRows);
    }

    return {
      runId,
      mode: parsed.mode,
      result,
      suggestions: suggestionRows.map(item => ({
        suggestionType: item.suggestionType,
        content: item.content,
        metadataJson: item.metadataJson,
      })),
    };
  } catch (error) {
    await db.update(blogAiRuns).set({
      status: "error",
      errorText: error instanceof Error ? error.message : "Unknown AI error",
      finishedAt: new Date(),
    }).where(eq(blogAiRuns.id, runId));
    throw error;
  }
}

export async function listBlogAiSuggestions(postId?: number) {
  const db = getDb();
  if (postId) {
    return db
      .select()
      .from(blogAiSuggestions)
      .where(eq(blogAiSuggestions.postId, postId))
      .limit(24);
  }

  return db.select().from(blogAiSuggestions).limit(24);
}

export async function markBlogAiSuggestionsApplied(ids: number[]) {
  if (ids.length === 0) return;
  const db = getDb();
  await db
    .update(blogAiSuggestions)
    .set({
      status: "applied",
      appliedAt: new Date(),
    })
    .where(inArray(blogAiSuggestions.id, ids));
}

function buildPrompt(
  input: z.infer<typeof blogAiInputSchema>,
  context: { categoryNames: string[]; manufacturerNames: string[]; catalogTargets: CatalogLinkTarget[] }
) {
  const targetLines =
    context.catalogTargets.length > 0
      ? context.catalogTargets.map(item => `- [${item.entityType}] ${item.label} -> ${item.url}`).join("\n")
      : "-";

  return [
    "Ты редактор и SEO-помощник интернет-магазина ТЕХАКС.",
    "Пиши по-русски, прагматично, без SEO-спама и без пустых маркетинговых клише.",
    "Главная задача: делать полезные статьи про технику, аксессуары, выбор, сравнение и использование товаров.",
    "Помни, что AI-помощник не публикует статью сам, а только предлагает редактору варианты.",
    `Режим: ${input.mode}.`,
    `Категория статьи: ${input.category || "Новости"}.`,
    `Заголовок: ${input.title}`,
    `Excerpt: ${input.excerpt || "-"}`,
    `Slug: ${input.slug || "-"}`,
    `Meta title: ${input.metaTitle || "-"}`,
    `Meta description: ${input.metaDescription || "-"}`,
    `Статус статьи: ${input.status}.`,
    `Featured: ${input.featured ? "да" : "нет"}.`,
    "",
    "Контекст ассортимента магазина:",
    `Категории каталога: ${context.categoryNames.join(", ") || "-"}.`,
    `Бренды: ${context.manufacturerNames.join(", ") || "-"}.`,
    "Реальные кандидаты для внутренних ссылок и коммерческих акцентов:",
    targetLines,
    "",
    "Черновик статьи/контента:",
    input.content || "-",
    "",
    "Требования к ответу:",
    "1. Верни JSON.",
    "2. Заполняй только полезные поля для текущего режима, остальные оставляй пустыми или массивами [].",
    "3. Заголовки и SEO делай конкретными, без переоптимизации и без кликбейта.",
    "4. Если предлагаешь внутренние ссылки, используй только реальные URL из списка кандидатов выше. Не выдумывай новые пути.",
    "5. Для режимов ideas и internal_links старайся опираться на коммерчески полезные темы: выбор, совместимость, сценарии покупки, подборки, сравнения, сезонные советы.",
    "6. Тон: экспертный, понятный, человечный, без воды.",
  ].join("\n");
}

function buildSuggestionRows(
  runId: number,
  postId: number | undefined,
  mode: z.infer<typeof modeSchema>,
  result: z.infer<typeof aiSuggestionResultSchema>
) {
  const rows: Array<{
    runId: number;
    postId: number | null;
    suggestionType: string;
    content: string;
    metadataJson: Record<string, unknown> | null;
    status: string;
  }> = [];

  for (const title of result.titleOptions) {
    rows.push({
      runId,
      postId: postId ?? null,
      suggestionType: mode === "ideas" ? "idea_title" : "title",
      content: title,
      metadataJson: { rationale: result.rationale },
      status: "suggested",
    });
  }

  const scalarRows: Array<[string, string]> = [
    ["slug", result.suggestedSlug],
    ["excerpt", result.excerpt],
    ["rewrite", result.rewrite],
    ["seo_title", result.seoTitle],
    ["seo_description", result.seoDescription],
    ["cta", result.cta],
  ];

  for (const [suggestionType, content] of scalarRows) {
    if (!content) continue;
    rows.push({
      runId,
      postId: postId ?? null,
      suggestionType,
      content,
      metadataJson: { rationale: result.rationale },
      status: "suggested",
    });
  }

  if (result.outline.length > 0) {
    rows.push({
      runId,
      postId: postId ?? null,
      suggestionType: "outline",
      content: result.outline.join("\n"),
      metadataJson: { rationale: result.rationale },
      status: "suggested",
    });
  }

  for (const idea of result.ideas) {
    rows.push({
      runId,
      postId: postId ?? null,
      suggestionType: "idea",
      content: idea,
      metadataJson: { rationale: result.rationale },
      status: "suggested",
    });
  }

  for (const link of result.internalLinks) {
    rows.push({
      runId,
      postId: postId ?? null,
      suggestionType: "internal_link",
      content: link.label,
      metadataJson: {
        reason: link.reason,
        rationale: result.rationale,
        url: link.url,
        entityType: link.entityType,
      },
      status: "suggested",
    });
  }

  return rows;
}

function assertGeminiAccess(config: Awaited<ReturnType<typeof getGeminiConfig>>) {
  if (!config.proxyBaseUrl && !config.apiKey) {
    throw new Error("Нужно указать Gemini API key или AI Proxy URL в настройках.");
  }
}

async function executeGemini(
  config: Awaited<ReturnType<typeof getGeminiConfig>>,
  body: Record<string, unknown>
) {
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
        apiKey: config.apiKey || "",
        body,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI proxy failed: ${response.status} ${errorText}`);
    }

    return response;
  }

  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": config.apiKey || "",
      },
      body: JSON.stringify(body),
    }
  );
}
