import { getDb } from "../api/queries/connection";
import * as schema from "./schema";
import { products as staticProducts, categories as staticCategories, homeCategories } from "../src/data/products";

async function seed() {
  const db = getDb();
  console.log("Seeding database...");

  // 1. Seed Categories
  console.log("Seeding categories...");
  const categoriesToSeed = [
    ...staticCategories.filter(c => c.slug !== "all"),
    ...homeCategories.filter(hc => !staticCategories.find(sc => sc.slug === hc.slug))
  ];

  for (let i = 0; i < categoriesToSeed.length; i++) {
    const cat = categoriesToSeed[i];
    const homeCat = homeCategories.find(hc => hc.slug === cat.slug);
    
    await db.insert(schema.categories).values({
      slug: cat.slug,
      name: cat.name,
      description: homeCat?.description || null,
      icon: homeCat?.icon || "Smartphone",
      sortOrder: i,
    }).onDuplicateKeyUpdate({ 
      set: { 
        name: cat.name, 
        description: homeCat?.description || null,
        icon: homeCat?.icon || "Smartphone",
        sortOrder: i 
      } 
    });
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
    }).onDuplicateKeyUpdate({ 
      set: { 
        price: prod.price, 
        inStock: prod.inStock,
        rating: prod.rating.toString(),
        reviewCount: prod.reviewCount
      } 
    });
  }

  // 3. Seed Stores
  console.log("Seeding stores...");
  const stores = [
    {
      name: "пр. Строителей, 50А",
      address: "пр. Строителей, 50А",
      hours: "Ежедневно 9:00–21:00",
      phone: "+7 (927) 375-05-55",
      rating: "4.9",
      reviewCount: 31,
      image: "/images/store-stroiteley.jpg",
      mapUrl: "https://yandex.ru/maps/?text=%D0%BF%D1%80.+%D0%A1%D1%82%D1%80%D0%BE%D0%B8%D1%82%D0%B5%D0%BB%D0%B5%D0%B9%2C+50%D0%90+%D0%9F%D0%B5%D0%BD%D0%B7%D0%B0",
      sortOrder: 0
    },
    {
      name: "ул. Генерала Глазунова, 1",
      address: "ул. Генерала Глазунова, 1 (ТЦ Застава)",
      hours: "Ежедневно 9:00–21:00",
      phone: "+7 (927) 375-05-55",
      rating: "4.9",
      reviewCount: 35,
      image: "/images/store-glazunova.jpg",
      mapUrl: "https://yandex.ru/maps/?text=%D1%83%D0%BB.+%D0%93%D0%B5%D0%BD%D0%B5%D1%80%D0%B0%D0%BB%D0%B0+%D0%93%D0%BB%D0%B0%D0%B7%D1%83%D0%BD%D0%BE%D0%B2%D0%B0%2C+1+%D0%9F%D0%B5%D0%BD%D0%B7%D0%B0",
      sortOrder: 1
    }
  ];

  for (const store of stores) {
    await db.insert(schema.stores).values(store).onDuplicateKeyUpdate({ set: store });
  }

  // 4. Seed Banners
  console.log("Seeding banners...");
  const banners = [
    {
      title: "Новое поступление HONOR X8b",
      subtitle: "Ультратонкий дизайн и камера 108 МП",
      image: "/images/blog-1.jpg",
      link: "/product/honor-x8b",
      active: true,
      sortOrder: 0
    }
  ];

  for (const banner of banners) {
    await db.insert(schema.banners).values(banner).onDuplicateKeyUpdate({ set: banner });
  }

  console.log("Seed completed.");
  process.exit(0);
}

seed();
