import { z } from "zod";
import { getDb } from "../queries/connection";
import { categories } from "@db/schema";
import { eq } from "drizzle-orm";
import { env } from "./env";
import {
  getCategorySpecStandardization,
} from "./product-spec-standardization";
import {
  normalizeSpecKeyForDisplay,
  normalizeSpecToken,
} from "./product-normalization";
import { getAppSettings } from "./app-settings";

const aiSuggestionSchema = z.object({
  suggestions: z.array(
    z.object({
      sourceNormalizedKey: z.string(),
      targetKey: z.string(),
      isVisible: z.boolean(),
      isFilterable: z.boolean(),
      sortOrder: z.number().int().min(0).max(999).default(0),
      reason: z.string().optional().default(""),
    })
  ),
});

export async function suggestCategorySpecRulesWithGemini(input: {
  categoryId: number;
  limit?: number;
}) {
  const config = await getGeminiConfig();

  if (!config.apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const db = getDb();
  const [category] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, input.categoryId))
    .limit(1);

  if (!category) {
    throw new Error("Category not found");
  }

  const overview = await getCategorySpecStandardization(input.categoryId);
  const rows = overview.slice(0, input.limit ?? 80).map(row => ({
    sourceKey: row.sourceKey,
    sourceNormalizedKey: row.sourceNormalizedKey,
    productCount: row.productCount,
    valueCount: row.valueCount,
    sampleValue: row.sampleValue,
    currentTargetKey: row.targetKey,
    currentIsVisible: row.isVisible,
    currentIsFilterable: row.isFilterable,
  }));

  const prompt = [
    "Ты стандартизируешь характеристики для интернет-магазина.",
    `Категория: ${category.name}.`,
    "Нужно предложить нормальные, короткие и единообразные названия характеристик для карточек товара и фильтров.",
    "Правила:",
    "1. Не выдумывай новые характеристики, работай только с переданными ключами.",
    "2. Объединяй очевидные дубли и опечатки: например 'Бренд' и 'Производитель', 'Цвет корпуса' и 'Цвет' только если это логично для категории.",
    "3. Для мусорных или маркетинговых ключей ставь isFilterable=false.",
    "4. Для служебных, слишком длинных, одноразовых или плохо пригодных к сравнению ключей можно ставить isVisible=false.",
    "5. targetKey должен быть на русском, короткий, в нормальной форме для каталога.",
    "6. sortOrder: чем важнее характеристика для выбора товара, тем меньше число.",
    "7. Верни suggestion для каждого sourceNormalizedKey из входа.",
    "",
    "Входные данные:",
    JSON.stringify(rows, null, 2),
  ].join("\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": config.apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
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
                    sourceNormalizedKey: { type: "string" },
                    targetKey: { type: "string" },
                    isVisible: { type: "boolean" },
                    isFilterable: { type: "boolean" },
                    sortOrder: { type: "integer" },
                    reason: { type: "string" },
                  },
                  required: [
                    "sourceNormalizedKey",
                    "targetKey",
                    "isVisible",
                    "isFilterable",
                    "sortOrder",
                  ],
                },
              },
            },
            required: ["suggestions"],
          },
        },
      }),
    }
  );

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
    payload?.candidates?.[0]?.content?.parts?.find(
      (part: { text?: string }) => typeof part.text === "string"
    )?.text ?? "";

  if (!text) {
    throw new Error("Gemini returned empty response");
  }

  const parsed = aiSuggestionSchema.parse(JSON.parse(text));
  const suggestionsByKey = new Map(
    parsed.suggestions.map(item => [item.sourceNormalizedKey, item])
  );

  return rows.map(row => {
    const suggestion = suggestionsByKey.get(row.sourceNormalizedKey);
    const targetKey = normalizeSpecKeyForDisplay(
      suggestion?.targetKey || row.currentTargetKey || row.sourceKey
    ).slice(0, 120);

    return {
      sourceKey: row.sourceKey,
      sourceNormalizedKey: row.sourceNormalizedKey,
      targetKey,
      targetNormalizedKey: normalizeSpecToken(targetKey).slice(0, 120),
      isVisible: suggestion?.isVisible ?? row.currentIsVisible,
      isFilterable: suggestion?.isFilterable ?? row.currentIsFilterable,
      sortOrder: suggestion?.sortOrder ?? 0,
      reason: suggestion?.reason || "",
    };
  });
}

export async function getGeminiConfig() {
  const settings = await getAppSettings([
    "gemini_api_key",
    "gemini_model",
  ]);

  return {
    apiKey: settings.gemini_api_key?.trim() || env.geminiApiKey || "",
    model: settings.gemini_model?.trim() || env.geminiModel,
    source: settings.gemini_api_key?.trim() ? "database" : "env",
  } as const;
}

export async function testGeminiConnection(input?: {
  apiKey?: string;
  model?: string;
}) {
  const config = input?.apiKey?.trim()
    ? {
        apiKey: input.apiKey.trim(),
        model: input.model?.trim() || env.geminiModel,
      }
    : await getGeminiConfig();

  if (!config.apiKey) {
    throw new Error("Ключ Gemini не заполнен");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": config.apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: "Ответь одним словом: ok" }],
          },
        ],
        generationConfig: {
          temperature: 0,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${errorText}`);
  }

  return {
    success: true,
    model: config.model,
  };
}
