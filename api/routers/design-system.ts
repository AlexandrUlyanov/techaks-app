import { z } from "zod";
import {
  designThemeSchema,
  type DesignTheme,
} from "@contracts/design-system";
import { createRouter, protectedProcedure, publicQuery, requireAbility } from "../middleware";
import {
  getDesignSystemAdminState,
  getPublishedDesignTheme,
  publishDesignThemeDraft,
  resetDesignThemeDraft,
  rollbackDesignThemeVersion,
  saveDesignThemeDraft,
} from "../lib/design-system";

export const designSystemRouter = createRouter({
  getPublishedTheme: publicQuery.query(async () => {
    const theme = await getPublishedDesignTheme();
    return { theme };
  }),

  getAdminState: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "DesignSystem");
    return getDesignSystemAdminState();
  }),

  saveDraft: protectedProcedure
    .input(
      z.object({
        theme: designThemeSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "update", "DesignSystem");
      return saveDesignThemeDraft({
        theme: input.theme as DesignTheme,
      });
    }),

  publishDraft: protectedProcedure
    .input(
      z.object({
        changeNote: z.string().trim().max(255).default(""),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "publish", "DesignSystem");
      return publishDesignThemeDraft({
        changeNote: input.changeNote,
        actor: {
          id: ctx.user!.id,
          fullName: ctx.user!.fullName,
          email: ctx.user!.email,
          role: ctx.user!.role,
        },
      });
    }),

  resetDraft: protectedProcedure.mutation(async ({ ctx }) => {
    requireAbility(ctx, "update", "DesignSystem");
    return resetDesignThemeDraft();
  }),

  rollbackVersion: protectedProcedure
    .input(
      z.object({
        versionId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "rollback", "DesignSystem");
      return rollbackDesignThemeVersion({
        versionId: input.versionId,
        actor: {
          id: ctx.user!.id,
          fullName: ctx.user!.fullName,
          email: ctx.user!.email,
          role: ctx.user!.role,
        },
      });
    }),
});
