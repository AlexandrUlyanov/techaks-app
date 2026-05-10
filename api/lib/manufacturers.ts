import { asc, desc, eq } from "drizzle-orm";
import * as schema from "../../db/schema";
import { getDb } from "../queries/connection";
import { getAppSettings } from "./app-settings";
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
  }

  const existingByNormalized = new Map(
    existingRows.map(row => [row.normalizedName, row])
  );
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
    const canUpgradePlaceholder =
      Boolean(row.website) &&
      Boolean(row.logoUrl) &&
      String(row.logoUrl).startsWith("data:image/svg+xml");

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

  return rows.filter(row =>
    input?.withProductsOnly ? row.productCount > 0 : true
  );
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

export async function getVisibleManufacturerCatalogEntries() {
  const rows = await getManufacturers({
    onlyVisible: true,
    withProductsOnly: true,
  });

  return rows.map(row => ({
    id: row.id,
    title: row.name,
    slug: row.slug,
    href: `/catalog?view=brands&brand=${row.slug}`,
    logo: row.logoUrl || buildPlaceholderLogoDataUrl(row.name),
    productCount: row.productCount,
  }));
}
