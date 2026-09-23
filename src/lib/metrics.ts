import { QUARTERS, quarterIndex } from "@/lib/quarters";
import {
  isHeld,
  isLeased,
  passingRent,
  zoneArea,
  type Asset,
  type UseKind,
  type Zone,
} from "@/lib/portfolio";

export type Metrics = {
  total: number;
  vacant: number;
  commercial: number;
  warehouse: number;
  commercialVacant: number;
  warehouseVacant: number;
  shell: number;
  occupied: number;
  occupancy: number;
  rentPerM2: number;
  rentRoll: number;
  wault: number;
  assets: number;
};

const EMPTY: Metrics = {
  total: 0,
  vacant: 0,
  commercial: 0,
  warehouse: 0,
  commercialVacant: 0,
  warehouseVacant: 0,
  shell: 0,
  occupied: 0,
  occupancy: 0,
  rentPerM2: 0,
  rentRoll: 0,
  wault: 0,
  assets: 0,
};

function isCommercial(use: UseKind): boolean {
  return use === "office" || use === "retail";
}

export function metricsAt(assets: Asset[], qi: number): Metrics {
  const held = assets.filter((asset) => isHeld(asset, qi));
  if (held.length === 0) return { ...EMPTY };

  let total = 0;
  let vacant = 0;
  let commercial = 0;
  let warehouse = 0;
  let commercialVacant = 0;
  let warehouseVacant = 0;
  let shell = 0;
  let rentArea = 0;
  let rentWeighted = 0;
  let rentRoll = 0;
  let waultNum = 0;

  for (const asset of held) {
    for (const floor of asset.floors) {
      for (const item of floor.zones) {
        const area = zoneArea(item);
        if (area <= 0) continue;
        total += area;
        const leased = isLeased(item, qi);
        if (!leased) vacant += area;
        if (item.use === "warehouse") {
          warehouse += area;
          if (!leased) warehouseVacant += area;
        } else if (isCommercial(item.use)) {
          commercial += area;
          if (!leased) commercialVacant += area;
        } else {
          shell += area;
        }
        if (leased) {
          const rent = passingRent(item, qi);
          rentArea += area;
          rentWeighted += rent * area;
          const annual = rent * area;
          rentRoll += annual;
          if (item.end) {
            const remain = (quarterIndex(item.end) - qi) / 4;
            waultNum += Math.max(0, remain) * annual;
          }
        }
      }
    }
  }

  const occupied = total - vacant;
  return {
    total,
    vacant,
    commercial,
    warehouse,
    commercialVacant,
    warehouseVacant,
    shell,
    occupied,
    occupancy: total > 0 ? (occupied / total) * 100 : 0,
    rentPerM2: rentArea > 0 ? rentWeighted / rentArea : 0,
    rentRoll,
    wault: rentRoll > 0 ? waultNum / rentRoll : 0,
    assets: held.length,
  };
}

export type SeriesPoint = {
  label: string;
  commercial: number;
  warehouse: number;
  vacant: number;
  total: number;
  occupancy: number;
  rent: number;
};

export function series(assets: Asset[]): SeriesPoint[] {
  return QUARTERS.map((label, qi) => {
    const metrics = metricsAt(assets, qi);
    return {
      label,
      commercial: metrics.commercial - metrics.commercialVacant,
      warehouse: metrics.warehouse - metrics.warehouseVacant,
      vacant: metrics.vacant,
      total: metrics.total,
      occupancy: metrics.occupancy,
      rent: metrics.rentPerM2,
    };
  });
}

export type AssetSnap = {
  asset: Asset;
  total: number;
  vacant: number;
  commercial: number;
  warehouse: number;
  occupancy: number;
  rent: number;
  roll: number;
};

export function assetSnaps(assets: Asset[], qi: number): AssetSnap[] {
  return assets
    .filter((asset) => isHeld(asset, qi))
    .map((asset) => {
      const metrics = metricsAt([asset], qi);
      return {
        asset,
        total: metrics.total,
        vacant: metrics.vacant,
        commercial: metrics.commercial,
        warehouse: metrics.warehouse,
        occupancy: metrics.occupancy,
        rent: metrics.rentPerM2,
        roll: metrics.rentRoll,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export type CityRow = {
  city: string;
  country: string;
  count: number;
  total: number;
  vacant: number;
  commercial: number;
  warehouse: number;
  rent: number;
};

export function cityRows(assets: Asset[], qi: number): CityRow[] {
  const map = new Map<string, CityRow & { rentArea: number; rentWeighted: number }>();
  for (const snap of assetSnaps(assets, qi)) {
    const key = snap.asset.city;
    const row = map.get(key) ?? {
      city: snap.asset.city,
      country: snap.asset.country,
      count: 0,
      total: 0,
      vacant: 0,
      commercial: 0,
      warehouse: 0,
      rent: 0,
      rentArea: 0,
      rentWeighted: 0,
    };
    row.count += 1;
    row.total += snap.total;
    row.vacant += snap.vacant;
    row.commercial += snap.commercial;
    row.warehouse += snap.warehouse;
    const occupied = snap.total - snap.vacant;
    row.rentArea += occupied;
    row.rentWeighted += snap.rent * occupied;
    map.set(key, row);
  }
  return [...map.values()]
    .map((row) => ({
      city: row.city,
      country: row.country,
      count: row.count,
      total: row.total,
      vacant: row.vacant,
      commercial: row.commercial,
      warehouse: row.warehouse,
      rent: row.rentArea > 0 ? row.rentWeighted / row.rentArea : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export function expiryBuckets(assets: Asset[], qi: number): { label: string; area: number }[] {
  const startYear = 2018 + Math.floor(qi / 4);
  const buckets = [0, 1, 2, 3, 4, 5].map((offset) => ({
    label: offset === 5 ? `${startYear + 5}+` : String(startYear + offset),
    area: 0,
  }));
  for (const asset of assets) {
    if (!isHeld(asset, qi)) continue;
    for (const floor of asset.floors) {
      for (const item of floor.zones) {
        if (!isLeased(item, qi) || !item.end) continue;
        const endQi = quarterIndex(item.end);
        const year = 2018 + Math.floor(endQi / 4);
        const offset = Math.min(5, Math.max(0, year - startYear));
        const bucket = buckets[offset];
        if (bucket) bucket.area += zoneArea(item);
      }
    }
  }
  return buckets;
}

export type HeatCell = { assetId: string; name: string; city: string; year: number; rate: number | null };

export function vacancyHeat(assets: Asset[]): HeatCell[] {
  const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
  const cells: HeatCell[] = [];
  for (const asset of assets) {
    for (const year of years) {
      const qi = QUARTERS.indexOf(`${year}-Q3`);
      if (!isHeld(asset, qi)) {
        cells.push({ assetId: asset.id, name: asset.name, city: asset.city, year, rate: null });
        continue;
      }
      const metrics = metricsAt([asset], qi);
      const rate = metrics.total > 0 ? (metrics.vacant / metrics.total) * 100 : 0;
      cells.push({ assetId: asset.id, name: asset.name, city: asset.city, year, rate });
    }
  }
  return cells;
}

export type LeaseEvent = {
  qi: number;
  tone: "start" | "end" | "enter";
  title: string;
  detail: string;
};

export function eventsBetween(assets: Asset[], from: number, to: number): LeaseEvent[] {
  const events: LeaseEvent[] = [];
  for (const asset of assets) {
    const acquired = QUARTERS.indexOf(asset.acquired);
    if (acquired >= from && acquired <= to) {
      events.push({
        qi: acquired,
        tone: "enter",
        title: asset.name,
        detail: `Вход в портфель · ${asset.city}`,
      });
    }
    for (const floor of asset.floors) {
      for (const item of floor.zones) {
        pushEdge(events, asset, item, item.start, "start", from, to);
        pushEdge(events, asset, item, item.end, "end", from, to);
      }
    }
  }
  return events.sort((a, b) => a.qi - b.qi || a.title.localeCompare(b.title, "ru"));
}

function pushEdge(
  events: LeaseEvent[],
  asset: Asset,
  item: Zone,
  label: string,
  tone: "start" | "end",
  from: number,
  to: number,
) {
  if (!label || !item.tenant) return;
  const qi = QUARTERS.indexOf(label);
  if (qi < from || qi > to) return;
  events.push({
    qi,
    tone,
    title: item.tenant,
    detail: tone === "start" ? `Старт · ${asset.name}, ${item.name}` : `Окончание · ${asset.name}, ${item.name}`,
  });
}
