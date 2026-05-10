import { getDb } from "../api/queries/connection";
import * as schema from "./schema";
import {
  products as staticProducts,
  categories as staticCategories,
  homeCategories,
} from "../src/data/products";
import { sql } from "drizzle-orm";

async function seed() {
  const db = getDb();
  console.log("Seeding database...");

  // Clear existing data to prevent duplicates
  console.log("Cleaning up old data...");
  await db.execute(sql`DELETE FROM product_stocks`);
  await db.execute(sql`DELETE FROM banners`);
  await db.execute(sql`DELETE FROM stores`);
  await db.execute(sql`DELETE FROM categories`);

  // 1. Seed Categories
  console.log("Seeding categories...");
  const categoriesToSeed = [
    ...staticCategories,
    ...homeCategories.filter(
      hc => !staticCategories.find(sc => sc.slug === hc.slug)
    ),
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
    });
  }

  // Add subcategories
  const dbCats = await db.select().from(schema.categories);
  const autoMotoCatId = dbCats.find(c => c.slug === "auto-moto")?.id;
  if (autoMotoCatId) {
    const autoSubs = [
      { slug: "fm-transmitters", name: "FM трансмиттеры и Bluetooth адаптеры" },
      { slug: "autocosmetics", name: "Автокосметика" },
      { slug: "car-holders", name: "Автомобильные держатели" },
      { slug: "car-chargers", name: "Автомобильные зарядные устройства" },
      { slug: "car-pumps", name: "Автомобильные насосы" },
      { slug: "car-vacuums", name: "Автомобильные пылесосы" },
      { slug: "car-fragrances", name: "Ароматизаторы в авто" },
      { slug: "moto-acc", name: "Вело/мото аксессуары" },
      { slug: "dash-cams", name: "Видеорегистраторы" },
      { slug: "parking-cards", name: "Парковочные автовизитки" },
      { slug: "portable-lighter", name: "Портативный прикуриватель" },
      { slug: "jump-starters", name: "Пуско-зарядные устройства" },
      { slug: "car-care", name: "Уход за авто" },
    ];
    for (const sub of autoSubs) {
      await db.insert(schema.categories).values({
        ...sub,
        parentId: autoMotoCatId,
        sortOrder: 100,
      });
    }

    const holdersId = (await db.select().from(schema.categories)).find(
      c => c.slug === "car-holders"
    )?.id;
    if (holdersId) {
      const holderSubs = [
        { slug: "phone-holders", name: "Держатели для телефонов" },
        {
          slug: "wireless-chargers-holders",
          name: "Держатели с беспроводной зарядкой",
        },
        { slug: "holder-plates", name: "Пластина для автодержателей" },
      ];
      for (const sub of holderSubs) {
        await db.insert(schema.categories).values({
          ...sub,
          parentId: holdersId,
          sortOrder: 100,
        });
      }
    }
  }

  // Refresh categories with IDs
  const dbCategories = await db.select().from(schema.categories);
  const categoryMap = new Map(dbCategories.map(c => [c.slug, c.id]));

  // 2. Seed Products
  console.log("Seeding products...");
  for (const prod of staticProducts) {
    const categoryId = categoryMap.get(prod.categorySlug);
    if (!categoryId) continue;

    await db
      .insert(schema.products)
      .values({
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
      })
      .onDuplicateKeyUpdate({
        set: {
          price: prod.price,
          inStock: prod.inStock,
          rating: prod.rating.toString(),
          reviewCount: prod.reviewCount,
        },
      });
  }

  // 3. Seed Stores
  console.log("Seeding stores...");
  const stores = [
    {
      name: "пр. Строителей, 50А",
      address: "пр. Строителей, 50А",
      hours: "Ежедневно 9:00–21:00",
      phone: "+7 (927) 364-28-88",
      rating: "4.9",
      reviewCount: 34,
      image: "/images/stores/stroiteley-50a.webp",
      mapUrl:
        "https://yandex.com/maps/org/tekhaks/81538152780/?indoorLevel=1&ll=44.920957%2C53.222379&z=17.64",
      sortOrder: 0,
    },
    {
      name: "ул. Генерала Глазунова, 1",
      address: "ул. Генерала Глазунова, 1",
      hours: "Ежедневно 9:00–21:00",
      phone: "+7 (927) 364-28-88",
      rating: "5.0",
      reviewCount: 43,
      image: "/images/stores/glazunova-1.webp",
      mapUrl:
        "https://yandex.com/maps/org/tekhaks/204121927664/?indoorLevel=1&ll=44.878736%2C53.232707&z=17",
      sortOrder: 1,
    },
  ];

  for (const store of stores) {
    await db
      .insert(schema.stores)
      .values(store)
      .onDuplicateKeyUpdate({ set: store });
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
      sortOrder: 0,
    },
  ];

  for (const banner of banners) {
    await db
      .insert(schema.banners)
      .values(banner)
      .onDuplicateKeyUpdate({ set: banner });
  }

  // Seed Stocks
  console.log("Seeding stocks...");
  const allProducts = await db.select().from(schema.products);
  const allStores = await db.select().from(schema.stores);

  for (const product of allProducts) {
    for (const store of allStores) {
      // Random stock quantity between 0 and 15
      const quantity = Math.floor(Math.random() * 16);
      await db
        .insert(schema.productStocks)
        .values({
          productId: product.id,
          storeId: store.id,
          quantity,
        })
        .onDuplicateKeyUpdate({ set: { quantity } });
    }
  }

  console.log("Seed completed.");
  process.exit(0);
}

seed();
