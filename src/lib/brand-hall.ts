export type RoomKind = "trade" | "vacant" | "storage" | "service";

export type BrandRoom = {
  id: string;
  name: string;
  floor: string;
  area: number | null;
  kind: RoomKind;
  shape: string;
  labelX: number;
  labelY: number;
  included?: boolean;
  note?: string;
};

export type FloorCore = { x: number; y: number; width: number; height: number };

export type BrandFloor = {
  name: string;
  outline: string;
  rooms: BrandRoom[];
  cores: FloorCore[];
  parking?: boolean;
};

const room = (
  floor: string,
  id: string,
  name: string,
  area: number | null,
  kind: RoomKind,
  shape: string,
  labelX: number,
  labelY: number,
  extra: Partial<BrandRoom> = {},
): BrandRoom => ({ floor, id, name, area, kind, shape, labelX, labelY, ...extra });

export const kindMeta: Record<RoomKind, { label: string; color: string; threeColor: number }> = {
  trade: { label: "Торговая", color: "#67d894", threeColor: 0x67d894 },
  vacant: { label: "Вакантная", color: "#f18f74", threeColor: 0xf18f74 },
  storage: { label: "Складская", color: "#e8ca54", threeColor: 0xe8ca54 },
  service: { label: "Служебная", color: "#cdd3d8", threeColor: 0xcdd3d8 },
};

export const floorOrder = ["Парковка", "Подвал", "1 этаж", "2 этаж", "3 этаж", "Мансарда"];

export const brandFloors: BrandFloor[] = [
  {
    name: "Парковка",
    parking: true,
    outline: "M40 70 H940 V570 H40 Z",
    cores: [],
    rooms: [
      room("Парковка", "parking-main", "Парковочная зона", null, "service", "40,70 940,70 940,570 40,570", 490, 320, {
        included: false,
        note: "Концептуальная схема: 10 условных машиномест, два автомобиля показаны для масштаба.",
      }),
    ],
  },
  {
    name: "Подвал",
    outline: "M20 45 H900 V25 H980 V610 H20 Z",
    cores: [{ x: 425, y: 260, width: 135, height: 150 }, { x: 225, y: 255, width: 130, height: 155 }],
    rooms: [
      room("Подвал", "b-electric", "Эл. щитовая", null, "service", "40,70 205,70 205,160 40,160", 122, 118),
      room("Подвал", "b-heating", "Тепловая", null, "service", "245,70 440,70 440,155 245,155", 342, 115),
      room("Подвал", "b-clean", "Уборщицы", null, "service", "250,155 440,155 440,225 250,225", 345, 190),
      room("Подвал", "b-vent", "Вентиляционная", null, "service", "40,160 225,160 225,355 40,355", 132, 255),
      room("Подвал", "b-011", "0.011", null, "trade", "300,178 392,178 392,207 300,207", 346, 193),
      room("Подвал", "b-009", "0.09", null, "trade", "480,155 570,155 570,355 530,355 480,275", 525, 230),
      room("Подвал", "b-001", "0.01", null, "trade", "570,70 850,70 850,355 730,355 730,215 570,215", 750, 145),
      room("Подвал", "b-007", "0.07", null, "vacant", "40,355 210,355 210,590 40,590", 125, 475),
      room("Подвал", "b-006", "0.06", null, "trade", "210,420 355,420 355,590 210,590", 282, 500),
      room("Подвал", "b-005", "0.05", null, "trade", "355,420 520,420 520,590 355,590", 438, 500),
      room("Подвал", "b-004", "0.04", null, "vacant", "520,420 665,420 665,590 520,590", 592, 500),
      room("Подвал", "b-003", "0.03", null, "vacant", "665,420 850,420 850,590 665,590", 758, 500),
      room("Подвал", "b-002a", "0.02А", null, "vacant", "875,110 970,110 970,230 875,230", 922, 170),
      room("Подвал", "b-002b", "0.02Б", null, "vacant", "875,230 970,230 970,350 875,350", 922, 290),
      room("Подвал", "b-002v", "0.02В", null, "vacant", "875,350 970,350 970,475 875,475", 922, 412),
      room("Подвал", "b-002g", "0.02Г", null, "trade", "875,475 970,475 970,590 875,590", 922, 532),
    ],
  },
  {
    name: "1 этаж",
    outline: "M20 55 H900 V25 H980 V610 H20 Z",
    cores: [{ x: 545, y: 260, width: 145, height: 160 }, { x: 135, y: 260, width: 70, height: 155 }],
    rooms: [
      room("1 этаж", "f1-105", "1.05", 126.79, "vacant", "40,85 375,85 365,260 210,260 210,235 40,235", 245, 165),
      room("1 этаж", "f1-104", "1.04", 70.61, "trade", "40,235 135,235 135,590 40,590", 88, 410),
      room("1 этаж", "f1-103", "1.03", 58.69, "trade", "205,420 355,420 355,590 205,590", 280, 500),
      room("1 этаж", "f1-102c", "1.02с", 12.63, "storage", "355,440 395,440 395,590 355,590", 375, 500),
      room("1 этаж", "f1-102", "1.02", 71.29, "trade", "395,420 545,420 600,470 600,590 395,590", 480, 505),
      room("1 этаж", "f1-108", "1.08", 1, "service", "335,320 370,320 370,355 335,355", 352, 339),
      room("1 этаж", "f1-106", "1.06", 61.26, "trade", "375,155 545,155 545,330 375,330", 460, 240),
      room("1 этаж", "f1-101", "1.01", 364, "trade", "545,85 900,85 900,590 680,590 680,420 805,420 805,260 545,260", 745, 170),
    ],
  },
  {
    name: "2 этаж",
    outline: "M20 55 H900 V25 H980 V610 H20 Z",
    cores: [{ x: 535, y: 245, width: 140, height: 95 }, { x: 250, y: 245, width: 120, height: 95 }],
    rooms: [
      room("2 этаж", "f2-206", "2.06", 144.14, "vacant", "40,80 245,80 245,340 40,340", 143, 205),
      room("2 этаж", "f2-207", "2.07", 105.65, "vacant", "245,80 375,80 375,245 245,245", 310, 160),
      room("2 этаж", "f2-208", "2.08", 64.7, "vacant", "375,150 535,150 535,245 375,245", 455, 190),
      room("2 этаж", "f2-201", "2.01", 131.69, "vacant", "535,80 810,80 810,245 670,245 670,340 535,340", 655, 165),
      room("2 этаж", "f2-202", "2.02", 132.84, "vacant", "810,180 930,180 930,550 810,550", 870, 360),
      room("2 этаж", "f2-203", "2.03", 106.84, "vacant", "535,340 810,340 810,550 535,550", 672, 445),
      room("2 этаж", "f2-204", "2.04", 65.28, "vacant", "375,340 535,340 535,550 375,550", 455, 445),
      room("2 этаж", "f2-205a", "2.05а", 105.08, "vacant", "40,340 220,340 220,550 40,550", 130, 445),
      room("2 этаж", "f2-205", "2.05", 91.05, "vacant", "220,340 375,340 375,550 220,550", 298, 445),
    ],
  },
  {
    name: "3 этаж",
    outline: "M25 55 H865 V30 H965 V610 H25 Z",
    cores: [{ x: 40, y: 80, width: 230, height: 175 }, { x: 825, y: 70, width: 115, height: 250 }],
    rooms: [
      room("3 этаж", "f3-311", "3.11 · директор", null, "service", "270,80 350,80 350,255 270,255", 310, 165),
      room("3 этаж", "f3-310", "3.10", 23.56, "trade", "350,80 500,80 500,255 350,255", 425, 165),
      room("3 этаж", "f3-309", "3.09", 11.71, "trade", "500,80 580,80 580,255 500,255", 540, 165),
      room("3 этаж", "f3-308", "3.08", 21.95, "vacant", "580,80 720,80 720,255 580,255", 650, 165),
      room("3 этаж", "f3-307", "3.07", 16.31, "vacant", "720,80 825,80 825,255 720,255", 772, 165),
      room("3 этаж", "f3-301", "3.01", 14.26, "vacant", "40,360 120,360 120,550 40,550", 80, 455),
      room("3 этаж", "f3-302c", "3.02с", 8.04, "storage", "120,360 200,360 200,550 120,550", 160, 455),
      room("3 этаж", "f3-303c", "3.03с", 7.8, "trade", "200,360 280,360 280,550 200,550", 240, 455),
      room("3 этаж", "f3-304a", "3.04А · общая", 43.91, "trade", "280,360 390,360 390,550 280,550", 335, 455, { included: false, note: "43,91 м² — общая площадь для 3.03с, 3.04 и 3.10; отдельно в итог не прибавлена." }),
      room("3 этаж", "f3-304", "3.04", 15.8, "storage", "390,360 510,360 510,550 390,550", 450, 455),
      room("3 этаж", "f3-304b", "3.04Б", 12.46, "vacant", "510,360 630,360 630,550 510,550", 570, 455),
      room("3 этаж", "f3-305", "3.05", 16.44, "vacant", "630,360 750,360 750,550 630,550", 690, 455),
      room("3 этаж", "f3-306", "3.06", 9.11, "vacant", "750,360 825,360 825,550 750,550", 787, 455),
    ],
  },
  {
    name: "Мансарда",
    outline: "M180 70 H820 V590 H180 Z",
    cores: [{ x: 760, y: 120, width: 90, height: 300 }],
    rooms: [
      room("Мансарда", "fa-205a", "2.05А", 105.08, "vacant", "250,175 500,175 500,500 250,500", 375, 335),
      room("Мансарда", "fa-207a", "2.07А", 99.55, "vacant", "500,175 750,175 750,500 500,500", 625, 335),
    ],
  },
];

export const allBrandRooms = brandFloors.flatMap((floor) => floor.rooms);

export function countedRooms(rooms: BrandRoom[] = allBrandRooms): BrandRoom[] {
  return rooms.filter((room) => room.area !== null && room.included !== false);
}

export function areaOf(rooms: BrandRoom[], kind?: RoomKind): number {
  return countedRooms(rooms)
    .filter((room) => kind === undefined || room.kind === kind)
    .reduce((sum, room) => sum + (room.area ?? 0), 0);
}

export const brandTotals = {
  total: areaOf(allBrandRooms),
  trade: areaOf(allBrandRooms, "trade"),
  vacant: areaOf(allBrandRooms, "vacant"),
  storage: areaOf(allBrandRooms, "storage"),
  service: areaOf(allBrandRooms, "service"),
  levels: floorOrder.length,
  zones: allBrandRooms.length,
};

