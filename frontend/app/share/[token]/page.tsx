"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";

import TripMap from "@/app/components/TripMap";
import { getSharedTrip } from "@/app/lib/api";
import { dayDate } from "@/app/lib/dayDate";
import type { TravelMode } from "@/app/lib/types";

const MODE_LABELS: Record<TravelMode, string> = {
  WALK: "走路",
  DRIVE: "開車",
  TRANSIT: "大眾運輸",
};

// "09:00:00" → "09:00"
function hhmm(time: string | null) {
  return time?.slice(0, 5) ?? "";
}

// 分享頁：拿到連結的人都能看，但只能看，不能改
export default function SharePage() {
  // 網址 /share/xxxx 裡的「xxxx」。資料夾叫 [token]，所以這裡就叫 token
  const { token } = useParams<{ token: string }>();
  const [activeDay, setActiveDay] = useState(1);

  const shareQuery = useQuery({
    queryKey: ["share", token],
    queryFn: () => getSharedTrip(token),
    retry: false, // 連結錯了、或已經停止分享（404），就直接顯示
  });

  if (shareQuery.isError) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <p className="text-red-600">{shareQuery.error.message}</p>
      </main>
    );
  }

  const trip = shareQuery.data;
  if (!trip) {
    return <main className="mx-auto max-w-5xl p-6 text-gray-500">載入中…</main>;
  }

  const dayNumbers = Array.from({ length: trip.days }, (_, i) => i + 1);
  const dayItems = trip.items.filter((item) => item.day_index === activeDay);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <p className="mb-2 text-sm text-gray-500">
        別人分享給你的行程（只能看，不能改）
      </p>
      <h1 className="text-3xl font-bold">{trip.title}</h1>
      <p className="mb-6 text-gray-500">
        {trip.days} 天{trip.start_date && `・${trip.start_date} 出發`}
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {dayNumbers.map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => setActiveDay(day)}
            className={`rounded-full px-4 py-1 text-sm font-semibold ${
              day === activeDay
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            第 {day} 天 {dayDate(trip.start_date, day)}
          </button>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl bg-white p-5 shadow">
          {dayItems.length === 0 && (
            <p className="text-sm text-gray-500">這一天還沒有排景點</p>
          )}
          <ol className="flex flex-col gap-2">
            {dayItems.map((item, index) => (
              <li
                key={item.id}
                className="rounded-lg border border-gray-200 px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {item.destination.place_name}
                    </p>
                    {(item.arrival_time || item.departure_time) && (
                      <p className="text-sm text-gray-500">
                        {hhmm(item.arrival_time)} ～ {hhmm(item.departure_time)}
                      </p>
                    )}
                  </div>
                </div>
                {/* 有選交通方式、而且不是最後一站，才顯示 */}
                {item.travel_mode && index < dayItems.length - 1 && (
                  <p className="mt-1 pl-10 text-xs text-gray-500">
                    ↓ {MODE_LABELS[item.travel_mode]}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
        <TripMap day={activeDay} items={dayItems} />
      </div>
    </main>
  );
}
