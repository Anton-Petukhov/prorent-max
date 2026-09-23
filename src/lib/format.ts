const intFmt = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const oneFmt = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function m2(value: number): string {
  return intFmt.format(Math.round(value));
}

export function eur(value: number): string {
  return intFmt.format(Math.round(value));
}

export function pct(value: number): string {
  return oneFmt.format(value);
}

export const KIND_LABEL = {
  office: "Офис",
  retail: "Ритейл",
  logistics: "Склад",
  mixed: "Смешанный",
} as const;

export const USE_LABEL = {
  office: "Офис",
  retail: "Торговля",
  warehouse: "Склад",
  vacant: "Вакант",
} as const;
