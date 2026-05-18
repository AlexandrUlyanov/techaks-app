const PHONE_ALLOWED_PATTERN = /^[\d+\s()\-]+$/;

export function normalizePhone(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function getPhoneDigitsCount(value: string | null | undefined) {
  return normalizePhone(value).replace(/\D/g, "").length;
}

export function isSoftValidPhone(value: string | null | undefined) {
  const normalized = normalizePhone(value);
  if (!normalized) return false;
  if (!PHONE_ALLOWED_PATTERN.test(normalized)) return false;
  return getPhoneDigitsCount(normalized) >= 7;
}
