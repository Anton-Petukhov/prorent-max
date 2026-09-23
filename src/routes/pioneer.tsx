import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import PioneerPlan from "@/components/pioneer-plan";
import { pioneerFloors, pioneerRooms, pioneerStatus, pioneerTotals, type PioneerRoom } from "@/lib/pioneer";

export const Route = createFileRoute("/pioneer")({ component: PioneerPage });

const fine = (value: number) => value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });

function PioneerPage() {
  const [floor, setFloor] = useState<(typeof pioneerFloors)[number]>("1 этаж");
  const [selectedId, setSelectedId] = useState<number | null>(5);
  const [mode, setMode] = useState<"3d" | "2d">("3d");
  const totals = pioneerTotals();
  const floorRooms = useMemo(() => pioneerRooms.filter((room) => room.floor === floor), [floor]);
  const floorStats = pioneerTotals(floorRooms);
  const selected = pioneerRooms.find((room) => room.id === selectedId) ?? floorRooms[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Иркутск · 3D-эталон из прошлого ProRent</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">Галерея «Пионер»</h1>
          <p className="mt-3 max-w-2xl text-ink-soft">
            Объёмный план с редактором стен: выберите стену, сдвиньте её по полу и поменяйте высоту. Цифры —
            демо-книга галереи, не европейский портфель.
          </p>
        </div>
        <Link to="/brand-hall" className="text-sm text-copper">
          ТД «Брэнд Холл»
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Общая площадь" value={`${fine(totals.total)} м²`} note={`${totals.rooms} помещений`} />
        <Stat label="Арендовано" value={`${fine(totals.occupied)} м²`} note={`${totals.occupancy.toFixed(1)}%`} />
        <Stat label="Свободно" value={`${fine(totals.vacant)} м²`} note="Торговое 1 и Офис 201" />
        <Stat label="Бронь" value={`${fine(totals.reserved)} м²`} note="Coffee Lab · Офис 202" />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {pioneerFloors.map((item) => (
            <button
              key={item}
              type="button"
              className={item === floor ? "btn" : "btn btn-ghost"}
              onClick={() => {
                setFloor(item);
                setSelectedId(pioneerRooms.find((room) => room.floor === item)?.id ?? null);
              }}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button type="button" className={mode === "3d" ? "btn" : "btn btn-ghost"} onClick={() => setMode("3d")}>
            3D
          </button>
          <button type="button" className={mode === "2d" ? "btn" : "btn btn-ghost"} onClick={() => setMode("2d")}>
            2D
          </button>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.5fr_0.7fr]">
        <article className="panel overflow-hidden">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <p className="kicker">Этаж</p>
              <h2 className="font-display text-2xl">{floor}</h2>
            </div>
            <p className="nums text-sm text-stone">
              {fine(floorStats.total)} м² · свободно {fine(floorStats.vacant)} · бронь {fine(floorStats.reserved)}
            </p>
          </div>
          {mode === "3d" ? (
            <PioneerPlan
              rooms={floorRooms}
              allFloorRooms={floorRooms}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ) : (
            <FlatPlan rooms={floorRooms} selectedId={selectedId} onSelect={setSelectedId} />
          )}
        </article>
        <aside className="panel flex flex-col gap-3 p-4">
          {selected ? (
            <>
              <p className="kicker">{selected.floor}</p>
              <h2 className="font-display text-3xl">{selected.name}</h2>
              <p className="nums font-display text-4xl">
                {fine(selected.area)}
                <span className="ml-2 font-sans text-base text-stone">м²</span>
              </p>
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between border-b border-line py-1">
                  <dt className="text-stone">Арендатор</dt>
                  <dd>{selected.tenant}</dd>
                </div>
                <div className="flex justify-between border-b border-line py-1">
                  <dt className="text-stone">Статус</dt>
                  <dd>{pioneerStatus[selected.status].label}</dd>
                </div>
                <div className="flex justify-between border-b border-line py-1">
                  <dt className="text-stone">Тип</dt>
                  <dd>{selected.type}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="text-stone">Выберите помещение на плане.</p>
          )}
          <ul className="mt-2 flex flex-col">
            {floorRooms.map((room) => (
              <li key={room.id}>
                <button
                  type="button"
                  className="flex w-full items-baseline justify-between gap-3 border-b border-line py-2 text-left text-sm"
                  onClick={() => setSelectedId(room.id)}
                >
                  <span>
                    {room.name}
                    <span className="mt-0.5 block text-xs text-stone">{room.tenant}</span>
                  </span>
                  <span className="nums">{fine(room.area)}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
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

function FlatPlan({
  rooms,
  selectedId,
  onSelect,
}: {
  rooms: PioneerRoom[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const points = rooms.flatMap((room) =>
    room.shape.split(" ").map((pair) => {
      const [x, y] = pair.split(",").map(Number);
      return { x: x ?? 0, y: y ?? 0 };
    }),
  );
  const minX = Math.min(...points.map((point) => point.x)) - 24;
  const minY = Math.min(...points.map((point) => point.y)) - 24;
  const maxX = Math.max(...points.map((point) => point.x)) + 24;
  const maxY = Math.max(...points.map((point) => point.y)) + 24;

  return (
    <div className="bg-bone p-3">
      <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} className="h-canvas w-full" role="img">
        {rooms.map((room) => (
          <g key={room.id} onClick={() => onSelect(room.id)} className="cursor-pointer">
            <polygon
              points={room.shape}
              fill={pioneerStatus[room.status].color}
              fillOpacity={0.85}
              stroke={room.id === selectedId ? "#1a1814" : "#3c3832"}
              strokeWidth={room.id === selectedId ? 3 : 1}
            />
            <text x={room.labelX} y={room.labelY} textAnchor="middle" fontSize="14" fill="#1a1814">
              {room.name}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
