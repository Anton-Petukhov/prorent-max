import { createServerFn } from "@tanstack/react-start";
import type { Zone } from "@/lib/portfolio";

export type PlanEditInput = {
  instruction: string;
  floorName: string;
  width: number;
  depth: number;
  zones: Zone[];
};

export const editPlanWithGrok = createServerFn({ method: "POST" })
  .validator((data: PlanEditInput) => {
    if (typeof data?.instruction !== "string") throw new Error("Нет команды");
    const instruction = data.instruction.trim();
    if (instruction.length < 2 || instruction.length > 600) {
      throw new Error("Команда должна быть от 2 до 600 символов");
    }
    if (!Array.isArray(data.zones) || data.zones.length < 1 || data.zones.length > 32) {
      throw new Error("На этаже слишком много зон");
    }
    return {
      instruction,
      floorName: String(data.floorName ?? "Этаж").slice(0, 80),
      width: Number(data.width) || 40,
      depth: Number(data.depth) || 40,
      zones: data.zones.map((zone) => ({
        id: String(zone.id),
        name: String(zone.name),
        use: zone.use,
        x: zone.x,
        y: zone.y,
        w: zone.w,
        h: zone.h,
        tenant: zone.tenant,
        rentPerM2: zone.rentPerM2,
        start: zone.start,
        end: zone.end,
      })),
    };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "Модель сейчас недоступна" };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4.5",
          temperature: 0.2,
          max_tokens: 1800,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "Ты редактор поэтажных планов коммерческой недвижимости. Отвечай только JSON-объектом {\"note\": string, \"zones\": Zone[]}. " +
                "Zone: id, name, use (office|retail|warehouse|vacant), x, y, w, h в метрах, tenant (string|null), rentPerM2 (EUR за м² в год), start и end в виде 2026-Q3 или пустая строка. " +
                "Начало координат — левый верх плана, x вправо, y вниз. Зоны не должны вылезать за width×depth и не должны сильно пересекаться. " +
                "Сохраняй id существующих зон. Новым давай id вида new-1. Вакант: tenant null, start и end пустые. Не выдумывай лишние этажи. note — одна короткая фраза по-русски.",
            },
            {
              role: "user",
              content: JSON.stringify({
                floor: data.floorName,
                width: data.width,
                depth: data.depth,
                instruction: data.instruction,
                zones: data.zones,
              }),
            },
          ],
        }),
      });
      if (!res.ok) return { ok: false as const, error: `Модель ответила ошибкой ${res.status}` };
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = body.choices?.[0]?.message?.content ?? "";
      if (!text) return { ok: false as const, error: "Пустой ответ модели" };
      return { ok: true as const, text };
    } catch {
      return { ok: false as const, error: "Не удалось связаться с моделью" };
    } finally {
      clearTimeout(timer);
    }
  });
