import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { m2, pct } from "@/lib/format";
import { assetSnaps, expiryBuckets, series, type SeriesPoint } from "@/lib/metrics";
import type { Asset } from "@/lib/portfolio";
import { QUARTERS } from "@/lib/quarters";
import { theme } from "@/lib/theme";

type TipRow = { name?: string; value?: number; color?: string; dataKey?: string };

function Tip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: TipRow[];
  label?: string;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="panel px-3 py-2 text-ink shadow-none">
      <p className="mb-1 text-xs text-stone">{label}</p>
      {payload.map((row) => (
        <p key={String(row.dataKey)} className="nums text-sm">
          <span style={{ color: row.color }}>{row.name}</span>
          {": "}
          {unit === "%" ? pct(row.value ?? 0) : m2(row.value ?? 0)}
          {unit === "м²" ? " м²" : unit === "€" ? " €" : ""}
        </p>
      ))}
    </div>
  );
}

function yearTick(value: string): string {
  return value.endsWith("Q1") ? value.slice(0, 4) : "";
}

export function MixChart({ assets, qi }: { assets: Asset[]; qi: number }) {
  const data = useMemo(() => series(assets), [assets]);
  const mark = QUARTERS[qi] ?? data[0]?.label;
  return (
    <div className="h-72 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={theme.line} vertical={false} />
          <XAxis
            dataKey="label"
            tickFormatter={yearTick}
            interval={3}
            tick={{ fill: theme.stone, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(value: number) => m2(value)}
            tick={{ fill: theme.stone, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip content={<Tip unit="м²" />} />
          <Area
            type="monotone"
            dataKey="commercial"
            name="Коммерция занята"
            stackId="mix"
            stroke={theme.copper}
            fill={theme.copper}
            fillOpacity={0.9}
          />
          <Area
            type="monotone"
            dataKey="warehouse"
            name="Склады заняты"
            stackId="mix"
            stroke={theme.pine}
            fill={theme.pine}
            fillOpacity={0.92}
          />
          <Area
            type="monotone"
            dataKey="vacant"
            name="Вакант"
            stackId="mix"
            stroke={theme.stone}
            fill={theme.vacant}
            fillOpacity={1}
          />
          {mark ? <ReferenceLine x={mark} stroke={theme.ink} strokeDasharray="3 3" /> : null}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MixDonut({ assets, qi }: { assets: Asset[]; qi: number }) {
  const point: SeriesPoint | undefined = series(assets)[qi];
  const data = [
    { name: "Коммерция", value: point?.commercial ?? 0, fill: theme.copper },
    { name: "Склады", value: point?.warehouse ?? 0, fill: theme.pine },
    { name: "Вакант", value: point?.vacant ?? 0, fill: theme.vacant },
  ];
  const occupancy = point?.occupancy ?? 0;
  return (
    <div className="relative h-64 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="64%" outerRadius="88%" stroke={theme.paper} paddingAngle={1.5}>
            {data.map((slice) => (
              <Cell key={slice.name} fill={slice.fill} />
            ))}
          </Pie>
          <Tooltip content={<Tip unit="м²" />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="nums font-display text-4xl text-ink">{pct(occupancy)}</span>
        <span className="kicker mt-1">занято</span>
      </div>
    </div>
  );
}

export function RentBars({ assets, qi }: { assets: Asset[]; qi: number }) {
  const data = assetSnaps(assets, qi).map((snap) => ({
    name: snap.asset.name.length > 16 ? `${snap.asset.name.slice(0, 15)}…` : snap.asset.name,
    rent: Math.round(snap.rent),
  }));
  return (
    <div className="h-72 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={112}
            tick={{ fill: theme.inkSoft, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<Tip unit="€" />} />
          <Bar dataKey="rent" name="Ставка" fill={theme.copper} barSize={12} radius={[0, 2, 2, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ExpiryBars({ assets, qi }: { assets: Asset[]; qi: number }) {
  const data = expiryBuckets(assets, qi);
  return (
    <div className="h-56 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={theme.line} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: theme.stone, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(value: number) => m2(value)}
            tick={{ fill: theme.stone, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip content={<Tip unit="м²" />} />
          <Bar dataKey="area" name="Истекает" fill={theme.pine} barSize={22} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MixLegend() {
  const items = [
    { label: "Коммерция занята", swatch: "bg-copper" },
    { label: "Склады заняты", swatch: "bg-pine" },
    { label: "Вакант", swatch: "bg-vacant" },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span className={`inline-block size-2 ${item.swatch}`} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
