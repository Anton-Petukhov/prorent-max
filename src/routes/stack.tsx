import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { kindMeta } from "@/lib/brand-hall";
import { brandSnapshotAt, type BrandSnapshot } from "@/lib/brand-history";
import { electronFloors } from "@/lib/electron";
import { electronSnapshotAt, planRoomFor, type ElectronSnapshot } from "@/lib/electron-history";
import { m2 } from "@/lib/format";
import { isHeld, isLeased, zoneArea } from "@/lib/portfolio";
import { pioneerFloors, pioneerRooms, pioneerStatus } from "@/lib/pioneer";
import { quarterPretty, QUARTERS } from "@/lib/quarters";
import { usePortfolio, useResolvedAssets } from "@/lib/store";

export const Route = createFileRoute("/stack")({ component: StackPage });

type Tone = "leased" | "vacant" | "reserved" | "service";

type Cell = {
  id: string;
  name: string;
  tenant: string;
  area: number;
  tone: Tone;
  note: string;
};

type Row = { id: string; label: string; area: number; cells: Cell[] };

const TONE_LABEL: Record<Tone, string> = {
  leased: "Занято",
  vacant: "Свободно",
  reserved: "Бронь",
  service: "Служебное",
};

function StackPage() {
  const qi = usePortfolio((state) => state.qi);
  const assets = useResolvedAssets();
  const held = assets.filter((asset) => isHeld(asset, qi));
  const books = useMemo(() => ["book", "brand", "pioneer", "electron"] as const, []);
  const [book, setBook] = useState<(typeof books)[number]>("book");
  const [tone, setTone] = useState<Tone | "all">("all");
  const [assetId, setAssetId] = useState<string>("all");
  const label = QUARTERS[qi] ?? "2026-Q3";

  const rows = useMemo<Row[]>(() => {
    if (book === "brand") return brandRows(brandSnapshotAt(qi));
    if (book === "pioneer") return pioneerRows();
    if (book === "electron") return electronRows(electronSnapshotAt(qi));
    const source = assetId === "all" ? held : held.filter((asset) => asset.id === assetId);
    return source.flatMap((asset) =>
      asset.floors.map((floor) => {
        const cells = floor.zones
          .map((zone) => {
            const area = zoneArea(zone);
            const leased = isLeased(zone, qi);
            return {
              id: zone.id,
              name: zone.name,
              tenant: leased ? (zone.tenant ?? "Арендатор") : "Свободно",
              area,
              tone: (leased ? "leased" : "vacant") as Tone,
              note: `${asset.city} · ${zone.use === "warehouse" ? "склад" : zone.use === "retail" ? "торговля" : "офис"}`,
            };
          })
          .filter((cell) => cell.area > 0);
        return {
          id: `${asset.id}-${floor.id}`,
          label: `${asset.name} · ${floor.name}`,
          area: cells.reduce((sum, cell) => sum + cell.area, 0),
          cells,
        };
      }),
    );
  }, [assetId, book, held, qi]);

  const visible = rows
    .map((row) => ({ ...row, cells: row.cells.filter((cell) => tone === "all" || cell.tone === tone) }))
    .filter((row) => row.cells.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="kicker">Экспозиция · {book === "pioneer" ? "архив Иркутска" : quarterPretty(label)}</p>
        <h1 className="mt-2 font-display text-4xl sm:text-5xl">Шахматка</h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          Этаж — строка, помещение — клетка. Ширина клетки следует площади. Европейская книга, «Брэнд Холл», «Электрон» и
          лента внизу экрана смотрят в один квартал. «Пионер» остаётся фиксированной схемой.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["book", "Книга"],
            ["brand", "Брэнд Холл"],
            ["pioneer", "Пионер"],
            ["electron", "Электрон"],
          ] as const
        ).map(([id, name]) => (
          <button key={id} type="button" className={book === id ? "btn" : "btn btn-ghost"} onClick={() => setBook(id)}>
            {name}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {(["all", "leased", "vacant", "reserved", "service"] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={tone === item ? "btn" : "btn btn-ghost"}
              onClick={() => setTone(item)}
            >
              {item === "all" ? "Все" : TONE_LABEL[item]}
            </button>
          ))}
        </div>
        {book === "book" && (
          <label className="text-sm text-stone">
            Актив
            <select
              className="ml-2 border border-line bg-paper px-2 py-2 text-ink"
              value={assetId}
              onChange={(event) => setAssetId(event.target.value)}
            >
              <option value="all">Все в срезе</option>
              {held.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <section className="flex flex-col gap-3">
        {visible.length === 0 && <p className="panel p-4 text-stone">На этом срезе таких клеток нет.</p>}
        {visible.map((row) => (
          <article key={row.id} className="panel p-3 sm:p-4">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-xl">{row.label}</h2>
              <span className="nums text-sm text-stone">{m2(row.area)} м²</span>
            </div>
            <div className="flex min-h-24 gap-1 overflow-x-auto">
              {row.cells.map((cell) => (
                <div
                  key={cell.id}
                  className={`flex min-w-24 flex-1 flex-col justify-between px-2 py-2 text-left ${toneClass(cell.tone)}`}
                  style={{ flexGrow: Math.max(cell.area, 40) }}
                  title={`${cell.name} · ${cell.tenant} · ${m2(cell.area)} м²`}
                >
                  <span className="text-xs">{cell.name}</span>
                  <strong className="text-sm leading-tight">{cell.tenant}</strong>
                  <small className="nums text-xs">
                    {m2(cell.area)} м² · {cell.note}
                  </small>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      <p className="text-sm text-stone">
        Планы этих объектов: <Link to="/brand-hall" className="text-copper">Брэнд Холл</Link>
        {" · "}
        <Link to="/pioneer" className="text-copper">Пионер</Link>
        {" · "}
        <Link to="/electron" className="text-copper">Электрон</Link>
      </p>
    </div>
  );
}

function toneClass(tone: Tone): string {
  if (tone === "leased") return "bg-pine text-paper";
  if (tone === "reserved") return "bg-copper text-paper";
  if (tone === "service") return "bg-vacant text-ink";
  return "border border-line bg-paper text-ink";
}

function brandRows(snapshot: BrandSnapshot | null): Row[] {
  if (!snapshot) return [];
  const order = ["Подвал", "1 этаж", "2 этаж", "3 этаж", "Мансарда"];
  return order
    .map((name) => {
      const rooms = snapshot.rooms.filter((room) => room.floor === name && room.id !== "3.04А" && room.area);
      return {
        id: name,
        label: `Брэнд Холл · ${name}`,
        area: rooms.reduce((sum, room) => sum + (room.area ?? 0), 0),
        cells: rooms.map((room) => ({
          id: `${name}-${room.id}`,
          name: room.id,
          tenant: room.kind === "vacant" ? "Свободно" : kindMeta[room.kind].label,
          area: room.area ?? 0,
          tone: (room.kind === "vacant" ? "vacant" : room.kind === "service" ? "service" : "leased") as Tone,
          note: kindMeta[room.kind].label,
        })),
      };
    })
    .filter((row) => row.cells.length > 0);
}

function electronRows(snapshot: ElectronSnapshot | null): Row[] {
  if (!snapshot) return [];
  return electronFloors
    .map((floor) => {
      const rooms = snapshot.rooms.filter((room) => room.floor === floor.number);
      return {
        id: `electron-${floor.number}`,
        label: `Электрон · ${floor.name}`,
        area: rooms.reduce((sum, room) => sum + room.area, 0),
        cells: rooms.map((room) => {
          const known = planRoomFor(room);
          return {
            id: `${room.floor}-${room.id}`,
            name: known && known.id !== room.id ? `${room.id} → ${known.id}` : room.id,
            tenant: room.kind === "vacant" ? "Свободно" : room.kind === "storage" ? "Склад" : (known?.name ?? "Помещение листа"),
            area: room.area,
            tone: (room.kind === "vacant" ? "vacant" : "leased") as Tone,
            note: room.kind === "storage" ? "Склад" : room.kind === "vacant" ? "Вакантно" : "Торговля",
          };
        }),
      };
    })
    .filter((row) => row.cells.length > 0);
}

function pioneerRows(): Row[] {
  return pioneerFloors.map((floor) => {
    const rooms = pioneerRooms.filter((room) => room.floor === floor);
    return {
      id: floor,
      label: `Пионер · ${floor}`,
      area: rooms.reduce((sum, room) => sum + room.area, 0),
      cells: rooms.map((room) => ({
        id: String(room.id),
        name: room.name,
        tenant: room.tenant,
        area: room.area,
        tone: room.status === "occupied" ? "leased" : room.status === "reserved" ? "reserved" : "vacant",
        note: pioneerStatus[room.status].label,
      })),
    };
  });
}
