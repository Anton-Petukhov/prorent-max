import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import ElectronPlan from "@/components/electron-plan";
import {
  electronBook,
  electronFloors,
  electronStatus,
  electronTotals,
  roomPath,
  type ElectronStatus,
} from "@/lib/electron";

export const Route = createFileRoute("/electron")({ component: ElectronPage });

const fine = (value: number) => value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });

function ElectronPage() {
  const [level, setLevel] = useState(1);
  const [mode, setMode] = useState<"3d" | "2d">("3d");
  const [status, setStatus] = useState<ElectronStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>("1.01");
  const floor = electronFloors.find((item) => item.number === level) ?? electronFloors[0];
  const floorStats = electronTotals(floor.rooms);
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ru");
    return floor.rooms.filter((room) => {
      const matchesStatus = status === "all" || room.status === status;
      const haystack = `${room.id} ${room.legacy} ${room.name} ${room.note}`.toLocaleLowerCase("ru");
      return matchesStatus && (!needle || haystack.includes(needle));
    });
  }, [floor, query, status]);
  const selected = floor.rooms.find((room) => room.id === selectedId) ?? visible[0] ?? null;
  const [cropX, cropY, cropW, cropH] = floor.crop;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Иркутск · схема ЦФ-3.2 от 20.07.2026</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">ТЦ «Электрон»</h1>
          <p className="mt-3 max-w-2xl text-ink-soft">
            ул. Рабочая. Два этажа со старой версии: точный план и объём со стенами и стеклом. Европейская книга
            и остальные объекты не менялись — этот блок можно убрать, не трогая их.
          </p>
        </div>
        <Link to="/brand-hall" className="text-sm text-copper">
          К Брэнд Холлу
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Учтённая площадь" value={`${fine(electronBook.total)} м²`} note="сумма из PDF, без коридоров" />
        <Stat label="Занято / торговая" value={`${fine(electronBook.occupied)} м²`} note={`${electronBook.occupancy.toFixed(2)}%`} />
        <Stat label="Вакантно" value={`${fine(electronBook.vacant)} м²`} note="9 помещений" />
        <Stat label="Помещения" value={String(electronBook.count)} note="12 на первом · 9 на втором" />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {electronFloors.map((item) => (
            <button
              key={item.number}
              type="button"
              className={item.number === floor.number ? "btn" : "btn btn-ghost"}
              onClick={() => {
                setLevel(item.number);
                setSelectedId(item.rooms[0]?.id ?? null);
                setQuery("");
              }}
            >
              {item.name}
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

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-stone">
          Поиск
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Номер, название, арендатор"
            className="mt-1 block border border-line bg-paper px-3 py-2 text-ink"
          />
        </label>
        <label className="text-sm text-stone">
          Статус
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as ElectronStatus | "all")}
            className="mt-1 block border border-line bg-paper px-3 py-2 text-ink"
          >
            <option value="all">Все</option>
            <option value="occupied">Занято</option>
            <option value="vacant">Вакантно</option>
          </select>
        </label>
        <p className="nums text-sm text-stone">
          {floor.name}: {fine(floorStats.total)} м² · вакантно {fine(floorStats.vacant)} · найдено {visible.length} из {floor.rooms.length}
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.5fr_0.7fr]">
        <article className="panel overflow-hidden">
          {mode === "3d" ? (
            <ElectronPlan
              floor={floor}
              selectedId={selected?.id ?? null}
              visibleIds={visible.map((room) => room.id)}
              onSelect={setSelectedId}
            />
          ) : (
            <div className="bg-bone p-3">
              <svg viewBox={`${cropX} ${cropY} ${cropW} ${cropH}`} className="h-canvas w-full" role="img" aria-label={`План ${floor.name}`}>
                <image href={`/electron/floor-${floor.number}.svg`} x={cropX} y={cropY} width={cropW} height={cropH} />
                {floor.rooms.map((room) => {
                  const shown = visible.some((item) => item.id === room.id);
                  return (
                    <path
                      key={room.id}
                      d={roomPath(room)}
                      fill={electronStatus[room.status].color}
                      fillOpacity={room.id === selected?.id ? 0.45 : shown ? 0.18 : 0.04}
                      stroke={room.id === selected?.id ? "#1a1814" : "transparent"}
                      strokeWidth={1.4}
                      className="cursor-pointer"
                      onClick={() => shown && setSelectedId(room.id)}
                    />
                  );
                })}
              </svg>
            </div>
          )}
        </article>
        <aside className="panel flex flex-col gap-3 p-4">
          {selected ? (
            <>
              <p className="kicker">{floor.name}{selected.legacy ? ` · № ${selected.legacy}` : ""}</p>
              <h2 className="font-display text-3xl">
                {selected.id} {selected.name}
              </h2>
              <p className="nums font-display text-4xl">
                {fine(selected.area)}
                <span className="ml-2 font-sans text-base text-stone">м²</span>
              </p>
              <p className="text-sm">{electronStatus[selected.status].label}</p>
              {selected.note && <p className="text-sm text-stone">{selected.note}</p>}
            </>
          ) : (
            <p className="text-stone">Ничего не найдено.</p>
          )}
          <ul className="mt-2 max-h-80 overflow-auto">
            {visible.map((room) => (
              <li key={room.id}>
                <button
                  type="button"
                  className="flex w-full items-baseline justify-between gap-3 border-b border-line py-2 text-left text-sm"
                  onClick={() => setSelectedId(room.id)}
                >
                  <span>
                    {room.id} {room.name}
                    <span className="mt-0.5 block text-xs text-stone">{electronStatus[room.status].label}</span>
                  </span>
                  <span className="nums">{fine(room.area)}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </section>
      <img src="/electron/facades.webp" alt="Фасады ТЦ «Электрон», рекламные места 3.2.1–3.2.12" className="panel w-full" />
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
