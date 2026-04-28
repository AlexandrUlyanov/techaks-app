import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { stores } from "@db/schema";
import { asc } from "drizzle-orm";

export const storeRouter = createRouter({
  getAll: publicQuery.query(async () => {
    const db = getDb();
    return await db.select().from(stores).orderBy(asc(stores.sortOrder));
  }),
});
