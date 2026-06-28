import { access, mkdir, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { createHash } from "node:crypto";
import { extname, join } from "node:path";

const YANDEX_REVIEWS_URL =
  "https://yandex.ru/maps/org/tekhaks/81538152780/reviews/?indoorLevel=1&ll=44.920956%2C53.222379&z=17";
const YANDEX_ORG_URL = "https://yandex.ru/maps/org/tekhaks/81538152780/";
const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_REVIEWS = 6;
const REVIEW_MEDIA_DIR = join(process.cwd(), "public", "images", "reviews", "yandex");
const REVIEW_MEDIA_PUBLIC_PATH = "/images/reviews/yandex";

const FALLBACK_REVIEWS: HomepageYandexReview[] = [
  {
    id: "fallback-mariya-ivanova-2026-06-23",
    authorName: "Мария Иванова",
    authorAvatarUrl: null,
    authorBadge: "Знаток города 3 уровня",
    rating: 5,
    text: "Покупала тут фен, понравился и сам товар и магазин, большой выбор самых различных видов техники и аксессуаров, есть что повыбирать, персонал отзывчивый",
    createdAt: "2026-06-23T14:08:17.926Z",
    photoUrl: null,
    source: "Яндекс Карты",
    reviewUrl: YANDEX_REVIEWS_URL,
    replyText:
      "Благодарим за отзыв и высокую оценку магазина техники и аксессуаров ТЕХАКС. Что касается техники для красоты, у нас большой выбор современных фенов с ионизацией, дорожных фенов, выпрямителей для волос, машинок для стрижки волос и других аксессуаров для ухода. Профессиональные консультанты магазина ТЕХАКС всегда готовы помочь вам выбрать качественную технику по лучшей цене!",
    replyUpdatedAt: "2026-06-24T08:48:21.053Z",
  },
  {
    id: "fallback-nadia-ara-2026-06-03",
    authorName: "Nadia.ara",
    authorAvatarUrl: null,
    authorBadge: "Знаток города 5 уровня",
    rating: 5,
    text: "Открыла для себя новый магазин электроники. Небольшой, но много всего интересного, аксессуаров для телефонов, наушников,колонок, много интересного для детей, от брелков до разнообразных развивающих настолок. Набрала и в подарок и для семьи)))Приятное открытие. Спасибо 😀",
    createdAt: "2026-06-03T10:26:45.843Z",
    photoUrl: null,
    source: "Яндекс Карты",
    reviewUrl: YANDEX_REVIEWS_URL,
    replyText:
      "Благодарим за отзыв! Нам очень приятно, что вы отметили большой выбор и разнообразный ассортимент магазина техники и аксессуаров ТЕХАКС, который постоянно пополняется новинками техники. Помимо телефонов, планшетов, беспроводных наушников и портативных колонок, у нас также большой выбор техники для дома: аэрогрили, чайники, утюги, кофемашины, блендеры, отпариватели, вентиляторы. Купить фен, выпрямитель для волос, машинку для стрижки волос, бритву или умную расческу вы также можете в магазине техники и аксессуаров ТЕХАКС.",
    replyUpdatedAt: "2026-06-15T07:15:17.625Z",
  },
  {
    id: "fallback-ilya-korobkov-2026-04-06",
    authorName: "Илья Коробков",
    authorAvatarUrl: null,
    authorBadge: "Знаток города 3 уровня",
    rating: 5,
    text: "Хороший магазин, персонал очень вежливый, единственный магазин в городе, в котором оказалось нужное мне защитное стекло, продавец очень ровно и качественно наклеил стекло без пузырей. Очень доволен, рекомендую!",
    createdAt: "2026-04-06T13:57:24.680Z",
    photoUrl: null,
    source: "Яндекс Карты",
    reviewUrl: YANDEX_REVIEWS_URL,
    replyText:
      "Благодарим за отзыв! В магазине техники и аксессуаров ТЕХАКС в Пензе всегда можно поклеить защитное стекло или пленку на телефон. Цены на поклейку пленки у нас самые низкие по городу — от 150 рублей (поклейка пленки на экран смартфона).",
    replyUpdatedAt: "2026-06-15T14:36:42.691Z",
  },
];

function buildFallbackPayload(): HomepageYandexReviewsPayload {
  return {
    totalCount: Math.max(43, FALLBACK_REVIEWS.length),
    reviews: FALLBACK_REVIEWS.slice(0, MAX_REVIEWS),
    sourceUrl: YANDEX_REVIEWS_URL,
    fetchedAt: new Date().toISOString(),
  };
}

export type HomepageYandexReview = {
  id: string;
  authorName: string;
  authorAvatarUrl: string | null;
  authorBadge: string | null;
  rating: number;
  text: string;
  createdAt: string;
  photoUrl: string | null;
  source: "Яндекс Карты";
  reviewUrl: string;
  replyText: string | null;
  replyUpdatedAt: string | null;
};

export type HomepageYandexReviewsPayload = {
  totalCount: number;
  reviews: HomepageYandexReview[];
  sourceUrl: string;
  fetchedAt: string;
};

type RawReviewPhoto = {
  urlTemplate?: string;
};

type RawReview = {
  reviewId?: string;
  rating?: number;
  text?: string;
  updatedTime?: string;
  author?: {
    name?: string;
    avatarUrl?: string;
    professionLevel?: string;
  };
  photos?: RawReviewPhoto[];
  businessComment?: {
    text?: string;
    updatedTime?: string;
  };
};

let cache: {
  expiresAt: number;
  payload: HomepageYandexReviewsPayload;
} | null = null;

function normalizeWhitespace(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function resolveTemplateImage(urlTemplate: string | null | undefined, size: string) {
  if (!urlTemplate) return null;
  return urlTemplate.replace("{size}", size);
}

function sanitizeMediaKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function detectImageExtension(contentType: string | null, sourceUrl: string) {
  const normalizedType = (contentType ?? "").toLowerCase();
  if (normalizedType.includes("png")) return ".png";
  if (normalizedType.includes("webp")) return ".webp";
  if (normalizedType.includes("gif")) return ".gif";
  if (normalizedType.includes("avif")) return ".avif";
  if (normalizedType.includes("jpeg") || normalizedType.includes("jpg")) return ".jpg";

  const pathname = (() => {
    try {
      return new URL(sourceUrl).pathname;
    } catch {
      return sourceUrl;
    }
  })();
  const extension = extname(pathname).toLowerCase();
  if (extension && extension.length <= 6) {
    return extension;
  }
  return ".jpg";
}

async function fileExists(path: string) {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function mirrorReviewMedia(
  reviewId: string,
  kind: "avatar" | "photo",
  remoteUrl: string | null
) {
  if (!remoteUrl) return null;

  const key = sanitizeMediaKey(reviewId) || createHash("sha1").update(reviewId).digest("hex");
  const hash = createHash("sha1").update(remoteUrl).digest("hex").slice(0, 10);
  const baseName = `${key}-${kind}-${hash}`;

  await mkdir(REVIEW_MEDIA_DIR, { recursive: true });

  for (const knownExtension of [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]) {
    const candidatePath = join(REVIEW_MEDIA_DIR, `${baseName}${knownExtension}`);
    if (await fileExists(candidatePath)) {
      return `${REVIEW_MEDIA_PUBLIC_PATH}/${baseName}${knownExtension}`;
    }
  }

  try {
    const response = await fetch(remoteUrl, {
      method: "GET",
      headers: {
        "accept-language": "ru-RU,ru;q=0.9,en;q=0.8",
        referer: YANDEX_ORG_URL,
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      return null;
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength === 0) {
      return null;
    }

    const extension = detectImageExtension(response.headers.get("content-type"), remoteUrl);
    const fileName = `${baseName}${extension}`;
    const filePath = join(REVIEW_MEDIA_DIR, fileName);
    await writeFile(filePath, bytes);
    return `${REVIEW_MEDIA_PUBLIC_PATH}/${fileName}`;
  } catch {
    return null;
  }
}

function extractBalancedJsonFragment(
  source: string,
  startIndex: number,
  openChar: "[" | "{",
  closeChar: "]" | "}"
) {
  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escaping) {
        escaping = false;
        continue;
      }
      if (char === "\\") {
        escaping = true;
        continue;
      }
      if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === openChar) {
      depth += 1;
    } else if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return source.slice(startIndex, index + 1);
      }
    }
  }

  throw new Error("Не удалось извлечь JSON-фрагмент отзывов из HTML Яндекс Карт.");
}

function parseEmbeddedReviewResults(html: string) {
  const marker = "\"reviewResults\":{\"reviews\":";
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error("Блок reviewResults не найден в ответе Яндекс Карт.");
  }

  const reviewsStart = markerIndex + marker.length;
  const reviewsJson = extractBalancedJsonFragment(html, reviewsStart, "[", "]");
  const reviews = JSON.parse(reviewsJson) as RawReview[];

  const paramsMarker = "\"params\":";
  const paramsIndex = html.indexOf(paramsMarker, reviewsStart + reviewsJson.length);
  let totalCount = reviews.length;

  if (paramsIndex >= 0) {
    const paramsStart = paramsIndex + paramsMarker.length;
    const paramsJson = extractBalancedJsonFragment(html, paramsStart, "{", "}");
    const params = JSON.parse(paramsJson) as { count?: number };
    totalCount = Number(params.count ?? reviews.length);
  }

  return { reviews, totalCount };
}

function mapReview(rawReview: RawReview): HomepageYandexReview | null {
  const id = normalizeWhitespace(rawReview.reviewId);
  const authorName = normalizeWhitespace(rawReview.author?.name);
  const text = normalizeWhitespace(rawReview.text);
  const rating = Math.max(0, Math.min(5, Number(rawReview.rating ?? 0)));
  const createdAt = normalizeWhitespace(rawReview.updatedTime);

  if (!id || !authorName || !text || rating <= 0 || !createdAt) {
    return null;
  }

  return {
    id,
    authorName,
    authorAvatarUrl: resolveTemplateImage(rawReview.author?.avatarUrl ?? null, "islands-200"),
    authorBadge: normalizeWhitespace(rawReview.author?.professionLevel) || null,
    rating,
    text,
    createdAt,
    photoUrl: resolveTemplateImage(rawReview.photos?.[0]?.urlTemplate ?? null, "XXL"),
    source: "Яндекс Карты",
    reviewUrl: YANDEX_REVIEWS_URL,
    replyText: normalizeWhitespace(rawReview.businessComment?.text) || null,
    replyUpdatedAt: normalizeWhitespace(rawReview.businessComment?.updatedTime) || null,
  };
}

async function fetchHomepageYandexReviews(): Promise<HomepageYandexReviewsPayload> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(YANDEX_ORG_URL, {
      method: "GET",
      headers: {
        "accept-language": "ru-RU,ru;q=0.9,en;q=0.8",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Яндекс Карты вернули HTTP ${response.status}.`);
    }

    const html = await response.text();
    const parsed = parseEmbeddedReviewResults(html);
    const reviews = parsed.reviews
      .map(mapReview)
      .filter((review): review is HomepageYandexReview => Boolean(review))
      .sort((left, right) => {
        const leftHasPhoto = left.photoUrl ? 1 : 0;
        const rightHasPhoto = right.photoUrl ? 1 : 0;
        if (leftHasPhoto !== rightHasPhoto) {
          return rightHasPhoto - leftHasPhoto;
        }
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      })
      .slice(0, MAX_REVIEWS);

    if (reviews.length === 0) {
      throw new Error("На странице Яндекс Карт не удалось собрать ни одного отзыва.");
    }

    const reviewsWithLocalMedia = await Promise.all(
      reviews.map(async (review) => ({
        ...review,
        authorAvatarUrl: await mirrorReviewMedia(review.id, "avatar", review.authorAvatarUrl),
        photoUrl: await mirrorReviewMedia(review.id, "photo", review.photoUrl),
      }))
    );

    return {
      totalCount: Math.max(parsed.totalCount, reviews.length),
      reviews: reviewsWithLocalMedia,
      sourceUrl: YANDEX_REVIEWS_URL,
      fetchedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getHomepageYandexReviews() {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.payload;
  }

  try {
    const payload = await fetchHomepageYandexReviews();
    cache = {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    };
    return payload;
  } catch (error) {
    if (cache?.payload) {
      return cache.payload;
    }
    const payload = buildFallbackPayload();
    cache = {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    };
    return payload;
  }
}
