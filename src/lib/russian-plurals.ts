export function formatRussianCount(
  count: number,
  forms: [one: string, few: string, many: string]
) {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;

  if (abs > 10 && abs < 20) {
    return `${count} ${forms[2]}`;
  }

  if (last === 1) {
    return `${count} ${forms[0]}`;
  }

  if (last >= 2 && last <= 4) {
    return `${count} ${forms[1]}`;
  }

  return `${count} ${forms[2]}`;
}
