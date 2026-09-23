import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import BrandHall3D from "@/components/brand-hall-3d";
import {
  allBrandRooms,
  areaOf,
  brandFloors,
  brandTotals,
  floorOrder,
  kindMeta,
  type BrandFloor,
  type BrandRoom,
  type RoomKind,
} from "@/lib/brand-hall";

export const Route = createFileRoute("/brand-hall")({ component: BrandHallPage });

const fine = (value: number) => value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });

function BrandHallPage() {
  const [floorName, setFloorName] = useState("1 этаж");
  const [selectedId, setSelectedId] = useState("f1-105");
  const [mode, setMode] = useState<"3d" | "2d">("3d");
  const [filter, setFilter] = useState<RoomKind | "all">("all");

  const floor = brandFloors.find((item) => item.name === floorName) ?? brandFloors[2];
  const selected = allBrandRooms.find((item) => item.id === selectedId) ?? floor.rooms[0];
  const visibleRooms = useMemo(
    () => floor.rooms.filter((room) => filter === "all" || room.kind === filter),
    [filter, floor],
  );
  const floorArea = areaOf(floor.rooms);
  const floorVacant = areaOf(floor.rooms, "vacant");
  const occupancy = floorArea > 0 ? ((floorArea - floorVacant) / floorArea) * 100 : null;

  const changeFloor = (nextName: string) => {
    const next = brandFloors.find((item) => item.name === nextName);
    setFloorName(nextName);
    setSelectedId(next?.rooms[0]?.id ?? "");
    setFilter("all");
  };

  if (!selected) return null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Иркутск · архив схемы СР2-35</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">ТД «Брэнд Холл»</h1>
          <p className="mt-3 max-w-2xl text-ink-soft">
            ул. Карла Маркса, 35. Контуры и площади сняты со схемы от 01.05.2026: торговля, вакант, склады и
            служебные. Парковка — условная модель на 10 мест.
          </p>
        </div>
        <Link to="/pioneer" className="text-sm text-copper">
          3D-эталон «Пионер»
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Учтённая площадь" value={`${fine(brandTotals.total)} м²`} note="без двойного счёта общих зон" />
        <Stat
          label="Торговая"
          value={`${fine(brandTotals.trade)} м²`}
          note={`${((brandTotals.trade / brandTotals.total) * 100).toFixed(1)}% учтённой`}
        />
        <Stat
          label="Вакантная"
          value={`${fine(brandTotals.vacant)} м²`}
          note={`${((brandTotals.vacant / brandTotals.total) * 100).toFixed(1)}% учтённой`}
        />
        <Stat
          label="Склад + служебные"
          value={`${fine(brandTotals.storage + brandTotals.service)} м²`}
          note={`${brandTotals.levels} уровней · ${brandTotals.zones} зон`}
        />
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
            <Row term="Источник" value={floor.parking ? "Концепт" : "СР2-35 · 01.05.2026"} />
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
              <th className="px-4 py-2 text-right font-medium">Заполнение</th>
            </tr>
          </thead>
          <tbody>
            {brandFloors.map((item) => {
              const total = areaOf(item.rooms);
              const vacant = areaOf(item.rooms, "vacant");
              return (
                <tr key={item.name}>
                  <td className="px-4 py-2">{item.name}</td>
                  <td className="nums px-4 py-2 text-right">{total ? fine(total) : "—"}</td>
                  <td className="nums px-4 py-2 text-right">{fine(areaOf(item.rooms, "trade"))}</td>
                  <td className="nums px-4 py-2 text-right">{fine(vacant)}</td>
                  <td className="nums px-4 py-2 text-right">{fine(areaOf(item.rooms, "storage"))}</td>
                  <td className="nums px-4 py-2 text-right">
                    {total ? `${(((total - vacant) / total) * 100).toFixed(1)}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
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
