import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { verifyToken } from "./lib/auth";
import { getDb } from "./queries/connection";
import { accountSessions, users } from "@db/schema";
import { and, eq, gt, isNull } from "drizzle-orm";
import { defineAbilityFor, type AppAbility } from "../contracts/ability";

export type User = typeof users.$inferSelect;

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: User | null;
  ability?: AppAbility;
  sessionId?: string;
};

export async function createContext(
  opts: FetchCreateContextFnOptions
): Promise<TrpcContext> {
  const { req, resHeaders } = opts;
  
  // Extract token from Authorization header or cookie
  let token: string | null = null;
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  } else {
    // Try cookie
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(/token=([^;]+)/);
      if (match) token = match[1];
    }
  }

  let user: User | null = null;
  let ability: AppAbility | undefined;
  let sessionId: string | undefined;

  if (token) {
    const payload = await verifyToken(token);
    if (payload) {
      const db = getDb();
      if (payload.sessionId) {
        const [session] = await db
          .select({ id: accountSessions.id })
          .from(accountSessions)
          .where(and(
            eq(accountSessions.id, payload.sessionId),
            eq(accountSessions.userId, payload.id),
            isNull(accountSessions.revokedAt),
            gt(accountSessions.expiresAt, new Date())
          ))
          .limit(1);
        if (!session) return { req, resHeaders, user: null, ability: undefined };
        sessionId = session.id;
        await db.update(accountSessions).set({ lastSeenAt: new Date() }).where(eq(accountSessions.id, session.id));
      }
      const results = await db
        .select()
        .from(users)
        .where(eq(users.id, payload.id))
        .limit(1);
      
      if (results[0] && results[0].status === "active") {
        user = results[0];
        ability = defineAbilityFor({ id: user.id, role: user.role });
      }
    }
  }

  return { req, resHeaders, user, ability, sessionId };
}
