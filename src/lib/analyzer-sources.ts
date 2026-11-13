import { brandSnapshots, type BrandSnapshot } from "@/lib/brand-history";
import { electronSnapshots, type ElectronSnapshot } from "@/lib/electron-history";
import { pioneerRooms } from "@/lib/pioneer";
import type { Revision, Room, RoomStatus } from "@/lib/analyzer";

export type BuiltInSource = "brand" | "electron" | "pioneer";
export type BuiltInOption = { id: string; title: string; objectName: string; date: string; source: BuiltInSource; index: number };
export function builtInOptions(): BuiltInOption[] {
  const brand = brandSnapshots.map((snapshot, index) => ({
    id: "brand-" + index, title: "Брэнд Холл · " + snapshot.date,
    objectName: "Брэнд Холл", date: snapshot.date, source: "brand" as const, index
  }));
  const electron = electronSnapshots.map((snapshot, index) => ({
    id: "electron-" + index, title: "Электрон · " + snapshot.date,
    objectName: "Электрон", date: snapshot.date, source: "electron" as const, index
  }));
  return [
    ...brand, ...electron,
    {id:"pioneer-0",title:"Пионер · фиксированная схема",objectName:"Пионер",date:"2026-09-01",source:"pioneer" as const,index:0}
  ];
}
const statusFromKind = (kind: "trade" | "vacant" | "storage"): RoomStatus => kind === "vacant" ? "Свободно" : "Занято";

function brandRooms(snapshot: BrandSnapshot): Room[] {
  return snapshot.rooms
    .filter((fact) => fact.area !== null && fact.area > 0 && fact.id !== "3.04А" && fact.kind !== "service")
    .map((fact) => ({
      object: "Брэнд Холл",
      floor: fact.floor,
      number: fact.id,
      area: fact.area,
      status: statusFromKind(fact.kind as "trade" | "vacant" | "storage"),
      note: "Источник: сохранённая схема ProRent MAX"
    }));
}
function electronRooms(snapshot: ElectronSnapshot): Room[] {
  return snapshot.rooms.filter((fact) => fact.area > 0).map((fact) => ({
    object: "Электрон",
    floor: String(fact.floor),
    number: fact.id,
    area: fact.area,
    status: statusFromKind(fact.kind),
    note: fact.legacy ? "Старое обозначение: " + fact.legacy : "Источник: схема ProRent MAX"
  }));
}
function pioneerRows(): Room[] {
  return pioneerRooms.map((fact) => ({
    object: "Пионер",
    floor: fact.floor,
    number: fact.name.replace(/^(Торговое|Офис)\s+/i, ""),
    area: fact.area,
    status: fact.status === "vacant" ? "Свободно" as const : fact.status === "reserved" ? "Бронь" as const : "Занято" as const,
    note: "Источник: фиксированная схема ProRent MAX"
  }));
}

export function importBuiltIn(option: BuiltInOption): Revision {
  const snapshotB = option.source === "brand" ? brandSnapshots[option.index] : null;
  const snapshotE = option.source === "electron" ? electronSnapshots[option.index] : null;
  if (option.source === "brand" && !snapshotB) throw new Error("Схема Брэнд Холла не найдена.");
  if (option.source === "electron" && !snapshotE) throw new Error("Схема Электрона не найдена.");
  const rooms = snapshotB ? brandRooms(snapshotB) : snapshotE ? electronRooms(snapshotE) : pioneerRows();
  return {
    id: option.id + "-builtin",
    at: option.date + "T00:00:00.000Z",
    label: option.title,
    filename: "ProRent MAX · встроенная история",
    rooms
  };
}
