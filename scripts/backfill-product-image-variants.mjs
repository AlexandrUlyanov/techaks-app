import fs from "fs";
import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import sharp from "sharp";

dotenv.config();

const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const PRODUCT_NOFOTO_SRC = "/images/nofoto.jpg";
const BATCH_SIZE = 100;

function normalizeImagePath(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized === "undefined" || normalized === "null") {
    return null;
  }
  return normalized;
}

function toPublicAbsolutePath(publicPath) {
  const normalized = normalizeImagePath(publicPath);
  if (!normalized?.startsWith("/")) return null;
  return path.join(PUBLIC_DIR, normalized.replace(/^\//, ""));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function buildVariantPaths(folderName, baseName) {
  return {
    thumb: `/images/${folderName}/${baseName}-thumb.webp`,
    card: `/images/${folderName}/${baseName}-card.webp`,
    medium: `/images/${folderName}/${baseName}-medium.webp`,
  };
}

async function writeVariant(buffer, outputPath, maxSize) {
  await sharp(buffer)
    .resize(maxSize, maxSize, {
      fit: "inside",
      withoutEnlargement: true,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .webp({ quality: 82 })
    .toFile(outputPath);
}

async function buildVariantSet(publicPath, baseName, folderName) {
  const absolutePath = toPublicAbsolutePath(publicPath);
  if (!absolutePath || !fs.existsSync(absolutePath)) {
    return null;
  }

  const inputBuffer = fs.readFileSync(absolutePath);
  const hash = crypto.createHash("sha1").update(inputBuffer).digest("hex");
  const metadata = await sharp(inputBuffer).metadata();
  const targetDir = path.join(PUBLIC_DIR, "images", folderName);
  ensureDir(targetDir);
  const variantPaths = buildVariantPaths(folderName, baseName);

  await Promise.all([
    writeVariant(inputBuffer, path.join(PUBLIC_DIR, variantPaths.thumb.replace(/^\//, "")), 120),
    writeVariant(inputBuffer, path.join(PUBLIC_DIR, variantPaths.card.replace(/^\//, "")), 400),
    writeVariant(inputBuffer, path.join(PUBLIC_DIR, variantPaths.medium.replace(/^\//, "")), 800),
  ]);

  return {
    original: publicPath,
    thumb: variantPaths.thumb,
    card: variantPaths.card,
    medium: variantPaths.medium,
    hash,
    width: metadata.width ?? null,
    height: metadata.height ?? null,
  };
}

function normalizeFolderName(publicPath, fallbackProductId) {
  const normalized = normalizeImagePath(publicPath) ?? "";
  const withoutQuery = normalized.split("?")[0];
  const segments = withoutQuery.split("/").filter(Boolean);
  if (segments.length >= 3 && segments[0] === "images") {
    return segments[1];
  }
  return `product-${fallbackProductId}`;
}

function normalizeBaseName(publicPath, fallbackProductId, index = 0) {
  const normalized = normalizeImagePath(publicPath) ?? "";
  const withoutQuery = normalized.split("?")[0];
  const fileName = path.basename(withoutQuery, path.extname(withoutQuery));
  const safeName = fileName.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  return safeName || `product-${fallbackProductId}-${index + 1}`;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  let processed = 0;
  let updated = 0;

  while (true) {
    const [rows] = await connection.query(
      `
        SELECT id, image, images, image_variants
        FROM products
        WHERE image <> ?
          AND image_variants IS NULL
        ORDER BY id ASC
        LIMIT ${BATCH_SIZE}
      `,
      [PRODUCT_NOFOTO_SRC]
    );

    const batch = rows;
    if (!Array.isArray(batch) || batch.length === 0) {
      break;
    }

    for (const row of batch) {
      processed += 1;
      const primaryImage = normalizeImagePath(row.image);
      if (!primaryImage) continue;

      const folderName = normalizeFolderName(primaryImage, row.id);
      const primaryVariant = await buildVariantSet(
        primaryImage,
        normalizeBaseName(primaryImage, row.id),
        folderName
      );

      if (!primaryVariant) continue;

      const rawImages = Array.isArray(row.images) ? row.images : [];
      const gallery = [primaryVariant];

      for (let index = 0; index < rawImages.length; index += 1) {
        const item = rawImages[index];
        if (item && typeof item === "object" && item.original) {
          gallery.push(item);
          continue;
        }

        const itemPath = normalizeImagePath(String(item ?? ""));
        if (!itemPath || itemPath === primaryVariant.original) continue;

        const variant = await buildVariantSet(
          itemPath,
          normalizeBaseName(itemPath, row.id, index + 1),
          normalizeFolderName(itemPath, row.id)
        );
        if (variant && !gallery.some(existing => existing.original === variant.original)) {
          gallery.push(variant);
        }
      }

      await connection.query(
        "UPDATE products SET image_variants = ?, images = ? WHERE id = ?",
        [JSON.stringify(primaryVariant), JSON.stringify(gallery), row.id]
      );
      updated += 1;
    }
  }

  await connection.end();
  console.log(
    JSON.stringify(
      {
        processed,
        updated,
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
