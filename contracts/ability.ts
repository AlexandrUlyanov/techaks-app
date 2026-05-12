import { AbilityBuilder, createMongoAbility } from "@casl/ability";
import type { MongoAbility } from "@casl/ability";

export type Role =
  | "customer"
  | "manager"
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
  | "configure";

export type Subjects =
  | "all"
  | "Product"
  | "Category"
  | "Store"
  | "Lead"
  | "Order"
  | "Banner"
  | "BlogPost"
  | "Merchandising"
  | "Settings"
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
      "Category",
      "Store",
      "Lead",
      "Banner",
      "BlogPost",
      "Merchandising",
      "Order",
      "Sync",
    ]);
    can("configure", "Settings");
    can("read", "User");
    can("read", "AdminPanel");
  } else if (role === "merchandiser") {
    can("read", ["Product", "Category"]);
    can("manage", "Merchandising");
    can("read", "AdminPanel");
  } else if (role === "content_manager") {
    can("manage", ["Banner", "BlogPost"]);
    can("read", "Product");
    can("read", "AdminPanel");
  } else if (role === "manager") {
    can("read", ["Lead", "Order", "Product", "Store"]);
    can("update", ["Lead", "Order"]);
    can("read", "AdminPanel");
  } else {
    // customer
    can("read", ["Product", "Category", "Store", "Banner", "BlogPost"]);
    can("create", ["Lead", "Order"]);
    can("read", "Order", { userId: user.id } as any);
  }

  return build();
}
