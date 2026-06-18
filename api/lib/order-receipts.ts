export type ReceiptMeta = {
  receiptUrl?: string;
  receiptPdfUrl?: string;
  receiptStatus: "pending" | "ready" | "failed" | "not_required";
};

const RECEIPT_URL_PATTERNS = [
  "consumer.1-ofd.ru/ticket?",
  "consumer.1-ofd.ru/ticket/",
  "ofd.ru/",
];

function normalizeScalar(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function collectObjectValues(
  value: unknown,
  bucket: string[] = [],
  visited = new WeakSet<object>()
) {
  if (value === null || value === undefined) {
    return bucket;
  }

  const scalar = normalizeScalar(value);
  if (scalar) {
    bucket.push(scalar);
    return bucket;
  }

  if (typeof value !== "object") {
    return bucket;
  }

  if (visited.has(value as object)) {
    return bucket;
  }
  visited.add(value as object);

  if (Array.isArray(value)) {
    for (const item of value) {
      collectObjectValues(item, bucket, visited);
    }
    return bucket;
  }

  for (const nested of Object.values(value as Record<string, unknown>)) {
    collectObjectValues(nested, bucket, visited);
  }

  return bucket;
}

function collectObjectEntries(
  value: unknown,
  bucket: Array<[string, unknown]> = [],
  visited = new WeakSet<object>()
) {
  if (!value || typeof value !== "object") {
    return bucket;
  }

  if (visited.has(value as object)) {
    return bucket;
  }
  visited.add(value as object);

  if (Array.isArray(value)) {
    for (const item of value) {
      collectObjectEntries(item, bucket, visited);
    }
    return bucket;
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    bucket.push([key, nested]);
    collectObjectEntries(nested, bucket, visited);
  }

  return bucket;
}

function findReceiptUrlCandidate(payload: Record<string, any>) {
  const directCandidates = [
    payload?.receiptUrl,
    payload?.receipt_url,
    payload?.receiptPdfUrl,
    payload?.receipt_pdf_url,
    payload?.receipt?.url,
    payload?.receipt_registration?.url,
    payload?.fiscal_receipt?.url,
    payload?.fiscalReceipt?.url,
  ]
    .map(normalizeScalar)
    .filter((value): value is string => Boolean(value));

  for (const candidate of directCandidates) {
    if (RECEIPT_URL_PATTERNS.some(pattern => candidate.includes(pattern))) {
      return candidate;
    }
  }

  const allValues = collectObjectValues(payload);
  return (
    allValues.find(candidate =>
      RECEIPT_URL_PATTERNS.some(pattern => candidate.includes(pattern))
    ) ?? null
  );
}

function findFieldValue(
  payload: Record<string, any>,
  candidateKeys: string[]
) {
  const normalizedKeySet = new Set(
    candidateKeys.map(key => key.toLowerCase().replace(/[^a-z0-9]+/g, ""))
  );
  const entries = collectObjectEntries(payload);

  for (const [key, rawValue] of entries) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (!normalizedKeySet.has(normalizedKey)) continue;
    const scalar = normalizeScalar(rawValue);
    if (scalar) return scalar;
  }

  return null;
}

function buildExternalFiscalReceiptUrl(payload: Record<string, any>) {
  const fn = findFieldValue(payload, [
    "fn",
    "fiscal_storage_number",
    "fiscalStorageNumber",
    "fiscal_drive_number",
    "fiscalDriveNumber",
    "fiscal_number",
    "fiscalNumber",
  ]);
  const i = findFieldValue(payload, [
    "i",
    "fiscal_document_number",
    "fiscalDocumentNumber",
    "document_number",
    "documentNumber",
    "receipt_number",
    "receiptNumber",
  ]);
  const fp = findFieldValue(payload, [
    "fp",
    "fiscal_document_attribute",
    "fiscalDocumentAttribute",
    "fiscal_sign",
    "fiscalSign",
  ]);
  const n = findFieldValue(payload, [
    "n",
    "receipt_type",
    "receiptType",
    "operation_type",
    "operationType",
  ]) || "1";

  if (!fn || !i || !fp || !n) {
    return null;
  }

  const url = new URL("https://consumer.1-ofd.ru/ticket");
  url.searchParams.set("fn", fn);
  url.searchParams.set("i", i);
  url.searchParams.set("fp", fp);
  url.searchParams.set("n", n);
  return url.toString();
}

export function extractReceiptMeta(rawPayload: unknown): ReceiptMeta {
  if (!rawPayload || typeof rawPayload !== "object") {
    return { receiptStatus: "not_required" };
  }

  const payload = rawPayload as Record<string, any>;
  const candidateUrl =
    findReceiptUrlCandidate(payload) || buildExternalFiscalReceiptUrl(payload);

  const candidatePdf =
    payload?.receiptPdfUrl ||
    payload?.receipt_pdf_url ||
    payload?.receipt?.pdf_url ||
    payload?.fiscal_receipt?.pdf_url ||
    payload?.fiscalReceipt?.pdf_url ||
    null;

  const rawStatus =
    payload?.receiptStatus ||
    payload?.receipt_status ||
    payload?.receipt?.status ||
    payload?.receipt_registration?.status ||
    payload?.fiscal_receipt?.status ||
    payload?.fiscalReceipt?.status ||
    null;

  if (candidateUrl || candidatePdf) {
    return {
      receiptUrl: typeof candidateUrl === "string" ? candidateUrl : undefined,
      receiptPdfUrl: typeof candidatePdf === "string" ? candidatePdf : undefined,
      receiptStatus: "ready",
    };
  }

  if (typeof rawStatus === "string") {
    if (rawStatus === "failed" || rawStatus === "error") {
      return { receiptStatus: "failed" };
    }
    if (rawStatus === "pending" || rawStatus === "processing") {
      return { receiptStatus: "pending" };
    }
  }

  return { receiptStatus: "not_required" };
}

export function extractReceiptUrl(rawPayload: unknown) {
  const meta = extractReceiptMeta(rawPayload);
  return meta.receiptPdfUrl || meta.receiptUrl || null;
}
