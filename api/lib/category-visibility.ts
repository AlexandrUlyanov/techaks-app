import { categories } from "@db/schema";

export type CategoryRow = typeof categories.$inferSelect;

export function filterPublicVisibleCategories<T extends Pick<CategoryRow, "id" | "parentId" | "isActive">>(
  rows: T[]
) {
  const byId = new Map(rows.map(row => [row.id, row] as const));

  return rows.filter(row => {
    let current: T | undefined = row;

    while (current) {
      if (!current.isActive) return false;
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }

    return true;
  });
}

export function buildPublicVisibleCategoryIdSet<
  T extends Pick<CategoryRow, "id" | "parentId" | "isActive">
>(rows: T[]) {
  return new Set(filterPublicVisibleCategories(rows).map(row => row.id));
}
