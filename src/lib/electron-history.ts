import history from "@/lib/electron-history.json";
import type { ElectronRoom, ElectronStatus } from "@/lib/electron";
import { prettySchemeDate, qiForDate, quarterEndIso } from "@/lib/brand-history";
import { QUARTERS } from "@/lib/quarters";

export type ElectronKind = "trade" | "vacant" | "storage";

export type ElectronFact = {
  floor: number;
  id: string;
  area: number;
  kind: ElectronKind;
  sheetId?: string;
};

export type ElectronSnapshot = {
  date: string;
  note?: string;
  rooms: ElectronFact[];
};

export const electronSnapshots = history as ElectronSnapshot[];

export type ElectronFacts = {
  total: number;
  trade: number;
  vacant: number;
  storage: number;
  occupancy: number;
  rooms: number;
};

const round = (value: number) => Math.round(value * 100) / 100;

export function electronFacts(snapshot: ElectronSnapshot | null): ElectronFacts {
  const rooms = snapshot?.rooms ?? [];
  const area = (kind?: ElectronKind) =>
    round(rooms.filter((room) => kind === undefined || room.kind === kind).reduce((sum, room) => sum + room.area, 0));
  const total = area();
  const vacant = area("vacant");
  return {
    total,
    trade: area("trade"),
    vacant,
    storage: area("storage"),
    occupancy: total > 0 ? ((total - vacant) / total) * 100 : 0,
    rooms: rooms.length,
  };
}

export type ElectronSeriesPoint = {
  label: string;
  commercial: number;
  warehouse: number;
  vacant: number;
  occupancy: number;
};

export function electronSeries(): ElectronSeriesPoint[] {
  return QUARTERS.map((label, qi) => {
    const facts = electronFacts(electronSnapshotAt(qi));
    return {
      label,
      commercial: facts.trade,
      warehouse: facts.storage,
      vacant: facts.vacant,
      occupancy: facts.occupancy,
    };
  });
}

export function electronSnapshotAt(qi: number): ElectronSnapshot | null {
  const end = quarterEndIso(qi);
  let chosen: ElectronSnapshot | null = null;
  for (const snapshot of electronSnapshots) {
    if (snapshot.date <= end) chosen = snapshot;
  }
  return chosen;
}

export { prettySchemeDate, qiForDate };

const statusOf = (kind: ElectronKind): ElectronStatus =>
  kind === "vacant" ? "vacant" : kind === "storage" ? "storage" : "occupied";

export function paintElectronRoom(room: ElectronRoom, snapshot: ElectronSnapshot | null): ElectronRoom {
  if (!snapshot) {
    return { ...room, area: 0, status: "vacant", note: "Схемы ещё нет." };
  }
  const fact = snapshot.rooms.find((item) => item.id === room.id);
  if (!fact) {
    return { ...room, area: 0, status: "vacant", note: "На этом листе площадь не подписана." };
  }
  const legacy = room.legacy ? `Сквозной номер ${room.legacy}.` : "";
  const renamed =
    fact.sheetId && /^[12]\.\d{2}/.test(fact.sheetId)
      ? `На листе контур подписан как ${fact.sheetId} — в серии это всё равно ${room.id}.`
      : fact.sheetId
        ? `На листе номер ${fact.sheetId}.`
        : "";
  return {
    ...room,
    area: fact.area,
    status: statusOf(fact.kind),
    note: [legacy, renamed].filter(Boolean).join(" "),
  };
}

export type ElectronDelta = {
  date: string;
  note?: string;
  facts: ElectronFacts;
  tradeDelta: number;
  vacantDelta: number;
  storageDelta: number;
};

export type ElectronMove = {
  id: string;
  from: ElectronKind | null;
  to: ElectronKind;
  areaFrom: number | null;
  areaTo: number | null;
  sheetId?: string;
};

export function electronMoves(date: string): ElectronMove[] {
  const index = electronSnapshots.findIndex((snapshot) => snapshot.date === date);
  if (index <= 0) return [];
  const previous = electronSnapshots[index - 1];
  const current = electronSnapshots[index];
  if (!previous || !current) return [];
  const before = new Map(previous.rooms.map((room) => [room.id, room]));
  const moves: ElectronMove[] = [];
  for (const room of current.rooms) {
    const prior = before.get(room.id);
    if (!prior) {
      moves.push({ id: room.id, from: null, to: room.kind, areaFrom: null, areaTo: room.area, sheetId: room.sheetId });
      continue;
    }
    if (prior.kind !== room.kind || prior.area !== room.area) {
      moves.push({
        id: room.id,
        from: prior.kind,
        to: room.kind,
        areaFrom: prior.area,
        areaTo: room.area,
        sheetId: room.sheetId,
      });
    }
  }
  return moves;
}

export function electronDeltas(): ElectronDelta[] {
  let previous: ElectronFacts | null = null;
  return electronSnapshots.map((snapshot) => {
    const facts = electronFacts(snapshot);
    const row = {
      date: snapshot.date,
      note: snapshot.note,
      facts,
      tradeDelta: round(facts.trade - (previous?.trade ?? facts.trade)),
      vacantDelta: round(facts.vacant - (previous?.vacant ?? facts.vacant)),
      storageDelta: round(facts.storage - (previous?.storage ?? facts.storage)),
    };
    previous = facts;
    return row;
  });
}
