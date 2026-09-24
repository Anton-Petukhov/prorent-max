import history from "@/lib/electron-history.json";
import { electronFloors, type ElectronRoom, type ElectronStatus } from "@/lib/electron";
import { prettySchemeDate, qiForDate, quarterEndIso } from "@/lib/brand-history";
import { QUARTERS } from "@/lib/quarters";

export type ElectronKind = "trade" | "vacant" | "storage";

export type ElectronFact = {
  floor: number;
  id: string;
  area: number;
  kind: ElectronKind;
  legacy?: string;
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

const planRooms = electronFloors.flatMap((floor) => floor.rooms);
const grownIds = new Set(["1.01", "1.02", "1.03", "1.04", "1.08", "2.01", "2.02", "2.03", "2.04", "2.05", "2.06", "2.07", "2.08", "2.09"]);

export function unitKey(room: { id: string; area: number }): string {
  if (room.area > 400 && (room.id === "1.10" || room.id === "1.12")) return "hall-479";
  if (room.area > 10 && room.area < 20 && (room.id === "1.06" || room.id === "1.11")) return "shop-16";
  if (room.area > 20 && room.area < 35 && (room.id === "1.05" || room.id === "1.06")) return "shop-24";
  if (room.id === "1.05" && room.area > 80) return "shop-150";
  if (room.id === "1.07" && room.area < 55) return "shop-47";
  if (room.id === "1.07") return "warehouse-63";
  if (room.id === "1.10" && room.area < 80) return "shop-29";
  if (room.id === "1.12" && room.area < 5) return "kiosk-1.12";
  return room.id;
}

export function planRoomFor(fact: ElectronFact): ElectronRoom | null {
  if (fact.area > 400 && (fact.id === "1.10" || fact.id === "1.12")) return planRooms.find((room) => room.id === "1.10") ?? null;
  if (fact.area > 10 && fact.area < 20 && (fact.id === "1.06" || fact.id === "1.11")) return planRooms.find((room) => room.id === "1.06") ?? null;
  if (fact.area > 20 && fact.area < 35 && (fact.id === "1.05" || fact.id === "1.06")) return planRooms.find((room) => room.id === "1.05") ?? null;
  const same = planRooms.find((room) => room.id === fact.id);
  if (!same) return null;
  const close = Math.abs(same.area - fact.area) <= Math.max(8, same.area * 0.12);
  if (grownIds.has(fact.id) || close) return same;
  return null;
}

const statusOf = (kind: ElectronKind): ElectronStatus =>
  kind === "vacant" ? "vacant" : kind === "storage" ? "storage" : "occupied";

export function paintElectronRoom(room: ElectronRoom, snapshot: ElectronSnapshot | null): ElectronRoom {
  if (!snapshot) return { ...room, area: 0, status: "vacant", layout: "missing", note: "Схемы ещё нет." };
  const fact =
    snapshot.rooms.find((item) => planRoomFor(item)?.id === room.id && item.id === room.id) ??
    snapshot.rooms.find((item) => planRoomFor(item)?.id === room.id);
  if (!fact) {
    return { ...room, area: 0, status: "vacant", layout: "missing", sheetId: undefined, note: "Этого контура на листе нет — планировка тогда была другой." };
  }
  const moved = Math.abs(fact.area - room.area) > Math.max(8, room.area * 0.12);
  const renamed = fact.id !== room.id;
  const note = [
    renamed ? `Сейчас это место называется ${room.id}. На листе оно ещё ${fact.id} — номер переедет позже.` : "",
    moved ? `Контур другой: на листе ${fact.area.toLocaleString("ru-RU")} м², на схеме 20.07.2026 — ${room.area.toLocaleString("ru-RU")} м².` : "",
    fact.legacy ? `На листе рядом номер ${fact.legacy}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return {
    ...room,
    area: fact.area,
    status: statusOf(fact.kind),
    sheetId: fact.id,
    layout: moved ? "moved" : "same",
    note,
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
  label: string;
  from: ElectronKind | null;
  to: ElectronKind | null;
  areaFrom: number | null;
  areaTo: number | null;
};

export function electronMoves(date: string): ElectronMove[] {
  const index = electronSnapshots.findIndex((snapshot) => snapshot.date === date);
  if (index <= 0) return [];
  const previous = electronSnapshots[index - 1];
  const current = electronSnapshots[index];
  if (!previous || !current) return [];
  const before = new Map(previous.rooms.map((room) => [unitKey(room), room]));
  const after = new Map(current.rooms.map((room) => [unitKey(room), room]));
  const moves: ElectronMove[] = [];
  for (const [key, room] of after) {
    const prior = before.get(key);
    const label = prior && prior.id !== room.id ? `${prior.id} → ${room.id}` : room.id;
    if (!prior) {
      moves.push({ id: key, label, from: null, to: room.kind, areaFrom: null, areaTo: room.area });
      continue;
    }
    if (prior.kind !== room.kind || prior.area !== room.area || prior.id !== room.id) {
      moves.push({ id: key, label, from: prior.kind, to: room.kind, areaFrom: prior.area, areaTo: room.area });
    }
  }
  for (const [key, room] of before) {
    if (after.has(key)) continue;
    moves.push({ id: key, label: room.id, from: room.kind, to: null, areaFrom: room.area, areaTo: null });
  }
  return moves;
}

const placeOf = (area: number) => {
  if (area >= 400) return "зал";
  if (area >= 100) return "блок";
  if (area >= 20) return "секция";
  if (area >= 8) return "ларёк";
  return "киоск";
};

export type NumberStop = { from: string; to: string; area: number; place: string };

export function electronShifts(): { id: string; stops: NumberStop[] }[] {
  const ids = [...new Set(electronSnapshots.flatMap((snapshot) => snapshot.rooms.map((room) => room.id)))].sort((a, b) =>
    a.localeCompare(b, "en"),
  );
  const shifts: { id: string; stops: NumberStop[] }[] = [];
  for (const id of ids) {
    const stops: NumberStop[] = [];
    let gap = false;
    for (const snapshot of electronSnapshots) {
      const room = snapshot.rooms.find((item) => item.id === id);
      if (!room) {
        if (stops.length) gap = true;
        continue;
      }
      const place = placeOf(room.area);
      const last = stops.at(-1);
      if (last && !gap && last.place === place) last.to = snapshot.date;
      else stops.push({ from: snapshot.date, to: snapshot.date, area: room.area, place });
      gap = false;
    }
    if (stops.length > 1) shifts.push({ id, stops });
  }
  return shifts;
}

export function electronFlipFlops(): string[] {
  const ids = [...new Set(electronSnapshots.flatMap((snapshot) => snapshot.rooms.map((room) => room.id)))];
  return ids
    .filter((id) => {
      const kinds: ElectronKind[] = [];
      let place: string | null = null;
      let gap = false;
      for (const snapshot of electronSnapshots) {
        const room = snapshot.rooms.find((item) => item.id === id);
        if (!room) {
          if (place) gap = true;
          continue;
        }
        if (gap) break;
        const here = placeOf(room.area);
        if (place && here !== place) break;
        place = here;
        if (kinds.at(-1) !== room.kind) kinds.push(room.kind);
      }
      const first = kinds[0];
      return Boolean(first) && kinds.length >= 3 && kinds.slice(1).includes(first);
    })
    .sort((a, b) => a.localeCompare(b, "en"));
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
