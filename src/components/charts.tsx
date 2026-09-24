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

export type MixPoint = {
  label: string;
  commercial: number;
  warehouse: number;
  vacant: number;
  occupancy?: number;
};

export function AreaMix({ data, mark }: { data: MixPoint[]; mark?: string }) {
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

export function MixChart({
  assets,
  qi,
  includeArchive = true,
}: {
  assets: Asset[];
  qi: number;
  includeArchive?: boolean;
}) {
  const data = useMemo(() => series(assets, includeArchive), [assets, includeArchive]);
  const mark = QUARTERS[qi] ?? data[0]?.label;
  return <AreaMix data={data} mark={mark} />;
}

export function DonutMix({
  slices,
  center,
  caption,
}: {
  slices: { name: string; value: number; fill: string }[];
  center: string;
  caption: string;
}) {
  const drawn = slices.filter((slice) => slice.value > 0);
  return (
    <div className="relative h-64 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={drawn.length ? drawn : [{ name: "Нет данных", value: 1, fill: theme.line }]}
            dataKey="value"
            nameKey="name"
            innerRadius="64%"
            outerRadius="88%"
            stroke={theme.paper}
            paddingAngle={drawn.length > 1 ? 1.5 : 0}
          >
            {(drawn.length ? drawn : [{ name: "Нет данных", value: 1, fill: theme.line }]).map((slice) => (
              <Cell key={slice.name} fill={slice.fill} />
            ))}
          </Pie>
          <Tooltip content={<Tip unit="м²" />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="nums font-display text-4xl text-ink">{center}</span>
        <span className="kicker mt-1">{caption}</span>
      </div>
    </div>
  );
}

export function MixDonut({
  assets,
  qi,
  includeArchive = true,
}: {
  assets: Asset[];
  qi: number;
  includeArchive?: boolean;
}) {
  const point: SeriesPoint | undefined = useMemo(() => series(assets, includeArchive)[qi], [assets, includeArchive, qi]);
  return (
    <DonutMix
      slices={[
        { name: "Коммерция", value: point?.commercial ?? 0, fill: theme.copper },
        { name: "Склады", value: point?.warehouse ?? 0, fill: theme.pine },
        { name: "Вакант", value: point?.vacant ?? 0, fill: theme.vacant },
      ]}
      center={pct(point?.occupancy ?? 0)}
      caption="занято"
    />
  );
}

export function StackBars({
  data,
  bars,
}: {
  data: Record<string, string | number>[];
  bars: { key: string; name: string; fill: string }[];
}) {
  return (
    <div className="h-72 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={theme.line} vertical={false} />
          <XAxis dataKey="name" tick={{ fill: theme.stone, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(value: number) => m2(value)}
            tick={{ fill: theme.stone, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip content={<Tip unit="м²" />} />
          {bars.map((bar) => (
            <Bar key={bar.key} dataKey={bar.key} name={bar.name} stackId="mix" fill={bar.fill} barSize={28} />
          ))}
        </BarChart>
      </ResponsiveContainer>
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
