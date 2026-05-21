import fs from "fs";
import path from "path";
import sharp from "sharp";
import { createHash } from "node:crypto";
import type { ProductImageVariantSet } from "@contracts/product-images";

const PRODUCT_IMAGE_VARIANT_SPECS = {
  thumb: 120,
  card: 400,
  medium: 800,
} as const;

const IMAGE_EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};

function ensureDirectory(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getOriginalExtension(downloadUrl: string, contentType?: string | null) {
  const fromContentType =
    (contentType && IMAGE_EXTENSION_BY_CONTENT_TYPE[contentType.toLowerCase()]) ||
    null;
  if (fromContentType) return fromContentType;

  try {
    const pathname = new URL(downloadUrl).pathname;
    const ext = path.extname(pathname).toLowerCase();
    if (ext) return ext;
  } catch {
    // ignore
  }

  return ".jpg";
}

function getExistingVariantMetadata(metaPath: string) {
  if (!fs.existsSync(metaPath)) return null;

  try {
    return JSON.parse(fs.readFileSync(metaPath, "utf8")) as ProductImageVariantSet;
  } catch {
    return null;
  }
}

function hasAllVariantFiles(variants: ProductImageVariantSet | null) {
  if (!variants) return false;

  const expected = [variants.original, variants.thumb, variants.card, variants.medium]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .map(value => path.join(process.cwd(), "public", value.replace(/^\/+/, "").replace(/\//g, path.sep)));

  return expected.length > 0 && expected.every(filePath => fs.existsSync(filePath));
}

async function writeResponsiveVariant(
  inputBuffer: Buffer,
  outputPath: string,
  size: number
) {
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

export async function createProductImageVariants(args: {
  inputBuffer: Buffer;
  downloadUrl: string;
  contentType?: string | null;
  imageId: string;
  folderName: string;
}): Promise<ProductImageVariantSet> {
  const baseDir = path.join(process.cwd(), "public", "images", args.folderName);
  ensureDirectory(baseDir);

  const fileHash = createHash("sha1").update(args.inputBuffer).digest("hex");
  const originalExtension = getOriginalExtension(args.downloadUrl, args.contentType);
  const originalFileName = `${args.imageId}-original${originalExtension}`;
  const originalRelativePath = `/images/${args.folderName}/${originalFileName}`;
  const thumbRelativePath = `/images/${args.folderName}/${args.imageId}-thumb.webp`;
  const cardRelativePath = `/images/${args.folderName}/${args.imageId}-card.webp`;
  const mediumRelativePath = `/images/${args.folderName}/${args.imageId}-medium.webp`;
  const metaPath = path.join(baseDir, `${args.imageId}.variants.json`);

  const existing = getExistingVariantMetadata(metaPath);
  if (existing?.hash === fileHash && hasAllVariantFiles(existing)) {
    return existing;
  }

  const originalFilePath = path.join(baseDir, originalFileName);
  const thumbFilePath = path.join(baseDir, `${args.imageId}-thumb.webp`);
  const cardFilePath = path.join(baseDir, `${args.imageId}-card.webp`);
  const mediumFilePath = path.join(baseDir, `${args.imageId}-medium.webp`);

  fs.writeFileSync(originalFilePath, args.inputBuffer);

  await Promise.all([
    writeResponsiveVariant(args.inputBuffer, thumbFilePath, PRODUCT_IMAGE_VARIANT_SPECS.thumb),
    writeResponsiveVariant(args.inputBuffer, cardFilePath, PRODUCT_IMAGE_VARIANT_SPECS.card),
    writeResponsiveVariant(args.inputBuffer, mediumFilePath, PRODUCT_IMAGE_VARIANT_SPECS.medium),
  ]);

  const metadata = await sharp(args.inputBuffer).metadata();
  const variants: ProductImageVariantSet = {
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
