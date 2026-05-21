import { AbilityBuilder, createMongoAbility } from "@casl/ability";
import type { MongoAbility } from "@casl/ability";

export type Role =
  | "customer"
  | "manager"
  | "warehouse"
  | "content_manager"
  | "merchandiser"
  | "admin"
  | "super_admin";

export type Actions =
  | "manage"
  | "create"
  | "read"
  | "update"
  | "delete"
  | "sync"
  | "configure"
  | "publish"
  | "rollback";

export type Subjects =
  | "all"
  | "Product"
  | "Review"
  | "Category"
  | "Store"
  | "Reservation"
  | "Lead"
  | "Order"
  | "Banner"
  | "BlogPost"
  | "Merchandising"
  | "Settings"
  | "DesignSystem"
  | "Search"
  | "Sync"
  | "User"
  | "AdminPanel";

export type AppAbility = MongoAbility<[Actions, Subjects]>;

export function defineAbilityFor(user: { id: number; role: string }) {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  const role = user.role as Role;

  if (role === "super_admin") {
    can("manage", "all");
  } else if (role === "admin") {
    can("manage", [
      "Product",
      "Review",
      "Category",
      "Store",
      "Reservation",
      "Lead",
      "Banner",
      "BlogPost",
      "Merchandising",
      "Search",
      "Order",
      "Sync",
    ]);
    can("configure", "Settings");
    can(["read", "update", "publish", "rollback"], "DesignSystem");
    can("manage", "Search");
    can("read", "User");
    can("read", "AdminPanel");
  } else if (role === "merchandiser") {
    can("read", ["Product", "Category"]);
    can("manage", "Merchandising");
    can("read", "AdminPanel");
  } else if (role === "content_manager") {
    can("manage", ["Banner", "BlogPost"]);
    can("read", "Product");
    can("read", "DesignSystem");
    can("read", "Search");
    can("read", "AdminPanel");
  } else if (role === "manager") {
    can("read", ["Lead", "Order", "Product", "Store", "Review"]);
    can("update", ["Lead", "Order", "Review", "Reservation"]);
    can("read", "DesignSystem");
    can("read", "Search");
    can("read", "AdminPanel");
  } else if (role === "warehouse") {
    can("read", ["Order", "Product", "Store", "Reservation"]);
    can("update", ["Order", "Reservation"]);
    can("read", "DesignSystem");
    can("read", "Search");
    can("read", "AdminPanel");
  } else {
    // customer
    can("read", ["Product", "Review", "Category", "Store", "Banner", "BlogPost"]);
    can("create", ["Lead", "Order"]);
    can("read", "Order", { userId: user.id } as any);
  }

  return build();
}
