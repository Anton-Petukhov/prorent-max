import { quarterIndex } from "@/lib/quarters";

export type UseKind = "office" | "retail" | "warehouse" | "vacant";
export type AssetKind = "office" | "retail" | "logistics" | "mixed";

export type Zone = {
  id: string;
  name: string;
  use: UseKind;
  x: number;
  y: number;
  w: number;
  h: number;
  tenant: string | null;
  rentPerM2: number;
  start: string;
  end: string;
};

export type Floor = {
  id: string;
  name: string;
  level: number;
  zones: Zone[];
};

export type Asset = {
  id: string;
  name: string;
  city: string;
  country: string;
  address: string;
  kind: AssetKind;
  year: number;
  photo: string;
  acquired: string;
  floors: Floor[];
  source: "book" | "pdf";
  blurb: string;
};

type Spec = {
  id: string;
  name: string;
  use: UseKind;
  tenant: string | null;
  rent: number;
  start: string;
  end: string;
};

function zone(
  id: string,
  name: string,
  use: UseKind,
  x: number,
  y: number,
  w: number,
  h: number,
  tenant: string | null,
  rent: number,
  start: string,
  end: string,
): Zone {
  return { id, name, use, x, y, w, h, tenant, rentPerM2: rent, start, end };
}

function ring(w: number, d: number, band: number, specs: [Spec, Spec, Spec, Spec]): Zone[] {
  const [north, east, south, west] = specs;
  const mid = d - band * 2;
  const placed = [
    { ...north, x: 0, y: 0, w, h: band },
    { ...east, x: w - band, y: band, w: band, h: mid },
    { ...south, x: 0, y: d - band, w, h: band },
    { ...west, x: 0, y: band, w: band, h: mid },
  ];
  return placed.map((item) =>
    zone(item.id, item.name, item.use, item.x, item.y, item.w, item.h, item.tenant, item.rent, item.start, item.end),
  );
}

const empty = (id: string, name: string, use: UseKind, rent: number): Spec => ({
  id,
  name,
  use,
  tenant: null,
  rent,
  start: "",
  end: "",
});

const lease = (
  id: string,
  name: string,
  use: UseKind,
  tenant: string,
  rent: number,
  start: string,
  end: string,
): Spec => ({ id, name, use, tenant, rent, start, end });

const BERLIN: [Spec, Spec, Spec, Spec][] = [
  [
    lease("ber-0-n", "Улица", "retail", "Markthalle Süd", 340, "2019-Q2", "2028-Q2"),
    lease("ber-0-e", "Восточное крыло", "office", "Bildraum", 275, "2023-Q1", "2029-Q1"),
    lease("ber-0-s", "Садовое", "office", "Kreuzberg Works", 290, "2020-Q1", "2026-Q4"),
    lease("ber-0-w", "Западное крыло", "office", "Hof Atelier", 260, "2019-Q1", "2025-Q1"),
  ],
  [
    lease("ber-1-n", "Север", "office", "Kiehl & Partner", 310, "2021-Q3", "2028-Q3"),
    lease("ber-1-e", "Восток", "office", "Fenster AG", 280, "2019-Q2", "2024-Q2"),
    lease("ber-1-s", "Юг", "office", "Studio Ost", 300, "2022-Q1", "2027-Q4"),
    lease("ber-1-w", "Запад", "office", "Archiv Nord", 255, "2019-Q4", "2030-Q1"),
  ],
  [
    lease("ber-2-n", "Север", "office", "Papier Berlin", 305, "2020-Q3", "2028-Q1"),
    lease("ber-2-e", "Восток", "office", "Linie Vier", 295, "2023-Q2", "2029-Q3"),
    lease("ber-2-s", "Юг", "office", "Feld Notes", 285, "2021-Q1", "2027-Q1"),
    lease("ber-2-w", "Запад", "office", "Raum Drei", 270, "2024-Q3", "2030-Q3"),
  ],
  [
    lease("ber-3-n", "Север", "office", "Dach Studio", 250, "2022-Q2", "2027-Q2"),
    empty("ber-3-e", "Восток", "office", 240),
    lease("ber-3-s", "Юг", "office", "Lichtkammer", 245, "2025-Q1", "2029-Q1"),
    empty("ber-3-w", "Запад", "vacant", 230),
  ],
];

const PRAGUE: [Spec, Spec, Spec, Spec][] = [
  [
    lease("prg-0-n", "Улица", "retail", "Kavárna Devět", 310, "2018-Q4", "2027-Q4"),
    lease("prg-0-e", "Восток", "office", "Vinohrady Desk", 240, "2020-Q1", "2028-Q1"),
    lease("prg-0-s", "Двор", "office", "Most Legal", 230, "2019-Q3", "2026-Q3"),
    empty("prg-0-w", "Запад", "office", 220),
  ],
  [
    lease("prg-1-n", "Север", "office", "Říční Audit", 255, "2021-Q2", "2029-Q2"),
    lease("prg-1-e", "Восток", "office", "Studio Havel", 250, "2022-Q1", "2028-Q4"),
    lease("prg-1-s", "Юг", "office", "Cedra Partners", 245, "2019-Q1", "2025-Q4"),
    lease("prg-1-w", "Запад", "office", "Ateliér Lipa", 235, "2023-Q3", "2030-Q1"),
  ],
  [
    lease("prg-2-n", "Север", "office", "Mapa Czech", 260, "2020-Q4", "2027-Q4"),
    lease("prg-2-e", "Восток", "office", "Oliva Research", 255, "2024-Q1", "2029-Q4"),
    lease("prg-2-s", "Юг", "office", "Knihovna Firmy", 240, "2018-Q2", "2026-Q2"),
    lease("prg-2-w", "Запад", "office", "Severní Stůl", 235, "2021-Q4", "2028-Q2"),
  ],
  [
    lease("prg-3-n", "Север", "office", "Půda Works", 225, "2023-Q1", "2028-Q1"),
    empty("prg-3-e", "Восток", "vacant", 210),
    lease("prg-3-s", "Юг", "office", "Tiché Páté", 220, "2025-Q2", "2030-Q2"),
    lease("prg-3-w", "Запад", "office", "Koruna Mini", 215, "2019-Q2", "2024-Q3"),
  ],
];

const BERLIN_NAMES = ["Двор, земля", "Второй", "Третий", "Чердак"];
const PRAGUE_NAMES = ["Партер", "Второй", "Третий", "Четвёртый"];

export const SEED: Asset[] = [
  {
    id: "ams",
    name: "Кейзерсграхт 482",
    city: "Амстердам",
    country: "Нидерланды",
    address: "Keizersgracht 482",
    kind: "office",
    year: 1672,
    photo: "/photos/amsterdam.jpg",
    acquired: "2018-Q1",
    source: "book",
    blurb: "Узкий канал-хаус: первый этаж отдаёт улице, верхние — тихим практикам.",
    floors: [
      {
        id: "ams-0",
        name: "Первый",
        level: 0,
        zones: [
          zone("ams-0-r", "Витрина", "retail", 0, 0, 16, 12, "Noord & Co", 460, "2019-Q1", "2028-Q1"),
          zone("ams-0-o", "Бельэтаж", "office", 0, 12, 16, 18, "Maas Legal", 380, "2020-Q2", "2027-Q2"),
          zone("ams-0-v", "Двор", "vacant", 0, 30, 16, 12, null, 340, "", ""),
        ],
      },
      {
        id: "ams-1",
        name: "Второй",
        level: 1,
        zones: [
          zone("ams-1-a", "Парадный офис", "office", 0, 0, 16, 26, "Atelier Voss", 410, "2021-Q1", "2029-Q1"),
          zone("ams-1-b", "Задний кабинет", "office", 0, 26, 16, 16, "IJzer Post", 360, "2019-Q1", "2025-Q3"),
        ],
      },
      {
        id: "ams-2",
        name: "Третий",
        level: 2,
        zones: [
          zone("ams-2-w", "Запад", "office", 0, 0, 8, 42, "Northwind", 365, "2022-Q1", "2028-Q4"),
          zone("ams-2-e", "Восток", "office", 8, 0, 8, 42, "Canal Desk", 350, "2023-Q2", "2030-Q1"),
        ],
      },
      {
        id: "ams-3",
        name: "Мансарда",
        level: 3,
        zones: [
          zone("ams-3-o", "Светлый зал", "office", 0, 0, 16, 28, "Studio IJzer", 330, "2024-Q1", "2027-Q1"),
          zone("ams-3-v", "Холодный торец", "vacant", 0, 28, 16, 14, null, 290, "", ""),
        ],
      },
    ],
  },
  {
    id: "ham",
    name: "Шпайхеркай 12",
    city: "Гамбург",
    country: "Германия",
    address: "Speicherkai 12",
    kind: "mixed",
    year: 1904,
    photo: "/photos/hamburg.jpg",
    acquired: "2018-Q1",
    source: "book",
    blurb: "Кирпичный шпейхер у гавани: склады в теле здания, капитал — в надстройке.",
    floors: [
      {
        id: "ham-0",
        name: "Нижний склад",
        level: 0,
        zones: [
          zone("ham-0-a", "Неф A", "warehouse", 0, 0, 72, 60, "Baltic Grain", 92, "2018-Q1", "2029-Q2"),
          zone("ham-0-b", "Неф B", "warehouse", 72, 0, 38, 36, "Elbe Stores", 88, "2018-Q1", "2024-Q4"),
          zone("ham-0-c", "Контора у воды", "office", 72, 36, 38, 24, "Hafen Capital", 220, "2021-Q2", "2028-Q2"),
        ],
      },
      {
        id: "ham-1",
        name: "Верхний ярус",
        level: 1,
        zones: [
          zone("ham-1-a", "Неф C", "warehouse", 0, 0, 72, 60, "Nordsee Logistics", 98, "2019-Q3", "2027-Q4"),
          zone("ham-1-b", "Студии кая", "office", 72, 0, 38, 36, "Kai Studios", 240, "2022-Q1", "2029-Q1"),
          zone("ham-1-c", "Галерея", "office", 72, 36, 38, 24, "Lotse GmbH", 210, "2020-Q1", "2025-Q2"),
        ],
      },
    ],
  },
  {
    id: "ber",
    name: "Мерингдамм 48",
    city: "Берлин",
    country: "Германия",
    address: "Mehringdamm 48",
    kind: "office",
    year: 1912,
    photo: "/photos/berlin.jpg",
    acquired: "2018-Q1",
    source: "book",
    blurb: "Двор-колодец в Кройцберге. Крылья сдаются по отдельности, центр остаётся воздухом.",
    floors: BERLIN.map((specs, level) => ({
      id: `ber-${level}`,
      name: BERLIN_NAMES[level] ?? `Этаж ${level}`,
      level,
      zones: ring(42, 34, 9, specs),
    })),
  },
  {
    id: "waw",
    name: "Прага Магазин 7",
    city: "Варшава",
    country: "Польша",
    address: "Magazynowa 7, Praga",
    kind: "logistics",
    year: 2018,
    photo: "/photos/warsaw.jpg",
    acquired: "2019-Q1",
    source: "book",
    blurb: "Сухой склад на правом берегу. Мезонин держит офис экспедиторов.",
    floors: [
      {
        id: "waw-0",
        name: "Склад",
        level: 0,
        zones: [
          zone("waw-0-a", "Камера A", "warehouse", 0, 0, 80, 70, "Vistula Cold", 71, "2019-Q1", "2030-Q1"),
          zone("waw-0-b", "Камера B", "warehouse", 80, 0, 40, 46, "Praga Pack", 68, "2021-Q2", "2028-Q2"),
          zone("waw-0-c", "Док C", "warehouse", 80, 46, 40, 24, "Mostowa", 64, "2020-Q1", "2025-Q4"),
        ],
      },
      {
        id: "waw-1",
        name: "Мезонин",
        level: 1,
        zones: [
          zone("waw-1-o", "Офис смены", "office", 0, 0, 36, 20, "Magazyn Office", 145, "2021-Q1", "2028-Q1"),
          zone("waw-1-w", "Лёгкий ряд", "warehouse", 36, 0, 44, 20, "Mezz Light", 80, "2022-Q3", "2027-Q3"),
        ],
      },
    ],
  },
  {
    id: "mil",
    name: "Порта Романа 15",
    city: "Милан",
    country: "Италия",
    address: "Via Porta Romana 15",
    kind: "retail",
    year: 1890,
    photo: "/photos/milan.jpg",
    acquired: "2018-Q2",
    source: "book",
    blurb: "Палаццо с аркадой: торговля по периметру двора, бюро над ней.",
    floors: [
      {
        id: "mil-0",
        name: "Аркада",
        level: 0,
        zones: ring(36, 36, 9, [
          lease("mil-0-n", "Галерея север", "retail", "Sala Pietra", 520, "2019-Q2", "2028-Q4"),
          lease("mil-0-e", "Восточная витрина", "retail", "Bottega Lenta", 490, "2021-Q1", "2027-Q4"),
          lease("mil-0-s", "Южный проход", "retail", "Caffè Corte", 450, "2018-Q3", "2026-Q4"),
          empty("mil-0-w", "Западная арка", "retail", 430),
        ]),
      },
      {
        id: "mil-1",
        name: "Бельэтаж",
        level: 1,
        zones: ring(36, 36, 9, [
          lease("mil-1-n", "Север", "office", "Studio Brera", 390, "2020-Q4", "2029-Q2"),
          lease("mil-1-e", "Восток", "office", "Linea Due", 370, "2022-Q2", "2028-Q1"),
          lease("mil-1-s", "Юг", "office", "Archivio Roma", 360, "2019-Q1", "2027-Q3"),
          lease("mil-1-w", "Запад", "office", "Atelier Nove", 355, "2023-Q1", "2030-Q1"),
        ]),
      },
      {
        id: "mil-2",
        name: "Второй",
        level: 2,
        zones: ring(36, 36, 9, [
          lease("mil-2-n", "Север", "office", "Quota Milano", 340, "2024-Q1", "2029-Q4"),
          empty("mil-2-e", "Восток", "office", 330),
          lease("mil-2-s", "Юг", "office", "Carta & Co", 325, "2021-Q3", "2026-Q3"),
          lease("mil-2-w", "Запад", "retail", "Showroom Otto", 410, "2022-Q4", "2028-Q4"),
        ]),
      },
    ],
  },
  {
    id: "rot",
    name: "Док 19",
    city: "Роттердам",
    country: "Нидерланды",
    address: "Dok 19, Waalhaven",
    kind: "logistics",
    year: 2016,
    photo: "/photos/rotterdam.jpg",
    acquired: "2018-Q1",
    source: "book",
    blurb: "Короб у причала. Офис сидит на углу, остальное — высота ворот.",
    floors: [
      {
        id: "rot-0",
        name: "Платформа",
        level: 0,
        zones: [
          zone("rot-0-a", "Неф Маас", "warehouse", 0, 0, 80, 64, "Maas Bulk", 84, "2018-Q2", "2029-Q1"),
          zone("rot-0-b", "Неф Рейн", "warehouse", 80, 0, 40, 40, "Rijn Pallets", 79, "2020-Q4", "2027-Q4"),
          zone("rot-0-c", "Угловой офис", "office", 80, 40, 40, 24, "Dock Desk", 195, "2022-Q1", "2028-Q1"),
        ],
      },
      {
        id: "rot-1",
        name: "Павильон",
        level: 1,
        zones: [
          zone("rot-1-o", "Haven Lab", "office", 80, 40, 40, 24, "Haven Lab", 210, "2024-Q2", "2030-Q2"),
        ],
      },
    ],
  },
  {
    id: "prg",
    name: "Винограды 9",
    city: "Прага",
    country: "Чехия",
    address: "Vinohradská 9",
    kind: "office",
    year: 1908,
    photo: "/photos/prague.jpg",
    acquired: "2018-Q1",
    source: "book",
    blurb: "Угловой дом с карнизом. Четыре крыла вокруг узкого двора.",
    floors: PRAGUE.map((specs, level) => ({
      id: `prg-${level}`,
      name: PRAGUE_NAMES[level] ?? `Этаж ${level}`,
      level,
      zones: ring(32, 36, 8, specs),
    })),
  },
];

export function zoneArea(item: Zone): number {
  return item.w * item.h;
}

export function isLeased(item: Zone, qi: number): boolean {
  if (!item.tenant || !item.start) return false;
  if (qi < quarterIndex(item.start)) return false;
  if (!item.end) return true;
  return qi < quarterIndex(item.end);
}

export function isHeld(asset: Asset, qi: number): boolean {
  return qi >= quarterIndex(asset.acquired);
}

export function passingRent(item: Zone, qi: number): number {
  if (!isLeased(item, qi)) return 0;
  const years = (qi - quarterIndex(item.start)) / 4;
  return item.rentPerM2 * Math.pow(1.022, Math.max(0, years));
}

export function footprint(floor: Floor): { w: number; h: number } {
  let w = 8;
  let h = 8;
  for (const item of floor.zones) {
    w = Math.max(w, item.x + item.w);
    h = Math.max(h, item.y + item.h);
  }
  return { w, h };
}

export function assetById(assets: Asset[], id: string): Asset | undefined {
  return assets.find((asset) => asset.id === id);
}
