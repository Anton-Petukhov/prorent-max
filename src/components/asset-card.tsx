import { KIND_LABEL, m2, pct } from "@/lib/format";
import type { AssetSnap } from "@/lib/metrics";

export function AssetCard({
  snap,
  active,
  onOpen,
}: {
  snap: AssetSnap;
  active?: boolean;
  onOpen: () => void;
}) {
  const { asset } = snap;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`panel flex h-full flex-col text-left transition-colors duration-200 hover:bg-bone ${active ? "ring-2 ring-copper" : ""}`}
    >
      <span className="relative block aspect-[3/2] overflow-hidden bg-slab">
        <img
          src={asset.photo}
          alt={`${asset.name}, ${asset.city}`}
          className="h-full w-full object-cover"
        />
        {asset.source === "pdf" ? (
          <span className="absolute top-3 left-3 bg-ink px-2 py-1 text-xs tracking-caps text-paper uppercase">PDF</span>
        ) : null}
      </span>
      <span className="flex flex-1 flex-col gap-3 px-4 py-4">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-xs text-stone">
            {asset.city} · {asset.country}
          </span>
          <span className="text-xs text-stone">{KIND_LABEL[asset.kind]}</span>
        </span>
        <span className="font-display text-2xl text-ink">{asset.name}</span>
        <span className="text-sm text-ink-soft">{asset.blurb}</span>
        <span className="mt-auto">
          <span className="mb-2 flex items-baseline justify-between text-sm">
            <span className="nums text-ink">{m2(snap.total)} м²</span>
            <span className="nums text-stone">{pct(snap.occupancy)}% занято</span>
          </span>
          <span className="block h-1 bg-line">
            <span className="block h-full bg-pine" style={{ width: `${Math.min(100, snap.occupancy)}%` }} />
          </span>
        </span>
      </span>
    </button>
  );
}
