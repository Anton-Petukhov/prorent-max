import history from "@/lib/brand-history.json";
import type { BrandRoom, RoomKind } from "@/lib/brand-hall";
import { QUARTERS, quarterIndex } from "@/lib/quarters";

export type BrandFact = {
  floor: string;
  id: string;
  area: number | null;
  kind: RoomKind;
};

export type BrandSnapshot = {
  date: string;
  stamp: string | null;
  rooms: BrandFact[];
};

export const brandSnapshots = history as BrandSnapshot[];

const COUNTED = new Set(["trade", "vacant", "storage", "service"]);

export function countedFacts(rooms: BrandFact[]): BrandFact[] {
  return rooms.filter((room) => room.area !== null && room.area > 0 && room.id !== "3.04А" && COUNTED.has(room.kind));
}

export type BrandFacts = {
  total: number;
  trade: number;
  vacant: number;
  storage: number;
  service: number;
  commercial: number;
  occupancy: number;
  rooms: number;
};

const round = (value: number) => Math.round(value * 100) / 100;

export function brandFacts(snapshot: BrandSnapshot | null): BrandFacts {
  const rooms = snapshot ? countedFacts(snapshot.rooms) : [];
  const area = (kind?: RoomKind) =>
    round(rooms.filter((room) => kind === undefined || room.kind === kind).reduce((sum, room) => sum + (room.area ?? 0), 0));
  const total = area();
  const vacant = area("vacant");
  const trade = area("trade");
  return {
    total,
    trade,
    vacant,
    storage: area("storage"),
    service: area("service"),
    commercial: round(trade + vacant),
    occupancy: total > 0 ? ((total - vacant) / total) * 100 : 0,
    rooms: rooms.length,
  };
}

export type BrandSeriesPoint = {
  label: string;
  commercial: number;
  warehouse: number;
  vacant: number;
  occupancy: number;
};

export function brandSeries(): BrandSeriesPoint[] {
  return QUARTERS.map((label, qi) => {
    const facts = brandFacts(brandSnapshotAt(qi));
    return {
      label,
      commercial: facts.trade,
      warehouse: facts.storage,
      vacant: facts.vacant,
      occupancy: facts.occupancy,
    };
  });
}

export function quarterEndIso(qi: number): string {
  const label = QUARTERS[qi] ?? "2018-Q1";
  const year = Number(label.slice(0, 4));
  const quarter = Number(label.slice(6));
  const month = String(quarter * 3).padStart(2, "0");
  const day = ["31", "30", "30", "31"][quarter - 1] ?? "30";
  return `${year}-${month}-${day}`;
}

export function brandSnapshotAt(qi: number): BrandSnapshot | null {
  const end = quarterEndIso(qi);
  let chosen: BrandSnapshot | null = null;
  for (const snapshot of brandSnapshots) {
    if (snapshot.date <= end) chosen = snapshot;
  }
  return chosen;
}

export function qiForDate(iso: string): number {
  const [year, month] = iso.split("-").map(Number);
  const quarter = Math.min(4, Math.max(1, Math.ceil((month ?? 1) / 3)));
  return quarterIndex(`${year}-Q${quarter}`);
}

export function prettySchemeDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

const keyOf = (value: string) => value.split("·")[0]?.trim().toLowerCase().replace(/ё/g, "е") ?? value;

export function paintBrandRoom(room: BrandRoom, snapshot: BrandSnapshot | null): BrandRoom {
  if (!snapshot || room.floor === "Парковка") return room;
  const fact = snapshot.rooms.find((item) => item.floor === room.floor && keyOf(item.id) === keyOf(room.name));
  if (!fact) return room;
  return {
    ...room,
    kind: fact.kind,
    area: fact.area,
    included: fact.id === "3.04А" ? false : room.included,
    note:
      fact.id === "3.04А"
        ? "43,91 м² на схеме — общая пометка для 3.03с, 3.04 и 3.10, в итог не входит."
        : room.note,
  };
}

export type BrandDelta = {
  date: string;
  stamp: string | null;
  facts: BrandFacts;
  tradeDelta: number;
  vacantDelta: number;
  storageDelta: number;
};

export type BrandMove = {
  floor: string;
  id: string;
  from: RoomKind | null;
  to: RoomKind;
  areaFrom: number | null;
  areaTo: number | null;
};

export function brandMoves(date: string): BrandMove[] {
  const index = brandSnapshots.findIndex((snapshot) => snapshot.date === date);
  if (index <= 0) return [];
  const previous = brandSnapshots[index - 1];
  const current = brandSnapshots[index];
  if (!previous || !current) return [];
  const before = new Map(previous.rooms.map((room) => [`${room.floor}|${room.id}`, room]));
  const moves: BrandMove[] = [];
  for (const room of current.rooms) {
    if (room.id === "3.04А") continue;
    const prior = before.get(`${room.floor}|${room.id}`);
    if (!prior) {
      if (room.area) moves.push({ floor: room.floor, id: room.id, from: null, to: room.kind, areaFrom: null, areaTo: room.area });
      continue;
    }
    if (prior.kind !== room.kind || prior.area !== room.area) {
      moves.push({
        floor: room.floor,
        id: room.id,
        from: prior.kind,
        to: room.kind,
        areaFrom: prior.area,
        areaTo: room.area,
      });
    }
  }
  return moves;
}

export function brandDeltas(): BrandDelta[] {
  let previous: BrandFacts | null = null;
  return brandSnapshots.map((snapshot) => {
    const facts = brandFacts(snapshot);
    const row = {
      date: snapshot.date,
      stamp: snapshot.stamp,
      facts,
      tradeDelta: round(facts.trade - (previous?.trade ?? facts.trade)),
      vacantDelta: round(facts.vacant - (previous?.vacant ?? facts.vacant)),
      storageDelta: round(facts.storage - (previous?.storage ?? facts.storage)),
    };
    previous = facts;
    return row;
  });
}
