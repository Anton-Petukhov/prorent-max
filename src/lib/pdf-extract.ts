import type { Asset, UseKind, Zone } from "@/lib/portfolio";

export type LeaseFields = {
  name: string | null;
  city: string | null;
  country: string | null;
  tenant: string | null;
  total: number | null;
  commercial: number | null;
  warehouse: number | null;
  vacant: number | null;
  vacantCommercial: number | null;
  vacantWarehouse: number | null;
  rent: number | null;
  excerpt: string;
};

const PHOTOS = [
  "/photos/hamburg.jpg",
  "/photos/rotterdam.jpg",
  "/photos/warsaw.jpg",
  "/photos/berlin.jpg",
  "/photos/prague.jpg",
  "/photos/milan.jpg",
  "/photos/amsterdam.jpg",
];

export async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  }
  const doc = await pdfjs.getDocument({ data: data.slice(0), verbosity: 0 }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let line = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      line += item.str;
      if ("hasEOL" in item && item.hasEOL) {
        pages.push(line);
        line = "";
      } else {
        line += " ";
      }
    }
    if (line.trim()) pages.push(line);
  }
  return pages.join("\n");
}

export function parseLeaseText(text: string): LeaseFields {
  const excerpt = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 700);
  return {
    name: lineValue(text, /^(?:объект|objekt|object|objet|obiekt|название|наименование)\s*[:\-–]/iu),
    city: lineValue(text, /^(?:город|stadt|city|ville|miasto)\s*[:\-–]/iu),
    country: lineValue(text, /^(?:страна|land|country|pays|kraj)\s*[:\-–]/iu),
    tenant: lineValue(text, /^(?:арендатор|mieter|tenant|locataire|najemca)\s*[:\-–]/iu),
    total: grab(
      text,
      /(?:общ\p{L}*\s+площад\p{L}*|gesamtfl[aä]che|surface\s+totale|powierzchnia\s+ca[łl]kowita|total\s+(?:area|gla|nla)|gla)/iu,
    ),
    vacantCommercial: grab(
      text,
      /(?:вакант\p{L}*\s+коммерч\p{L}*|вакант\p{L}*\s+офис\p{L}*|leerstand\s+b[uü]ro|vacant\s+(?:office|commercial))/iu,
    ),
    vacantWarehouse: grab(
      text,
      /(?:вакант\p{L}*\s+склад\p{L}*|leerstand\s+lager|vacant\s+warehouse)/iu,
    ),
    commercial: grab(
      text,
      /(?:коммерч\p{L}*\s+площад\p{L}*|офисн\p{L}*\s+площад\p{L}*|b[uü]rofl[aä]che|handelsfl[aä]che|surface\s+commerciale|powierzchnia\s+biurowa|office\s+area|commercial\s+area)/iu,
    ),
    warehouse: grab(
      text,
      /(?:склад\p{L}*\s+площад\p{L}*|lagerfl[aä]che|surface\s+entrep[oô]t|powierzchnia\s+magazynowa|warehouse\s+area|logistics\s+area)/iu,
    ),
    vacant: grab(
      text,
      /(?:вакант\p{L}*\s+площад\p{L}*|leerstand|surface\s+vacante|powierzchnia\s+pustostan\p{L}*|vacant\s+area)/iu,
    ),
    rent: grab(text, /(?:аренд\p{L}*\s+ставк\p{L}*|ставка\s+аренд\p{L}*|miete|loyer|czynsz|rent)/iu, 1, 5000),
    excerpt,
  };
}

function lineValue(text: string, label: RegExp): string | null {
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim();
    if (!label.test(line)) continue;
    const value = line.split(/[:\-–]/).slice(1).join(":").trim();
    if (value && !/^\d/.test(value)) return value.slice(0, 80);
  }
  return null;
}

function grab(text: string, label: RegExp, min = 30, max = 500000): number | null {
  const reject = /вакант|leerstand|vacant|pustostan|vacante/i;
  const skipVacant = label.source.includes("коммерч") || label.source.includes("склад") || label.source.includes("b[u");
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim();
    if (!label.test(line)) continue;
    if (skipVacant && reject.test(line) && !label.source.includes("вакант") && !label.source.includes("leerstand")) continue;
    const tail = line.split(/[:\-–]/).slice(1).join(":");
    const match = /([\d][\d\s.,]{0,14})/.exec(tail || line);
    if (!match?.[1]) continue;
    const value = parseLooseNumber(match[1]);
    if (value === null || value < min || value > max) continue;
    return Math.round(value);
  }
  return null;
}

export function parseLooseNumber(raw: string): number | null {
  let s = raw.trim().replace(/\s/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const tail = s.split(",")[1] ?? "";
    s = tail.length === 3 ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (lastDot >= 0) {
    const parts = s.split(".");
    const tail = parts[1] ?? "";
    if (tail.length === 3 && (parts[0]?.length ?? 0) <= 3) s = parts.join("");
  }
  const value = Number(s);
  return Number.isFinite(value) ? value : null;
}

export function assetFromLease(fields: LeaseFields, filename: string): Asset | null {
  const warehouse = fields.warehouse ?? 0;
  const commercial = fields.commercial ?? 0;
  const declaredTotal = fields.total;
  let total = declaredTotal ?? commercial + warehouse;
  if (total < 80) return null;
  if (commercial + warehouse <= 0) {
    const vacant = Math.min(fields.vacant ?? 0, total);
    return packAsset(fields, filename, {
      whLeased: 0,
      whVacant: 0,
      comLeased: Math.max(0, total - vacant),
      comVacant: vacant,
    });
  }
  if (declaredTotal && commercial + warehouse > declaredTotal * 1.08) {
    total = commercial + warehouse;
  } else if (!declaredTotal) {
    total = commercial + warehouse;
  }
  const scale = commercial + warehouse > 0 ? total / (commercial + warehouse) : 1;
  const wh = warehouse * scale;
  const com = commercial * scale;
  let whVacant = fields.vacantWarehouse ?? 0;
  let comVacant = fields.vacantCommercial ?? 0;
  if (whVacant + comVacant <= 0 && fields.vacant) {
    const share = com / (com + wh || 1);
    comVacant = Math.round(fields.vacant * share);
    whVacant = Math.max(0, fields.vacant - comVacant);
  }
  comVacant = Math.min(comVacant, com);
  whVacant = Math.min(whVacant, wh);
  return packAsset(fields, filename, {
    whLeased: Math.max(0, wh - whVacant),
    whVacant,
    comLeased: Math.max(0, com - comVacant),
    comVacant,
  });
}

function packAsset(
  fields: LeaseFields,
  filename: string,
  areas: { whLeased: number; whVacant: number; comLeased: number; comVacant: number },
): Asset {
  const name = fields.name ?? filename.replace(/\.pdf$/i, "");
  const id = slug(name);
  const raw: Array<{ key: string; name: string; use: UseKind; area: number; leased: boolean }> = [
    { key: "wh", name: "Склад", use: "warehouse", area: areas.whLeased, leased: true },
    { key: "whv", name: "Склад, свободно", use: "warehouse", area: areas.whVacant, leased: false },
    { key: "com", name: "Коммерция", use: "office", area: areas.comLeased, leased: true },
    { key: "comv", name: "Коммерция, свободно", use: "office", area: areas.comVacant, leased: false },
  ];
  const blocks = raw.filter((block) => block.area >= 20);

  let x = 0;
  const zones: Zone[] = blocks.map((block) => {
    const width = Math.max(8, Math.round(Math.sqrt(block.area * 1.7) * 10) / 10);
    const height = block.area / width;
    const zone: Zone = {
      id: `${id}-${block.key}`,
      name: block.name,
      use: block.use,
      x,
      y: 0,
      w: width,
      h: height,
      tenant: block.leased ? fields.tenant : null,
      rentPerM2: fields.rent ?? 120,
      start: block.leased ? "2024-Q1" : "",
      end: block.leased ? "2029-Q4" : "",
    };
    x += width + 3;
    return zone;
  });

  const warehouse = areas.whLeased + areas.whVacant;
  const commercial = areas.comLeased + areas.comVacant;
  const kind = warehouse > commercial * 1.4 ? "logistics" : commercial > warehouse * 1.4 ? "office" : "mixed";
  const photo = PHOTOS[Math.abs(hash(id)) % PHOTOS.length] ?? PHOTOS[0]!;

  return {
    id,
    name,
    city: fields.city ?? "Не указан",
    country: fields.country ?? "Европа",
    address: fields.city ? `По документу · ${fields.city}` : filename,
    kind,
    year: 2024,
    photo,
    acquired: "2018-Q1",
    source: "pdf",
    blurb: "Площади сняты с текстового слоя договора и разложены в сводный план.",
    floors: [{ id: `${id}-0`, name: "Сводный план", level: 0, zones }],
  };
}

function slug(value: string): string {
  const base = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42);
  return `pdf-${base || "asset"}`;
}

function hash(value: string): number {
  let n = 0;
  for (let i = 0; i < value.length; i += 1) n = (n * 33 + value.charCodeAt(i)) >>> 0;
  return n;
}
