const YANDEX_REVIEWS_URL =
  "https://yandex.ru/maps/org/tekhaks/81538152780/reviews/?indoorLevel=1&ll=44.920956%2C53.222379&z=17";
const YANDEX_ORG_URL = "https://yandex.ru/maps/org/tekhaks/81538152780/";
const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_REVIEWS = 6;

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
    authorAvatarUrl: resolveTemplateImage(rawReview.author?.avatarUrl ?? null, "160x160"),
    authorBadge: normalizeWhitespace(rawReview.author?.professionLevel) || null,
    rating,
    text,
    createdAt,
    photoUrl: resolveTemplateImage(rawReview.photos?.[0]?.urlTemplate ?? null, "900x900"),
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

    return {
      totalCount: Math.max(parsed.totalCount, reviews.length),
      reviews,
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
    return {
      totalCount: 0,
      reviews: [],
      sourceUrl: YANDEX_REVIEWS_URL,
      fetchedAt: new Date().toISOString(),
    };
  }
}
