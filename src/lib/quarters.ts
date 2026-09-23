export const QUARTERS: string[] = [];

for (let year = 2018; year <= 2026; year += 1) {
  for (let quarter = 1; quarter <= 4; quarter += 1) {
    QUARTERS.push(`${year}-Q${quarter}`);
  }
}

export const NOW_QI = QUARTERS.indexOf("2026-Q3");

const ROMAN = ["I", "II", "III", "IV"] as const;

export function quarterIndex(label: string): number {
  const match = /^(\d{4})-Q([1-4])$/.exec(label);
  if (!match) return 0;
  const year = Number(match[1]);
  const quarter = Number(match[2]);
  return (year - 2018) * 4 + (quarter - 1);
}

export function quarterPretty(label: string): string {
  const match = /^(\d{4})-Q([1-4])$/.exec(label);
  if (!match) return label;
  return `${match[1]} · ${ROMAN[Number(match[2]) - 1]} кв.`;
}

export function clampQi(qi: number): number {
  return Math.min(QUARTERS.length - 1, Math.max(0, qi));
}
