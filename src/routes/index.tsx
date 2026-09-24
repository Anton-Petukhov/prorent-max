import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AssetCard } from "@/components/asset-card";
import { MixChart, MixDonut, MixLegend } from "@/components/charts";
import { KpiRow } from "@/components/kpis";
import { brandFacts, brandSnapshotAt } from "@/lib/brand-history";
import { electronFacts, electronSnapshotAt } from "@/lib/electron-history";
import { eur, m2, pct } from "@/lib/format";
import { pioneerTotals } from "@/lib/pioneer";
import { assetSnaps, eventsBetween, metricsAt } from "@/lib/metrics";
import { quarterPretty, QUARTERS } from "@/lib/quarters";
import { usePortfolio, useResolvedAssets } from "@/lib/store";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const navigate = useNavigate();
  const qi = usePortfolio((state) => state.qi);
  const setPlanAsset = usePortfolio((state) => state.setPlanAsset);
  const assets = useResolvedAssets();
  const metrics = metricsAt(assets, qi);
  const snaps = assetSnaps(assets, qi);
  const label = QUARTERS[qi] ?? "2026-Q3";
  const events = eventsBetween(assets, Math.max(0, qi - 1), qi).slice(-3);
  const lead = snaps[0];
  const brand = brandFacts(brandSnapshotAt(qi));
  const electron = electronFacts(electronSnapshotAt(qi));

  return (
    <div className="flex flex-col gap-8">
      <header className="grid items-end gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div>
          <p className="kicker">Выпуск 09 · {quarterPretty(label)}</p>
          <h1 className="mt-3 max-w-xl font-display text-4xl text-ink sm:text-6xl sm:leading-tight">
            Перемотайте <span className="italic">портфель</span>.
          </h1>
          <p className="mt-4 max-w-xl text-base text-ink-soft sm:text-lg">
            ProRent MAX собирает коммерческие площади, склады и вакант в одну ленту времени. Договоры из PDF
            становятся строками аналитики, планы этажей — объёмом, который можно править.
          </p>
        </div>
        <figure className="panel overflow-hidden">
          <img src="/photos/hamburg.jpg" alt="Шпайхеркай 12, Гамбург" className="aspect-[3/2] w-full object-cover" />
          <figcaption className="flex items-baseline justify-between gap-3 px-4 py-3 text-sm">
            <span>Шпайхеркай 12</span>
            <span className="text-stone">Гамбург</span>
          </figcaption>
        </figure>
      </header>

      <KpiRow metrics={metrics} />

      <section className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="panel p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl">Состав площади</h2>
              <p className="text-sm text-stone">Занятая коммерция, занятые склады и вакант. Пунктир — выбранный квартал.</p>
            </div>
            <MixLegend />
          </div>
          <MixChart assets={assets} qi={qi} />
        </div>
        <div className="panel flex flex-col p-4 sm:p-5">
          <h2 className="font-display text-2xl">Сейчас</h2>
          <MixDonut assets={assets} qi={qi} />
          <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="kicker">Ставка</dt>
              <dd className="nums mt-1 text-ink">{eur(metrics.rentPerM2)} €/м²</dd>
            </div>
            <div>
              <dt className="kicker">WAULT</dt>
              <dd className="nums mt-1 text-ink">{pct(metrics.wault)} лет</dd>
            </div>
            <div>
              <dt className="kicker">Rent roll</dt>
              <dd className="nums mt-1 text-ink">{pct(metrics.rentRoll / 1_000_000)} млн €</dd>
            </div>
            <div>
              <dt className="kicker">Занято</dt>
              <dd className="nums mt-1 text-ink">{m2(metrics.occupied)} м²</dd>
            </div>
          </dl>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 className="font-display text-3xl">Книга активов</h2>
          <Link to="/portfolio" className="text-sm text-copper">
            Весь портфель
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {snaps.slice(0, 3).map((snap) => (
            <AssetCard
              key={snap.asset.id}
              snap={snap}
              onOpen={() => {
                setPlanAsset(snap.asset.id);
                void navigate({ to: "/plans" });
              }}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link to="/brand-hall" className="panel block overflow-hidden">
          <img
            src="/photos/brand-hall.jpg"
            alt="Фасад ТД «Брэнд Холл», Иркутск"
            className="aspect-[3/2] w-full object-cover object-top"
          />
          <span className="block px-4 py-4">
            <span className="kicker">Иркутск</span>
            <span className="mt-2 block font-display text-3xl text-ink">ТД «Брэнд Холл»</span>
            <span className="nums mt-3 block text-sm text-stone">
              {brand.total
                ? `${m2(brand.total)} м² на срезе · вакант ${m2(brand.vacant)}`
                : "до первой схемы 17.01.2023"}
            </span>
            <span className="mt-3 block h-1 bg-line">
              <span
                className="block h-full bg-pine"
                style={{ width: `${brand.total ? Math.min(100, brand.occupancy) : 0}%` }}
              />
            </span>
          </span>
        </Link>
        <Link to="/pioneer" className="panel flex flex-col justify-end p-5">
          <p className="kicker">3D-эталон</p>
          <h2 className="mt-2 font-display text-3xl">Галерея «Пионер»</h2>
          <p className="nums mt-3 text-sm text-stone">
            {m2(pioneerTotals().total)} м² · занято {pct(pioneerTotals().occupancy)}% · бронь {m2(pioneerTotals().reserved)} м²
          </p>
          <span className="mt-4 block h-1 bg-line">
            <span className="block h-full bg-pine" style={{ width: `${Math.min(100, pioneerTotals().occupancy)}%` }} />
          </span>
        </Link>
        <Link to="/electron" className="panel block overflow-hidden">
          <img
            src="/photos/electron.jpg"
            alt="Фасад ТЦ «Электрон», Иркутск"
            className="aspect-[3/2] w-full object-cover object-center"
          />
          <span className="block px-4 py-4">
            <span className="kicker">Иркутск</span>
            <span className="mt-2 block font-display text-3xl text-ink">ТЦ «Электрон»</span>
            <span className="nums mt-3 block text-sm text-stone">
              {electron.total
                ? `${m2(electron.total)} м² на срезе · вакант ${m2(electron.vacant)}`
                : "до первой схемы 30.11.2022"}
            </span>
            <span className="mt-3 block h-1 bg-line">
              <span
                className="block h-full bg-pine"
                style={{ width: `${electron.total ? Math.min(100, electron.occupancy) : 0}%` }}
              />
            </span>
          </span>
        </Link>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="panel p-5">
          <h2 className="font-display text-2xl">Лента квартала</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {events.length === 0 ? <li className="text-sm text-stone">Тихий квартал: ни входов, ни окончаний.</li> : null}
            {events.map((event) => (
              <li key={`${event.qi}-${event.title}-${event.detail}`} className="border-t border-line pt-3">
                <p className="text-sm text-ink">{event.title}</p>
                <p className="text-sm text-stone">{event.detail}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid gap-px bg-line sm:grid-cols-3">
          {(
            [
              {
                to: "/documents",
                title: "Документы",
                text: "Несколько PDF с площадями складываются в общую, вакантную, коммерческую и склад.",
              },
              {
                to: "/analytics",
                title: "Аналитика",
                text: "Вакантность по годам, истечение договоров и ставка по каждому активу.",
              },
              {
                to: "/plans",
                title: "Планы",
                text: lead
                  ? `${lead.asset.name} уже открывается объёмом. Зоны правятся мышью или фразой.`
                  : "Объём здания и правка зон.",
              },
            ] as const
          ).map((item) => (
            <Link key={item.to} to={item.to} className="bg-paper p-5 hover:bg-bone">
              <h3 className="font-display text-2xl">{item.title}</h3>
              <p className="mt-2 text-sm text-ink-soft">{item.text}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
