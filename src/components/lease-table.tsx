import { USE_LABEL, m2 } from "@/lib/format";
import { isLeased, passingRent, zoneArea, type Asset } from "@/lib/portfolio";

export function LeaseTable({ asset, qi }: { asset: Asset; qi: number }) {
  const rows = asset.floors.flatMap((floor) => floor.zones.map((zone) => ({ floor: floor.name, zone })));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] text-left text-sm">
        <thead className="text-xs tracking-caps text-stone uppercase">
          <tr className="border-b border-line">
            <th className="py-2 pr-3 font-medium">Этаж</th>
            <th className="py-2 pr-3 font-medium">Зона</th>
            <th className="py-2 pr-3 font-medium">Использование</th>
            <th className="py-2 pr-3 font-medium">Арендатор</th>
            <th className="py-2 pr-3 text-right font-medium">м²</th>
            <th className="py-2 pr-3 text-right font-medium">€/м²</th>
            <th className="py-2 font-medium">Срок</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ floor, zone }) => {
            const leased = isLeased(zone, qi);
            const rent = leased ? passingRent(zone, qi) : zone.rentPerM2;
            return (
              <tr key={zone.id} className="border-b border-line last:border-0">
                <td className="py-2 pr-3 text-stone">{floor}</td>
                <td className="py-2 pr-3 text-ink">{zone.name}</td>
                <td className="py-2 pr-3">{USE_LABEL[zone.use]}</td>
                <td className="py-2 pr-3">{leased ? zone.tenant : zone.tenant ? `был ${zone.tenant}` : "—"}</td>
                <td className="nums py-2 pr-3 text-right">{m2(zoneArea(zone))}</td>
                <td className="nums py-2 pr-3 text-right">{m2(rent)}</td>
                <td className="py-2 text-stone">
                  {leased ? `${zone.start} → ${zone.end || "…"}` : "свободно"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
