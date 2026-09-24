import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import ElectronPlan from "@/components/electron-plan";
import { AreaMix, DonutMix, MixLegend, StackBars } from "@/components/charts";
import { electronFloors, electronStatus, roomPath, type ElectronRoom, type ElectronStatus } from "@/lib/electron";
import {
  electronDeltas,
  electronFacts,
  electronMoves,
  electronSeries,
  electronShifts,
  electronFlipFlops,
  electronSnapshotAt,
  electronSnapshots,
  paintElectronRoom,
  planRoomFor,
  prettySchemeDate,
  qiForDate,
  type ElectronKind,
  type ElectronSnapshot,
} from "@/lib/electron-history";
import { pct } from "@/lib/format";
import { QUARTERS } from "@/lib/quarters";
import { usePortfolio } from "@/lib/store";
import { theme } from "@/lib/theme";

export const Route = createFileRoute("/electron")({ component: ElectronPage });

const fine = (value: number) => value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });

const KIND_LABEL: Record<ElectronKind, string> = {
  trade: "Торговля",
  vacant: "Вакант",
  storage: "Склад",
};

const EDIT_KEY = "prorent-electron-plan-edits";

type ElectronEdit = {
  status?: ElectronStatus;
  name?: string;
  area?: number;
  note?: string;
};

function readEdits(): Record<string, ElectronEdit> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(EDIT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ElectronEdit>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function withEdit(room: ElectronRoom, edit: ElectronEdit | undefined): ElectronRoom {
  if (!edit) return room;
  return {
    ...room,
    status: edit.status ?? room.status,
    name: edit.name ?? room.name,
    area: typeof edit.area === "number" ? edit.area : room.area,
    note: edit.note ?? room.note,
    sheetId: room.id,
    layout: "same",
  };
}

function ElectronPage() {
  const qi = usePortfolio((state) => state.qi);
  const setQi = usePortfolio((state) => state.setQi);
  const [pin, setPin] = useState<{ date: string; qi: number } | null>(null);
  const quarterSnap = electronSnapshotAt(qi);
  const snapshot: ElectronSnapshot | null =
    pin && pin.qi === qi ? (electronSnapshots.find((item) => item.date === pin.date) ?? quarterSnap) : quarterSnap;
  const facts = electronFacts(snapshot);
  const history = useMemo(() => electronDeltas(), []);
  const mix = useMemo(() => electronSeries(), []);
  const shifts = useMemo(() => electronShifts(), []);
  const flips = useMemo(() => electronFlipFlops(), []);
  const moves = useMemo(() => (snapshot ? electronMoves(snapshot.date) : []), [snapshot]);
  const levels = useMemo(() => levelRows(snapshot), [snapshot]);
  const [level, setLevel] = useState(1);
  const [mode, setMode] = useState<"3d" | "2d">("3d");
  const [status, setStatus] = useState<ElectronStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>("1.01");
  const [editor, setEditor] = useState(false);
  const [edits, setEdits] = useState<Record<string, ElectronEdit>>({});
  const [editsReady, setEditsReady] = useState(false);
  const [undo, setUndo] = useState<Record<string, ElectronEdit>[]>([]);
  const focusEdits = useRef(edits);

  useEffect(() => {
    setEdits(readEdits());
    setEditsReady(true);
  }, []);

  useEffect(() => {
    if (!editsReady) return;
    window.localStorage.setItem(EDIT_KEY, JSON.stringify(edits));
  }, [edits, editsReady]);

  const floors = useMemo(() => {
    if (editor) {
      return electronFloors.map((item) => ({
        ...item,
        rooms: item.rooms.map((room) => withEdit(room, edits[room.id])),
      }));
    }
    return electronFloors.map((item) => ({
      ...item,
      rooms: item.rooms.map((room) => paintElectronRoom(room, snapshot)),
    }));
  }, [editor, edits, snapshot]);
  const floor = floors.find((item) => item.number === level) ?? floors[0];
  const floorRooms = snapshot?.rooms.filter((room) => room.floor === floor.number) ?? [];
  const floorArea = floorRooms.reduce((sum, room) => sum + room.area, 0);
  const floorVacant = floorRooms.filter((room) => room.kind === "vacant").reduce((sum, room) => sum + room.area, 0);
  const sheetOnly = snapshot?.rooms.filter((room) => room.floor === floor.number && !planRoomFor(room)) ?? [];
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ru");
    return floor.rooms.filter((room) => {
      const matchesStatus = status === "all" || (room.layout !== "missing" && room.status === status);
      const haystack = `${room.id} ${room.legacy} ${room.name} ${room.note}`.toLocaleLowerCase("ru");
      return matchesStatus && (!needle || haystack.includes(needle));
    });
  }, [floor, query, status]);
  const selected = floor.rooms.find((room) => room.id === selectedId) ?? visible[0] ?? null;
  const [cropX, cropY, cropW, cropH] = floor.crop;

  const openScheme = (date: string) => {
    const next = qiForDate(date);
    setPin({ date, qi: next });
    setQi(next);
  };

  const remember = () => setUndo((stack) => [...stack.slice(-30), edits]);
  const patchRoom = (id: string, patch: ElectronEdit) => {
    setEdits((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  };
  const undoEdit = () => {
    const previous = undo.at(-1);
    if (!previous) return;
    setUndo((stack) => stack.slice(0, -1));
    setEdits(previous);
  };
  const resetRoom = (id: string) => {
    remember();
    setEdits((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };
  const keepTextUndo = () => {
    if (JSON.stringify(focusEdits.current) === JSON.stringify(edits)) return;
    setUndo((stack) => [...stack.slice(-30), focusEdits.current]);
  };

  if (!floor) return null;

  return (
    <div className="flex flex-col gap-6">
      <header className="grid items-end gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="kicker">
            Иркутск · {snapshot ? `схема ${prettySchemeDate(snapshot.date)}` : "до первой схемы"}
          </p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">ТЦ «Электрон»</h1>
          <p className="mt-3 max-w-2xl text-ink-soft">
            ул. Рабочая. Площади с листов ЦФ-3.2, с 30 ноября 2022 по 20 июля 2026. Номера не сидели на одном месте:
            зал 479 был 1.12, потом переехал на 1.10, а старые 1.05, 1.06, 1.07 и 1.11 после перепланировки сели на другие
            контуры. Контуры на экране — схема 20.07.2026. Лента листает и этот объект. В европейский rent roll он не входит.
          </p>
          <Link to="/brand-hall" className="mt-4 inline-block text-sm text-copper">
            К Брэнд Холлу
          </Link>
        </div>
        <figure className="panel overflow-hidden">
          <img
            src="/photos/electron.jpg"
            alt="Фасад ТЦ «Электрон» на улице Рабочей"
            className="aspect-[3/2] w-full object-cover object-center"
          />
          <figcaption className="flex items-baseline justify-between gap-3 px-4 py-3 text-sm">
            <span>Рабочая, Иркутск</span>
            <span className="text-stone">ТЦ «Электрон»</span>
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
          label="Склад"
          value={snapshot ? `${fine(facts.storage)} м²` : "—"}
          note={snapshot ? "жёлтые зоны на открытом листе" : "жёлтые зоны"}
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
              { name: "Склад", value: facts.storage, fill: theme.pine },
              { name: "Вакант", value: facts.vacant, fill: theme.vacant },
            ]}
            center={facts.total ? pct(facts.occupancy) : "—"}
            caption="занято"
          />
        </div>
        <div className="panel p-4 sm:p-5">
          <h2 className="font-display text-2xl">По этажам</h2>
          <p className="mb-2 text-sm text-stone">Торговля, склад и вакант на открытом листе.</p>
          <StackBars
            data={levels}
            bars={[
              { key: "commercial", name: "Торговля", fill: theme.copper },
              { key: "warehouse", name: "Склад", fill: theme.pine },
              { key: "vacant", name: "Вакант", fill: theme.vacant },
            ]}
          />
        </div>
      </section>

      <section className="panel p-4 sm:p-5">
        <h2 className="font-display text-2xl">Номера ездили</h2>
        <p className="mt-1 text-sm text-stone">
          Один номер — не одно место. Между листами подпись переезжала на другой контур, иногда туда и обратно по цвету.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {shifts.map((shift) => (
            <li key={shift.id} className="border-t border-line pt-3 text-sm">
              <p className="font-display text-xl">{shift.id}</p>
              <p className="text-stone">
                {shift.stops
                  .map((stop) => `${stop.place} ${fine(stop.area)} м², ${prettySchemeDate(stop.from)}–${prettySchemeDate(stop.to)}`)
                  .join(" → ")}
              </p>
            </li>
          ))}
        </ul>
        {flips.length > 0 ? (
          <p className="mt-4 text-sm text-stone">
            Без смены места то занимали, то снова освобождали: {flips.join(", ")}.
          </p>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {floors.map((item) => (
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
          <button type="button" className={editor ? "btn" : "btn btn-ghost"} onClick={() => setEditor((value) => !value)}>
            Редактор
          </button>
        </div>
      </div>

      {editor ? (
        <p className="panel px-4 py-3 text-sm text-ink-soft">
          Редактор открыт на стенах 20.07.2026. Контур не двигается: меняются цвет, название и цифра площади.
          Листы истории не переписываются. Правки остаются в этом браузере.
        </p>
      ) : snapshot && snapshot.date < "2026-07-20" ? (
        <p className="panel px-4 py-3 text-sm text-ink-soft">
          На экране стены схемы 20.07.2026, они не пересобираются. История меняет только цвет и подпись площадей.
          Лист {prettySchemeDate(snapshot.date)} нарисован иначе
          {snapshot.note ? `: ${snapshot.note}` : "."} Мелкие помещения, которых на сегодняшнем плане уже нет, остаются списком и в графике, без отдельных стен.
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-stone">
          Поиск
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Номер, старый номер, название"
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
            <option value="storage">Склад</option>
            <option value="vacant">Вакантно</option>
          </select>
        </label>
        <p className="nums text-sm text-stone">
          {floor.name}: {floorArea ? `${fine(floorArea)} м² · вакантно ${fine(floorVacant)}` : "на листе нет площадей"} · найдено{" "}
          {visible.length} из {floor.rooms.length}
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
                      fillOpacity={room.area <= 0 ? 0 : room.id === selected?.id ? 0.45 : shown ? 0.18 : 0.04}
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
              <p className="kicker">
                {floor.name}
                {selected.legacy ? ` · сквозной № ${selected.legacy}` : ""}
              </p>
              <h2 className="font-display text-3xl">
                {selected.id} {selected.name}
              </h2>
              <p className="nums font-display text-4xl">
                {selected.area > 0 ? fine(selected.area) : "—"}
                <span className="ml-2 font-sans text-base text-stone">м²</span>
              </p>
              <p className="text-sm">
                {selected.layout === "missing" ? "На этом листе помещения нет" : electronStatus[selected.status].label}
              </p>
              {editor ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(electronStatus) as ElectronStatus[]).map((key) => (
                      <button
                        key={key}
                        type="button"
                        className={selected.status === key ? "btn" : "btn btn-ghost"}
                        onClick={() => {
                          remember();
                          patchRoom(selected.id, { status: key });
                        }}
                      >
                        {electronStatus[key].label}
                      </button>
                    ))}
                  </div>
                  <label className="text-sm text-stone">
                    Название
                    <input
                      value={selected.name}
                      onFocus={() => {
                        focusEdits.current = edits;
                      }}
                      onChange={(event) => patchRoom(selected.id, { name: event.target.value })}
                      onBlur={keepTextUndo}
                      className="mt-1 block w-full border border-line bg-paper px-3 py-2 text-ink"
                    />
                  </label>
                  <label className="text-sm text-stone">
                    Площадь, м²
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={selected.area}
                      onFocus={() => {
                        focusEdits.current = edits;
                      }}
                      onChange={(event) => {
                        const area = Number(event.target.value);
                        if (Number.isFinite(area)) patchRoom(selected.id, { area });
                      }}
                      onBlur={keepTextUndo}
                      className="nums mt-1 block w-full border border-line bg-paper px-3 py-2 text-ink"
                    />
                  </label>
                  <label className="text-sm text-stone">
                    Заметка
                    <input
                      value={edits[selected.id]?.note ?? selected.note}
                      onFocus={() => {
                        focusEdits.current = edits;
                      }}
                      onChange={(event) => patchRoom(selected.id, { note: event.target.value })}
                      onBlur={keepTextUndo}
                      className="mt-1 block w-full border border-line bg-paper px-3 py-2 text-ink"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn btn-ghost" onClick={undoEdit} disabled={undo.length === 0}>
                      Шаг назад
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => resetRoom(selected.id)} disabled={!edits[selected.id]}>
                      Вернуть помещение
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => { remember(); setEdits({}); }} disabled={Object.keys(edits).length === 0}>
                      Сбросить правки
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {selected.note && <p className="text-sm text-stone">{selected.note}</p>}
                  <p className="text-sm text-stone">
                    {selected.layout === "missing"
                      ? "Контур есть только на схеме 20.07.2026."
                      : "Название — с книги 20.07.2026. Площадь и цвет — с открытого листа."}
                  </p>
                </>
              )}
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
                    {room.sheetId && room.sheetId !== room.id ? `${room.sheetId} → ` : ""}
                    {room.id}
                    {room.legacy ? ` · ${room.legacy}` : ""} {room.name}
                    <span className="mt-0.5 block text-xs text-stone">
                      {room.layout === "missing" ? "Нет на этом листе" : electronStatus[room.status].label}
                    </span>
                  </span>
                  <span className="nums">{room.area > 0 ? fine(room.area) : "—"}</span>
                </button>
              </li>
            ))}
          </ul>
          {sheetOnly.length > 0 ? (
            <div>
              <p className="kicker">Были на листе, контура уже нет</p>
              <ul className="mt-2 max-h-48 overflow-auto">
                {sheetOnly.map((room) => (
                  <li key={`${room.floor}-${room.id}`} className="flex items-baseline justify-between gap-3 border-b border-line py-2 text-sm">
                    <span>
                      {room.id}
                      <span className="mt-0.5 block text-xs text-stone">{KIND_LABEL[room.kind]}</span>
                    </span>
                    <span className="nums">{fine(room.area)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </section>

      <section className="panel overflow-x-auto">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <caption className="px-4 py-3 text-left">
            <span className="font-display text-2xl">История схем</span>
            <span className="mt-1 block text-sm text-stone">
              {history.length} листов. Строка открывает схему. Общая лента берёт последний лист квартала
              {quarterSnap && snapshot && quarterSnap.date !== snapshot.date
                ? ` — сейчас открыт более ранний, на срезе ленты ${prettySchemeDate(quarterSnap.date)}`
                : ""}
              . Номер в таблице — как напечатано на листе, а не как на сегодняшних стенах.
              {snapshot?.note ? ` ${snapshot.note}` : ""}
            </span>
          </caption>
          <thead>
            <tr className="text-xs text-stone">
              <th className="px-4 py-2 font-medium">Лист</th>
              <th className="px-4 py-2 text-right font-medium">Учтено</th>
              <th className="px-4 py-2 text-right font-medium">Торговля</th>
              <th className="px-4 py-2 text-right font-medium">Вакант</th>
              <th className="px-4 py-2 text-right font-medium">Склад</th>
              <th className="px-4 py-2 text-right font-medium">Заполнение</th>
              <th className="px-4 py-2 text-right font-medium">Помещений</th>
            </tr>
          </thead>
          <tbody>
            {history.map((row) => {
              const active = snapshot?.date === row.date;
              return (
                <tr key={row.date} className={active ? "bg-bone" : "cursor-pointer"} onClick={() => openScheme(row.date)}>
                  <td className="px-4 py-2">{prettySchemeDate(row.date)}</td>
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
                  <td className="nums px-4 py-2 text-right">{row.facts.occupancy.toFixed(1)}%</td>
                  <td className="nums px-4 py-2 text-right">{row.facts.rooms}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="panel p-4">
        <h2 className="font-display text-2xl">Что изменилось{snapshot ? ` к ${prettySchemeDate(snapshot.date)}` : ""}</h2>
        {moves.length === 0 ? (
          <p className="mt-3 text-sm text-stone">К предыдущему листу площади и статусы не менялись, либо это первая схема.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {moves.map((move) => (
              <li key={move.id} className="border-t border-line pt-2 text-sm">
                <p>{move.label}</p>
                <p className="text-stone">
                  {move.to === null
                    ? `убрали с листа · было ${move.areaFrom === null ? "—" : `${fine(move.areaFrom)} м²`}`
                    : `${move.from ? KIND_LABEL[move.from] : "появилось"} → ${KIND_LABEL[move.to]} · ${move.areaFrom === null ? "—" : `${fine(move.areaFrom)} м²`} → ${move.areaTo === null ? "—" : `${fine(move.areaTo)} м²`}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <img src="/electron/facades.webp" alt="Фасады ТЦ «Электрон», рекламные места 3.2.1–3.2.12" className="panel w-full" />
    </div>
  );
}

function levelRows(snapshot: ElectronSnapshot | null) {
  return [1, 2].map((number) => {
    const rooms = snapshot?.rooms.filter((room) => room.floor === number) ?? [];
    const sum = (kind: ElectronKind) => rooms.filter((room) => room.kind === kind).reduce((total, room) => total + room.area, 0);
    return {
      name: `${number} эт.`,
      commercial: sum("trade"),
      warehouse: sum("storage"),
      vacant: sum("vacant"),
    };
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
