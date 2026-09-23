import type { UseKind, Zone } from "@/lib/portfolio";

const USES: UseKind[] = ["office", "retail", "warehouse", "vacant"];

export function interpretPlanCommand(
  zones: Zone[],
  instruction: string,
  selectedId: string | null,
  qiLabel: string,
): { zones: Zone[]; note: string } | null {
  const text = instruction.toLowerCase();
  const wantVacant = /освобод|вакант|пусто|расторг/.test(text);
  const wantWh = /склад/.test(text);
  const wantOffice = /офис|коммерч/.test(text);
  const wantRetail = /ритейл|торгов|магазин|галере|витрин/.test(text);
  const wantSplit = /раздел|пополам|на два/.test(text);
  const pct = text.match(/(\d+(?:[.,]\d+)?)\s*%/);
  const rentDown = /сниз|уменьш|дисконт/.test(text);
  const rentUp = /повыс|увелич|индексац|\+/.test(text);
  const quarter = instruction.match(/(20\d{2})\s*[- ]?\s*q\s*([1-4])/i);
  const tenant = instruction.match(/(?:аренд\w*|tenant)\s+[«"']?([A-Za-zА-Яа-яЁё][^,.\n]{1,48})/);

  const named = zones.filter((item) => text.includes(item.name.toLowerCase()));
  let targets = named.map((item) => item.id);
  if (targets.length === 0 && selectedId && zones.some((item) => item.id === selectedId)) {
    targets = [selectedId];
  }
  if (targets.length === 0 && /все|каждый|этаж/.test(text)) targets = zones.map((item) => item.id);
  if (targets.length === 0) return null;
  if (!wantVacant && !wantWh && !wantOffice && !wantRetail && !wantSplit && !pct && !tenant && !quarter) {
    return null;
  }

  let next = zones.map((item) => ({ ...item }));
  const notes: string[] = [];

  for (const id of targets) {
    const item = next.find((zone) => zone.id === id);
    if (!item) continue;
    if (wantRetail) {
      item.use = "retail";
      notes.push(`${item.name}: торговля`);
    } else if (wantWh) {
      item.use = "warehouse";
      notes.push(`${item.name}: склад`);
    } else if (wantOffice) {
      item.use = "office";
      notes.push(`${item.name}: офис`);
    }
    if (wantVacant) {
      item.tenant = null;
      item.start = "";
      item.end = "";
      notes.push(`${item.name}: свободно`);
    }
    if (pct && (rentUp || rentDown || /ставк|аренд/.test(text))) {
      const value = Number(pct[1]?.replace(",", ".") ?? "0");
      const sign = rentDown ? -1 : 1;
      item.rentPerM2 = Math.max(0, Math.round(item.rentPerM2 * (1 + (sign * value) / 100)));
      notes.push(`ставка ${sign > 0 ? "+" : "−"}${value}%`);
    }
    if (tenant && !wantVacant) {
      item.tenant = tenant[1]?.trim() ?? item.tenant;
      if (!item.start) item.start = qiLabel;
      if (item.use === "vacant") item.use = "office";
      notes.push(`арендатор ${item.tenant ?? ""}`);
    }
    if (quarter && !wantVacant) {
      item.end = `${quarter[1]}-Q${quarter[2]}`;
      if (!item.start) item.start = qiLabel;
      notes.push(`до ${item.end}`);
    }
  }

  if (wantSplit && selectedId) {
    const split = splitZone(next, selectedId);
    if (split) {
      next = split;
      notes.push("зона разделена пополам");
    }
  }

  if (notes.length === 0) return null;
  return { zones: next, note: notes.join(" · ") };
}

function splitZone(zones: Zone[], id: string): Zone[] | null {
  const item = zones.find((zone) => zone.id === id);
  if (!item) return null;
  const vertical = item.w >= item.h;
  if ((vertical && item.w < 8) || (!vertical && item.h < 8)) return null;
  const keep = { ...item };
  const twin: Zone = {
    ...item,
    id: `${item.id}-b`,
    name: `${item.name} · 2`,
    tenant: null,
    start: "",
    end: "",
  };
  if (vertical) {
    const left = Math.round(item.w / 2);
    keep.w = left;
    twin.x = item.x + left;
    twin.w = item.w - left;
  } else {
    const top = Math.round(item.h / 2);
    keep.h = top;
    twin.y = item.y + top;
    twin.h = item.h - top;
  }
  return zones.flatMap((zone) => (zone.id === id ? [keep, twin] : [zone]));
}

export function sanitizeZones(raw: unknown, previous: Zone[], width: number, depth: number): Zone[] | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as { zones?: unknown; note?: unknown };
  if (!Array.isArray(record.zones) || record.zones.length < 1 || record.zones.length > 24) return null;
  const known = new Map(previous.map((item) => [item.id, item]));
  const zones: Zone[] = [];
  for (const entry of record.zones) {
    if (!entry || typeof entry !== "object") return null;
    const row = entry as Record<string, unknown>;
    const id = typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 48) : "";
    if (!id) return null;
    const base = known.get(id);
    const use = USES.includes(row.use as UseKind) ? (row.use as UseKind) : base?.use;
    if (!use) return null;
    const x = num(row.x, base?.x ?? 0);
    const y = num(row.y, base?.y ?? 0);
    const w = num(row.w, base?.w ?? 8);
    const h = num(row.h, base?.h ?? 8);
    if (w < 3 || h < 3 || w > width * 1.4 || h > depth * 1.4) return null;
    if (x < -2 || y < -2 || x > width * 1.3 || y > depth * 1.3) return null;
    const tenantRaw = row.tenant;
    const tenant =
      use === "vacant" || tenantRaw === null || tenantRaw === ""
        ? null
        : typeof tenantRaw === "string"
          ? tenantRaw.trim().slice(0, 80) || null
          : (base?.tenant ?? null);
    const start = quarterOr(row.start, tenant ? (base?.start ?? "") : "");
    const end = quarterOr(row.end, tenant ? (base?.end ?? "") : "");
    zones.push({
      id,
      name: typeof row.name === "string" && row.name.trim() ? row.name.trim().slice(0, 60) : (base?.name ?? "Зона"),
      use: tenant ? use : use === "vacant" ? "vacant" : use,
      x: round1(Math.max(0, x)),
      y: round1(Math.max(0, y)),
      w: round1(w),
      h: round1(h),
      tenant,
      rentPerM2: clamp(num(row.rentPerM2, base?.rentPerM2 ?? 100), 0, 2000),
      start: tenant ? start : "",
      end: tenant ? end : "",
    });
  }
  return zones;
}

export function noteFromModel(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "План обновлён";
  const note = (raw as { note?: unknown }).note;
  return typeof note === "string" && note.trim() ? note.trim().slice(0, 280) : "План обновлён";
}

function num(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function quarterOr(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^(20\d{2})-Q[1-4]$/.test(trimmed) ? trimmed : fallback;
}

export function extractJson(text: string): unknown {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence?.[1] ?? text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Модель не вернула JSON");
  return JSON.parse(body.slice(start, end + 1)) as unknown;
}
