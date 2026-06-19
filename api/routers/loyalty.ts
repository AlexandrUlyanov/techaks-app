import { z } from "zod";
import { protectedProcedure, createRouter, requireAbility } from "../middleware";
import {
  assignLoyaltyCustomerGroup,
  getLoyaltyAdminOverview,
  getLoyaltyAdminSettings,
  listLoyaltyCustomersAdmin,
  listLoyaltyJobsAdmin,
  listLoyaltyOrdersAdmin,
  listLoyaltySyncJournal,
  processLoyaltySyncJobs,
  resyncLoyaltyCustomer,
  resyncLoyaltyOrder,
  saveLoyaltyAdminSettings,
  scheduleLoyaltyMaintenanceJobs,
} from "../lib/moysklad-loyalty";
import { writeAdminAuditLog } from "../lib/admin-audit";

const listInputSchema = z.object({
  search: z.string().trim().optional(),
  status: z.string().trim().optional(),
  limit: z.number().int().min(1).max(250).optional(),
});

function requireLoyaltyAccess(ctx: Parameters<typeof requireAbility>[0]) {
  requireAbility(ctx, "configure", "Settings");
}

export const loyaltyRouter = createRouter({
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    requireLoyaltyAccess(ctx);
    return getLoyaltyAdminSettings();
  }),

  saveSettings: protectedProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        groupName: z.string().trim().optional(),
        participantTag: z.string().trim().optional(),
        defaultMaxWriteoffPercent: z.number().int().min(1).max(100).optional(),
        posCashierUid: z.string().trim().max(255).optional(),
        posStoreUid: z.string().trim().max(255).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireLoyaltyAccess(ctx);
      const before = await getLoyaltyAdminSettings();
      const result = await saveLoyaltyAdminSettings(input);
      await writeAdminAuditLog({
        ctx,
        action: "settings.loyalty.update",
        entityType: "settings",
        entityLabel: "Бонусная программа",
        before,
        after: result,
      });
      return result;
    }),

  getOverview: protectedProcedure.query(async ({ ctx }) => {
    requireLoyaltyAccess(ctx);
    return getLoyaltyAdminOverview();
  }),

  listCustomers: protectedProcedure.input(listInputSchema).query(async ({ ctx, input }) => {
    requireLoyaltyAccess(ctx);
    return listLoyaltyCustomersAdmin(input);
  }),

  listOrders: protectedProcedure
    .input(
      z.object({
        search: z.string().trim().optional(),
        syncStatus: z.string().trim().optional(),
        limit: z.number().int().min(1).max(300).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      requireLoyaltyAccess(ctx);
      return listLoyaltyOrdersAdmin(input);
    }),

  listJournal: protectedProcedure.input(listInputSchema).query(async ({ ctx, input }) => {
    requireLoyaltyAccess(ctx);
    return listLoyaltySyncJournal(input);
  }),

  listJobs: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(250).optional() }).optional())
    .query(async ({ ctx, input }) => {
      requireLoyaltyAccess(ctx);
      return listLoyaltyJobsAdmin(input?.limit ?? 120);
    }),

  resyncCustomer: protectedProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireLoyaltyAccess(ctx);
      const result = await resyncLoyaltyCustomer(input.userId);
      await writeAdminAuditLog({
        ctx,
        action: "loyalty.customer.resync",
        entityType: "settings",
        entityId: input.userId,
        entityLabel: `Клиент #${input.userId}`,
        after: { userId: input.userId },
      });
      return result;
    }),

  assignGroup: protectedProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireLoyaltyAccess(ctx);
      const result = await assignLoyaltyCustomerGroup(input.userId);
      await writeAdminAuditLog({
        ctx,
        action: "loyalty.customer.assign_group",
        entityType: "settings",
        entityId: input.userId,
        entityLabel: `Клиент #${input.userId}`,
        after: { userId: input.userId, participantTag: result.participantTag },
      });
      return result;
    }),

  resyncOrder: protectedProcedure
    .input(z.object({ orderId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireLoyaltyAccess(ctx);
      const result = await resyncLoyaltyOrder(input.orderId);
      await writeAdminAuditLog({
        ctx,
        action: "loyalty.order.resync",
        entityType: "settings",
        entityId: input.orderId,
        entityLabel: `Заказ #${input.orderId}`,
        after: { orderId: input.orderId },
      });
      return result;
    }),

  runMaintenance: protectedProcedure
    .input(
      z
        .object({
          scheduleLimit: z.number().int().min(1).max(100).optional(),
          processLimit: z.number().int().min(1).max(100).optional(),
        })
        .optional()
    )
    .mutation(async ({ ctx, input }) => {
      requireLoyaltyAccess(ctx);
      const scheduled = await scheduleLoyaltyMaintenanceJobs(input?.scheduleLimit ?? 20);
      const processed = await processLoyaltySyncJobs(input?.processLimit ?? 10);
      await writeAdminAuditLog({
        ctx,
        action: "loyalty.jobs.run",
        entityType: "settings",
        entityLabel: "Loyalty jobs",
        after: { scheduled, processed },
      });
      return { scheduled, processed };
    }),
});
