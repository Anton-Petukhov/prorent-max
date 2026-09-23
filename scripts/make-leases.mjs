import fs from "node:fs";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const fontBytes = fs.readFileSync("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf");
const boldBytes = fs.readFileSync("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf");

const docs = [
  {
    file: "riga-eksporta.pdf",
    title: "Выписка по объекту",
    lines: [
      "Объект: Экспорта 15",
      "Город: Рига",
      "Страна: Латвия",
      "",
      "Общая площадь: 11280 м²",
      "Коммерческая площадь: 2460 м²",
      "Складская площадь: 8820 м²",
      "Вакантная площадь: 1640 м²",
      "Арендная ставка: 88 €/м²/год",
      "Арендатор: Baltijas Krava SIA",
      "",
      "Срок учёта площадей — до передачи в портфельную книгу.",
      "Вакантная площадь входит в общую и не прибавляется сверху.",
    ],
  },
  {
    file: "lyon-confluence.pdf",
    title: "Extrait de bail",
    lines: [
      "Objet: Lyon Confluence Hall",
      "Ville: Lyon",
      "Pays: France",
      "",
      "Surface totale: 9640 m²",
      "Surface commerciale: 3280 m²",
      "Surface entrepôt: 6360 m²",
      "Surface vacante: 1250 m²",
      "Loyer: 168 €/m²/an",
      "Locataire: Atelier Rhône SAS",
      "",
      "Les surfaces vacantes sont incluses dans le total.",
    ],
  },
  {
    file: "wien-handelskai.pdf",
    title: "Mietübersicht",
    lines: [
      "Objekt: Handelskai 94",
      "Stadt: Wien",
      "Land: Österreich",
      "",
      "Gesamtfläche: 7420 m²",
      "Bürofläche: 5100 m²",
      "Lagerfläche: 2320 m²",
      "Leerstand: 980 m²",
      "Miete: 214 €/m²/Jahr",
      "Mieter: Donau Atelier GmbH",
      "",
      "Leerstand ist im Gesamt enthalten.",
    ],
  },
  {
    file: "zeran-magazyn.pdf",
    title: "Wyciąg najmu",
    lines: [
      "Obiekt: Magazyn Żerań",
      "Miasto: Warszawa",
      "Kraj: Polska",
      "",
      "Powierzchnia całkowita: 15240 m²",
      "Powierzchnia biurowa: 1860 m²",
      "Powierzchnia magazynowa: 13380 m²",
      "Powierzchnia pustostanów: 2410 m²",
      "Czynsz: 74 €/m²/rok",
      "Najemca: Vistula Cargo Sp. z o.o.",
      "",
      "Pustostany zawierają się w powierzchni całkowitej.",
    ],
  },
];

fs.mkdirSync("public/samples", { recursive: true });

for (const entry of docs) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes);
  const bold = await pdf.embedFont(boldBytes);
  const page = pdf.addPage([595, 842]);
  page.drawRectangle({ x: 0, y: 790, width: 595, height: 52, color: rgb(0.12, 0.24, 0.2) });
  page.drawText("PRORENT MAX", { x: 48, y: 812, size: 14, font: bold, color: rgb(0.97, 0.96, 0.93) });
  page.drawText(entry.title, { x: 48, y: 796, size: 10, font, color: rgb(0.83, 0.45, 0.22) });
  let y = 750;
  for (const line of entry.lines) {
    if (!line) {
      y -= 12;
      continue;
    }
    const head = line.includes(":") && y > 560;
    page.drawText(line, {
      x: 48,
      y,
      size: head ? 13 : 11,
      font: head ? bold : font,
      color: rgb(0.1, 0.09, 0.08),
    });
    y -= 22;
  }
  fs.writeFileSync(`public/samples/${entry.file}`, await pdf.save());
  console.log(entry.file);
}
