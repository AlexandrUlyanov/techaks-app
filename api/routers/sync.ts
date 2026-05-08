import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import * as schema from "../../db/schema";
import { eq, sql, desc } from "drizzle-orm";
import axios from "axios";
import fs from "fs";
import path from "path";

const moyskladApi = axios.create({
  baseURL: "https://api.moysklad.ru/api/remap/1.2",
  headers: {
    "Accept-Encoding": "gzip",
  },
});

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
    const res302 = await axios.get(downloadUrl, {
      headers: { Authorization: authHeader },
      maxRedirects: 0,
      validateStatus: status => status >= 200 && status < 400,
    });

    let finalUrl = downloadUrl;
    let useConfig: any = { headers: { Authorization: authHeader } };

    if (res302.status === 302 || res302.status === 301) {
      finalUrl = res302.headers.location || downloadUrl;
      useConfig = { headers: {} }; 
    }

    const res = await axios.get(finalUrl, {
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
    .input(z.object({ login: z.string(), password: z.string() }))
    .query(async ({ input }) => {
      const authHeader = `Basic ${Buffer.from(`${input.login}:${input.password}`).toString("base64")}`;
      try {
        const res = await moyskladApi.get("/entity/store", { headers: { Authorization: authHeader } });
        return res.data.rows.map((r: any) => ({ id: r.id, name: r.name }));
      } catch (error: any) {
        throw new Error(error.response?.data?.errors?.[0]?.error || "Ошибка получения складов");
      }
    }),

  getCategories: publicQuery
    .input(z.object({ login: z.string(), password: z.string() }))
    .query(async ({ input }) => {
      const authHeader = `Basic ${Buffer.from(`${input.login}:${input.password}`).toString("base64")}`;
      try {
        const res = await moyskladApi.get("/entity/productfolder", { headers: { Authorization: authHeader } });
        return res.data.rows.map((r: any) => {
          let parentId = null;
          if (r.productFolder?.meta?.href) {
            parentId = r.productFolder.meta.href.split("/").pop()?.split("?")[0];
          }
          return { id: r.id, name: r.name, parentId };
        });
      } catch (error: any) {
        throw new Error(error.response?.data?.errors?.[0]?.error || "Ошибка получения категорий");
      }
    }),

  getLogs: publicQuery.query(async () => {
    const db = getDb();
    return await db.select().from(schema.syncLogs).orderBy(desc(schema.syncLogs.createdAt)).limit(50);
  }),

  wipeCatalog: publicQuery.mutation(async () => {
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

  runSync: publicQuery
    .input(z.object({
      login: z.string(),
      password: z.string(),
      syncProducts: z.boolean(),
      syncStocks: z.boolean(),
      syncPrices: z.boolean(),
      selectedStores: z.array(z.string()).optional(),
      selectedCategories: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      let fileLogContent = `=== Синхронизация МойСклад [${new Date().toISOString()}] ===\n\n`;
      const writeLog = (msg: string) => {
        console.log(msg);
        fileLogContent += `[${new Date().toISOString()}] ${msg}\n`;
      };

      writeLog("Starting filtered MoySklad sync...");
      const authHeader = `Basic ${Buffer.from(`${input.login}:${input.password}`).toString("base64")}`;
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
          
          const foldersRes = await moyskladApi.get("/entity/productfolder", { headers: { Authorization: authHeader } });
          const msFolders = foldersRes.data.rows;
          writeLog(`Found ${msFolders.length} folders in MoySklad`);

          for (const msFolder of msFolders) {
            if (!input.selectedCategories.includes(msFolder.id)) continue;
            const existing = await db.select().from(schema.categories).where(eq(schema.categories.msId, msFolder.id)).limit(1);
            if (existing.length > 0) {
              await db.update(schema.categories).set({ name: msFolder.name }).where(eq(schema.categories.id, existing[0].id));
              categoryMap.set(msFolder.id, existing[0].id);
            } else {
              let baseSlug = slugify(msFolder.name).substring(0, 200);
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
              const msParentId = msFolder.productFolder.meta.href.split("/").pop();
              const dbParentId = categoryMap.get(msParentId);
              const dbChildId = categoryMap.get(msFolder.id);
              if (dbParentId && dbChildId) {
                await db.update(schema.categories).set({ parentId: dbParentId }).where(eq(schema.categories.id, dbChildId));
              }
            }
          }
        }

        const allCategories = await db.select().from(schema.categories);
        const allCategoryMap = new Map(allCategories.map(c => [c.slug, c.id]));

        // 2. Склады (Магазины)
        logDetails.steps.push("Синхронизация складов");
        await updateLog('running', 'Синхронизация складов...');
        writeLog("Fetching stores...");
        
        let localStores = await db.select().from(schema.stores);
        const msStoreIdToLocalId = new Map<string, number>();
        const storesRes = await moyskladApi.get("/entity/store", { headers: { Authorization: authHeader } });
        const allMsStores = storesRes.data.rows;
        writeLog(`Found ${allMsStores.length} stores in MoySklad`);

        if (input.selectedStores && input.selectedStores.length > 0) {
          const selectedMsStores = allMsStores.filter((s: any) => input.selectedStores!.includes(s.id));
          for (const msStore of selectedMsStores) {
            let existing = localStores.find(ls => ls.name === msStore.name);
            if (!existing) {
              const [insertRes] = await db.insert(schema.stores).values({
                name: msStore.name,
                address: msStore.address || msStore.name,
                hours: "Ежедневно", phone: "+7 (000) 000-00-00", image: "/images/store-placeholder.jpg",
              });
              existing = { id: insertRes.insertId } as any;
            }
          }
          localStores = await db.select().from(schema.stores);
        }

        for (const msStore of allMsStores) {
          const matched = localStores.find(ls => ls.name === msStore.name);
          if (matched) msStoreIdToLocalId.set(msStore.id, matched.id);
        }
        writeLog(`Mapped MS stores to local DB stores: ${Array.from(msStoreIdToLocalId.entries()).map(([k,v]) => `${k}=>${v}`).join(', ')}`);

        // 3. Товары
        logDetails.steps.push("Синхронизация товаров");
        await updateLog('running', 'Синхронизация товаров...');
        
        let offset = 0;
        const limit = 500;
        let hasMore = true;
        const msProductIdToLocalId = new Map<string, number>();

        while (hasMore) {
          writeLog(`Fetching assortment offset ${offset}...`);
          const assortmentRes = await moyskladApi.get(`/entity/assortment?offset=${offset}&limit=${limit}`, { headers: { Authorization: authHeader } });
          const items = assortmentRes.data.rows;
          if (items.length < limit) hasMore = false;
          offset += limit;

          for (const item of items) {
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
                const imagesRes = await axios.get(item.images.meta.href, { headers: { Authorization: authHeader } });
                if (imagesRes.data.rows?.length > 0) {
                  const mainImage = imagesRes.data.rows[0];
                  if (mainImage.meta.downloadHref) imagePath = await downloadImage(mainImage.meta.downloadHref, authHeader, mainImage.id || msId, folderSlug);
                }
              } catch (err) {}
            }

            const existingProd = await db.select().from(schema.products).where(eq(schema.products.msId, msId)).limit(1);
            let dbProductId: number;

            if (existingProd.length > 0) {
              dbProductId = existingProd[0].id;
              const updateData: any = { name: item.name, description: item.description || "", specs };
              if (input.syncPrices) updateData.price = price;
              if (input.syncStocks) updateData.inStock = inStock;
              if (categoryId) updateData.categoryId = categoryId;
              if (imagePath !== "/images/placeholder.jpg") updateData.image = imagePath;
              await db.update(schema.products).set(updateData).where(eq(schema.products.id, dbProductId));
            } else {
              let baseSlug = slugify(item.name).substring(0, 200);
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
          logDetails.steps.push("Синхронизация остатков");
          await updateLog('running', 'Синхронизация остатков...');
          writeLog("Fetching detailed stock report by store...");
          await db.execute(sql`DELETE FROM product_stocks`);
          
          let stockOffset = 0;
          let stockHasMore = true;
          while (stockHasMore) {
            writeLog(`Fetching stocks offset ${stockOffset}...`);
            const stockRes = await moyskladApi.get(`/report/stock/bystore?offset=${stockOffset}&limit=1000`, { headers: { Authorization: authHeader } });
            const stockItems = stockRes.data.rows;
            writeLog(`Got ${stockItems.length} stock items from API.`);
            if (stockItems.length < 1000) stockHasMore = false;
            stockOffset += 1000;

            for (const item of stockItems) {
              // meta.href might look like "https://.../entity/product/cbfcce03-9560-11f0-0a80-10030006c3a6?expand=supplier"
              let msProductId = item.meta.href.split("/").pop();
              if (msProductId && msProductId.includes("?")) {
                  msProductId = msProductId.split("?")[0];
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
                  msStoreId = storeStock.meta.href.split("/").pop();
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
