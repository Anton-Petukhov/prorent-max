import { createFileRoute } from "@tanstack/react-router";
import { ExpiryBars, MixChart, MixDonut, MixLegend, RentBars } from "@/components/charts";
import { KpiRow } from "@/components/kpis";
import { eur, m2, pct } from "@/lib/format";
import { cityRows, metricsAt, vacancyHeat } from "@/lib/metrics";
import { quarterPretty, QUARTERS } from "@/lib/quarters";
import { usePortfolio, useResolvedAssets } from "@/lib/store";

export const Route = createFileRoute("/analytics")({ component: AnalyticsPage });

const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

function AnalyticsPage() {
  const qi = usePortfolio((state) => state.qi);
  const assets = useResolvedAssets();
  const metrics = metricsAt(assets, qi);
  const cities = cityRows(assets, qi);
  const heat = vacancyHeat(assets);
  const names = [...new Map(heat.map((cell) => [cell.assetId, cell])).values()];
  const label = QUARTERS[qi] ?? "2026-Q3";

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="kicker">Срез {quarterPretty(label)}</p>
        <h1 className="mt-2 font-display text-4xl sm:text-5xl">Аналитика</h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          Четыре числа, которые просили с самого начала: общая площадь, вакантная, коммерческая и склады.
          Остальное — как они едут по кварталам.
        </p>
      </header>
      <KpiRow metrics={metrics} />
      <section className="panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-2xl">Площадь во времени</h2>
          <MixLegend />
        </div>
        <MixChart assets={assets} qi={qi} />
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-4 sm:p-5">
          <h2 className="font-display text-2xl">Смесь на срезе</h2>
          <MixDonut assets={assets} qi={qi} />
        </div>
        <div className="panel p-4 sm:p-5">
          <h2 className="font-display text-2xl">Ставка, €/м² в год</h2>
          <p className="mb-2 text-sm text-stone">Проходящая, с индексацией 2,2% в год от старта договора.</p>
          <RentBars assets={assets} qi={qi} />
        </div>
      </section>
      <section className="panel p-4 sm:p-5">
        <h2 className="font-display text-2xl">Истечение договоров</h2>
        <p className="mb-2 text-sm text-stone">Площадь, у которой год окончания попадает в корзину. Считается от выбранного квартала.</p>
        <ExpiryBars assets={assets} qi={qi} />
      </section>
      <section className="panel p-4 sm:p-5">
        <h2 className="font-display text-2xl">Вакантность, III квартал</h2>
        <p className="mb-3 text-sm text-stone">Медь гуще там, где пустее. Прочерк — актива ещё нет в книге.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="text-xs text-stone">
                <th className="py-2 pr-3 font-medium">Актив</th>
                {YEARS.map((year) => (
                  <th key={year} className="px-1 py-2 text-center font-medium">
                    {year}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {names.map((row) => (
                <tr key={row.assetId}>
                  <th className="py-1 pr-3 text-left font-normal text-ink">
                    <span className="block">{row.name}</span>
                    <span className="text-xs text-stone">{row.city}</span>
                  </th>
                  {YEARS.map((year) => {
                    const cell = heat.find((item) => item.assetId === row.assetId && item.year === year);
                    const rate = cell?.rate ?? null;
                    const hot = rate !== null && rate > 18;
                    return (
                      <td key={year} className="p-1">
                        <div
                          className={`nums flex h-11 items-center justify-center text-xs ${hot ? "text-paper" : "text-ink"}`}
                          style={{
                            background:
                              rate === null
                                ? "transparent"
                                : `color-mix(in srgb, var(--color-copper) ${Math.min(88, Math.round(rate * 2.2))}%, var(--color-paper))`,
                          }}
                        >
                          {rate === null ? "—" : pct(rate)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel overflow-x-auto p-4 sm:p-5">
        <h2 className="mb-3 font-display text-2xl">Города</h2>
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="text-xs tracking-caps text-stone uppercase">
            <tr className="border-b border-line">
              <th className="py-2 pr-3 font-medium">Город</th>
              <th className="py-2 pr-3 text-right font-medium">Активов</th>
              <th className="py-2 pr-3 text-right font-medium">Общая</th>
              <th className="py-2 pr-3 text-right font-medium">Вакантная</th>
              <th className="py-2 pr-3 text-right font-medium">Коммерческая</th>
              <th className="py-2 pr-3 text-right font-medium">Склады</th>
              <th className="py-2 text-right font-medium">€/м²</th>
            </tr>
          </thead>
          <tbody>
            {cities.map((city) => (
              <tr key={city.city} className="border-b border-line last:border-0">
                <td className="py-2 pr-3">
                  {city.city}
                  <span className="block text-xs text-stone">{city.country}</span>
                </td>
                <td className="nums py-2 pr-3 text-right">{city.count}</td>
                <td className="nums py-2 pr-3 text-right">{m2(city.total)}</td>
                <td className="nums py-2 pr-3 text-right">{m2(city.vacant)}</td>
                <td className="nums py-2 pr-3 text-right">{m2(city.commercial)}</td>
                <td className="nums py-2 pr-3 text-right">{m2(city.warehouse)}</td>
                <td className="nums py-2 text-right">{eur(city.rent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
