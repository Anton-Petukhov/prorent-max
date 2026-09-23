import { m2, pct } from "@/lib/format";
import type { Metrics } from "@/lib/metrics";

const CARDS: {
  key: "total" | "vacant" | "commercial" | "warehouse";
  label: string;
  hint: (metrics: Metrics) => string;
}[] = [
  { key: "total", label: "Общая площадь", hint: (metrics) => `${metrics.assets} активов в портфеле` },
  {
    key: "vacant",
    label: "Вакантная",
    hint: (metrics) => `${pct(metrics.total ? (metrics.vacant / metrics.total) * 100 : 0)}% портфеля`,
  },
  {
    key: "commercial",
    label: "Коммерческая",
    hint: (metrics) => `свободно ${m2(metrics.commercialVacant)} м²`,
  },
  {
    key: "warehouse",
    label: "Склады",
    hint: (metrics) => `свободно ${m2(metrics.warehouseVacant)} м²`,
  },
];

export function KpiRow({ metrics }: { metrics: Metrics }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden border border-line bg-line lg:grid-cols-4">
      {CARDS.map((card) => (
        <div key={card.key} className="bg-paper px-4 py-4 sm:px-5">
          <dt className="kicker">{card.label}</dt>
          <dd className="nums mt-2 font-display text-3xl text-ink sm:text-4xl">{m2(metrics[card.key])}</dd>
          <p className="mt-1 text-sm text-stone">
            м² · {card.hint(metrics)}
          </p>
        </div>
      ))}
    </dl>
  );
}
