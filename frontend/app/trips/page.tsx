"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createTrip, deleteTrip, listTrips } from "@/app/lib/api";

export default function TripsPage() {
  const router = useRouter(); // 用程式換頁
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [days, setDays] = useState(3);
  const [startDate, setStartDate] = useState(""); // 沒選就是空字串

  const {
    data: trips,
    isPending,
    isError,
  } = useQuery({
    queryKey: ["trips"],
    queryFn: listTrips,
  });

  // useMutation：會「改資料」的動作（新增、刪除）。呼叫 mutate(...) 才真的送出
  const create = useMutation({
    mutationFn: createTrip,
    onSuccess: (trip) => {
      queryClient.invalidateQueries({ queryKey: ["trips"] }); // 行程列表舊了
      router.push(`/trips/${trip.id}`); // 建好直接進編輯頁
    },
  });

  const remove = useMutation({
    mutationFn: deleteTrip,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trips"] }),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    create.mutate({ title: title.trim(), days, start_date: startDate || null });
  }

  function handleDelete(tripId: number, tripTitle: string) {
    if (confirm(`確定要刪除「${tripTitle}」嗎？景點池和每日行程會一起刪掉。`)) {
      remove.mutate(tripId);
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-3xl font-bold">我的行程</h1>

      <form
        onSubmit={handleSubmit}
        className="mb-8 flex flex-wrap items-end gap-3 rounded-xl bg-white p-5 shadow"
      >
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
          行程名稱
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="例如：京都三日遊"
            className="rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex w-24 flex-col gap-1 text-sm">
          天數
          <input
            type="number"
            min={1}
            max={60}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          出發日（可以不填）
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={create.isPending}
          className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700 disabled:bg-gray-400"
        >
          {create.isPending ? "建立中…" : "建立行程"}
        </button>
        {create.isError && (
          <p className="w-full text-sm text-red-600">
            建立失敗：{create.error.message}
          </p>
        )}
      </form>

      {isPending && <p className="text-gray-500">載入中…</p>}
      {isError && (
        <p className="text-red-600">
          讀取行程失敗：請確認後端（uvicorn）有在跑
        </p>
      )}
      {trips?.length === 0 && (
        <p className="text-gray-500">還沒有行程，先建立一個吧！</p>
      )}

      <ul className="grid gap-4 sm:grid-cols-2">
        {trips?.map((trip) => (
          <li
            key={trip.id}
            className="flex items-center justify-between gap-3 rounded-xl bg-white p-5 shadow"
          >
            <Link href={`/trips/${trip.id}`} className="flex-1">
              <h2 className="text-xl font-bold hover:text-blue-600">
                {trip.title}
              </h2>
              <p className="text-sm text-gray-500">
                {trip.days} 天{trip.start_date && `・${trip.start_date} 出發`}
              </p>
            </Link>
            <button
              type="button"
              onClick={() => handleDelete(trip.id, trip.title)}
              className="rounded-lg px-3 py-1 text-sm text-red-600 hover:bg-red-50"
            >
              刪除
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
