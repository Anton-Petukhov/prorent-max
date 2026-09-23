import { useRef, useState } from "react";
import { DraftingCompass, RotateCcw, Undo2 } from "lucide-react";
import { USE_LABEL, m2 } from "@/lib/format";
import { editPlanWithGrok } from "@/lib/plan-ai";
import { extractJson, interpretPlanCommand, noteFromModel, sanitizeZones } from "@/lib/plan-commands";
import { footprint, zoneArea, type Asset, type Floor, type UseKind, type Zone } from "@/lib/portfolio";
import { QUARTERS } from "@/lib/quarters";
import { usePortfolio } from "@/lib/store";

const USES: UseKind[] = ["office", "retail", "warehouse", "vacant"];

const FILL: Record<UseKind, string> = {
  office: "var(--color-copper)",
  retail: "var(--color-copper-deep)",
  warehouse: "var(--color-pine)",
  vacant: "var(--color-vacant)",
};

const PROMPTS = [
  "Освободи выбранную зону",
  "Сделай складом",
  "Раздели пополам",
  "Снизь ставку на 8%",
  "Офис, арендатор North Desk до 2029-Q4",
];

export function PlanEditor({ asset, floor }: { asset: Asset; floor: Floor }) {
  const qi = usePortfolio((state) => state.qi);
  const selectedId = usePortfolio((state) => state.selectedZoneId);
  const selectZone = usePortfolio((state) => state.selectZone);
  const setPlanFloor = usePortfolio((state) => state.setPlanFloor);
  const patchZone = usePortfolio((state) => state.patchZone);
  const replaceZones = usePortfolio((state) => state.replaceZones);
  const pushUndo = usePortfolio((state) => state.pushUndo);
  const undoEdit = usePortfolio((state) => state.undoEdit);
  const resetAsset = usePortfolio((state) => state.resetAsset);
  const undoCount = usePortfolio((state) => state.undo.length);

  const [instruction, setInstruction] = useState("Освободи выбранную зону");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ id: string; mode: "move" | "resize"; dx: number; dy: number; moved: boolean } | null>(null);
  const plate = footprint(floor);
  const selected = floor.zones.find((zone) => zone.id === selectedId) ?? null;

  function toPlan(event: React.PointerEvent) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const matrix = svg.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const mapped = point.matrixTransform(matrix.inverse());
    return { x: mapped.x, y: mapped.y };
  }

  function onPointerDown(event: React.PointerEvent, zone: Zone, mode: "move" | "resize") {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = toPlan(event);
    drag.current = {
      id: zone.id,
      mode,
      dx: point.x - (mode === "move" ? zone.x : zone.x + zone.w),
      dy: point.y - (mode === "move" ? zone.y : zone.y + zone.h),
      moved: false,
    };
    selectZone(zone.id);
  }

  function onPointerMove(event: React.PointerEvent) {
    const current = drag.current;
    if (!current) return;
    if (!current.moved) {
      pushUndo(asset.id);
      current.moved = true;
    }
    const zone = floor.zones.find((item) => item.id === current.id);
    if (!zone) return;
    const point = toPlan(event);
    if (current.mode === "move") {
      patchZone(asset.id, floor.id, zone.id, {
        x: Math.max(0, Math.round((point.x - current.dx) * 10) / 10),
        y: Math.max(0, Math.round((point.y - current.dy) * 10) / 10),
      });
    } else {
      patchZone(asset.id, floor.id, zone.id, {
        w: Math.max(4, Math.round((point.x - zone.x) * 10) / 10),
        h: Math.max(4, Math.round((point.y - zone.y) * 10) / 10),
      });
    }
  }

  function onPointerUp() {
    drag.current = null;
  }

  async function applyInstruction(text: string) {
    const command = text.trim();
    if (command.length < 2) return;
    setBusy(true);
    setError("");
    setNote("");
    let modelError = "";
    try {
      const result = await editPlanWithGrok({
        data: {
          instruction: command,
          floorName: floor.name,
          width: plate.w,
          depth: plate.h,
          zones: floor.zones,
        },
      });
      if (result.ok) {
        const json = extractJson(result.text);
        const next = sanitizeZones(json, floor.zones, plate.w, plate.h);
        if (next) {
          pushUndo(asset.id);
          replaceZones(asset.id, floor.id, next);
          setNote(noteFromModel(json));
          setBusy(false);
          return;
        }
        modelError = "Ответ модели не сошёлся с планом";
      } else {
        modelError = result.error;
      }
    } catch (cause) {
      modelError = cause instanceof Error ? cause.message : "Модель не ответила";
    }

    const local = interpretPlanCommand(floor.zones, command, selectedId, QUARTERS[qi] ?? "2026-Q3");
    if (local) {
      pushUndo(asset.id);
      replaceZones(asset.id, floor.id, local.zones);
      setNote(`${local.note}. Локальный разбор${modelError ? ` — ${modelError.toLowerCase()}` : ""}.`);
    } else {
      setError(modelError || "Выберите зону на плане. Подойдёт «освободи», «склад» или «раздели пополам».");
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 overflow-x-auto">
        {asset.floors.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setPlanFloor(item.id)}
            className={`min-h-11 shrink-0 border px-3 text-sm ${item.id === floor.id ? "border-ink bg-ink text-paper" : "border-line bg-paper text-ink"}`}
          >
            {item.name}
          </button>
        ))}
      </div>

      <svg
        ref={svgRef}
        viewBox={`-1 -1 ${plate.w + 2} ${plate.h + 2}`}
        className="h-72 w-full touch-none border border-line bg-paper sm:h-80"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        role="img"
        aria-label={`План этажа ${floor.name}`}
      >
        <rect x={0} y={0} width={plate.w} height={plate.h} fill="var(--color-bone)" />
        {floor.zones.map((zone) => {
          const active = zone.id === selectedId;
          const light = zone.use === "vacant";
          return (
            <g key={zone.id} onPointerDown={(event) => onPointerDown(event, zone, "move")}>
              <rect
                x={zone.x}
                y={zone.y}
                width={zone.w}
                height={zone.h}
                fill={FILL[zone.use]}
                stroke={active ? "var(--color-ink)" : "var(--color-paper)"}
                strokeWidth={active ? 0.45 : 0.2}
              />
              {zone.w > 7 && zone.h > 5 ? (
                <text
                  x={zone.x + 0.8}
                  y={zone.y + Math.min(zone.h * 0.35, 3.2)}
                  fill={light ? "var(--color-ink)" : "var(--color-paper)"}
                  fontSize={Math.min(2.4, zone.w / 7)}
                  style={{ pointerEvents: "none" }}
                >
                  {zone.name}
                </text>
              ) : null}
              {active ? (
                <rect
                  x={zone.x + zone.w - 1.6}
                  y={zone.y + zone.h - 1.6}
                  width={1.6}
                  height={1.6}
                  fill="var(--color-ink)"
                  onPointerDown={(event) => onPointerDown(event, zone, "resize")}
                />
              ) : null}
            </g>
          );
        })}
      </svg>

      <div className="grid gap-3 sm:grid-cols-2">
        <ul className="panel divide-y divide-line">
          {floor.zones.map((zone) => (
            <li key={zone.id}>
              <button
                type="button"
                onClick={() => selectZone(zone.id)}
                className={`flex min-h-11 w-full items-center justify-between gap-3 px-3 text-left text-sm ${zone.id === selectedId ? "bg-bone" : ""}`}
              >
                <span>
                  <span className="block text-ink">{zone.name}</span>
                  <span className="text-xs text-stone">{USE_LABEL[zone.use]}</span>
                </span>
                <span className="nums text-stone">{m2(zoneArea(zone))} м²</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="panel flex flex-col gap-3 p-4">
          {selected ? (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span className="kicker">Название</span>
                <input
                  value={selected.name}
                  onChange={(event) => patchZone(asset.id, floor.id, selected.id, { name: event.target.value })}
                  className="min-h-11 border border-line bg-paper px-3"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {USES.map((use) => (
                  <button
                    key={use}
                    type="button"
                    onClick={() =>
                      patchZone(asset.id, floor.id, selected.id, {
                        use,
                        tenant: use === "vacant" ? null : selected.tenant,
                        start: use === "vacant" ? "" : selected.start,
                        end: use === "vacant" ? "" : selected.end,
                      })
                    }
                    className={`min-h-11 border px-3 text-sm ${selected.use === use ? "border-ink bg-ink text-paper" : "border-line"}`}
                  >
                    {USE_LABEL[use]}
                  </button>
                ))}
              </div>
              <label className="flex flex-col gap-1 text-sm">
                <span className="kicker">Арендатор</span>
                <input
                  value={selected.tenant ?? ""}
                  onChange={(event) => {
                    const tenant = event.target.value || null;
                    patchZone(asset.id, floor.id, selected.id, {
                      tenant,
                      start: tenant && !selected.start ? (QUARTERS[qi] ?? "2026-Q3") : selected.start,
                    });
                  }}
                  className="min-h-11 border border-line bg-paper px-3"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="kicker">Ставка, €/м² в год</span>
                <input
                  type="number"
                  min={0}
                  value={selected.rentPerM2}
                  onChange={(event) =>
                    patchZone(asset.id, floor.id, selected.id, { rentPerM2: Number(event.target.value) || 0 })
                  }
                  className="nums min-h-11 border border-line bg-paper px-3"
                />
              </label>
              <p className="text-sm text-stone">
                {m2(zoneArea(selected))} м² · тяните блок, угол меняет размер
              </p>
            </>
          ) : (
            <p className="text-sm text-stone">Выберите зону на плане или в списке. Пустой двор у кольцевых домов — это воздух, не площадь.</p>
          )}
        </div>
      </div>

      <form
        className="panel flex flex-col gap-3 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void applyInstruction(instruction);
        }}
      >
        <div className="flex items-center gap-2">
          <DraftingCompass className="size-4 text-copper" />
          <p className="kicker">Редактор плана</p>
        </div>
        <textarea
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          rows={3}
          maxLength={600}
          className="w-full border border-line bg-paper px-3 py-2 text-sm"
          aria-label="Команда для плана"
        />
        <div className="flex flex-wrap gap-2">
          {PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="min-h-11 border border-line px-3 text-left text-xs text-ink-soft hover:bg-bone"
              onClick={() => setInstruction(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn btn-copper" disabled={busy}>
            {busy ? "Читаю план…" : "Применить"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={undoEdit} disabled={undoCount === 0}>
            <Undo2 className="size-4" />
            Шаг назад
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => resetAsset(asset.id)}>
            <RotateCcw className="size-4" />
            Сбросить актив
          </button>
        </div>
        {note ? <p className="text-sm text-ink">{note}</p> : null}
        {error ? (
          <p className="text-sm text-copper-deep" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
