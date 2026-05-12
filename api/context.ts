import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { verifyToken } from "./lib/auth";
import { getDb } from "./queries/connection";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";
import { defineAbilityFor, type AppAbility } from "../contracts/ability";

export type User = typeof users.$inferSelect;

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: User | null;
  ability?: AppAbility;
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

  if (token) {
    const payload = await verifyToken(token);
    if (payload) {
      const db = getDb();
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

  return { req, resHeaders, user, ability };
}
