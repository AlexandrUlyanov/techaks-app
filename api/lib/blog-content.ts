import sanitizeHtml from "sanitize-html";

export const BLOG_STATUSES = [
  "draft",
  "scheduled",
  "published",
  "archived",
] as const;

export type BlogStatus = (typeof BLOG_STATUSES)[number];

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "b",
  "i",
  "u",
  "blockquote",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
  "h4",
  "a",
  "img",
];

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  a: ["href", "target", "rel"],
  img: ["src", "alt", "title"],
};

export function slugifyBlogTitle(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё\s-]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 255);
}

export function sanitizeBlogContent(content: string) {
  const normalized = content.trim();
  const htmlLike = /<\/?[a-z][\s\S]*>/i.test(normalized);

  const input = htmlLike
    ? normalized
    : normalized
        .split(/\n{2,}/)
        .map(block => `<p>${escapeHtml(block).replace(/\n/g, "<br />")}</p>`)
        .join("");

  return sanitizeHtml(input, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        target: "_blank",
        rel: "noopener noreferrer",
      }),
    },
  }).trim();
}

export function estimateReadingTimeMinutes(content: string) {
  const plain = stripHtml(content).trim();
  const words = plain.length === 0 ? 0 : plain.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 180));
}

export function normalizeExcerpt(input: string) {
  return stripHtml(input).replace(/\s+/g, " ").trim().slice(0, 320);
}

export function normalizeSeoField(input: string, maxLength: number) {
  return input.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

export function resolveBlogStatus(input: {
  status: BlogStatus;
  publishedAt?: Date | null;
}) {
  if (input.status === "published" && !input.publishedAt) {
    return {
      status: "published" as const,
      publishedAt: new Date(),
      published: true,
    };
  }

  if (input.status === "scheduled") {
    return {
      status: "scheduled" as const,
      publishedAt: input.publishedAt ?? null,
      published: false,
    };
  }

  if (input.status === "archived") {
    return {
      status: "archived" as const,
      publishedAt: input.publishedAt ?? null,
      published: false,
    };
  }

  return {
    status: "draft" as const,
    publishedAt: null,
    published: false,
  };
}

export function isPostLive(post: {
  status?: string | null;
  published?: boolean | null;
  publishedAt?: Date | string | null;
}) {
  if (post.status === "published") return true;

  if (post.status === "scheduled" && post.publishedAt) {
    return new Date(post.publishedAt).getTime() <= Date.now();
  }

  return Boolean(post.published);
}

export function stripHtml(input: string) {
  return input.replace(/<[^>]+>/g, " ");
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
