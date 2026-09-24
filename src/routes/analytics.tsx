import { createFileRoute, Link } from "@tanstack/react-router";
import { ExpiryBars, MixChart, MixDonut, MixLegend, RentBars } from "@/components/charts";
import { KpiRow } from "@/components/kpis";
import { eur, m2, pct } from "@/lib/format";
import { brandFacts, brandSnapshotAt, prettySchemeDate } from "@/lib/brand-history";
import { electronFacts, electronSnapshotAt, prettySchemeDate as electronDate } from "@/lib/electron-history";
import { pioneerTotals } from "@/lib/pioneer";
import { cityRows, metricsAt, vacancyHeat, watchlist } from "@/lib/metrics";
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
  const watch = watchlist(assets, qi);
  const pioneer = pioneerTotals();
  const names = [...new Map(heat.map((cell) => [cell.assetId, cell])).values()];
  const label = QUARTERS[qi] ?? "2026-Q3";
  const brand = brandFacts(brandSnapshotAt(qi));
  const brandSnap = brandSnapshotAt(qi);
  const electron = electronFacts(electronSnapshotAt(qi));
  const electronSnap = electronSnapshotAt(qi);

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
      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="panel p-4 sm:p-5">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="kicker">Ближайший год</p>
              <h2 className="font-display text-2xl">Что требует внимания</h2>
            </div>
            <Link to="/stack" className="text-sm text-copper">
              Шахматка
            </Link>
          </div>
          <p className="nums text-sm text-stone">
            Потери от вакансии около {eur(watch.loss)} €/год при текущей проходящей ставке. Свободных зон:{" "}
            {watch.vacantZones} из {watch.zones}.
          </p>
          <ul className="mt-4 flex flex-col gap-3">
            {watch.endings.length === 0 ? <li className="text-sm text-stone">Окончаний в ближайшие четыре квартала нет.</li> : null}
            {watch.endings.map((event) => (
              <li key={`${event.qi}-${event.detail}`} className="border-t border-line pt-3 text-sm">
                <p>{event.title}</p>
                <p className="text-stone">{event.detail}</p>
              </li>
            ))}
            {watch.starts.map((event) => (
              <li key={`${event.qi}-${event.detail}`} className="border-t border-line pt-3 text-sm">
                <p>{event.title}</p>
                <p className="text-stone">{event.detail}</p>
              </li>
            ))}
          </ul>
        </article>
        <article className="panel p-4 sm:p-5">
          <p className="kicker">Иркутск в ленте</p>
          <h2 className="font-display text-2xl">Брэнд Холл и отдельные книги</h2>
          <p className="mt-2 text-sm text-stone">
            Брэнд Холл входит в общие KPI, смесь площади и таблицу городов с даты схемы. Ставка в евро его не
            касается: на листах рубли, в rent roll они не смешиваются. У Электрона своя лента схем с 30.11.2022, в общие
            KPI она не входит. Пионер остаётся фиксированным эталоном.
          </p>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="border-t border-line pt-3">
              <dt className="text-stone">Брэнд Холл на срезе</dt>
              <dd className="nums mt-1">
                {brand.total
                  ? `${m2(brand.total)} м² · торговля ${m2(brand.trade)} · вакант ${m2(brand.vacant)} · склад ${m2(brand.storage)} · схема ${prettySchemeDate(brandSnap?.stamp ?? brandSnap?.date ?? "")}`
                  : "до первой схемы 17.01.2023"}
              </dd>
              <Link to="/brand-hall" className="text-copper">
                3D, уровни и история листов
              </Link>
            </div>
            <div className="border-t border-line pt-3">
              <dt className="text-stone">Галерея «Пионер»</dt>
              <dd className="nums mt-1">
                {pct(pioneer.occupancy)}% занято · бронь {m2(pioneer.reserved)} м² · свободно {m2(pioneer.vacant)} м²
              </dd>
              <Link to="/pioneer" className="text-copper">
                3D-эталон со стенами
              </Link>
            </div>
            <div className="border-t border-line pt-3">
              <dt className="text-stone">ТЦ «Электрон»</dt>
              <dd className="nums mt-1">
                {electron.total
                  ? `${m2(electron.total)} м² · торговля ${m2(electron.trade)} · вакант ${m2(electron.vacant)} · склад ${m2(electron.storage)} · схема ${electronDate(electronSnap?.date ?? "")}`
                  : "до первой схемы 30.11.2022"}
              </dd>
              <Link to="/electron" className="text-copper">
                Фото, график и история листов
              </Link>
            </div>
          </dl>
        </article>
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
              <tr key={`${city.city}-${city.country}`} className="border-b border-line last:border-0">
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
