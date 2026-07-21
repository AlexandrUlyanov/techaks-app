import { z } from "zod";
import { createRouter, protectedProcedure, requireAbility } from "../middleware";
import { writeAdminAuditLog } from "../lib/admin-audit";
import {
  getWordstatAdminSettings,
  getWordstatCluster,
  getWordstatCoverageSummary,
  listWordstatTargets,
  saveWordstatSettings,
  setWordstatQueryDecision,
  syncWordstatBatch,
  syncWordstatPriorityBatch,
  syncWordstatTarget,
  testWordstatConnection,
  wordstatQueryDecisions,
  wordstatTargetTypes,
} from "../lib/wordstat";

const targetTypeSchema = z.enum(wordstatTargetTypes);
const decisionSchema = z.enum(wordstatQueryDecisions);

export const wordstatRouter = createRouter({
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Settings");
    return getWordstatAdminSettings();
  }),

  saveSettings: protectedProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        folderId: z.string().trim().max(160),
        regionIds: z.array(z.string().trim().min(1).max(40)).max(50),
        numPhrases: z.number().int().min(1).max(2000),
        refreshDays: z.number().int().min(1).max(365),
        maxTargetsPerRun: z.number().int().min(1).max(100),
        apiKey: z.string().trim().max(1000).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "configure", "Settings");
      const result = await saveWordstatSettings({
        config: input,
        apiKey: input.apiKey,
      });
      await writeAdminAuditLog({
        ctx,
        action: "wordstat.settings.update",
        entityType: "settings",
        entityLabel: "Yandex Wordstat",
        after: { ...input, apiKey: input.apiKey ? "[REDACTED]" : null },
      });
      return result;
    }),

  testConnection: protectedProcedure
    .input(z.object({ seedQuery: z.string().trim().min(1).max(255).default("техника") }))
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "configure", "Settings");
      const result = await testWordstatConnection(input.seedQuery);
      await writeAdminAuditLog({
        ctx,
        action: "wordstat.connection.test",
        entityType: "integration",
        entityLabel: "Yandex Wordstat",
        after: result,
      });
      return result;
    }),

  listTargets: protectedProcedure
    .input(
      z.object({
        targetType: targetTypeSchema,
        search: z.string().trim().max(255).optional(),
        limit: z.number().int().min(1).max(100).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Listing");
      return listWordstatTargets(input);
    }),

  getCoverageSummary: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Listing");
    return getWordstatCoverageSummary();
  }),

  getCluster: protectedProcedure
    .input(z.object({ targetType: targetTypeSchema, targetId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Listing");
      return getWordstatCluster(input);
    }),

  syncTarget: protectedProcedure
    .input(
      z.object({
        targetType: targetTypeSchema,
        targetId: z.number().int().positive(),
        seedQuery: z.string().trim().max(512).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Listing");
      const result = await syncWordstatTarget({
        ...input,
        userId: ctx.user?.id,
      });
      await writeAdminAuditLog({
        ctx,
        action: "wordstat.cluster.sync",
        entityType: input.targetType,
        entityId: input.targetId,
        after: result,
      });
      return result;
    }),

  syncBatch: protectedProcedure
    .input(z.object({ targetType: targetTypeSchema }))
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Listing");
      const result = await syncWordstatBatch({
        targetType: input.targetType,
        userId: ctx.user?.id,
      });
      await writeAdminAuditLog({
        ctx,
        action: "wordstat.cluster.batch_sync",
        entityType: input.targetType,
        after: {
          processed: result.processed,
          succeeded: result.succeeded,
          failed: result.failed,
        },
      });
      return result;
    }),

  syncPriorityBatch: protectedProcedure.mutation(async ({ ctx }) => {
    requireAbility(ctx, "manage", "Listing");
    const result = await syncWordstatPriorityBatch({ userId: ctx.user?.id });
    await writeAdminAuditLog({
      ctx,
      action: "wordstat.priority_batch_sync",
      entityType: "wordstat",
      after: { targetType: result.targetType, processed: result.processed, succeeded: result.succeeded, failed: result.failed },
    });
    return result;
  }),

  setQueryDecision: protectedProcedure
    .input(z.object({ queryId: z.number().int().positive(), decision: decisionSchema }))
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Listing");
      const result = await setWordstatQueryDecision(input);
      await writeAdminAuditLog({
        ctx,
        action: "wordstat.query.decision",
        entityType: "demand_cluster_query",
        entityId: input.queryId,
        after: { decision: input.decision },
      });
      return result;
    }),
});
