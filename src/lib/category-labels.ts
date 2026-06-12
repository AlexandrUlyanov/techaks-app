export function formatCategoryLabel(name: string | null | undefined): string {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return "";

  const hasLetters = /[A-Za-zА-Яа-яЁё]/u.test(trimmed);
  const hasLowercaseLetters = /[a-zа-яё]/u.test(trimmed);

  if (!hasLetters || hasLowercaseLetters) {
    return trimmed;
  }

  const lowered = trimmed.toLocaleLowerCase("ru-RU");

  return lowered.replace(
    /^([^A-Za-zА-Яа-яЁё]*)([A-Za-zА-Яа-яЁё])/u,
    (_, prefix: string, firstLetter: string) =>
      prefix + firstLetter.toLocaleUpperCase("ru-RU")
  );
}
