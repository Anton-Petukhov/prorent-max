import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { FileUp, Trash2 } from "lucide-react";
import { m2 } from "@/lib/format";
import { metricsAt } from "@/lib/metrics";
import { assetFromLease, extractPdfText, parseLeaseText } from "@/lib/pdf-extract";
import { resolveAssets, usePortfolio, useResolvedAssets } from "@/lib/store";

export const Route = createFileRoute("/documents")({ component: DocumentsPage });

const SAMPLES = [
  { href: "/samples/riga-eksporta.pdf", label: "Рига · Экспорта 15" },
  { href: "/samples/lyon-confluence.pdf", label: "Лион · Confluence" },
  { href: "/samples/wien-handelskai.pdf", label: "Вена · Handelskai" },
  { href: "/samples/zeran-magazyn.pdf", label: "Варшава · Жерань" },
];

function DocumentsPage() {
  const navigate = useNavigate();
  const docs = usePortfolio((state) => state.docs);
  const addImported = usePortfolio((state) => state.addImported);
  const removeImported = usePortfolio((state) => state.removeImported);
  const setPlanAsset = usePortfolio((state) => state.setPlanAsset);
  const assets = useResolvedAssets();
  const qi = usePortfolio((state) => state.qi);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastDelta, setLastDelta] = useState<string>("");
  const metrics = metricsAt(assets, qi);

  async function ingest(file: { name: string; data: ArrayBuffer }) {
    const text = await extractPdfText(file.data);
    if (!text.trim()) {
      throw new Error(`${file.name}: в файле нет текстового слоя. Нужен PDF с текстом, не скан.`);
    }
    const state = usePortfolio.getState();
    const beforeAssets = resolveAssets(state.imported, state.overrides);
    const before = metricsAt(beforeAssets, state.qi);
    const fields = parseLeaseText(text);
    const asset = assetFromLease(fields, file.name);
    if (!asset) {
      throw new Error(`${file.name}: не нашёл площади. Нужны строки вроде «Общая площадь: 1 200 м²».`);
    }
    addImported(asset, {
      id: `${asset.id}-${Date.now()}`,
      filename: file.name,
      excerpt: fields.excerpt,
      name: asset.name,
      city: asset.city,
      country: asset.country,
      total: Math.round(asset.floors[0]?.zones.reduce((sum, zone) => sum + zone.w * zone.h, 0) ?? 0),
      commercial: fields.commercial ?? 0,
      warehouse: fields.warehouse ?? 0,
      vacant: fields.vacant ?? (fields.vacantCommercial ?? 0) + (fields.vacantWarehouse ?? 0),
      rent: fields.rent ?? 0,
      tenant: fields.tenant,
      assetId: asset.id,
      addedAt: new Date().toISOString(),
    });
    const next = usePortfolio.getState();
    const after = metricsAt(resolveAssets(next.imported, next.overrides), next.qi);
    setLastDelta(
      `Общая ${m2(before.total)} → ${m2(after.total)} м² · вакант ${m2(before.vacant)} → ${m2(after.vacant)} · коммерция ${m2(before.commercial)} → ${m2(after.commercial)} · склады ${m2(before.warehouse)} → ${m2(after.warehouse)}`,
    );
    return asset.id;
  }

  async function takeFiles(list: File[]) {
    const pdfs = list.filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    if (!pdfs.length) {
      setError("Нужны файлы PDF.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      let lastId = "";
      for (const file of pdfs) {
        const data = await file.arrayBuffer();
        lastId = await ingest({ name: file.name, data });
      }
      if (lastId) setPlanAsset(lastId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось прочитать PDF");
    } finally {
      setBusy(false);
    }
  }

  async function loadSamples() {
    setBusy(true);
    setError("");
    try {
      let lastId = "";
      for (const sample of SAMPLES) {
        const response = await fetch(sample.href);
        if (!response.ok) throw new Error(`Не открылся образец ${sample.label}`);
        const data = await response.arrayBuffer();
        lastId = await ingest({ name: sample.href.split("/").pop() ?? "sample.pdf", data });
      }
      if (lastId) setPlanAsset(lastId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Образцы не прочитались");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="kicker">Текстовый слой, не картинка</p>
        <h1 className="mt-2 font-display text-4xl sm:text-5xl">Документы</h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          Положите несколько выписок по аренде. Из каждой читаются общая площадь, вакантная, коммерческая и склады —
          на русском, немецком, французском или польском. Цифры сразу входят в аналитику и в 3D-план.
        </p>
      </header>

      <div className="grid gap-px bg-line sm:grid-cols-4">
        {(
          [
            ["Общая сейчас", metrics.total],
            ["Вакантная", metrics.vacant],
            ["Коммерческая", metrics.commercial],
            ["Склады", metrics.warehouse],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="bg-paper px-4 py-4">
            <p className="kicker">{label}</p>
            <p className="nums mt-2 font-display text-3xl">{m2(value)}</p>
          </div>
        ))}
      </div>

      <label
        className="panel flex cursor-pointer flex-col items-center gap-3 px-6 py-10 text-center"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void takeFiles([...event.dataTransfer.files]);
        }}
      >
        <FileUp className="size-6 text-copper" />
        <span className="font-display text-2xl">Перетащите PDF сюда</span>
        <span className="max-w-md text-sm text-stone">Или выберите файлы. Несколько договоров читаются по очереди и не затирают книгу, пока имя объекта не совпадёт.</span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="sr-only"
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];
            event.target.value = "";
            void takeFiles(files);
          }}
        />
        <span className="btn">{busy ? "Читаю…" : "Выбрать PDF"}</span>
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-copper" disabled={busy} onClick={() => void loadSamples()}>
          {busy ? "Читаю пакет…" : "Разобрать демонстрационный пакет"}
        </button>
        {SAMPLES.map((sample) => (
          <a key={sample.href} href={sample.href} download className="btn btn-ghost">
            {sample.label}
          </a>
        ))}
      </div>
      {lastDelta ? <p className="text-sm text-ink">{lastDelta}</p> : null}
      {error ? (
        <p className="text-sm text-copper-deep" role="alert">
          {error}
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        {docs.length === 0 ? (
          <p className="text-sm text-stone">Пока пусто. Пакет из четырёх городов — самый быстрый способ увидеть, как цифры сдвигают графики.</p>
        ) : null}
        {docs.map((doc) => (
          <article key={doc.id} className="panel p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="kicker">{doc.filename}</p>
                <h2 className="font-display text-2xl">
                  {doc.name}
                  <span className="text-stone"> · {doc.city}</span>
                </h2>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setPlanAsset(doc.assetId);
                    void navigate({ to: "/plans" });
                  }}
                >
                  План
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => removeImported(doc.assetId)} aria-label="Убрать документ">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="kicker">Общая</dt>
                <dd className="nums">{m2(doc.total)} м²</dd>
              </div>
              <div>
                <dt className="kicker">Вакантная</dt>
                <dd className="nums">{m2(doc.vacant)} м²</dd>
              </div>
              <div>
                <dt className="kicker">Коммерческая</dt>
                <dd className="nums">{m2(doc.commercial)} м²</dd>
              </div>
              <div>
                <dt className="kicker">Склады</dt>
                <dd className="nums">{m2(doc.warehouse)} м²</dd>
              </div>
            </dl>
            {doc.tenant ? <p className="mt-2 text-sm text-stone">Арендатор: {doc.tenant}</p> : null}
            <pre className="mt-3 max-h-36 overflow-auto text-xs whitespace-pre-wrap text-stone">{doc.excerpt}</pre>
          </article>
        ))}
      </section>
    </div>
  );
}
