import { unzipSync, strFromU8 } from "fflate";
import { extractPdfText, parseLooseNumber } from "@/lib/pdf-extract";

export type RoomStatus = "Свободно" | "Занято" | "Бронь" | "Неизвестно";
export type Room = {
  object: string;
  floor: string;
  number: string;
  area: number | null;
  status: RoomStatus;
  note?: string;
};
export type Revision = { id: string; at: string; label: string; filename: string; rooms: Room[] };
export type Archive = { version: 1; revisions: Revision[] };
export type DiffKind = "new" | "gone" | "changed" | "same";
export type RoomDiff = { key: string; before?: Room; after?: Room; kind: DiffKind; areaChanged: boolean; statusChanged: boolean };
export const STORAGE_KEY = "prorent-analyzer-archive-v1";
const MAX_ROOMS = 15000;

const clean = (s: unknown) => String(s ?? "").replace(/\u00a0/g, " ").trim();
const column = (s: string) => clean(s).toLowerCase().replace(/[\s_.#()-]+/g, "").replace(/ё/g, "е");

export function statusOf(value: unknown): RoomStatus {
  const s = clean(value).toLowerCase().replace(/ё/g, "е");
  if (/брон|резерв|booked|reserved/.test(s)) return "Бронь";
  if (/не\s*свобод|занят|сдан|аренд|occupied|leased|rented|busy/.test(s)) return "Занято";
  if (/вакант|свобод|пуст|vacant|available|empty|free/.test(s)) return "Свободно";
  return "Неизвестно";
}
export function areaOf(value: unknown): number | null {
  const s = clean(value).replace(/м[²2]|кв\.?\s*м|sqm/gi, "").replace(/[^\d.,\s-]/g, "");
  if (!s || !/\d/.test(s)) return null;
  const n = parseLooseNumber(s);
  return n !== null && n >= 0 && n <= 1000000 ? Math.round(n * 100) / 100 : null;
}
export function identity(r: Pick<Room, "object" | "floor" | "number">): string {
  const objectKey = column(r.object).replace(/[«»"']/g, "").replace(/^(тц|тд|тк|торговыйцентр)/, "");
  const floorKey = column(r.floor).replace(/(этаж|эт|floor|level|уровень)/g, "").replace(/й$/, "").replace(/^0+(?=\d+$)/, "");
  const number = clean(r.number).toLowerCase().replace(/\s+/g, "").replace(/^№/, "").replace(/ё/g, "е");
  const numberKey = number.replace(/^0+(?=\d+$)/, "");
  return [objectKey, floorKey, numberKey].join("|");
}
export function uniqueRooms(rooms: Room[]) {
  const map = new Map<string, Room>();
  const duplicates: string[] = [];
  for (const row of rooms) {
    if (!row.number) continue;
    const key = identity(row);
    if (map.has(key)) duplicates.push([row.object, row.floor, row.number].filter(Boolean).join(" / "));
    else map.set(key, row);
  }
  return { map, duplicates };
}
export function compareRooms(baseline: Room[], current: Room[]): RoomDiff[] {
  const a = uniqueRooms(baseline).map;
  const b = uniqueRooms(current).map;
  const results: RoomDiff[] = [];
  for (const key of new Set([...a.keys(), ...b.keys()])) {
    const before = a.get(key);
    const after = b.get(key);
    const areaChanged = Boolean(before && after && before.area !== null && after.area !== null && Math.abs(before.area - after.area) > 0.05);
    const statusChanged = Boolean(before && after && before.status !== after.status && before.status !== "Неизвестно" && after.status !== "Неизвестно");
    const kind: DiffKind = !before ? "new" : !after ? "gone" : (areaChanged || statusChanged) ? "changed" : "same";
    results.push({ key, before, after, areaChanged, statusChanged, kind });
  }
  const priority: Record<DiffKind, number> = { changed: 0, new: 1, gone: 2, same: 3 };
  return results.sort((x, y) => priority[x.kind] - priority[y.kind] || x.key.localeCompare(y.key, "ru", { numeric: true }));
}
export function parseDelimited(text: string, separator?: string): string[][] {
  const sample = text.replace(/^\uFEFF/, "").split(/\r?\n/).slice(0, 8).join("\n");
  const sep = separator ?? ["\t", ";", ","].sort((a, b) => sample.split(b).length - sample.split(a).length)[0];
  const result: string[][] = [];
  let row: string[] = [], value = "", quoted = false;
  const t = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < t.length; i++) {
    const char = t[i];
    if (char === '"') {
      if (quoted && t[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (char === sep || char === "\n" || char === "\r")) {
      row.push(value.trim()); value = "";
      if (char !== sep) {
        if (row.some((cell) => cell.length)) result.push(row);
        row = [];
        if (char === "\r" && t[i + 1] === "\n") i++;
      }
    } else value += char;
  }
  row.push(value.trim());
  if (row.some((cell) => cell.length)) result.push(row);
  return result;
}

function headerKey(label: string): "number" | "object" | "floor" | "area" | "status" | "note" | null {
  const h = column(label).replace(/[,;:]+/g, "");
  if (/^(№|n|номер|номерпомещения|помещение|пом|помещениетц|комната|unit|room|roomnumber|unitnumber|лот|лотномер|space|shop|shopnumber)$/.test(h)
    || /^(номер|№).*(помещ|лот|торгов)|^(номерпом|№пом)|^помещени[ея]|^room.*number|^unit.*number/.test(h)) return "number";
  if (/^(объект|тц|тд|здание|центр|комплекс|building|property|object)$/.test(h) || /^(наименованиеобъекта|торговыйцентр)$/.test(h)) return "object";
  if (/^(этаж|эт|уровень|floor|level)$/.test(h) || /^номерэтажа/.test(h)) return "floor";
  if (/площ|^sqm|^area|^квм$|^м2$|^м²$|^s$/.test(h) && !/вакантнаяплощадь|свободнаяплощадь/.test(h)) return "area";
  if (/^(статус|состояние|занятость|вакантность|status|occupancy|аренда)$/.test(h)
    || /^(статус|занятость|вакантность|состояние|аренда)/.test(h)) return "status";
  if (/^(примечание|арендатор|комментарий|comment|tenant|note)$/.test(h)) return "note";
  return null;
}
function textRooms(text: string, defaultObject: string): Room[] {
  const rows: Room[] = [];
  for (const line of text.split(/\r?\n/)) {
    const l = line.replace(/\s+/g, " ").trim();
    if (!l || l.length > 280) continue;
    const m = l.match(/(?:^|\s)(?:пом(?:ещение)?\.?\s*№?\s*|№\s*|room\s*|unit\s*)([\wА-Яа-я./-]{1,20})[;:,\s-]+(?:пл(?:ощадь)?\.?\s*[:=\s]*)?([\d\s.,]+)\s*(?:м²|м2|кв\.?\s*м|sqm)/iu)
      ?? l.match(/^([\wА-Яа-я./-]{1,18})\s*[;|\t]+\s*([\d.,]+)\s*(?:м²|м2)?(?:\s*[;|\t ]+\s*(.*))?$/iu);
    if (!m) continue;
    const number = clean(m[1]);
    const area = areaOf(m[2]);
    if (!number || area === null) continue;
    rows.push({ object: defaultObject, floor: "", number, area, status: statusOf(l), note: "" });
  }
  return rows;
}
export function roomsFromMatrix(matrix: string[][], defaultObject: string): Room[] {
  const result: Room[] = [];
  let headers: Record<string, number> | null = null;
  for (let ri = 0; ri < matrix.length && result.length < MAX_ROOMS; ri++) {
    const row = matrix[ri] ?? [];
    const candidate: Record<string, number> = {};
    row.forEach((cell, index) => { const k = headerKey(cell); if (k && candidate[k] === undefined) candidate[k] = index; });
    if (candidate.number !== undefined && (candidate.area !== undefined || candidate.status !== undefined)) {
      headers = candidate; continue;
    }
    if (!headers) continue;
    const rawNumber = clean(row[headers.number]);
    const number = rawNumber.replace(/^(?:торговое|офис|помещение|комната|складское|склад)\s*(?:№\s*)?/iu, "").trim() || rawNumber;
    if (!number || /^(итого|всего|total|сумма)$/i.test(number)) continue;
    const area = headers.area !== undefined ? areaOf(row[headers.area]) : null;
    const status = headers.status !== undefined ? statusOf(row[headers.status]) : "Неизвестно";
    const note = headers.note !== undefined ? clean(row[headers.note]) : "";
    if (area === null && status === "Неизвестно" && !note) continue;
    result.push({ object: clean(row[headers.object]) || defaultObject, floor: clean(row[headers.floor]), number, area, status, note });
  }
  return result;
}
function parseXlsx(buffer: ArrayBuffer, defaultObject: string): Room[] {
  const zip = unzipSync(new Uint8Array(buffer), { filter: (entry) => entry.originalSize < 15_000_000 && entry.name.startsWith("xl/") });
  const xml = (name: string): Document | null => {
    const bytes = zip[name];
    if (!bytes) return null;
    const doc = new DOMParser().parseFromString(strFromU8(bytes), "application/xml");
    return doc.querySelector("parsererror") ? null : doc;
  };
  const shared = xml("xl/sharedStrings.xml");
  const strings = shared ? [...shared.getElementsByTagName("si")].map((el) => [...el.getElementsByTagName("t")].map((x) => x.textContent ?? "").join("")) : [];
  const sheets = Object.keys(zip).filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const rooms: Room[] = [];
  for (const path of sheets) {
    const doc = xml(path);
    if (!doc) continue;
    const rows: string[][] = [];
    for (const row of [...doc.getElementsByTagName("row")]) {
      const cols: string[] = [];
      for (const c of [...row.getElementsByTagName("c")]) {
        const ref = c.getAttribute("r") ?? "";
        const letters = ref.match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? "";
        let col = 0;
        for (const ch of letters) col = col * 26 + ch.charCodeAt(0) - 64;
        if (!col || col > 120) continue;
        const type = c.getAttribute("t");
        const raw = c.getElementsByTagName("v")[0]?.textContent ?? "";
        const value = type === "s" ? strings[Number(raw)] ?? "" : type === "inlineStr" ? [...c.getElementsByTagName("t")].map((x) => x.textContent ?? "").join("") : raw;
        cols[col - 1] = value;
      }
      rows.push(cols);
      if (rows.length >= MAX_ROOMS) break;
    }
    const parsed = roomsFromMatrix(rows, defaultObject);
    rooms.push(...(parsed.length ? parsed : textRooms(rows.map((row) => row.join("\t")).join("\n"), defaultObject)));
    if (rooms.length >= MAX_ROOMS) break;
  }
  return rooms.slice(0, MAX_ROOMS);
}
export async function roomsFromFile(file: File, defaultObject: string): Promise<Room[]> {
  if (file.size > 12_000_000) throw new Error("Файл больше 12 МБ. Разделите его на несколько таблиц.");
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx")) return parseXlsx(await file.arrayBuffer(), defaultObject);
  if (name.endsWith(".pdf")) return roomsFromText(await extractPdfText(await file.arrayBuffer()), defaultObject);
  if (/\.(csv|tsv|txt)$/.test(name)) return roomsFromText(await file.text(), defaultObject);
  if (/\.(png|jpe?g|webp)$/.test(name)) throw new Error("Распознавание изображений появится после подключения OCR/API. Пока вставьте данные текстом.");
  throw new Error("Поддерживаются XLSX, CSV, TSV, TXT и PDF с текстовым слоем.");
}
export function roomsFromText(text: string, defaultObject: string): Room[] {
  const matrix = parseDelimited(text, /\t/.test(text) ? "\t" : undefined);
  const table = roomsFromMatrix(matrix, defaultObject);
  return (table.length ? table : textRooms(text, defaultObject)).slice(0, MAX_ROOMS);
}
export function demoRevisions(): [Revision, Revision] {
  const prev: Room[] = [
    {object:"Электрон",floor:"1",number:"101",area:45.5,status:"Занято"},
    {object:"Электрон",floor:"1",number:"102",area:38,status:"Свободно"},
    {object:"Электрон",floor:"1",number:"103",area:72,status:"Занято"},
    {object:"Электрон",floor:"2",number:"201",area:80,status:"Занято"},
    {object:"Электрон",floor:"2",number:"202",area:24,status:"Бронь"},
  ];
  const next: Room[] = [
    {object:"Электрон",floor:"1",number:"101",area:45.5,status:"Свободно"},
    {object:"Электрон",floor:"1",number:"102",area:40.5,status:"Свободно"},
    {object:"Электрон",floor:"1",number:"103",area:72,status:"Занято"},
    {object:"Электрон",floor:"2",number:"201",area:80,status:"Занято"},
    {object:"Электрон",floor:"2",number:"203",area:30,status:"Свободно"},
  ];
  return [
    {id:"demo-archive",at:"2026-09-01T00:00:00.000Z",label:"Демо · архив",filename:"Демонстрационный набор",rooms:prev},
    {id:"demo-current",at:"2026-11-13T00:00:00.000Z",label:"Демо · актуальная",filename:"Демонстрационный набор",rooms:next},
  ];
}
function isRoom(x: unknown): x is Room {
  if (!x || typeof x !== "object") return false;
  const r = x as Partial<Room>;
  return typeof r.number === "string" && typeof r.object === "string" && typeof r.floor === "string" && (r.area === null || (typeof r.area === "number" && Number.isFinite(r.area) && r.area >= 0)) && ["Занято","Свободно","Бронь","Неизвестно"].includes(r.status ?? "");
}
export function validateArchive(value: unknown): Archive {
  if (!value || typeof value !== "object") throw new Error("Неверный файл архива.");
  const obj = value as Partial<Archive>;
  if (obj.version !== 1 || !Array.isArray(obj.revisions) || obj.revisions.length > 80) throw new Error("Неподдерживаемый формат архива.");
  const revisions = obj.revisions.map((r) => {
    if (!r || typeof r.id !== "string" || typeof r.at !== "string" || typeof r.label !== "string" || typeof r.filename !== "string" || !Array.isArray(r.rooms) || r.rooms.length > MAX_ROOMS || !r.rooms.every(isRoom)) throw new Error("Некорректная запись истории.");
    return { ...r, rooms: r.rooms.map((x) => ({...x})) };
  });
  return {version:1,revisions};
}
export function readArchive(): Archive {
  try { return validateArchive(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{"version":1,"revisions":[]}')); }
  catch { return {version:1,revisions:[]}; }
}
export function writeArchive(value: Archive): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(validateArchive(value)));
}
export function csvForDiff(diffs: RoomDiff[]): string {
  const rows = [["Объект","Этаж","№","Было м²","Стало м²","Было статус","Стало статус","Изменение"]];
  for (const d of diffs) {
    const row = d.after ?? d.before!;
    rows.push([row.object,row.floor,row.number,d.before?.area?.toString() ?? "",d.after?.area?.toString() ?? "",d.before?.status ?? "",d.after?.status ?? "",d.kind === "changed" ? "Изменено" : d.kind === "new" ? "Добавлено" : d.kind === "gone" ? "Исчезло" : "Совпадает"]);
  }
  const escape = (s: string) => {
    const safe = /^[=+@\-\t\r]/.test(s) ? "'" + s : s;
    return '"' + safe.replace(/"/g, '""') + '"';
  };
  return "\uFEFF" + rows.map((r) => r.map(escape).join(";")).join("\r\n");
}
export function downloadText(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content],{type:mime}));
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}
