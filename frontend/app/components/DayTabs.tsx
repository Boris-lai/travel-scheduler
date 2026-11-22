"use client";

import { dayDate } from "@/app/lib/dayDate";
import { lineColor } from "@/app/lib/lineColors";

type Props = {
  days: number; // 總共幾天
  startDate: string | null; // 出發日，用來算每一天的日期
  activeDay: number; // 現在看第幾天
  onChange: (day: number) => void;
};

// 每一天的分頁：像路線圖上的路線標誌，第幾天就是第幾號線，顏色就是那一天的路線色
export default function DayTabs({
  days,
  startDate,
  activeDay,
  onChange,
}: Props) {
  const dayNumbers = Array.from({ length: days }, (_, i) => i + 1); // 例如 [1, 2, 3]

  return (
    <div className="flex flex-wrap gap-2">
      {dayNumbers.map((day) => {
        const active = day === activeDay;
        return (
          <button
            key={day}
            type="button"
            onClick={() => onChange(day)}
            aria-pressed={active}
            // 顏色是算出來的，Tailwind 的 class 要寫死的字串才有用，所以用 style
            style={{ borderColor: active ? lineColor(day) : "transparent" }}
            className={`flex items-center gap-2 rounded-full border-2 py-1 pr-4 pl-1 text-sm ${
              active
                ? "bg-board font-bold text-ink"
                : "text-ink-2 hover:bg-board"
            }`}
          >
            <span
              style={{ backgroundColor: lineColor(day) }}
              className="flex h-7 w-7 items-center justify-center rounded-full font-num text-base font-bold text-white"
            >
              {day}
            </span>
            第 {day} 天
            <span className="font-num text-ink-2">
              {dayDate(startDate, day)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
