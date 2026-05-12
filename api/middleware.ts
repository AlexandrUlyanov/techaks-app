import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { ForbiddenError } from "@casl/ability";
import type { Actions, Subjects } from "../contracts/ability";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const createRouter = t.router;
export const publicQuery = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user || !ctx.ability) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      ability: ctx.ability,
    },
  });
});

export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.ability.can("manage", "all")) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next();
});

export function requireAbility(
  ctx: TrpcContext,
  action: Actions,
  subject: Subjects,
  conditions?: any
) {
  if (!ctx.ability) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  try {
    ForbiddenError.from(ctx.ability).throwUnlessCan(action, subject, conditions);
  } catch (error) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: (error as Error).message,
    });
  }
}
