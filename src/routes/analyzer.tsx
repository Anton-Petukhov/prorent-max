import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Archive, ArrowLeftRight, CheckCircle2, Download, FileSpreadsheet, FileUp, History, Search, ShieldCheck, Upload, AlertTriangle } from "lucide-react";
import {
  compareRooms, csvForDiff, demoRevisions, downloadText, identity, readArchive, roomsFromFile,
  roomsFromText, uniqueRooms, validateArchive, writeArchive, type Archive as RoomArchive,
  type Revision, type Room, type RoomDiff
} from "@/lib/analyzer";

export const Route = createFileRoute("/analyzer")({ component: AnalyzerPage });
type Side = "old" | "new";
type Filter = "all" | "changed" | "new" | "gone" | "same";

const uid = () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
const countFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const fmt = (n: number | null | undefined) => n === null || n === undefined ? "—" : countFormat.format(n);
const TOTAL_STORAGE_LIMIT = 80;

function makeRevision(label: string, filename: string, rooms: Room[]): Revision {
  return { id: uid(), label, filename, rooms, at: new Date().toISOString() };
}
function labelFor(kind: RoomDiff["kind"]) {
  return { changed: "Изменено", new: "Добавлено", gone: "Исчезло", same: "Совпадает" }[kind];
}
function badgeClass(kind: RoomDiff["kind"]) {
  return kind === "changed" ? "bg-amber-100 text-amber-900" :
    kind === "new" ? "bg-green-100 text-green-900" :
    kind === "gone" ? "bg-red-100 text-red-900" : "bg-line text-ink-soft";
}
function prettyDate(value: string) {
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleString("ru-RU") : value;
}
function AnalyzerPage() {
  const [archive, setArchive] = useState<RoomArchive>({ version: 1, revisions: [] });
  const [old, setOld] = useState<Revision | null>(null);
  const [newer, setNewer] = useState<Revision | null>(null);
  const [objectName, setObjectName] = useState("Электрон");
  const [floorName, setFloorName] = useState("");
  const [paste, setPaste] = useState<Record<Side, string>>({old:"",new:""});
  const [busy, setBusy] = useState<Side | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => { setArchive(readArchive()); }, []);

  const baseline = old?.rooms ?? [];
  const current = newer?.rooms ?? [];
  const diffs = useMemo(() => compareRooms(baseline, current), [baseline, current]);
  const oldCheck = useMemo(() => uniqueRooms(baseline), [baseline]);
  const newCheck = useMemo(() => uniqueRooms(current), [current]);
  const counts = useMemo(() => {
    return diffs.reduce((acc, r) => { acc[r.kind]++; if(r.areaChanged) acc.area++; if(r.statusChanged) acc.status++; return acc; }, {changed:0,new:0,gone:0,same:0,area:0,status:0});
  }, [diffs]);
  const shown = useMemo(() => diffs.filter((d) => (filter === "all" || d.kind === filter) &&
    [d.after?.object,d.after?.floor,d.after?.number,d.after?.status,d.before?.object,d.before?.floor,d.before?.number,d.before?.status].join(" ").toLowerCase().includes(query.trim().toLowerCase())), [diffs, filter, query]);
  const selectedDiff = diffs.find((d) => d.key === selected);
  const changes = archive.revisions.filter((rev) => rev.rooms.some((room) => identity(room) === selected)).map((rev) => ({
    rev, room: rev.rooms.find((room) => identity(room) === selected)!
  })).reverse();

  function update(side: Side, rev: Revision) {
    side === "old" ? setOld(rev) : setNewer(rev);
    setError(""); setNotice(""); setSelected(null);
  }
  function normalizeFloor(rows: Room[]): Room[] {
    return rows.map((row) => ({ ...row, floor: row.floor || floorName.trim() }));
  }
  async function takeFile(side: Side, file?: File) {
    if (!file) return;
    setBusy(side); setError(""); setNotice("");
    try {
      const rows = normalizeFloor(await roomsFromFile(file, objectName.trim() || "Объект"));
      if (!rows.length) throw new Error("Не нашла строки помещений. Проверьте заголовки колонок: №, Площадь, Статус. Скан PDF пока не распознаётся.");
      update(side, makeRevision(file.name, file.name, rows));
      setNotice(file.name + ": прочитано " + rows.length + " строк.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось разобрать файл."); }
    finally { setBusy(null); }
  }
  function takeText(side: Side) {
    const rows = normalizeFloor(roomsFromText(paste[side], objectName.trim() || "Объект"));
    if (!rows.length) { setError("Строки не найдены. Вставьте таблицу с колонками «№», «Площадь», «Статус»."); return; }
    update(side, makeRevision("Вставка вручную", "Текст", rows));
    setNotice("Вставлено " + rows.length + " строк.");
  }
  function save(rev: Revision | null) {
    if (!rev) return;
    try {
      const snapshot = { ...rev, id: uid(), at: new Date().toISOString() };
      const next = { version: 1 as const, revisions: [...archive.revisions, snapshot].slice(-TOTAL_STORAGE_LIMIT) };
      writeArchive(next); setArchive(next);
      setNotice("Снимок добавлен в историю этого браузера.");
      setError("");
    } catch { setError("Не удалось сохранить историю. Проверьте свободное место браузера или экспортируйте архив."); }
  }
  function exportArchive() {
    downloadText("prorent-analyzer-archive.json", JSON.stringify(archive, null, 2), "application/json");
    setNotice("История выгружена в переносимый JSON.");
  }
  async function importArchive(file?: File) {
    if (!file) return;
    try {
      if (file.size > 12_000_000) throw new Error("Архив больше 12 МБ.");
      const incoming = validateArchive(JSON.parse(await file.text()));
      const merged = new Map(archive.revisions.map((r) => [r.id, r]));
      for (const rev of incoming.revisions) merged.set(rev.id, rev);
      if (merged.size > TOTAL_STORAGE_LIMIT) throw new Error("В истории может храниться не более 80 снимков. Сделайте резервную копию и очистите лишнее.");
      const next: RoomArchive = { version: 1, revisions: [...merged.values()].sort((a,b) => a.at.localeCompare(b.at)) };
      writeArchive(next); setArchive(next);
      setNotice("Импортировано " + incoming.revisions.length + " снимков; существующие записи сохранены.");
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Ошибка импорта истории."); }
  }
  function demo() {
    const [a,b] = demoRevisions();
    setOld(a); setNewer(b); setObjectName("Электрон"); setFloorName(""); setError("");
    setNotice("Демо: в двух версиях намеренно есть расхождения. Данные не сохраняются, пока вы сами не нажмёте «Сохранить снимок».");
    setFilter("all"); setSelected(null);
  }
  const panels: { side: Side; value: Revision | null; title: string; kicker: string }[] = [
    {side:"old",value:old,title:"Архив / Базовая версия",kicker:"ИСТОЧНИК A · БЫЛО"},
    {side:"new",value:newer,title:"Актуальная версия",kicker:"ИСТОЧНИК B · СТАЛО"},
  ];

  return <div className="flex flex-col gap-7">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="kicker">ProRent MAX · модуль сверки · v1</p>
        <h1 className="mt-2 font-display text-4xl sm:text-5xl">Прорент Анализатор</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-soft">
          Сверка номеров, площадей и вакантности между двумя версиями. История по помещениям, выгрузка расхождений,
          переносимый архив. Данные обрабатываются в вашем браузере и не отправляются на внешний сервис.
        </p>
      </div>
      <button type="button" className="btn btn-copper" onClick={demo}><ArrowLeftRight className="size-4"/>Посмотреть пример</button>
    </header>

    <div className="grid gap-px bg-line sm:grid-cols-3">
      <div className="bg-paper p-4"><p className="kicker">Изменены</p><p className="nums mt-2 font-display text-4xl">{counts.changed}</p><p className="mt-1 text-xs text-stone">площадь: {counts.area} · статус: {counts.status}</p></div>
      <div className="bg-paper p-4"><p className="kicker">Добавлены</p><p className="nums mt-2 font-display text-4xl">{counts.new}</p><p className="mt-1 text-xs text-stone">есть в актуальной версии</p></div>
      <div className="bg-paper p-4"><p className="kicker">Исчезли</p><p className="nums mt-2 font-display text-4xl">{counts.gone}</p><p className="mt-1 text-xs text-stone">были в архиве, отсутствуют сейчас</p></div>
    </div>

    <section className="panel p-4 sm:p-5">
      <div className="flex items-start gap-2"><ShieldCheck className="mt-1 size-5 shrink-0 text-pine"/><div><h2 className="font-display text-2xl">Настройки чтения</h2><p className="mt-1 text-sm text-stone">Если в источнике не указаны объект или этаж, подставим значения ниже. Для сравнения они должны совпадать в обеих версиях.</p></div></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Объект по умолчанию<input className="mt-1 w-full border border-line bg-bone p-3 text-ink" value={objectName} onChange={(e) => setObjectName(e.target.value)} placeholder="Например, Брэнд Холл"/></label>
        <label className="text-sm">Этаж по умолчанию<input className="mt-1 w-full border border-line bg-bone p-3 text-ink" value={floorName} onChange={(e) => setFloorName(e.target.value)} placeholder="Например, 1"/></label>
      </div>
    </section>

    <section className="grid gap-4 lg:grid-cols-2">
      {panels.map(({side,value,title,kicker}) => {
        const checked = side === "old" ? oldCheck : newCheck;
        return <div key={side} className="panel flex flex-col p-4 sm:p-5">
          <p className="kicker">{kicker}</p>
          <h2 className="mt-1 font-display text-2xl">{title}</h2>
          <p className="mt-2 text-xs text-stone">XLSX · CSV · TSV · TXT · PDF с текстовым слоем</p>
          <label className="mt-4 flex cursor-pointer flex-col items-center gap-2 border border-dashed border-copper bg-bone p-6 text-center" onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{e.preventDefault();void takeFile(side,e.dataTransfer.files[0]);}}>
            <FileUp className="size-6 text-copper"/>
            <span className="text-sm font-medium">{busy === side ? "Читаю…" : "Перетащите файл или нажмите для выбора"}</span>
            <input type="file" className="sr-only" accept=".xlsx,.csv,.tsv,.txt,.pdf,.png,.jpg,.jpeg,.webp" disabled={busy !== null} onChange={(e)=>{void takeFile(side,e.currentTarget.files?.[0]);e.currentTarget.value="";}}/>
          </label>
          <div className="mt-3">
            <label className="kicker" htmlFor={"paste-"+side}>Или вставьте таблицу текстом</label>
            <textarea id={"paste-"+side} className="mt-1 h-24 w-full resize-y border border-line bg-bone p-3 font-mono text-xs text-ink" value={paste[side]} onChange={(e)=>setPaste((s)=>({...s,[side]:e.target.value}))} placeholder={"№;Площадь;Статус\n101;45,5;занято\n102;38;вакантно"}/>
            <button type="button" className="btn btn-ghost mt-2" onClick={()=>takeText(side)}>Разобрать вставку</button>
          </div>
          <div className="mt-5 border-t border-line pt-4">
            <label className="kicker">Взять сохранённый снимок</label>
            <select className="mt-2 w-full border border-line bg-bone p-3 text-sm text-ink" value={archive.revisions.some((r)=>r.id === value?.id) ? value?.id : ""} onChange={(e)=>{const found=archive.revisions.find((r)=>r.id===e.target.value);if(found)update(side,found);}}>
              <option value="">Выберите из истории ({archive.revisions.length})</option>
              {[...archive.revisions].reverse().map((r)=><option key={r.id} value={r.id}>{prettyDate(r.at)} · {r.label}</option>)}
            </select>
          </div>
          {value ? <div className="mt-auto pt-5">
            <div className="rounded border border-line bg-bone p-3">
              <p className="font-medium">{value.label}</p>
              <p className="mt-1 text-xs text-stone">{value.rooms.length} строк · {checked.map.size} уникальных помещений · {fmt(value.rooms.reduce((s,r)=>s+(r.area ?? 0),0))} м²</p>
              <p className="mt-1 text-xs text-stone">Статус не определён: {value.rooms.filter((r)=>r.status === "Неизвестно").length} · нет площади: {value.rooms.filter((r)=>r.area === null).length}</p>
              {checked.duplicates.length > 0 && <p className="mt-2 text-sm text-copper-deep"><AlertTriangle className="mr-1 inline size-4"/>Дубли номеров: {checked.duplicates.slice(0,5).join(", ")}{checked.duplicates.length>5?"…":""}. Дубликаты не объединяются.</p>}
            </div>
            <button type="button" className="btn btn-copper mt-3 w-full" onClick={()=>save(value)}><Archive className="size-4"/>Сохранить снимок в историю</button>
          </div> : <p className="mt-auto pt-4 text-xs text-stone">Источник пока не загружен.</p>}
        </div>;
      })}
    </section>

    {error && <div role="alert" className="border border-red-400 bg-red-50 p-3 text-sm text-red-900">{error}</div>}
    {notice && <div role="status" className="flex items-center gap-2 border border-line bg-paper p-3 text-sm text-pine"><CheckCircle2 className="size-4 shrink-0"/>{notice}</div>}
    {(oldCheck.duplicates.length || newCheck.duplicates.length) ? <p className="text-sm text-copper-deep">Внимание: обнаружены повторяющиеся номера в пределах объекта и этажа. Для таких записей сверка использует первую строку каждого источника; проверьте дубли перед выводами.</p> : null}

    <section className="panel p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="kicker">РЕЗУЛЬТАТ СВЕРКИ</p><h2 className="font-display text-3xl">Расхождения по помещениям</h2></div>
        <button type="button" className="btn btn-ghost" disabled={!old || !newer} onClick={()=>downloadText("prorent-differences.csv",csvForDiff(shown),"text/csv;charset=utf-8")}><Download className="size-4"/>CSV (текущий фильтр)</button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {([
          ["all","Все",diffs.length],["changed","Изменены",counts.changed],["new","Добавлены",counts.new],["gone","Исчезли",counts.gone],["same","Совпали",counts.same]
        ] as [Filter,string,number][]).map(([id,label,n])=><button type="button" key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)} className={filter===id?"btn btn-copper":"btn btn-ghost"}>{label} · {n}</button>)}
      </div>
      <label className="mt-4 flex items-center gap-2 border border-line bg-bone px-3"><Search className="size-4 text-stone"/><input type="search" value={query} onChange={(e)=>setQuery(e.target.value)} className="min-h-11 w-full bg-transparent text-sm outline-none" placeholder="Найти объект, этаж, номер, статус…"/></label>
      {(!old || !newer) ? <div className="mt-5 border border-dashed border-line p-10 text-center text-sm text-stone"><FileSpreadsheet className="mx-auto mb-3 size-7"/>Загрузите обе версии или нажмите «Посмотреть пример», чтобы начать сравнение.</div> :
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="border-b border-line text-xs text-stone"><tr><th className="p-3">Объект · этаж · №</th><th className="p-3">Площадь было</th><th className="p-3">Площадь стало</th><th className="p-3">Статус было → стало</th><th className="p-3">Итог</th></tr></thead>
          <tbody>{shown.map((d)=>{
            const row=d.after??d.before!;
            return <tr key={d.key} onClick={()=>setSelected(d.key)} className={"cursor-pointer border-b border-line/70 hover:bg-bone "+(selected===d.key?"bg-bone":"")}>
              <td className="p-3"><span className="font-medium">{row.number}</span><span className="block text-xs text-stone">{row.object}{row.floor?" · этаж "+row.floor:""}</span></td>
              <td className="nums p-3">{fmt(d.before?.area)} м²</td><td className={"nums p-3 "+(d.areaChanged?"font-semibold text-copper-deep":"")}>{fmt(d.after?.area)} м²{d.areaChanged && d.before?.area!=null && d.after?.area!=null?<span className="block text-xs">{d.after.area>d.before.area?"+":""}{fmt(d.after.area-d.before.area)} м²</span>:null}</td>
              <td className={"p-3 "+(d.statusChanged?"font-semibold text-copper-deep":"")}>{d.before?.status??"—"} → {d.after?.status??"—"}</td>
              <td className="p-3"><span className={"inline-flex whitespace-nowrap px-2 py-1 text-xs "+badgeClass(d.kind)}>{labelFor(d.kind)}</span></td>
            </tr>;
          })}</tbody>
        </table>
        {!shown.length && <p className="p-6 text-center text-sm text-stone">Совпадений для фильтра нет.</p>}
        <p className="mt-3 text-xs text-stone">Сравнение строго по ключу «объект + этаж + номер». Разделение или объединение номеров показывается как удаление/добавление; автоматическое сопоставление при переименовании будет следующим этапом. Неопределённые статусы требуют ручной проверки.</p>
      </div>}
    </section>

    <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="panel p-4 sm:p-5">
        <div className="flex items-center gap-2"><History className="size-5 text-copper"/><h2 className="font-display text-2xl">История помещения</h2></div>
        {!selectedDiff ? <p className="mt-3 text-sm text-stone">Нажмите на строку в таблице расхождений. Покажем все сохранённые версии помещения по датам.</p> :
        <div className="mt-3">
          <p className="text-lg font-medium">{(selectedDiff.after??selectedDiff.before)?.object} · № {(selectedDiff.after??selectedDiff.before)?.number}</p>
          <p className="mt-1 text-sm text-stone">Сохранённых версий: {changes.length}</p>
          {changes.length ? <div className="mt-3 space-y-3">{changes.map(({rev,room})=><div key={rev.id} className="border-l-2 border-copper bg-bone p-3"><p className="text-xs text-stone">{prettyDate(rev.at)} · {rev.label}</p><p className="mt-1 text-sm">{fmt(room.area)} м² · {room.status}{room.note?" · "+room.note:""}</p></div>)}</div> : <p className="mt-3 text-sm text-stone">Снимков в архиве пока нет. Сохраните базовую и актуальную версии кнопками выше — история появится здесь.</p>}
        </div>}
      </div>
      <div className="panel p-4 sm:p-5">
        <div className="flex items-center gap-2"><Archive className="size-5 text-copper"/><h2 className="font-display text-2xl">Переносимый архив</h2></div>
        <p className="mt-2 text-sm text-stone">Снимки хранятся локально в браузере. Чтобы перенести историю на другой компьютер, экспортируйте JSON и импортируйте его там. При импорте записи объединяются.</p>
        <p className="mt-3 text-sm font-medium">Снимков сохранено: {archive.revisions.length}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={exportArchive} className="btn btn-ghost"><Download className="size-4"/>Экспорт JSON</button>
          <label className="btn btn-ghost"><Upload className="size-4"/>Импорт JSON<input className="sr-only" type="file" accept=".json,application/json" onChange={(e)=>{void importArchive(e.currentTarget.files?.[0]);e.currentTarget.value="";}}/></label>
        </div>
        <p className="mt-4 text-xs text-stone">В версии 1 нет доступа к корпоративным API и нет OCR для скриншотов. Автоматическое распознавание добавим отдельным обновлением после получения API и согласования доступа к данным.</p>
      </div>
    </section>
  </div>;
}
