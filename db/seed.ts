import { getDb } from "../api/queries/connection";
import * as schema from "./schema";
import { products as staticProducts, categories as staticCategories } from "../src/data/products";

async function seed() {
  const db = getDb();
  console.log("Seeding database...");

  // 1. Seed Categories
  console.log("Seeding categories...");
  for (const cat of staticCategories) {
    if (cat.slug === "all") continue;
    await db.insert(schema.categories).values({
      slug: cat.slug,
      name: cat.name,
      icon: "Smartphone", // Default icon
    }).onDuplicateKeyUpdate({ set: { name: cat.name } });
  }

  // Get categories with IDs
  const dbCategories = await db.select().from(schema.categories);
  const categoryMap = new Map(dbCategories.map(c => [c.slug, c.id]));

  // 2. Seed Products
  console.log("Seeding products...");
  for (const prod of staticProducts) {
    const categoryId = categoryMap.get(prod.categorySlug);
    if (!categoryId) continue;

    await db.insert(schema.products).values({
      slug: prod.id,
      name: prod.name,
      categoryId: categoryId,
      price: prod.price,
      oldPrice: prod.oldPrice || null,
      badge: prod.badge || null,
      image: prod.image,
      description: prod.description,
      specs: prod.specs,
      inStock: prod.inStock,
      rating: prod.rating.toString(),
      reviewCount: prod.reviewCount,
    }).onDuplicateKeyUpdate({ set: { price: prod.price, inStock: prod.inStock } });
  }

  console.log("Seed completed.");
  process.exit(0);
}

seed();
