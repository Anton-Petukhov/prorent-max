import { useEffect, useState, type ComponentType } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PlanEditor } from "@/components/plan-editor";
import { MixChart, MixLegend } from "@/components/charts";
import type { CanvasZone } from "@/components/plan-canvas";
import { USE_LABEL } from "@/lib/format";
import { footprint } from "@/lib/portfolio";
import { usePortfolio, useResolvedAssets } from "@/lib/store";

export const Route = createFileRoute("/plans")({ component: PlansPage });

type CanvasProps = {
  zones: CanvasZone[];
  width: number;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const LEGEND = [
  { use: "office", label: USE_LABEL.office, className: "bg-copper" },
  { use: "retail", label: USE_LABEL.retail, className: "bg-copper-deep" },
  { use: "warehouse", label: USE_LABEL.warehouse, className: "bg-pine" },
  { use: "vacant", label: USE_LABEL.vacant, className: "bg-vacant" },
] as const;

function PlansPage() {
  const assets = useResolvedAssets();
  const planAssetId = usePortfolio((state) => state.planAssetId);
  const planFloorId = usePortfolio((state) => state.planFloorId);
  const selectedId = usePortfolio((state) => state.selectedZoneId);
  const setPlanAsset = usePortfolio((state) => state.setPlanAsset);
  const selectZone = usePortfolio((state) => state.selectZone);
  const qi = usePortfolio((state) => state.qi);
  const asset = assets.find((item) => item.id === planAssetId) ?? assets[0];
  const floor = asset?.floors.find((item) => item.id === planFloorId) ?? asset?.floors[0];
  const [CanvasView, setCanvasView] = useState<ComponentType<CanvasProps> | null>(null);

  useEffect(() => {
    let alive = true;
    void import("@/components/plan-canvas").then((mod) => {
      if (alive) setCanvasView(() => mod.PlanCanvas);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!asset || !floor) return null;
  const plate = footprint(floor);
  const zones = asset.floors.flatMap((item) =>
    item.zones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      use: zone.use,
      x: zone.x,
      y: zone.y,
      w: zone.w,
      h: zone.h,
      level: item.level,
      active: item.id === floor.id,
    })),
  );

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="kicker">Объём, не картинка</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">Планы</h1>
        </div>
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="kicker">Актив</span>
          <select
            value={asset.id}
            onChange={(event) => setPlanAsset(event.target.value)}
            className="min-h-11 border border-line bg-paper px-3"
          >
            {assets.map((item) => (
              <option key={item.id} value={item.id}>
                {item.city} · {item.name}
              </option>
            ))}
          </select>
        </label>
      </header>
      <section className="panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">Площадь во времени</h2>
            <p className="text-sm text-stone">{asset.name}. Пунктир — выбранный квартал. Брэнд Холл в этот график не входит.</p>
          </div>
          <MixLegend />
        </div>
        <MixChart assets={[asset]} qi={qi} includeArchive={false} />
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="panel relative h-canvas min-h-80 overflow-hidden lg:sticky lg:top-24">
          {CanvasView ? (
            <CanvasView
              zones={zones}
              width={plate.w}
              depth={plate.h}
              selectedId={selectedId}
              onSelect={selectZone}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-stone">Собираю объём…</div>
          )}
          <ul className="absolute bottom-3 left-3 flex flex-wrap gap-2 bg-paper/90 px-3 py-2 text-xs">
            {LEGEND.map((item) => (
              <li key={item.use} className="flex items-center gap-1.5">
                <span className={`inline-block size-2 ${item.className}`} />
                {item.label}
              </li>
            ))}
          </ul>
          <p className="absolute top-3 right-3 bg-paper/90 px-2 py-1 text-xs text-stone">Крутите мышью · этаж ярче остальных</p>
        </div>
        <PlanEditor asset={asset} floor={floor} />
      </div>
    </div>
  );
}
