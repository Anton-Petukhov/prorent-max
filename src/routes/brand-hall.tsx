import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import BrandHall3D from "@/components/brand-hall-3d";
import { AreaMix, DonutMix, MixLegend, StackBars } from "@/components/charts";
import {
  brandFloors,
  floorOrder,
  kindMeta,
  type BrandFloor,
  type BrandRoom,
  type RoomKind,
} from "@/lib/brand-hall";
import {
  brandDeltas,
  brandFacts,
  brandMoves,
  brandSeries,
  brandSnapshotAt,
  brandSnapshots,
  paintBrandRoom,
  prettySchemeDate,
  qiForDate,
  type BrandSnapshot,
} from "@/lib/brand-history";
import { pct } from "@/lib/format";
import { QUARTERS } from "@/lib/quarters";
import { usePortfolio } from "@/lib/store";
import { theme } from "@/lib/theme";

export const Route = createFileRoute("/brand-hall")({ component: BrandHallPage });

const fine = (value: number) => value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });

function BrandHallPage() {
  const qi = usePortfolio((state) => state.qi);
  const setQi = usePortfolio((state) => state.setQi);
  const [pin, setPin] = useState<{ date: string; qi: number } | null>(null);
  const quarterSnap = brandSnapshotAt(qi);
  const snapshot: BrandSnapshot | null =
    pin && pin.qi === qi ? (brandSnapshots.find((item) => item.date === pin.date) ?? quarterSnap) : quarterSnap;
  const facts = brandFacts(snapshot);
  const history = useMemo(() => brandDeltas(), []);
  const mix = useMemo(() => brandSeries(), []);
  const moves = useMemo(() => (snapshot ? brandMoves(snapshot.date) : []), [snapshot]);
  const [floorName, setFloorName] = useState("1 этаж");
  const [selectedId, setSelectedId] = useState("f1-105");
  const [mode, setMode] = useState<"3d" | "2d">("3d");
  const [filter, setFilter] = useState<RoomKind | "all">("all");

  const floors = useMemo(
    () =>
      brandFloors.map((item) => ({
        ...item,
        rooms: item.rooms.map((room) => paintBrandRoom(room, snapshot)),
      })),
    [snapshot],
  );
  const floor = floors.find((item) => item.name === floorName) ?? floors[2];
  const selected = floors.flatMap((item) => item.rooms).find((item) => item.id === selectedId) ?? floor.rooms[0];
  const visibleRooms = useMemo(
    () => floor.rooms.filter((room) => filter === "all" || room.kind === filter),
    [filter, floor],
  );
  const floorRooms = snapshot?.rooms.filter((room) => room.floor === floor.name && room.id !== "3.04А" && room.area) ?? [];
  const floorArea = floorRooms.reduce((sum, room) => sum + (room.area ?? 0), 0);
  const floorVacant = floorRooms.filter((room) => room.kind === "vacant").reduce((sum, room) => sum + (room.area ?? 0), 0);
  const occupancy = floorArea > 0 ? ((floorArea - floorVacant) / floorArea) * 100 : null;
  const levels = useMemo(() => levelRows(snapshot), [snapshot]);

  const openScheme = (date: string) => {
    const next = qiForDate(date);
    setPin({ date, qi: next });
    setQi(next);
  };

  const changeFloor = (nextName: string) => {
    const next = floors.find((item) => item.name === nextName);
    setFloorName(nextName);
    setSelectedId(next?.rooms[0]?.id ?? "");
    setFilter("all");
  };

  if (!selected) return null;

  return (
    <div className="flex flex-col gap-6">
      <header className="grid items-end gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="kicker">Иркутск · {snapshot ? `схема ${prettySchemeDate(snapshot.stamp ?? snapshot.date)}` : "до первой схемы"}</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">ТД «Брэнд Холл»</h1>
          <p className="mt-3 max-w-2xl text-ink-soft">
            ул. Карла Маркса, 35. Площади и цвета сняты с схем СР2-35, с 17 января 2023 по 1 мая 2026. Лента внизу
            экрана двигает и этот объект, и общий портфель. Клик по строке истории открывает конкретный лист.
          </p>
          <Link to="/pioneer" className="mt-4 inline-block text-sm text-copper">
            3D-эталон «Пионер»
          </Link>
        </div>
        <figure className="panel overflow-hidden">
          <img
            src="/photos/brand-hall.jpg"
            alt="Фасад ТД «Брэнд Холл» на улице Карла Маркса"
            className="aspect-[3/2] w-full object-cover object-top"
          />
          <figcaption className="flex items-baseline justify-between gap-3 px-4 py-3 text-sm">
            <span>Карла Маркса, 35</span>
            <span className="text-stone">Иркутск</span>
          </figcaption>
        </figure>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Учтённая площадь" value={snapshot ? `${fine(facts.total)} м²` : "—"} note={snapshot ? `${facts.rooms} помещений с площадью` : "схемы ещё нет"} />
        <Stat
          label="Торговая"
          value={snapshot ? `${fine(facts.trade)} м²` : "—"}
          note={snapshot && facts.total ? `${((facts.trade / facts.total) * 100).toFixed(1)}% учтённой` : "занятая коммерция"}
        />
        <Stat
          label="Вакантная"
          value={snapshot ? `${fine(facts.vacant)} м²` : "—"}
          note={snapshot && facts.total ? `${((facts.vacant / facts.total) * 100).toFixed(1)}% учтённой` : "оранжевые зоны"}
        />
        <Stat
          label="Склады"
          value={snapshot ? `${fine(facts.storage)} м²` : "—"}
          note={snapshot ? `служебные ${fine(facts.service)} м²` : "жёлтые зоны"}
        />
      </section>

      <section className="panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">Площадь во времени</h2>
            <p className="text-sm text-stone">Последний лист каждого квартала. Пунктир — выбранный срез ленты.</p>
          </div>
          <MixLegend />
        </div>
        <AreaMix data={mix} mark={QUARTERS[qi]} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-4 sm:p-5">
          <h2 className="font-display text-2xl">Смесь на срезе</h2>
          <DonutMix
            slices={[
              { name: "Торговля", value: facts.trade, fill: theme.copper },
              { name: "Склады", value: facts.storage, fill: theme.pine },
              { name: "Вакант", value: facts.vacant, fill: theme.vacant },
            ]}
            center={facts.total ? pct(facts.occupancy) : "—"}
            caption="занято"
          />
        </div>
        <div className="panel p-4 sm:p-5">
          <h2 className="font-display text-2xl">Уровни</h2>
          <p className="mb-2 text-sm text-stone">Торговля, склады и вакант на открытом листе.</p>
          <StackBars
            data={levels.map((item) => ({
              name: item.name.replace(" этаж", " эт."),
              commercial: item.trade,
              warehouse: item.storage,
              vacant: item.vacant,
            }))}
            bars={[
              { key: "commercial", name: "Торговля", fill: theme.copper },
              { key: "warehouse", name: "Склады", fill: theme.pine },
              { key: "vacant", name: "Вакант", fill: theme.vacant },
            ]}
          />
        </div>
      </section>

      <div className="flex gap-1 overflow-x-auto">
        {floorOrder.map((item) => (
          <button
            key={item}
            type="button"
            className={item === floorName ? "btn shrink-0" : "btn btn-ghost shrink-0"}
            onClick={() => changeFloor(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
            Все
          </FilterChip>
          {!floor.parking &&
            (Object.keys(kindMeta) as RoomKind[]).map((kind) => (
              <FilterChip key={kind} active={filter === kind} onClick={() => setFilter(kind)}>
                {kindMeta[kind].label}
              </FilterChip>
            ))}
        </div>
        <div className="flex gap-1">
          <FilterChip active={mode === "3d"} onClick={() => setMode("3d")}>
            3D
          </FilterChip>
          <FilterChip active={mode === "2d"} onClick={() => setMode("2d")}>
            2D
          </FilterChip>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.5fr_0.7fr]">
        <article className="panel overflow-hidden">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <p className="kicker">{floor.parking ? "Условная схема" : "Контуры из PDF"}</p>
              <h2 className="font-display text-2xl">{floorName}</h2>
            </div>
            <p className="nums text-sm text-stone">
              {floor.parking
                ? "10 мест · 2 автомобиля"
                : floorArea
                  ? `${fine(floorArea)} м² · вакант ${fine(floorVacant)} · ${occupancy?.toFixed(1)}%`
                  : "площади на схеме не подписаны"}
            </p>
          </div>
          {mode === "3d" ? (
            <BrandHall3D floor={floor} rooms={visibleRooms} selectedId={selectedId} onSelect={setSelectedId} />
          ) : (
            <Plan2D floor={floor} visibleRooms={visibleRooms} selectedId={selectedId} onSelect={setSelectedId} />
          )}
        </article>
        <aside className="panel flex flex-col gap-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="kicker">{selected.floor}</p>
              <h2 className="font-display text-3xl">{selected.name}</h2>
            </div>
            <span className="text-xs tracking-caps text-stone uppercase">
              {floor.parking ? "Парковка" : kindMeta[selected.kind].label}
            </span>
          </div>
          <p className="nums font-display text-4xl">
            {selected.area === null ? "—" : fine(selected.area)}
            <span className="ml-2 font-sans text-base text-stone">м²</span>
          </p>
          <dl className="grid gap-2 text-sm">
            <Row term="Категория" value={floor.parking ? "Парковка" : kindMeta[selected.kind].label} />
            <Row term="Этаж" value={selected.floor} />
            <Row term="Источник" value={snapshot ? `СР2-35 · ${prettySchemeDate(snapshot.stamp ?? snapshot.date)}` : "ещё нет схемы"} />
          </dl>
          {selected.note && <p className="text-sm text-copper-deep">{selected.note}</p>}
          <p className="text-sm text-stone">
            Помещения без площади и зоны с пометкой «не включено» не входят в итог, чтобы общая площадь не
            задваивалась.
          </p>
        </aside>
      </section>

      <section className="panel overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <caption className="px-4 py-3 text-left font-display text-2xl">Экспликация · {floorName}</caption>
          <thead>
            <tr className="text-xs text-stone">
              <th className="px-4 py-2 font-medium">Помещение</th>
              <th className="px-4 py-2 font-medium">Категория</th>
              <th className="px-4 py-2 text-right font-medium">Площадь</th>
            </tr>
          </thead>
          <tbody>
            {floor.rooms.map((room) => (
              <tr
                key={room.id}
                className={room.id === selectedId ? "bg-bone" : undefined}
                onClick={() => setSelectedId(room.id)}
              >
                <td className="px-4 py-2">{room.name}</td>
                <td className="px-4 py-2 text-stone">{floor.parking ? "Парковка" : kindMeta[room.kind].label}</td>
                <td className="nums px-4 py-2 text-right">{room.area === null ? "—" : `${fine(room.area)} м²`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <caption className="px-4 py-3 text-left font-display text-2xl">Статистика по уровням</caption>
          <thead>
            <tr className="text-xs text-stone">
              <th className="px-4 py-2 font-medium">Уровень</th>
              <th className="px-4 py-2 text-right font-medium">Учтено, м²</th>
              <th className="px-4 py-2 text-right font-medium">Торговля</th>
              <th className="px-4 py-2 text-right font-medium">Вакант</th>
              <th className="px-4 py-2 text-right font-medium">Склад</th>
              <th className="px-4 py-2 text-right font-medium">Служебные</th>
              <th className="px-4 py-2 text-right font-medium">Заполнение</th>
            </tr>
          </thead>
          <tbody>
            {levels.map((item) => (
              <tr key={item.name}>
                <td className="px-4 py-2">{item.name}</td>
                <td className="nums px-4 py-2 text-right">{item.total ? fine(item.total) : "—"}</td>
                <td className="nums px-4 py-2 text-right">{item.total ? fine(item.trade) : "—"}</td>
                <td className="nums px-4 py-2 text-right">{item.total ? fine(item.vacant) : "—"}</td>
                <td className="nums px-4 py-2 text-right">{item.total ? fine(item.storage) : "—"}</td>
                <td className="nums px-4 py-2 text-right">{item.total ? fine(item.service) : "—"}</td>
                <td className="nums px-4 py-2 text-right">
                  {item.total ? `${(((item.total - item.vacant) / item.total) * 100).toFixed(1)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel overflow-x-auto">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <caption className="px-4 py-3 text-left">
            <span className="font-display text-2xl">История схем</span>
            <span className="mt-1 block text-sm text-stone">
              {history.length} уникальных листов. Строка открывает схему на плане. Общая лента берёт последний лист
              квартала
              {quarterSnap && snapshot && quarterSnap.date !== snapshot.date
                ? ` — сейчас открыт более ранний, на срезе портфеля ${prettySchemeDate(quarterSnap.stamp ?? quarterSnap.date)}`
                : ""}
              .
            </span>
          </caption>
          <thead>
            <tr className="text-xs text-stone">
              <th className="px-4 py-2 font-medium">Штамп</th>
              <th className="px-4 py-2 font-medium">Файл</th>
              <th className="px-4 py-2 text-right font-medium">Учтено</th>
              <th className="px-4 py-2 text-right font-medium">Торговля</th>
              <th className="px-4 py-2 text-right font-medium">Вакант</th>
              <th className="px-4 py-2 text-right font-medium">Склад</th>
              <th className="px-4 py-2 text-right font-medium">Служебные</th>
              <th className="px-4 py-2 text-right font-medium">Заполнение</th>
              <th className="px-4 py-2 text-right font-medium">Помещений</th>
            </tr>
          </thead>
          <tbody>
            {history.map((row) => {
              const active = snapshot?.date === row.date;
              return (
                <tr
                  key={row.date}
                  className={active ? "bg-bone" : "cursor-pointer"}
                  onClick={() => openScheme(row.date)}
                >
                  <td className="px-4 py-2">{prettySchemeDate(row.stamp ?? row.date)}</td>
                  <td className="px-4 py-2 text-stone">{prettySchemeDate(row.date)}</td>
                  <td className="nums px-4 py-2 text-right">{fine(row.facts.total)}</td>
                  <td className="nums px-4 py-2 text-right">
                    {fine(row.facts.trade)}
                    <span className="ml-1 text-xs text-stone">{signed(row.tradeDelta)}</span>
                  </td>
                  <td className="nums px-4 py-2 text-right">
                    {fine(row.facts.vacant)}
                    <span className="ml-1 text-xs text-stone">{signed(row.vacantDelta)}</span>
                  </td>
                  <td className="nums px-4 py-2 text-right">
                    {fine(row.facts.storage)}
                    <span className="ml-1 text-xs text-stone">{signed(row.storageDelta)}</span>
                  </td>
                  <td className="nums px-4 py-2 text-right">{fine(row.facts.service)}</td>
                  <td className="nums px-4 py-2 text-right">{row.facts.occupancy.toFixed(1)}%</td>
                  <td className="nums px-4 py-2 text-right">{row.facts.rooms}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="panel p-4">
        <h2 className="font-display text-2xl">
          Что изменилось
          {snapshot ? ` к ${prettySchemeDate(snapshot.stamp ?? snapshot.date)}` : ""}
        </h2>
        {moves.length === 0 ? (
          <p className="mt-3 text-sm text-stone">К предыдущему листу площади и статусы помещений не менялись, либо это первая схема.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {moves.map((move) => (
              <li key={`${move.floor}-${move.id}`} className="border-t border-line pt-2 text-sm">
                <p>
                  {move.floor} · {move.id}
                </p>
                <p className="text-stone">
                  {move.from ? kindMeta[move.from].label : "новое"} → {kindMeta[move.to].label}
                  {" · "}
                  {move.areaFrom === null ? "—" : `${fine(move.areaFrom)} м²`} →{" "}
                  {move.areaTo === null ? "—" : `${fine(move.areaTo)} м²`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const LEVELS = ["Подвал", "1 этаж", "2 этаж", "3 этаж", "Мансарда"];

function levelRows(snapshot: BrandSnapshot | null) {
  return LEVELS.map((name) => {
    const rooms = snapshot?.rooms.filter((room) => room.floor === name && room.id !== "3.04А" && room.area) ?? [];
    const sum = (kind?: RoomKind) =>
      rooms.filter((room) => kind === undefined || room.kind === kind).reduce((total, room) => total + (room.area ?? 0), 0);
    return { name, total: sum(), trade: sum("trade"), vacant: sum("vacant"), storage: sum("storage"), service: sum("service") };
  });
}

function signed(value: number): string {
  if (!value) return "";
  const text = fine(Math.abs(value));
  return value > 0 ? `+${text}` : `−${text}`;
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="panel p-4">
      <p className="kicker">{label}</p>
      <p className="nums mt-2 font-display text-3xl">{value}</p>
      <p className="mt-1 text-sm text-stone">{note}</p>
    </article>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button type="button" className={active ? "btn shrink-0" : "btn btn-ghost shrink-0"} onClick={onClick}>
      {children}
    </button>
  );
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line py-1">
      <dt className="text-stone">{term}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Plan2D({
  floor,
  visibleRooms,
  selectedId,
  onSelect,
}: {
  floor: BrandFloor;
  visibleRooms: BrandRoom[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const visible = new Set(visibleRooms.map((room) => room.id));
  return (
    <div className="bg-bone p-3">
      <svg viewBox="0 0 1000 650" role="img" aria-label={`План: ${floor.name}`} className="h-canvas w-full">
        <path d={floor.outline} fill="#f7f4ee" stroke="#1a1814" strokeWidth="2" />
        {floor.cores.map((core, index) => (
          <g key={index}>
            <rect x={core.x} y={core.y} width={core.width} height={core.height} fill="#d9d2c6" stroke="#8a8378" />
          </g>
        ))}
        {floor.rooms.map((room) => (
          <g
            key={room.id}
            opacity={visible.has(room.id) ? 1 : 0.25}
            onClick={() => onSelect(room.id)}
            className="cursor-pointer"
          >
            <polygon
              points={room.shape}
              fill={kindMeta[room.kind].color}
              stroke={room.id === selectedId ? "#1a1814" : "#3c3832"}
              strokeWidth={room.id === selectedId ? 3 : 1}
            />
            {!floor.parking && (
              <text x={room.labelX} y={room.labelY} textAnchor="middle" fontSize="16" fill="#1a1814">
                {room.name}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
