"use client";

import { useQuery } from "@tanstack/react-query";

import { estimateLeg } from "@/app/lib/api";
import type { ItineraryItem, TravelMode } from "@/app/lib/types";

const MODE_LABELS: Record<TravelMode, string> = {
  WALK: "走路",
  DRIVE: "開車",
  TRANSIT: "大眾運輸",
};

// 75 → 「1 小時 15 分」
function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} 小時 ${m} 分` : `${m} 分`;
}

// 3957 → 「4.0 公里」，800 → 「800 公尺」
function formatDistance(meters: number) {
  return meters >= 1000
    ? `${(meters / 1000).toFixed(1)} 公里`
    : `${meters} 公尺`;
}

type Props = {
  from: ItineraryItem; // 這一站
  to: ItineraryItem; // 下一站
  onModeChange: (mode: TravelMode | null) => void;
};

// 這一站到下一站：選交通方式，顯示大概要多久
export default function LegInfo({ from, to, onModeChange }: Props) {
  const mode = from.travel_mode;
  const a = from.destination;
  const b = to.destination;
  const ready =
    mode !== null &&
    a.lat !== null &&
    a.lng !== null &&
    b.lat !== null &&
    b.lng !== null;

  const legQuery = useQuery({
    // 座標或交通方式變了（例如拖拉換了下一站），key 就變了，會自動重算
    queryKey: ["leg", a.lat, a.lng, b.lat, b.lng, mode],
    queryFn: () => estimateLeg(a, b, mode!),
    enabled: ready,
    staleTime: Infinity, // 同樣的兩點、同樣的交通方式，答案幾乎不會變，不用一直花 Google 的額度
  });

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
      <span>↓ 到下一站</span>
      <select
        value={mode ?? ""}
        onChange={(e) =>
          onModeChange((e.target.value || null) as TravelMode | null)
        }
        aria-label="到下一站的交通方式"
        className="rounded border border-gray-300 px-1 py-0.5"
      >
        <option value="">選交通方式</option>
        <option value="WALK">{MODE_LABELS.WALK}</option>
        <option value="DRIVE">{MODE_LABELS.DRIVE}</option>
        <option value="TRANSIT">{MODE_LABELS.TRANSIT}</option>
      </select>
      {ready && legQuery.isPending && <span>計算中…</span>}
      {legQuery.isError && (
        <span className="text-red-600">{legQuery.error.message}</span>
      )}
      {ready && legQuery.data && (
        <span>
          約 {formatMinutes(legQuery.data.duration_minutes)}・
          {formatDistance(legQuery.data.distance_meters)}
          {legQuery.data.estimated && "（直線估算）"}
        </span>
      )}
    </div>
  );
}
