export function normalizeAccountPhone(value?: string | null) {
  if (!value?.trim()) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) {
    throw new Error("Проверьте номер телефона.");
  }
  return `+${digits.startsWith("8") && digits.length === 11 ? `7${digits.slice(1)}` : digits}`;
}
