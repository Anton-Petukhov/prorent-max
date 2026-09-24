import { useEffect } from "react";
import { Pause, Play } from "lucide-react";
import { brandFacts, brandSnapshotAt, prettySchemeDate } from "@/lib/brand-history";
import { electronFacts, electronSnapshotAt } from "@/lib/electron-history";
import { eventsBetween } from "@/lib/metrics";
import { QUARTERS, quarterPretty } from "@/lib/quarters";
import { usePortfolio, useResolvedAssets } from "@/lib/store";

const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

export function TimeMachine() {
  const qi = usePortfolio((state) => state.qi);
  const setQi = usePortfolio((state) => state.setQi);
  const playing = usePortfolio((state) => state.playing);
  const setPlaying = usePortfolio((state) => state.setPlaying);
  const assets = useResolvedAssets();
  const label = QUARTERS[qi] ?? "2026-Q3";
  const here = eventsBetween(assets, qi, qi)
    .filter((event) => event.title !== "Брэнд Холл")
    .slice(0, 2);
  const scheme = brandSnapshotAt(qi);
  const schemeFacts = brandFacts(scheme);
  const schemeLine = scheme
    ? `Брэнд Холл · схема ${prettySchemeDate(scheme.stamp ?? scheme.date)} · ${Math.round(schemeFacts.total)} м², вакант ${Math.round(schemeFacts.vacant)}`
    : null;
  const electron = electronSnapshotAt(qi);
  const electronLine = electron
    ? `Электрон · ${prettySchemeDate(electron.date)} · вакант ${Math.round(electronFacts(electron).vacant)}`
    : null;
  const dock = [schemeLine, electronLine, ...here.map((event) => event.detail)].filter(Boolean).join("  ·  ");

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const current = usePortfolio.getState().qi;
      if (current >= QUARTERS.length - 1) {
        usePortfolio.getState().setPlaying(false);
        return;
      }
      usePortfolio.getState().setQi(current + 1);
    }, 650);
    return () => window.clearInterval(timer);
  }, [playing]);

  return (
    <footer className="dock fixed inset-x-0 bottom-0 z-30 border-t border-ink bg-ink text-paper">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn-dark size-11 shrink-0 px-0"
            onClick={() => setPlaying(!playing)}
            aria-label={playing ? "Пауза" : "Воспроизвести ленту"}
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <div className="min-w-0 flex-1">
            <input
              type="range"
              min={0}
              max={QUARTERS.length - 1}
              value={qi}
              aria-label="Квартал портфеля"
              aria-valuetext={quarterPretty(label)}
              onChange={(event) => {
                setPlaying(false);
                setQi(Number(event.target.value));
              }}
              className="w-full accent-copper"
            />
          </div>
          <p className="nums w-28 shrink-0 text-right font-display text-lg">{quarterPretty(label)}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 flex-1 justify-between gap-1 overflow-x-auto">
            {YEARS.map((year) => {
              const index = QUARTERS.indexOf(`${year}-Q3`);
              const active = label.startsWith(String(year));
              return (
                <button
                  key={year}
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    setQi(index);
                  }}
                  className={`min-h-11 px-1 text-xs ${active ? "text-copper" : "text-stone"}`}
                >
                  {year}
                </button>
              );
            })}
          </div>
          <p className="hidden min-w-0 flex-1 truncate text-xs text-vacant sm:block">
            {dock || "В этом квартале без новых стартов и окончаний"}
          </p>
        </div>
      </div>
    </footer>
  );
}
