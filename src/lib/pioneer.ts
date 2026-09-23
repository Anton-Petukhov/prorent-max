export type PioneerStatus = "vacant" | "occupied" | "reserved";

export type PioneerRoom = {
  id: number;
  name: string;
  type: string;
  floor: string;
  area: number;
  status: PioneerStatus;
  tenant: string;
  shape: string;
  labelX: number;
  labelY: number;
};

export const pioneerFloors = ["Подвал", "1 этаж", "2 этаж"] as const;

export const pioneerRooms: PioneerRoom[] = [
  { id: 1, name: "Торговое 3", type: "Торговое", floor: "Подвал", area: 140.16, status: "occupied", tenant: "Fix Price", shape: "18,44 286,44 286,198 18,198", labelX: 152, labelY: 113 },
  { id: 2, name: "Торговое 4А", type: "Торговое", floor: "Подвал", area: 75.13, status: "occupied", tenant: "585 Золотой", shape: "298,44 487,44 487,198 298,198", labelX: 393, labelY: 113 },
  { id: 3, name: "Торговое 6с", type: "Торговое", floor: "Подвал", area: 48.6, status: "occupied", tenant: "Аптека", shape: "499,44 642,44 642,198 499,198", labelX: 570, labelY: 113 },
  { id: 4, name: "Торговое 19с", type: "Торговое", floor: "Подвал", area: 14.56, status: "occupied", tenant: "Постамат", shape: "212,147 286,147 286,198 212,198", labelX: 249, labelY: 169 },
  { id: 5, name: "Торговое 1", type: "Торговое", floor: "1 этаж", area: 100.9, status: "vacant", tenant: "Свободно", shape: "18,216 186,216 186,368 18,368", labelX: 102, labelY: 285 },
  { id: 6, name: "Торговое 2", type: "Торговое", floor: "1 этаж", area: 136.2, status: "occupied", tenant: "DNS", shape: "198,216 398,216 398,368 198,368", labelX: 298, labelY: 285 },
  { id: 7, name: "Торговое 3", type: "Торговое", floor: "1 этаж", area: 366.3, status: "occupied", tenant: "Магнит", shape: "410,216 642,216 642,368 410,368", labelX: 526, labelY: 285 },
  { id: 8, name: "Офис 201", type: "Офис", floor: "2 этаж", area: 82.4, status: "vacant", tenant: "Свободно", shape: "18,386 205,386 205,496 18,496", labelX: 111, labelY: 437 },
  { id: 9, name: "Офис 202", type: "Офис", floor: "2 этаж", area: 91.7, status: "reserved", tenant: "Coffee Lab", shape: "217,386 415,386 415,496 217,496", labelX: 316, labelY: 437 },
  { id: 10, name: "Офис 203", type: "Офис", floor: "2 этаж", area: 118.5, status: "occupied", tenant: "СибПроект", shape: "427,386 642,386 642,496 427,496", labelX: 534, labelY: 437 },
];

export const pioneerStatus = {
  vacant: { label: "Свободно", color: "#24b47e" },
  occupied: { label: "Арендовано", color: "#c0562a" },
  reserved: { label: "Бронь", color: "#c4a15a" },
} as const;

export function pioneerTotals(rooms: PioneerRoom[] = pioneerRooms) {
  const sum = (status?: PioneerStatus) =>
    rooms.filter((room) => status === undefined || room.status === status).reduce((total, room) => total + room.area, 0);
  const total = sum();
  const occupied = sum("occupied");
  const vacant = sum("vacant");
  const reserved = sum("reserved");
  return {
    total,
    occupied,
    vacant,
    reserved,
    occupancy: total > 0 ? (occupied / total) * 100 : 0,
    rooms: rooms.length,
  };
}
