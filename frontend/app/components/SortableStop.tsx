"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { ItineraryItem, TimeField } from "@/app/lib/types";

type Props = {
  item: ItineraryItem;
  index: number; // 在畫面上排第幾個（從 0 開始）。編號用它，不用 position（可能跳號）
  onTimeChange: (field: TimeField, value: string | null) => void;
  onRemove: () => void;
  removeDisabled: boolean;
};

// 後端回 "09:00:00"，時間輸入框要的是 "09:00"
function toInputValue(time: string | null) {
  return time?.slice(0, 5) ?? "";
}

// 每日行程裡可以拖拉的一站
export default function SortableStop({
  item,
  index,
  onTimeChange,
  onRemove,
  removeDisabled,
}: Props) {
  // 跟 dnd-kit 說「這一列可以拖」，名字用這一站的 id
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  return (
    <li
      ref={setNodeRef} // 被拖著走的是這個 <li>
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 ${
        isDragging ? "relative z-10 shadow-lg" : ""
      }`}
    >
      {/* 把手：只有按住這裡才能拖，時間框和 ✕ 才點得到 */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        title="按住拖拉排序"
        className="cursor-grab touch-none px-1 text-xl text-gray-400 active:cursor-grabbing"
      >
        ⠿
      </button>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{item.destination.place_name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1 text-sm text-gray-500">
          <input
            type="time"
            value={toInputValue(item.arrival_time)}
            onChange={(e) =>
              onTimeChange("arrival_time", e.target.value || null)
            }
            aria-label="抵達時間"
            className="rounded border border-gray-300 px-1"
          />
          ～
          <input
            type="time"
            value={toInputValue(item.departure_time)}
            onChange={(e) =>
              onTimeChange("departure_time", e.target.value || null)
            }
            aria-label="離開時間"
            className="rounded border border-gray-300 px-1"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={removeDisabled}
        title="刪掉這一站"
        className="px-1 text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:hover:text-gray-400"
      >
        ✕
      </button>
    </li>
  );
}
