import fs from "fs";
import path from "path";
import { createHash } from "node:crypto";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import axios from "axios";
import sharp from "sharp";

dotenv.config();

const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const MOYSKLAD_BASE_URL = "https://api.moysklad.ru/api/remap/1.2";
const IMAGE_EXTENSION_BY_CONTENT_TYPE = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};

function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getOriginalExtension(downloadUrl, contentType) {
  const normalizedContentType =
    typeof contentType === "string" ? contentType.toLowerCase() : "";
  if (normalizedContentType && IMAGE_EXTENSION_BY_CONTENT_TYPE[normalizedContentType]) {
    return IMAGE_EXTENSION_BY_CONTENT_TYPE[normalizedContentType];
  }

  try {
    const pathname = new URL(downloadUrl).pathname;
    const ext = path.extname(pathname).toLowerCase();
    if (ext) return ext;
  } catch {
    // ignore invalid URL
  }

  return ".jpg";
}

function getExistingVariantMetadata(metaPath) {
  if (!fs.existsSync(metaPath)) return null;

  try {
    return JSON.parse(fs.readFileSync(metaPath, "utf8"));
  } catch {
    return null;
  }
}

function hasAllVariantFiles(variants) {
  if (!variants) return false;

  const expected = [variants.original, variants.thumb, variants.card, variants.medium]
    .filter(value => typeof value === "string" && value.length > 0)
    .map(value =>
      path.join(PUBLIC_DIR, value.replace(/^\/+/, "").replace(/\//g, path.sep))
    );

  return expected.length > 0 && expected.every(filePath => fs.existsSync(filePath));
}

async function writeResponsiveVariant(inputBuffer, outputPath, size) {
  await sharp(inputBuffer)
    .rotate()
    .resize(size, size, {
      fit: "contain",
      withoutEnlargement: true,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .webp({ quality: 82 })
    .toFile(outputPath);
}

async function createProductImageVariants({
  inputBuffer,
  downloadUrl,
  contentType,
  imageId,
  folderName,
}) {
  const baseDir = path.join(PUBLIC_DIR, "images", folderName);
  ensureDirectory(baseDir);

  const fileHash = createHash("sha1").update(inputBuffer).digest("hex");
  const originalExtension = getOriginalExtension(downloadUrl, contentType);
  const originalFileName = `${imageId}-original${originalExtension}`;
  const originalRelativePath = `/images/${folderName}/${originalFileName}`;
  const thumbRelativePath = `/images/${folderName}/${imageId}-thumb.webp`;
  const cardRelativePath = `/images/${folderName}/${imageId}-card.webp`;
  const mediumRelativePath = `/images/${folderName}/${imageId}-medium.webp`;
  const metaPath = path.join(baseDir, `${imageId}.variants.json`);

  const existing = getExistingVariantMetadata(metaPath);
  if (existing?.hash === fileHash && hasAllVariantFiles(existing)) {
    return existing;
  }

  const originalFilePath = path.join(baseDir, originalFileName);
  const thumbFilePath = path.join(baseDir, `${imageId}-thumb.webp`);
  const cardFilePath = path.join(baseDir, `${imageId}-card.webp`);
  const mediumFilePath = path.join(baseDir, `${imageId}-medium.webp`);

  fs.writeFileSync(originalFilePath, inputBuffer);

  await Promise.all([
    writeResponsiveVariant(inputBuffer, thumbFilePath, 120),
    writeResponsiveVariant(inputBuffer, cardFilePath, 400),
    writeResponsiveVariant(inputBuffer, mediumFilePath, 800),
  ]);

  const metadata = await sharp(inputBuffer).metadata();
  const variants = {
    original: originalRelativePath,
    thumb: thumbRelativePath,
    card: cardRelativePath,
    medium: mediumRelativePath,
    hash: fileHash,
    width: metadata.width ?? null,
    height: metadata.height ?? null,
  };

  fs.writeFileSync(metaPath, JSON.stringify(variants, null, 2), "utf8");
  return variants;
}

function parseArgs(argv) {
  const args = {
    slugPrefix: null,
    slug: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === "--slug-prefix" && next) {
      args.slugPrefix = next.trim();
      index += 1;
      continue;
    }

    if (current === "--slug" && next) {
      args.slug = next.trim();
      index += 1;
    }
  }

  return args;
}

async function ensureVariantImagesColumn(connection) {
  const [rows] = await connection.query(
    `
      SELECT COUNT(*) AS count
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'product_variants'
        AND COLUMN_NAME = 'images'
    `
  );

  const count = Number(rows?.[0]?.count ?? 0);
  if (count > 0) return false;

  await connection.query(`
    ALTER TABLE product_variants
      ADD COLUMN images JSON NULL AFTER image_variants
  `);
  return true;
}

async function getMoyskladToken(connection) {
  const envToken = `${process.env.MOYSKLAD_TOKEN ?? ""}`.trim();
  if (envToken) return envToken;

  const [rows] = await connection.query(
    "SELECT value FROM app_settings WHERE `key` = 'moysklad_token' LIMIT 1"
  );
  const storedToken = `${rows?.[0]?.value ?? ""}`.trim();
  if (!storedToken) {
    throw new Error("Не найден токен МойСклад в env или app_settings.");
  }

  return storedToken;
}

function inferFolderName(row) {
  const candidates = [row.variantImage, row.productImage];

  for (const value of candidates) {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (!normalized.startsWith("/images/")) continue;
    const segments = normalized.split("/").filter(Boolean);
    if (segments.length >= 3 && segments[0] === "images") {
      return segments[1];
    }
  }

  return row.productSlug || "general";
}

async function downloadImage(downloadUrl, authHeader, imageId, folderName) {
  const response = await axios.get(downloadUrl, {
    responseType: "arraybuffer",
    headers: { Authorization: authHeader },
    maxRedirects: 5,
    timeout: 60_000,
  });

  const inputBuffer = Buffer.from(response.data);
  return createProductImageVariants({
    inputBuffer,
    downloadUrl: response.request?.res?.responseUrl || downloadUrl,
    contentType: response.headers["content-type"],
    imageId,
    folderName,
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const args = parseArgs(process.argv.slice(2));
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const addedImagesColumn = await ensureVariantImagesColumn(connection);
  const token = await getMoyskladToken(connection);
  const authHeader = `Bearer ${token}`;

  const where = [];
  const params = [];

  if (args.slug) {
    where.push("p.slug = ?");
    params.push(args.slug);
  } else if (args.slugPrefix) {
    where.push("p.slug LIKE ?");
    params.push(`${args.slugPrefix}%`);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await connection.query(
    `
      SELECT
        v.id AS variantId,
        v.ms_id AS variantMsId,
        v.name AS variantName,
        v.image AS variantImage,
        p.id AS productId,
        p.slug AS productSlug,
        p.name AS productName,
        p.image AS productImage
      FROM product_variants v
      INNER JOIN products p ON p.id = v.product_id
      ${whereSql}
      ORDER BY p.id ASC, v.id ASC
    `,
    params
  );

  let processed = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const variantMsId = `${row.variantMsId ?? ""}`.trim();
    if (!variantMsId) {
      skipped += 1;
      continue;
    }

    processed += 1;
    const variantResponse = await axios.get(
      `${MOYSKLAD_BASE_URL}/entity/variant/${variantMsId}`,
      {
        headers: { Authorization: authHeader },
        timeout: 60_000,
      }
    );

    const imageMetaHref = variantResponse.data?.images?.meta?.href;
    if (!imageMetaHref) {
      skipped += 1;
      continue;
    }

    const imagesResponse = await axios.get(imageMetaHref, {
      headers: { Authorization: authHeader },
      timeout: 60_000,
    });

    const imageRows = Array.isArray(imagesResponse.data?.rows)
      ? imagesResponse.data.rows
      : [];
    if (imageRows.length === 0) {
      skipped += 1;
      continue;
    }

    const folderName = `${inferFolderName(row)}/variants`;
    const downloaded = [];

    for (const [index, imageRow] of imageRows.entries()) {
      const downloadHref = imageRow?.meta?.downloadHref;
      if (!downloadHref) continue;

      const variantSet = await downloadImage(
        downloadHref,
        authHeader,
        imageRow.id || `${variantMsId}-${index + 1}`,
        folderName
      );

      if (
        variantSet?.original &&
        !downloaded.some(existing => existing.original === variantSet.original)
      ) {
        downloaded.push(variantSet);
      }
    }

    if (downloaded.length === 0) {
      skipped += 1;
      continue;
    }

    const primary = downloaded[0];
    const primaryImage =
      primary.original || primary.medium || primary.card || primary.thumb || null;

    await connection.query(
      `
        UPDATE product_variants
        SET image = ?,
            image_variants = ?,
            images = ?,
            last_synced_at = NOW(),
            updated_at = NOW()
        WHERE id = ?
      `,
      [
        primaryImage,
        JSON.stringify(primary),
        JSON.stringify(downloaded),
        row.variantId,
      ]
    );

    updated += 1;
  }

  await connection.end();

  console.log(
    JSON.stringify(
      {
        slug: args.slug,
        slugPrefix: args.slugPrefix,
        addedImagesColumn,
        processed,
        updated,
        skipped,
      },
      null,
      2
    )
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
