import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getAppSettings, setAppSetting } from "../lib/app-settings";
import { env } from "../lib/env";
import { getGeminiConfig, testGeminiConnection } from "../lib/gemini-spec-standardization";

export const settingsRouter = createRouter({
  getGemini: publicQuery.query(async () => {
    const settings = await getAppSettings(["gemini_api_key", "gemini_model"]);
    const config = await getGeminiConfig();
    const storedKey = settings.gemini_api_key?.trim() || "";

    return {
      provider: "gemini",
      model: settings.gemini_model?.trim() || env.geminiModel,
      hasApiKey: Boolean(config.apiKey),
      apiKeyMasked: storedKey
        ? `${storedKey.slice(0, 4)}••••••••${storedKey.slice(-4)}`
        : config.source === "env" && env.geminiApiKey
          ? "Используется ключ из .env"
          : "",
      source: config.source,
    };
  }),

  saveGemini: publicQuery
    .input(
      z.object({
        apiKey: z.string().trim().optional().default(""),
        model: z.string().trim().min(1).max(120).default("gemini-2.5-flash"),
      })
    )
    .mutation(async ({ input }) => {
      if (input.apiKey) {
        await setAppSetting("gemini_api_key", input.apiKey);
      }
      await setAppSetting("gemini_model", input.model);

      return { success: true };
    }),

  clearGeminiApiKey: publicQuery.mutation(async () => {
    await setAppSetting("gemini_api_key", "");
    return { success: true };
  }),

  testGemini: publicQuery
    .input(
      z.object({
        apiKey: z.string().trim().optional(),
        model: z.string().trim().optional(),
      }).optional()
    )
    .mutation(async ({ input }) => {
      return testGeminiConnection(input);
    }),
});
