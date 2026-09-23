import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { AssetCard } from "@/components/asset-card";
import { LeaseTable } from "@/components/lease-table";
import { KIND_LABEL, m2, pct } from "@/lib/format";
import { assetSnaps } from "@/lib/metrics";
import type { AssetKind } from "@/lib/portfolio";
import { usePortfolio, useResolvedAssets } from "@/lib/store";

export const Route = createFileRoute("/portfolio")({ component: PortfolioPage });

const FILTERS: { id: "all" | AssetKind | "gap"; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "office", label: "Офисы" },
  { id: "retail", label: "Ритейл" },
  { id: "logistics", label: "Склады" },
  { id: "mixed", label: "Смешанные" },
  { id: "gap", label: "Вакант > 12%" },
];

function PortfolioPage() {
  const navigate = useNavigate();
  const qi = usePortfolio((state) => state.qi);
  const setPlanAsset = usePortfolio((state) => state.setPlanAsset);
  const assets = useResolvedAssets();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const snaps = useMemo(() => assetSnaps(assets, qi), [assets, qi]);
  const visible = snaps.filter((snap) => {
    if (filter === "all") return true;
    if (filter === "gap") return 100 - snap.occupancy > 12;
    return snap.asset.kind === filter;
  });
  const open = visible.find((snap) => snap.asset.id === openId) ?? visible[0];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="kicker">Семь адресов и всё, что пришло из договоров</p>
        <h1 className="mt-2 font-display text-4xl sm:text-5xl">Портфель</h1>
      </header>
      <div className="flex gap-2 overflow-x-auto">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`min-h-11 shrink-0 border px-3 text-sm ${filter === item.id ? "border-ink bg-ink text-paper" : "border-line bg-paper text-ink"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((snap) => (
          <AssetCard
            key={snap.asset.id}
            snap={snap}
            active={open?.asset.id === snap.asset.id}
            onOpen={() => setOpenId(snap.asset.id)}
          />
        ))}
      </div>
      {visible.length === 0 ? <p className="text-sm text-stone">В этом срезе пусто. Сдвиньте машину времени или снимите фильтр.</p> : null}
      {open ? (
        <section className="panel p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="kicker">
                {open.asset.city} · {KIND_LABEL[open.asset.kind]} · {open.asset.year}
              </p>
              <h2 className="font-display text-3xl">{open.asset.name}</h2>
              <p className="mt-1 text-sm text-stone">{open.asset.address}</p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="nums">{m2(open.total)} м²</span>
              <span className="nums text-stone">{pct(100 - open.occupancy)}% вакант</span>
              <button
                type="button"
                className="btn btn-copper"
                onClick={() => {
                  setPlanAsset(open.asset.id);
                  void navigate({ to: "/plans" });
                }}
              >
                Открыть в 3D
              </button>
            </div>
          </div>
          <LeaseTable asset={open.asset} qi={qi} />
        </section>
      ) : null}
    </div>
  );
}
