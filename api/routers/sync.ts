import { z } from "zod";
import { createRouter, publicQuery, protectedProcedure, requireAbility } from "../middleware";
import { getDb } from "../queries/connection";
import * as schema from "../../db/schema";
import { eq, sql, desc } from "drizzle-orm";
import axios from "axios";
import axiosRetry from 'axios-retry';
import fs from "fs";
import path from "path";
import {
  normalizeProductDescriptions,
  rebuildProductSpecIndex,
} from "../lib/product-normalization-service";
import { previewProductNormalization } from "../lib/product-normalization";
import { getAppSetting } from "../lib/app-settings";

const moyskladApi = axios.create({
  baseURL: "https://api.moysklad.ru/api/remap/1.2",
  headers: {
    "Accept-Encoding": "gzip",
  },
});

async function getAuthHeader(input: { login?: string; password?: string }): Promise<string> {
  if (input.login && input.password) {
    return `Basic ${Buffer.from(`${input.login}:${input.password}`).toString("base64")}`;
  }
  const storedToken = await getAppSetting("moysklad_token");
  if (storedToken) {
    return storedToken;
  }
  throw new Error("Не указаны учетные данные и токен МойСклад не найден в настройках");
}

// Auto-retry for rate limits (429)
axiosRetry(moyskladApi, { 
  retries: 5, 
  retryDelay: (retryCount) => {
    console.log(`[Rate Limit] Retrying request... Attempt: ${retryCount}`);
    return retryCount * 2000; // 2s, 4s, 6s...
  },
  retryCondition: (error) => {
    return error.response?.status === 429 || error.response?.status === 500;
  }
});

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function asSpecRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, specValue]) => [
      key,
      String(specValue ?? ""),
    ])
  );
}

function getMsIdFromHref(href?: string | null): string | null {
  return href?.split("/").pop()?.split("?")[0] ?? null;
}

async function fetchAllRows(endpoint: string, authHeader: string, limit = 1000): Promise<any[]> {
  const rows: any[] = [];
  let offset = 0;

  while (true) {
    const separator = endpoint.includes("?") ? "&" : "?";
    const res = await moyskladApi.get(
      `${endpoint}${separator}offset=${offset}&limit=${limit}`,
      { headers: { Authorization: authHeader } }
    );
    const batch = res.data.rows || [];
    rows.push(...batch);

    if (batch.length < limit) break;
    offset += limit;
  }

  return rows;
}

function normalizeStoreText(value?: string | null): string {
  return (value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function findMatchingLocalStore(msStore: any, localStores: typeof schema.stores.$inferSelect[]) {
  const msName = normalizeStoreText(msStore.name);
  const msAddress = normalizeStoreText(msStore.address);

  return localStores.find(localStore => {
    const localName = normalizeStoreText(localStore.name);
    const localAddress = normalizeStoreText(localStore.address);

    if (msName && localName && msName === localName) return true;
    if (msAddress && localAddress && (msAddress.includes(localAddress) || localAddress.includes(msAddress))) return true;
    if (msName && localName && (msName.includes(localName) || localName.includes(msName))) return true;
    if (msName && localAddress && localAddress.includes(msName)) return true;
    if (msAddress && localName && msAddress.includes(localName)) return true;

    return false;
  });
}

function slugify(text: string): string {
    const ru: Record<string, string> = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh',
      'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
      'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c',
      'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ы': 'y', 'э': 'e', 'ю': 'yu', 'я': 'ya',
      ' ': '-', 'ъ': '', 'ь': ''
    };
  
    return text
      .toLowerCase()
      .split('')
      .map(char => ru[char] || (/[a-z0-9-]/.test(char) ? char : ''))
      .join('')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
}

async function downloadImage(
  downloadUrl: string,
  authHeader: string,
  imageId: string,
  folderName: string = "general"
): Promise<string> {
  const baseDir = path.join(process.cwd(), "public", "images", folderName);

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  const filePath = path.join(baseDir, `${imageId}.jpg`);
  const relativePath = `/images/${folderName}/${imageId}.jpg`;

  if (fs.existsSync(filePath)) {
    return relativePath;
  }

  try {
    // Retry wrapper for image downloads
    const getWithRetry = async (url: string, config: any, retries = 3): Promise<any> => {
      try {
        return await axios.get(url, config);
      } catch (err: any) {
        if (err.response?.status === 429 && retries > 0) {
           await delay(3000);
           return getWithRetry(url, config, retries - 1);
        }
        throw err;
      }
    };

    const res302 = await getWithRetry(downloadUrl, {
      headers: { Authorization: authHeader },
      maxRedirects: 0,
      validateStatus: (status: number) => status >= 200 && status < 400,
    });

    let finalUrl = downloadUrl;
    let useConfig: any = { headers: { Authorization: authHeader } };

    if (res302.status === 302 || res302.status === 301) {
      finalUrl = res302.headers.location || downloadUrl;
      useConfig = { headers: {} }; 
    }

    const res = await getWithRetry(finalUrl, {
      ...useConfig,
      responseType: "stream",
    });

    const writer = fs.createWriteStream(filePath);
    res.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", () => resolve(true));
      writer.on("error", reject);
    });

    return relativePath;
  } catch (error: any) {
    console.error(`Ошибка скачивания картинки ${imageId}:`, error.message);
    return "/images/placeholder.jpg";
  }
}

export const syncRouter = createRouter({
  getStores: publicQuery
    .input(z.object({ login: z.string().optional(), password: z.string().optional() }))
    .query(async ({ input }) => {
      const authHeader = await getAuthHeader(input);
      try {
        const rows = await fetchAllRows("/entity/store", authHeader);
        return rows.map((r: any) => ({ id: r.id, name: r.name }));
      } catch (error: any) {
        throw new Error(error.response?.data?.errors?.[0]?.error || "Ошибка получения складов");
      }
    }),

  getCategories: publicQuery
    .input(z.object({ login: z.string().optional(), password: z.string().optional() }))
    .query(async ({ input }) => {
      const authHeader = await getAuthHeader(input);
      try {
        const rows = await fetchAllRows("/entity/productfolder", authHeader);
        return rows.map((r: any) => {
          const parentId = getMsIdFromHref(r.productFolder?.meta?.href);
          return { id: r.id, name: r.name, parentId };
        });
      } catch (error: any) {
        throw new Error(error.response?.data?.errors?.[0]?.error || "Ошибка получения категорий");
      }
    }),

  getLogs: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Sync");
    const db = getDb();
    return await db.select().from(schema.syncLogs).orderBy(desc(schema.syncLogs.createdAt)).limit(50);
  }),

  wipeCatalog: protectedProcedure.mutation(async ({ ctx }) => {
    requireAbility(ctx, "manage", "Sync");
    const db = getDb();
    try {
      // Delete in order to respect dependencies
      await db.execute(sql`DELETE FROM product_stocks`);
      await db.execute(sql`DELETE FROM reviews`);
      await db.execute(sql`DELETE FROM order_items`);
      await db.execute(sql`DELETE FROM products`);
      await db.execute(sql`DELETE FROM categories`);
      return { success: true, message: "Каталог успешно очищен" };
    } catch (error: any) {
      throw new Error("Ошибка при очистке каталога: " + error.message);
    }
  }),

  runSync: protectedProcedure
    .input(z.object({
      login: z.string().optional(),
      password: z.string().optional(),
      syncProducts: z.boolean(),
      syncStocks: z.boolean(),
      syncPrices: z.boolean(),
      selectedStores: z.array(z.string()).optional(),
      selectedCategories: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "sync", "Sync");
      let fileLogContent = `=== Синхронизация МойСклад [${new Date().toISOString()}] ===\n\n`;
      const writeLog = (msg: string) => {
        console.log(msg);
        fileLogContent += `[${new Date().toISOString()}] ${msg}\n`;
      };

      writeLog("Starting filtered MoySklad sync...");
      const authHeader = await getAuthHeader(input);
      const db = getDb();
      
      const logDetails: any = { steps: [], errors: [], stats: { categories: 0, products: 0, stocks: 0 }, logFileUrl: null };
      let currentLogId: number | null = null;

      const saveLogFile = () => {
        try {
          const logsDir = path.join(process.cwd(), "public", "logs");
          if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
          const fileName = `sync_${Date.now()}.log`;
          fs.writeFileSync(path.join(logsDir, fileName), fileLogContent);
          logDetails.logFileUrl = `/logs/${fileName}`;
        } catch (e) {
          console.error("Failed to save log file", e);
        }
      };

      try {
        const [logRes] = await db.insert(schema.syncLogs).values({
            type: 'moysklad',
            status: 'running',
            message: 'Синхронизация запущена',
            details: logDetails
        });
        currentLogId = logRes.insertId;

        const updateLog = async (status: string, message: string) => {
            if (currentLogId) {
                await db.update(schema.syncLogs).set({ status, message, details: logDetails }).where(eq(schema.syncLogs.id, currentLogId));
            }
        };

        // 1. Категории
        const categoryMap = new Map<string, number>();
        if (input.syncProducts && input.selectedCategories && input.selectedCategories.length > 0) {
          logDetails.steps.push("Синхронизация категорий");
          await updateLog('running', 'Синхронизация категорий...');
          writeLog("Fetching folders...");
          
          const msFolders = await fetchAllRows("/entity/productfolder", authHeader);
          writeLog(`Found ${msFolders.length} folders in MoySklad`);

          for (const msFolder of msFolders) {
            if (!input.selectedCategories.includes(msFolder.id)) continue;
            const existing = await db.select().from(schema.categories).where(eq(schema.categories.msId, msFolder.id)).limit(1);
            if (existing.length > 0) {
              await db.update(schema.categories).set({ name: msFolder.name }).where(eq(schema.categories.id, existing[0].id));
              categoryMap.set(msFolder.id, existing[0].id);
            } else {
              const baseSlug = slugify(msFolder.name).substring(0, 200);
              let slug = baseSlug;
              let counter = 1;
              while ((await db.select().from(schema.categories).where(eq(schema.categories.slug, slug)).limit(1)).length > 0) {
                slug = `${baseSlug}-${counter++}`;
              }
              const [res] = await db.insert(schema.categories).values({ 
                msId: msFolder.id,
                slug: slug, 
                name: msFolder.name 
              });
              categoryMap.set(msFolder.id, res.insertId);
            }
            logDetails.stats.categories++;
          }

          for (const msFolder of msFolders) {
            if (!input.selectedCategories.includes(msFolder.id)) continue;
            if (msFolder.productFolder?.meta?.href) {
              const msParentId = getMsIdFromHref(msFolder.productFolder.meta.href);
              if (!msParentId) continue;
              const dbParentId = categoryMap.get(msParentId);
              const dbChildId = categoryMap.get(msFolder.id);
              if (dbParentId && dbChildId) {
                await db.update(schema.categories).set({ parentId: dbParentId }).where(eq(schema.categories.id, dbChildId));
              }
            }
          }
        }

        const allCategories = await db.select().from(schema.categories);

        // 2. Склады (Магазины)
        logDetails.steps.push("Синхронизация складов");
        await updateLog('running', 'Синхронизация складов...');
        writeLog("Fetching stores...");
        
        let localStores = await db.select().from(schema.stores);
        const msStoreIdToLocalId = new Map<string, number>();
        const allMsStores = await fetchAllRows("/entity/store", authHeader);
        writeLog(`Found ${allMsStores.length} stores in MoySklad`);

        if (input.selectedStores && input.selectedStores.length > 0) {
          const selectedMsStores = allMsStores.filter((s: any) => input.selectedStores!.includes(s.id));
          for (const msStore of selectedMsStores) {
            let existing = findMatchingLocalStore(msStore, localStores);
            if (!existing) {
              const [insertRes] = await db.insert(schema.stores).values({
                msId: msStore.id,
                name: msStore.name,
                address: msStore.address || msStore.name,
                hours: "Ежедневно", phone: "+7 (000) 000-00-00", image: "/images/store-placeholder.jpg",
              });
              existing = { id: insertRes.insertId } as any;
            } else if (!existing.msId || existing.msId !== msStore.id) {
              await db
                .update(schema.stores)
                .set({ msId: msStore.id })
                .where(eq(schema.stores.id, existing.id));
            }
          }
          localStores = await db.select().from(schema.stores);
        }

        for (const msStore of allMsStores) {
          const matched = findMatchingLocalStore(msStore, localStores);
          if (matched) {
            msStoreIdToLocalId.set(msStore.id, matched.id);
            if (!matched.msId || matched.msId !== msStore.id) {
              await db
                .update(schema.stores)
                .set({ msId: msStore.id })
                .where(eq(schema.stores.id, matched.id));
            }
          }
        }
        writeLog(`Mapped MS stores to local DB stores: ${Array.from(msStoreIdToLocalId.entries()).map(([k,v]) => `${k}=>${v}`).join(', ')}`);

        // 3. Товары
        logDetails.steps.push("Синхронизация товаров");
        await updateLog('running', 'Синхронизация товаров...');
        
        let offset = 0;
        const limit = 500;
        let hasMore = true;
        const msProductIdToLocalId = new Map<string, number>();

        const fetchAssortmentWithRetry = async (currentOffset: number, retries = 5): Promise<any> => {
          try {
            return await moyskladApi.get(`/entity/assortment?offset=${currentOffset}&limit=${limit}`, { headers: { Authorization: authHeader } });
          } catch (err: any) {
            if (err.response?.status === 429 && retries > 0) {
               writeLog(`[Rate Limit] 429 hitting assortment fetch. Retrying in 5 seconds... (${retries} left)`);
               await delay(5000);
               return fetchAssortmentWithRetry(currentOffset, retries - 1);
            }
            throw err;
          }
        };

        while (hasMore) {
          writeLog(`Fetching assortment offset ${offset}...`);
          const assortmentRes = await fetchAssortmentWithRetry(offset);
          const items = assortmentRes.data.rows;
          if (items.length < limit) hasMore = false;
          offset += limit;

          for (const item of items) {
            // Respect API rate limits (approx 3 req/sec max)
            await delay(333);

            if (item.meta.type !== "product") continue;
            const msId = item.id;
            const folderIdRaw = item.productFolder?.meta?.href ? item.productFolder.meta.href.split("/").pop() : null;
            const folderId = folderIdRaw ? folderIdRaw.split("?")[0] : null;

            if (input.selectedCategories && folderId && !input.selectedCategories.includes(folderId)) continue;

            let categoryId: number | null = null;
            let folderSlug = "general";

            if (folderId) {
                const dbCategory = allCategories.find(c => c.msId === folderId);
                if (dbCategory) {
                    categoryId = dbCategory.id;
                    folderSlug = dbCategory.slug;
                }
            }

            if (!categoryId && allCategories.length > 0) categoryId = allCategories[0].id;

            const price = input.syncPrices && item.salePrices?.length > 0 ? Math.round(item.salePrices[0].value / 100) : 0;
            const inStock = input.syncStocks ? (item.stock || 0) > 0 : true;

            const specs: Record<string, string> = {};
            if (item.attributes) {
              for (const attr of item.attributes) {
                let val = attr.value;
                if (typeof val === "object" && val !== null && val.name) val = val.name;
                specs[attr.name] = String(val);
              }
            }

            let imagePath = "/images/placeholder.jpg";
            if (item.images?.meta?.href) {
              try {
                // Must use moyskladApi to get the 429 retry protection
                const imagesRes = await moyskladApi.get(item.images.meta.href, { headers: { Authorization: authHeader } });
                if (imagesRes.data.rows?.length > 0) {
                  const mainImage = imagesRes.data.rows[0];
                  if (mainImage.meta.downloadHref) imagePath = await downloadImage(mainImage.meta.downloadHref, authHeader, mainImage.id || msId, folderSlug);
                }
              } catch (err: any) {
                writeLog(`Error fetching image meta for product ${msId}: ${err.message}`);
              }
            }

            const existingProd = await db.select().from(schema.products).where(eq(schema.products.msId, msId)).limit(1);
            let dbProductId: number;

            if (existingProd.length > 0) {
              dbProductId = existingProd[0].id;
              const normalizedLog = await db
                .select({ id: schema.productNormalizationLogs.id })
                .from(schema.productNormalizationLogs)
                .where(sql`${schema.productNormalizationLogs.productId} = ${dbProductId} AND ${schema.productNormalizationLogs.status} = 'applied'`)
                .limit(1);
              const wasNormalized = normalizedLog.length > 0;
              const incomingDescription = item.description || "";
              const localSpecs = asSpecRecord(existingProd[0].specs);
              const updateData: any = { name: item.name };

              if (wasNormalized) {
                const preview = previewProductNormalization(incomingDescription, {
                  ...localSpecs,
                  ...specs,
                });
                updateData.description = existingProd[0].description;
                updateData.specs = preview.mergedSpecs;
                logDetails.stats.preservedDescriptions = (logDetails.stats.preservedDescriptions || 0) + 1;
              } else {
                updateData.description = incomingDescription;
                updateData.specs = specs;
              }

              if (input.syncPrices) updateData.price = price;
              if (input.syncStocks) updateData.inStock = inStock;
              if (categoryId) updateData.categoryId = categoryId;
              if (imagePath !== "/images/placeholder.jpg") updateData.image = imagePath;
              await db.update(schema.products).set(updateData).where(eq(schema.products.id, dbProductId));
            } else {
              const baseSlug = slugify(item.name).substring(0, 200);
              let slug = baseSlug;
              let counter = 1;
              while ((await db.select().from(schema.products).where(eq(schema.products.slug, slug)).limit(1)).length > 0) {
                slug = `${baseSlug}-${counter++}`;
              }

              const [res] = await db.insert(schema.products).values({
                msId,
                slug: slug, 
                name: item.name, 
                categoryId: categoryId || 1, 
                price, 
                description: item.description || "", 
                image: imagePath, 
                specs, 
                inStock,
              });
              dbProductId = res.insertId;
            }
            msProductIdToLocalId.set(msId, dbProductId);
            logDetails.stats.products++;
          }
        }

        // 4. Остатки
        if (input.syncStocks) {
          const existingProducts = await db
            .select({ id: schema.products.id, msId: schema.products.msId })
            .from(schema.products);
          for (const product of existingProducts) {
            if (product.msId && !msProductIdToLocalId.has(product.msId)) {
              msProductIdToLocalId.set(product.msId, product.id);
            }
          }

          logDetails.steps.push("Синхронизация остатков");
          await updateLog('running', 'Синхронизация остатков...');
          writeLog("Fetching detailed stock report by store...");
          await db.execute(sql`DELETE FROM product_stocks`);
          
          let stockOffset = 0;
          let stockHasMore = true;

          const fetchStockWithRetry = async (currentOffset: number, retries = 5): Promise<any> => {
            try {
              return await moyskladApi.get(`/report/stock/bystore?offset=${currentOffset}&limit=1000`, { headers: { Authorization: authHeader } });
            } catch (err: any) {
              if (err.response?.status === 429 && retries > 0) {
                 writeLog(`[Rate Limit] 429 hitting stock fetch. Retrying in 5 seconds... (${retries} left)`);
                 await delay(5000);
                 return fetchStockWithRetry(currentOffset, retries - 1);
              }
              throw err;
            }
          };

          while (stockHasMore) {
            writeLog(`Fetching stocks offset ${stockOffset}...`);
            const stockRes = await fetchStockWithRetry(stockOffset);
            const stockItems = stockRes.data.rows;
            writeLog(`Got ${stockItems.length} stock items from API.`);
            if (stockItems.length < 1000) stockHasMore = false;
            stockOffset += 1000;

            for (const item of stockItems) {
              // meta.href might look like "https://.../entity/product/cbfcce03-9560-11f0-0a80-10030006c3a6?expand=supplier"
              const msProductId = getMsIdFromHref(item.meta?.href);
              if (!msProductId) {
                writeLog(`[DEBUG SKIP] stock item has no product href: ${JSON.stringify(item.meta)}`);
                continue;
              }

              const localProductId = msProductIdToLocalId.get(msProductId);
              if (!localProductId || !item.stockByStore) {
                 if (!localProductId) writeLog(`[DEBUG SKIP] msProductId ${msProductId} has no mapping to localProductId.`);
                 if (!item.stockByStore) writeLog(`[DEBUG SKIP] item ${msProductId} has no stockByStore array.`);
                 continue;
              }

              for (const storeStock of item.stockByStore) {
                const quantity = storeStock.stock || 0;
                if (quantity <= 0) continue;
                
                let msStoreId = "";
                if (storeStock.meta?.href) {
                  msStoreId = getMsIdFromHref(storeStock.meta.href) || "";
                }

                if (!msStoreId) {
                  writeLog(`[DEBUG STOCK] No msStoreId found in storeStock: ${JSON.stringify(storeStock)}`);
                  continue;
                }

                if (input.selectedStores && input.selectedStores.length > 0 && !input.selectedStores.includes(msStoreId)) {
                   writeLog(`[DEBUG STOCK] Store ${msStoreId} has stock but was skipped because it's not in selectedStores.`);
                   continue;
                }

                const localStoreId = msStoreIdToLocalId.get(msStoreId);
                if (localStoreId) {
                  writeLog(`[DEBUG STOCK] Inserting stock: product=${localProductId}, store=${localStoreId}, qty=${quantity}`);
                  await db.insert(schema.productStocks).values({ productId: localProductId, storeId: localStoreId, quantity });
                  logDetails.stats.stocks++;
                } else {
                  writeLog(`[DEBUG STOCK] Missed match: msStoreId=${msStoreId}, storeName=${storeStock.name}. Cannot link to local DB.`);
                }
              }
            }
          }
        }

        if (input.syncProducts) {
          logDetails.steps.push("Нормализация характеристик");
          await updateLog('running', 'Нормализация характеристик...');
          writeLog("Normalizing description specs after MoySklad sync...");
          const normalization = await normalizeProductDescriptions({
            limit: 10000,
            examplesLimit: 5,
            source: "moysklad",
            apply: true,
            skipConflicts: true,
            rebuildIndex: true,
          });
          logDetails.stats.normalizedProducts = normalization.appliedProducts;
          logDetails.stats.normalizedSpecs = normalization.movedSpecs;
          logDetails.stats.normalizationConflicts = normalization.conflictCount;
          writeLog(
            `Normalization completed. Applied products: ${normalization.appliedProducts}, moved specs: ${normalization.movedSpecs}, conflicts: ${normalization.conflictCount}`
          );
        } else {
          logDetails.steps.push("Переиндексация характеристик");
          await updateLog('running', 'Переиндексация характеристик...');
          const indexResult = await rebuildProductSpecIndex(10000);
          logDetails.stats.indexedSpecValues = indexResult.indexedValues;
          writeLog(`Spec index rebuilt. Products: ${indexResult.indexedProducts}, values: ${indexResult.indexedValues}`);
        }

        writeLog(`Sync completed successfully. Categories: ${logDetails.stats.categories}, Products: ${logDetails.stats.products}, Stocks: ${logDetails.stats.stocks}`);
        saveLogFile();
        await updateLog('success', 'Синхронизация успешно завершена');
        return { success: true, message: "Синхронизация успешно завершена" };
      } catch (error: any) {
        writeLog(`[ERROR] ${error.message}`);
        if (error.response?.data) writeLog(`[ERROR DATA] ${JSON.stringify(error.response.data)}`);
        
        saveLogFile();
        logDetails.errors.push(error.message);
        if (currentLogId) {
          await db.update(schema.syncLogs).set({
            status: 'error', message: 'Ошибка: ' + error.message, details: logDetails
          }).where(eq(schema.syncLogs.id, currentLogId));
        } else {
          await db.insert(schema.syncLogs).values({
            type: 'moysklad', status: 'error', message: 'Ошибка: ' + error.message, details: logDetails
          });
        }
        throw new Error(error.response?.data?.errors?.[0]?.error || "Ошибка синхронизации");
      }
    }),
});
