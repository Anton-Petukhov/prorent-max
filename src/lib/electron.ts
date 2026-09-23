import plan from "@/lib/electron-data.json";
import facades from "@/lib/electron-facades.json";

export type ElectronStatus = "occupied" | "vacant";
export type Pt = [number, number];

export type ElectronRoom = {
  id: string;
  legacy: string;
  floor: number;
  area: number;
  status: ElectronStatus;
  name: string;
  shapes: Pt[][];
  label: Pt;
  note: string;
};

export type ElectronFloor = {
  number: number;
  name: string;
  crop: [number, number, number, number];
  rooms: ElectronRoom[];
  walls: Pt[][];
  commonAreas: Pt[][];
};

export const electronPlan = plan as {
  date: string;
  floors: ElectronFloor[];
};

export const electronFloors = electronPlan.floors;

const facadeLines = facades as unknown as Record<string, Pt[][]>;

export const electronStatus = {
  occupied: { label: "Занято / торговая", color: "#67d894" },
  vacant: { label: "Вакантно", color: "#f18f74" },
} as const;

export function electronTotals(rooms: ElectronRoom[]) {
  const sum = (status?: ElectronStatus) =>
    Math.round(rooms.filter((room) => !status || room.status === status).reduce((total, room) => total + room.area, 0) * 100) /
    100;
  const total = sum();
  const occupied = sum("occupied");
  return {
    total,
    occupied,
    vacant: sum("vacant"),
    count: rooms.length,
    occupancy: total ? (occupied / total) * 100 : 0,
  };
}

export const electronBook = electronTotals(electronFloors.flatMap((floor) => floor.rooms));

export function roomPath(room: ElectronRoom): string {
  return room.shapes.map((ring) => `M${ring.map((point) => point.join(",")).join(" L")} Z`).join(" ");
}

type Seg = { start: Pt; end: Pt; shared: boolean };

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const cross = (a: Pt, b: Pt) => a[0] * b[1] - a[1] * b[0];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const along = (seg: Seg, t: number): Pt => [
  seg.start[0] + (seg.end[0] - seg.start[0]) * t,
  seg.start[1] + (seg.end[1] - seg.start[1]) * t,
];

function inside(point: Pt, ring: Pt[]): boolean {
  let hit = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const current = ring[index];
    const prior = ring[previous];
    if (!current || !prior) continue;
    if (current[1] > point[1] !== prior[1] > point[1] && point[0] < ((prior[0] - current[0]) * (point[1] - current[1])) / (prior[1] - current[1]) + current[0]) {
      hit = !hit;
    }
  }
  return hit;
}

function distanceToSegment(point: Pt, seg: Seg): number {
  const delta = sub(seg.end, seg.start);
  const offset = sub(point, seg.start);
  const length2 = delta[0] ** 2 + delta[1] ** 2;
  const t = Math.max(0, Math.min(1, (delta[0] * offset[0] + delta[1] * offset[1]) / length2));
  return dist(point, along(seg, t));
}

function exposedFacade(seg: Seg, obstacles: Pt[][]): Seg[] {
  const delta = sub(seg.end, seg.start);
  const length = dist(seg.start, seg.end);
  if (length < 2) return [];
  const tangent: Pt = [delta[0] / length, delta[1] / length];
  const normal: Pt = [-tangent[1], tangent[0]];
  const band = 3.5;
  const spans: Array<[number, number]> = [];
  for (const ring of obstacles) {
    const local = ring.map((point) => {
      const offset = sub(point, seg.start);
      return [offset[0] * tangent[0] + offset[1] * tangent[1], offset[0] * normal[0] + offset[1] * normal[1]] as Pt;
    });
    const hits: number[] = [];
    local.forEach((point, index) => {
      const next = local[(index + 1) % local.length];
      if (!next) return;
      if (Math.abs(point[1]) <= band) hits.push(point[0]);
      for (const edge of [-band, band]) {
        if (point[1] < edge !== next[1] < edge) {
          hits.push(point[0] + ((next[0] - point[0]) * (edge - point[1])) / (next[1] - point[1]));
        }
      }
    });
    if (!hits.length) continue;
    const from = Math.max(0, Math.min(...hits));
    const to = Math.min(length, Math.max(...hits));
    if (to > from) spans.push([from, to]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  const open: Seg[] = [];
  let cursor = 0;
  for (const [from, to] of [...spans, [length, length] as [number, number]]) {
    if (from - cursor > 2) open.push({ start: along(seg, cursor / length), end: along(seg, from / length), shared: false });
    cursor = Math.max(cursor, to);
  }
  return open;
}

const derived = new WeakMap<ElectronFloor, { solidWalls: Pt[][]; partitions: Seg[] }>();

export function deriveWalls(floor: ElectronFloor): { solidWalls: Pt[][]; partitions: Seg[] } {
  const cached = derived.get(floor);
  if (cached) return cached;

  const edges = floor.rooms.flatMap((room) =>
    room.shapes.flatMap((ring) =>
      ring
        .map((point, index) => ({
          start: point,
          end: ring[(index + 1) % ring.length] ?? point,
          roomId: room.id,
        }))
        .filter((edge) => dist(edge.start, edge.end) > 3),
    ),
  );
  const roomsAt = (point: Pt) =>
    floor.rooms.filter((room) => room.shapes.some((ring) => inside(point, ring))).map((room) => room.id);
  const inCommon = (point: Pt) => floor.commonAreas.some((ring) => inside(point, ring));
  const partitions: Seg[] = [];

  for (const edge of edges) {
    const delta = sub(edge.end, edge.start);
    const length = dist(edge.start, edge.end);
    const length2 = length ** 2;
    const cuts = [0, 1];
    for (const other of edges) {
      if (other === edge) continue;
      const otherDelta = sub(other.end, other.start);
      const relative = sub(other.start, edge.start);
      const denom = cross(delta, otherDelta);
      const otherLength = dist(other.start, other.end);
      if (Math.abs(denom) / (length * otherLength) < 0.015 && Math.abs(cross(delta, relative)) / length < 2.2) {
        for (const point of [other.start, other.end]) {
          const offset = sub(point, edge.start);
          const t = (offset[0] * delta[0] + offset[1] * delta[1]) / length2;
          if (t > 0 && t < 1) cuts.push(t);
        }
      } else if (Math.abs(denom) > 0.001) {
        const onEdge = cross(relative, otherDelta) / denom;
        const onOther = cross(relative, delta) / denom;
        if (onEdge > 0 && onEdge < 1 && onOther >= 0 && onOther <= 1) cuts.push(onEdge);
      }
    }
    cuts.sort((a, b) => a - b);
    for (let index = 0; index < cuts.length - 1; index += 1) {
      const from = cuts[index] ?? 0;
      const to = cuts[index + 1] ?? 1;
      if ((to - from) * length < 4) continue;
      const mid = along({ start: edge.start, end: edge.end, shared: false }, (from + to) / 2);
      const side: Pt = [(-delta[1] / length) * 2, (delta[0] / length) * 2];
      const left: Pt = [mid[0] + side[0], mid[1] + side[1]];
      const right: Pt = [mid[0] - side[0], mid[1] - side[1]];
      const leftRooms = roomsAt(left);
      const rightRooms = roomsAt(right);
      if (leftRooms.some((id) => rightRooms.includes(id))) continue;
      const shared = leftRooms.length > 0 && rightRooms.length > 0;
      const besideCommon = (leftRooms.length > 0 && inCommon(right)) || (rightRooms.length > 0 && inCommon(left));
      if ((!shared && !besideCommon) || (shared && edge.roomId !== [...leftRooms, ...rightRooms].sort()[0])) continue;
      const piece: Seg = { start: along({ start: edge.start, end: edge.end, shared: false }, from), end: along({ start: edge.start, end: edge.end, shared: false }, to), shared };
      const duplicate = partitions.some(
        (item) =>
          (dist(item.start, piece.start) < 2.2 && dist(item.end, piece.end) < 2.2) ||
          (dist(item.start, piece.end) < 2.2 && dist(item.end, piece.start) < 2.2),
      );
      if (!duplicate) partitions.push(piece);
    }
  }

  const solidWalls = floor.walls.filter((ring) => {
    const xs = ring.map((point) => point[0]);
    const ys = ring.map((point) => point[1]);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    if (Math.min(width, height) > 7 || Math.max(width, height) < 14) return true;
    const start: Pt = width > height ? [Math.min(...xs), (Math.min(...ys) + Math.max(...ys)) / 2] : [(Math.min(...xs) + Math.max(...xs)) / 2, Math.min(...ys)];
    const end: Pt = width > height ? [Math.max(...xs), (Math.min(...ys) + Math.max(...ys)) / 2] : [(Math.min(...xs) + Math.max(...xs)) / 2, Math.max(...ys)];
    return !partitions.some((seg) => seg.shared && distanceToSegment(start, seg) < 5 && distanceToSegment(end, seg) < 5);
  });

  for (const line of facadeLines[String(floor.number)] ?? []) {
    for (let index = 0; index < line.length - 1; index += 1) {
      const start = line[index];
      const end = line[index + 1];
      if (!start || !end) continue;
      partitions.push(...exposedFacade({ start, end, shared: false }, solidWalls));
    }
  }

  const result = { solidWalls, partitions };
  derived.set(floor, result);
  return result;
}
