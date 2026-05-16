import { asc, desc, eq, inArray } from "drizzle-orm";
import * as schema from "../../db/schema";
import { getDb } from "../queries/connection";
import { getAppSettings } from "./app-settings";
import { buildPublicProductVisibilityCondition } from "./product-visibility";
import {
  normalizeSpecKeyForDisplay,
  normalizeSpecToken,
} from "./product-normalization";

const MANUFACTURER_KEYS = new Set(["производитель", "бренд"]);

function slugify(text: string) {
  const map: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "c",
    ч: "ch",
    ш: "sh",
    щ: "shch",
    ы: "y",
    э: "e",
    ю: "yu",
    я: "ya",
    ъ: "",
    ь: "",
    " ": "-",
  };

  return text
    .toLowerCase()
    .split("")
    .map(char => map[char] ?? (/[a-z0-9-]/.test(char) ? char : ""))
    .join("")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 220);
}

function isSpecsRecord(specs: unknown): specs is Record<string, unknown> {
  return Boolean(specs) && typeof specs === "object" && !Array.isArray(specs);
}

function cleanManufacturerName(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[;|]+/g, " ")
    .trim()
    .slice(0, 255);
}

function normalizeTextForManufacturerMatch(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasPhraseBoundaryMatch(haystack: string, needle: string) {
  if (!haystack || !needle) return false;
  let fromIndex = 0;
  while (fromIndex < haystack.length) {
    const index = haystack.indexOf(needle, fromIndex);
    if (index < 0) return false;
    const prev = index === 0 ? " " : haystack[index - 1];
    const next =
      index + needle.length >= haystack.length
        ? " "
        : haystack[index + needle.length];
    if (prev === " " && next === " ") return true;
    fromIndex = index + 1;
  }
  return false;
}

function getManufacturerNameFromTitle(
  title: unknown,
  knownManufacturers: Array<{ normalizedName: string; name: string }>
) {
  const normalizedTitle = normalizeTextForManufacturerMatch(String(title ?? ""));
  if (!normalizedTitle) return null;

  const sortedCandidates = knownManufacturers
    .map(item => ({
      normalizedName: normalizeTextForManufacturerMatch(item.normalizedName),
      name: item.name,
    }))
    .filter(item => item.normalizedName)
    .sort((a, b) => b.normalizedName.length - a.normalizedName.length);

  for (const candidate of sortedCandidates) {
    if (hasPhraseBoundaryMatch(normalizedTitle, candidate.normalizedName)) {
      return candidate.name;
    }
  }

  return null;
}

function getManufacturerNameFromSpecs(specs: unknown) {
  if (!isSpecsRecord(specs)) return null;

  for (const [key, value] of Object.entries(specs)) {
    const normalizedKey = normalizeSpecToken(
      normalizeSpecKeyForDisplay(String(key))
    ).slice(0, 120);
    if (!MANUFACTURER_KEYS.has(normalizedKey)) continue;

    const manufacturerName = cleanManufacturerName(value);
    if (manufacturerName) return manufacturerName;
  }

  return null;
}

function getInitials(name: string) {
  const parts = name
    .split(/\s+/)
    .map(part => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return "BR";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function buildPlaceholderLogoDataUrl(name: string) {
  const initials = getInitials(name);
  const colors = [
    "#0F172A",
    "#1F2937",
    "#0B3B52",
    "#0A4A6A",
    "#0A6A7E",
    "#1E293B",
  ];
  const colorIndex =
    name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) %
    colors.length;
  const background = colors[colorIndex];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" rx="36" fill="${background}"/><text x="50%" y="54%" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="88" font-weight="700" fill="#ffffff">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function isPlaceholderLogo(logoUrl: string | null) {
  return Boolean(logoUrl) && String(logoUrl).startsWith("data:image/svg+xml");
}

function normalizeWebsite(website: string | null) {
  const trimmed = String(website ?? "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function extractDomain(website: string | null) {
  const normalizedWebsite = normalizeWebsite(website);
  if (!normalizedWebsite) return "";

  try {
    return new URL(normalizedWebsite).hostname.replace(/^www\./i, "");
  } catch {
    return normalizedWebsite
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .trim();
  }
}

function buildLogoDevDomainUrl(domain: string, token: string) {
  return `https://img.logo.dev/${encodeURIComponent(
    domain
  )}?token=${encodeURIComponent(
    token
  )}&format=png&size=256&retina=true&fallback=404`;
}

function buildLogoDevNameUrl(name: string, token: string) {
  return `https://img.logo.dev/name/${encodeURIComponent(
    name
  )}?token=${encodeURIComponent(
    token
  )}&format=png&size=256&retina=true&fallback=404`;
}

async function isReachableImage(url: string) {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        Accept: "image/png,image/*;q=0.9,*/*;q=0.1",
      },
    });
    if (!response.ok) return false;
    const contentType = response.headers.get("content-type") || "";
    return contentType.startsWith("image/");
  } catch {
    return false;
  }
}

async function resolveRemoteLogoUrl(input: {
  name: string;
  website: string | null;
  provider: string;
  logoDevToken: string;
}) {
  const provider = input.provider || "logo_dev";
  if (provider !== "logo_dev" || !input.logoDevToken.trim()) {
    return null;
  }

  const domain = extractDomain(input.website);
  const candidates = [
    domain ? buildLogoDevDomainUrl(domain, input.logoDevToken) : "",
    buildLogoDevNameUrl(input.name, input.logoDevToken),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (await isReachableImage(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function getManufacturerLogoConfig() {
  const settings = await getAppSettings([
    "manufacturer_logo_provider",
    "manufacturer_logo_logo_dev_token",
  ]);

  return {
    provider: settings.manufacturer_logo_provider?.trim() || "logo_dev",
    logoDevToken: settings.manufacturer_logo_logo_dev_token?.trim() || "",
  };
}

function ensureUniqueSlug(
  baseName: string,
  usedSlugs: Set<string>,
  fallbackId?: number
) {
  const baseSlug = slugify(baseName) || `brand-${fallbackId ?? Date.now()}`;
  let slug = baseSlug;
  let counter = 2;
  while (usedSlugs.has(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  usedSlugs.add(slug);
  return slug;
}

export async function syncManufacturersFromProducts() {
  const db = getDb();
  const [productRows, existingRows] = await Promise.all([
    db
      .select({
        id: schema.products.id,
        name: schema.products.name,
        categoryId: schema.products.categoryId,
        specs: schema.products.specs,
      })
      .from(schema.products),
    db.select().from(schema.manufacturers),
  ]);

  const counts = new Map<
    string,
    {
      name: string;
      productCount: number;
    }
  >();
  const productManufacturerById = new Map<
    number,
    { normalizedName: string; name: string; categoryId: number }
  >();

  for (const product of productRows) {
    const name = getManufacturerNameFromSpecs(product.specs);
    if (!name) continue;

    const normalizedName = normalizeSpecToken(name).slice(0, 255);
    if (!normalizedName) continue;

    const current = counts.get(normalizedName) ?? {
      name,
      productCount: 0,
    };
    current.productCount += 1;

    if (
      current.name.length < name.length ||
      current.name === current.name.toUpperCase()
    ) {
      current.name = name;
    }

    counts.set(normalizedName, current);
    productManufacturerById.set(product.id, {
      normalizedName,
      name: current.name,
      categoryId: product.categoryId,
    });
  }

  const existingByNormalized = new Map(
    existingRows.map(row => [row.normalizedName, row])
  );
  const knownManufacturersMap = new Map<string, string>();
  for (const row of existingRows) {
    knownManufacturersMap.set(row.normalizedName, row.name);
  }
  for (const [normalizedName, manufacturer] of counts.entries()) {
    if (!knownManufacturersMap.has(normalizedName)) {
      knownManufacturersMap.set(normalizedName, manufacturer.name);
    }
  }
  const knownManufacturers = Array.from(knownManufacturersMap.entries()).map(
    ([normalizedName, name]) => ({ normalizedName, name })
  );

  for (const product of productRows) {
    const hasSpecsManufacturer = Boolean(getManufacturerNameFromSpecs(product.specs));
    if (hasSpecsManufacturer) continue;

    const byTitle = getManufacturerNameFromTitle(product.name, knownManufacturers);
    if (!byTitle) continue;

    const normalizedName = normalizeSpecToken(byTitle).slice(0, 255);
    if (!normalizedName) continue;

    const current = counts.get(normalizedName) ?? {
      name: byTitle,
      productCount: 0,
    };
    current.productCount += 1;
    if (
      current.name.length < byTitle.length ||
      current.name === current.name.toUpperCase()
    ) {
      current.name = byTitle;
    }
    counts.set(normalizedName, current);
    productManufacturerById.set(product.id, {
      normalizedName,
      name: current.name,
      categoryId: product.categoryId,
    });
  }

  const usedSlugs = new Set(existingRows.map(row => row.slug));

  let created = 0;
  let updated = 0;

  for (const [normalizedName, manufacturer] of counts.entries()) {
    const existing = existingByNormalized.get(normalizedName);

    if (existing) {
      await db
        .update(schema.manufacturers)
        .set({
          productCount: manufacturer.productCount,
          updatedAt: new Date(),
        })
        .where(eq(schema.manufacturers.id, existing.id));
      updated++;
      continue;
    }

    const slug = ensureUniqueSlug(manufacturer.name, usedSlugs);
    await db.insert(schema.manufacturers).values({
      name: manufacturer.name,
      normalizedName,
      slug,
      productCount: manufacturer.productCount,
      logoUrl: buildPlaceholderLogoDataUrl(manufacturer.name),
      isVisible: true,
      sortOrder: 0,
    });
    created++;
  }

  let archived = 0;
  for (const existing of existingRows) {
    if (counts.has(existing.normalizedName)) continue;
    await db
      .update(schema.manufacturers)
      .set({
        productCount: 0,
        updatedAt: new Date(),
      })
      .where(eq(schema.manufacturers.id, existing.id));
    archived++;
  }

  const refreshedManufacturers = await db.select().from(schema.manufacturers);
  const manufacturerIdByNormalizedName = new Map(
    refreshedManufacturers.map(row => [row.normalizedName, row.id])
  );
  const categoryManufacturerCounts = new Map<string, number>();

  for (const resolved of productManufacturerById.values()) {
    const manufacturerId = manufacturerIdByNormalizedName.get(
      resolved.normalizedName
    );
    if (!manufacturerId) continue;
    const key = `${manufacturerId}:${resolved.categoryId}`;
    categoryManufacturerCounts.set(key, (categoryManufacturerCounts.get(key) ?? 0) + 1);
  }

  await db.delete(schema.manufacturerCategoryIndex);
  if (categoryManufacturerCounts.size > 0) {
    const values = Array.from(categoryManufacturerCounts.entries()).map(
      ([key, productCount]) => {
        const [manufacturerIdRaw, categoryIdRaw] = key.split(":");
        return {
          manufacturerId: Number(manufacturerIdRaw),
          categoryId: Number(categoryIdRaw),
          productCount,
          updatedAt: new Date(),
        };
      }
    );
    await db.insert(schema.manufacturerCategoryIndex).values(values);
  }

  return {
    success: true,
    found: counts.size,
    created,
    updated,
    archived,
  };
}

export async function collectManufacturerLogos(input?: { force?: boolean }) {
  const db = getDb();
  const config = await getManufacturerLogoConfig();
  const rows = await db
    .select()
    .from(schema.manufacturers)
    .orderBy(desc(schema.manufacturers.productCount), asc(schema.manufacturers.name));

  let searched = 0;
  let found = 0;
  let fallback = 0;
  let updated = 0;
  let preserved = 0;

  for (const row of rows) {
    const canUpgradePlaceholder = isPlaceholderLogo(row.logoUrl);

    if (row.logoUrl && !input?.force && !canUpgradePlaceholder) {
      preserved++;
      continue;
    }

    searched++;
    const remoteLogoUrl = await resolveRemoteLogoUrl({
      name: row.name,
      website: row.website,
      provider: config.provider,
      logoDevToken: config.logoDevToken,
    });
    const logoUrl = remoteLogoUrl || buildPlaceholderLogoDataUrl(row.name);

    if (remoteLogoUrl) {
      found++;
    } else {
      fallback++;
    }

    await db
      .update(schema.manufacturers)
      .set({
        logoUrl,
        updatedAt: new Date(),
      })
      .where(eq(schema.manufacturers.id, row.id));
    updated++;
  }

  return {
    success: true,
    provider: config.provider,
    searched,
    found,
    fallback,
    updated,
    preserved,
    configured: Boolean(config.logoDevToken),
  };
}

export async function getManufacturerBySlug(slug: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.manufacturers)
    .where(eq(schema.manufacturers.slug, slug))
    .limit(1);

  return row ?? null;
}

function getDescendantCategoryIds(
  allCategories: Array<typeof schema.categories.$inferSelect>,
  categoryId: number
) {
  const ids = [categoryId];
  const stack = [categoryId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    const children = allCategories
      .filter(category => category.parentId === current)
      .map(category => category.id);

    for (const childId of children) {
      ids.push(childId);
      stack.push(childId);
    }
  }

  return ids;
}

export async function getManufacturersByCategory(input: {
  categorySlug: string;
  limit?: number;
}) {
  const bySlug = await getManufacturersByCategorySlugs({
    categorySlugs: [input.categorySlug],
    limit: input.limit ?? 12,
  });
  return bySlug[input.categorySlug] ?? [];
}

export async function getManufacturersByCategorySlugs(input: {
  categorySlugs: string[];
  limit?: number;
}) {
  const limit = input.limit ?? 12;
  const uniqueSlugs = Array.from(
    new Set(input.categorySlugs.map(item => item.trim()).filter(Boolean))
  );
  if (uniqueSlugs.length === 0) return {} as Record<string, any[]>;

  if (uniqueSlugs.length === 1 && uniqueSlugs[0] === "all") {
    return {
      all: await getVisibleManufacturerCatalogEntries(limit),
    };
  }

  const db = getDb();
  const allCategories = await db.select().from(schema.categories);
  const slugToCategory = new Map(allCategories.map(item => [item.slug, item]));
  const descendantIdsBySlug = new Map<string, number[]>();
  const categoryIdsToQuery = new Set<number>();

  for (const slug of uniqueSlugs) {
    if (slug === "all") continue;
    const category = slugToCategory.get(slug);
    if (!category) {
      descendantIdsBySlug.set(slug, []);
      continue;
    }
    const descendants = getDescendantCategoryIds(allCategories, category.id);
    descendantIdsBySlug.set(slug, descendants);
    descendants.forEach(id => categoryIdsToQuery.add(id));
  }

  const manufacturerRows = await getManufacturers({
    onlyVisible: true,
    withProductsOnly: true,
  });
  const manufacturerById = new Map(manufacturerRows.map(row => [row.id, row]));

  if (categoryIdsToQuery.size === 0) {
    const emptyResult: Record<string, any[]> = {};
    for (const slug of uniqueSlugs) {
      emptyResult[slug] =
        slug === "all" ? await getVisibleManufacturerCatalogEntries(limit) : [];
    }
    return emptyResult;
  }

  const rows = await db
    .select({
      manufacturerId: schema.manufacturerCategoryIndex.manufacturerId,
      categoryId: schema.manufacturerCategoryIndex.categoryId,
      productCount: schema.manufacturerCategoryIndex.productCount,
    })
    .from(schema.manufacturerCategoryIndex)
    .where(inArray(schema.manufacturerCategoryIndex.categoryId, Array.from(categoryIdsToQuery)));

  const rowsByCategoryId = new Map<number, Array<(typeof rows)[number]>>();
  for (const row of rows) {
    const list = rowsByCategoryId.get(row.categoryId) ?? [];
    list.push(row);
    rowsByCategoryId.set(row.categoryId, list);
  }

  const result: Record<string, any[]> = {};
  for (const slug of uniqueSlugs) {
    if (slug === "all") {
      result[slug] = await getVisibleManufacturerCatalogEntries(limit);
      continue;
    }

    const descendants = descendantIdsBySlug.get(slug) ?? [];
    const countsByManufacturer = new Map<number, number>();
    for (const categoryId of descendants) {
      const scopedRows = rowsByCategoryId.get(categoryId) ?? [];
      for (const row of scopedRows) {
        countsByManufacturer.set(
          row.manufacturerId,
          (countsByManufacturer.get(row.manufacturerId) ?? 0) + Number(row.productCount || 0)
        );
      }
    }

    result[slug] = Array.from(countsByManufacturer.entries())
      .map(([manufacturerId, productCount]) => {
        const manufacturer = manufacturerById.get(manufacturerId);
        if (!manufacturer) return null;
        return {
          id: manufacturer.id,
          title: manufacturer.name,
          slug: manufacturer.slug,
          href: `/catalog?view=brands&brand=${manufacturer.slug}`,
          logo:
            manufacturer.logoUrl || buildPlaceholderLogoDataUrl(manufacturer.name),
          productCount,
          normalizedName: manufacturer.normalizedName,
          sourceNormalizedKey: "производитель",
        };
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          Number(b!.productCount) - Number(a!.productCount) ||
          a!.title.localeCompare(b!.title, "ru")
      )
      .slice(0, limit) as any[];
  }

  return result;
}

export async function getManufacturerByProductSlug(slug: string) {
  const db = getDb();
  const [product] = await db
    .select({
      slug: schema.products.slug,
      name: schema.products.name,
      specs: schema.products.specs,
    })
    .from(schema.products)
    .where(eq(schema.products.slug, slug))
    .limit(1);

  if (!product) return null;

  let manufacturerName = getManufacturerNameFromSpecs(product.specs);
  if (!manufacturerName) {
    const allManufacturers = await db.select().from(schema.manufacturers);
    const knownManufacturers = allManufacturers.map(item => ({
      normalizedName: item.normalizedName,
      name: item.name,
    }));
    manufacturerName = getManufacturerNameFromTitle(
      product.name,
      knownManufacturers
    );
  }
  if (!manufacturerName) return null;

  const normalizedName = normalizeSpecToken(manufacturerName).slice(0, 255);
  const [manufacturer] = await db
    .select()
    .from(schema.manufacturers)
    .where(eq(schema.manufacturers.normalizedName, normalizedName))
    .limit(1);

  if (manufacturer) {
    return {
      id: manufacturer.id,
      title: manufacturer.name,
      slug: manufacturer.slug,
      href: `/catalog?view=brands&brand=${manufacturer.slug}`,
      logo: manufacturer.logoUrl || buildPlaceholderLogoDataUrl(manufacturer.name),
      productCount: manufacturer.productCount,
      normalizedName: manufacturer.normalizedName,
    };
  }

  const slugValue = slugify(manufacturerName);
  return {
    id: 0,
    title: manufacturerName,
    slug: slugValue,
    href: `/catalog?view=brands&brand=${slugValue}`,
    logo: buildPlaceholderLogoDataUrl(manufacturerName),
    productCount: 0,
    normalizedName,
  };
}

export async function getManufacturers(input?: {
  onlyVisible?: boolean;
  withProductsOnly?: boolean;
}) {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.manufacturers)
    .where(
      input?.onlyVisible
        ? eq(schema.manufacturers.isVisible, true)
        : undefined
    )
    .orderBy(
      asc(schema.manufacturers.sortOrder),
      desc(schema.manufacturers.productCount),
      asc(schema.manufacturers.name)
    );

  if (!input?.withProductsOnly) {
    return rows;
  }

  const visibleProducts = await db
    .select({
      specs: schema.products.specs,
    })
    .from(schema.products)
    .where(buildPublicProductVisibilityCondition());

  const visibleCounts = new Map<string, number>();
  for (const product of visibleProducts) {
    const manufacturerName = getManufacturerNameFromSpecs(product.specs);
    if (!manufacturerName) continue;
    const normalizedName = normalizeSpecToken(manufacturerName).slice(0, 255);
    visibleCounts.set(normalizedName, (visibleCounts.get(normalizedName) ?? 0) + 1);
  }

  return rows
    .map(row => ({
      ...row,
      productCount: visibleCounts.get(row.normalizedName) ?? 0,
    }))
    .filter(row => row.productCount > 0);
}

export async function updateManufacturer(input: {
  id: number;
  name: string;
  slug: string;
  website?: string | null;
  logoUrl?: string | null;
  isVisible: boolean;
  sortOrder?: number;
}) {
  const db = getDb();
  const normalizedName = normalizeSpecToken(input.name).slice(0, 255);
  await db
    .update(schema.manufacturers)
    .set({
      name: input.name.trim().slice(0, 255),
      normalizedName,
      slug: input.slug.trim().slice(0, 255),
      website: String(input.website ?? "").trim().slice(0, 255) || null,
      logoUrl: String(input.logoUrl ?? "").trim().slice(0, 512) || null,
      isVisible: input.isVisible,
      sortOrder: input.sortOrder ?? 0,
      updatedAt: new Date(),
    })
    .where(eq(schema.manufacturers.id, input.id));

  return { success: true };
}

export async function getManufacturerMapByNormalizedName() {
  const db = getDb();
  const rows = await db.select().from(schema.manufacturers);
  return new Map(rows.map(row => [row.normalizedName, row]));
}

export function getManufacturerNameFromProductSpecs(specs: unknown) {
  return getManufacturerNameFromSpecs(specs);
}

export function getManufacturerFilterKeys() {
  return Array.from(MANUFACTURER_KEYS);
}

export async function getVisibleManufacturerCatalogEntries(limit?: number) {
  const rows = await getManufacturers({
    onlyVisible: true,
    withProductsOnly: true,
  });

  return rows
    .slice(0, limit ?? rows.length)
    .map(row => ({
      id: row.id,
      title: row.name,
      slug: row.slug,
      href: `/catalog?view=brands&brand=${row.slug}`,
      logo: row.logoUrl || buildPlaceholderLogoDataUrl(row.name),
      productCount: row.productCount,
      normalizedName: row.normalizedName,
      sourceNormalizedKey: "производитель",
    }));
}
