"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import {
  addGooglePlace,
  listTripPlaces,
  searchGooglePlaces,
} from "@/app/lib/api";

type Props = {
  tripId: number;
};

// 景點池上面的搜尋框：打景點名稱，從 Google 的建議裡挑一個加進景點池
export default function GooglePlaceSearch({ tripId }: Props) {
  const queryClient = useQueryClient();
  const [text, setText] = useState(""); // 輸入框裡的字
  const [keyword, setKeyword] = useState(""); // 停下來 0.3 秒後，真的拿去查的字

  // 每打一個字就重新計時，停下來 0.3 秒才更新 keyword
  useEffect(() => {
    const timer = setTimeout(() => setKeyword(text.trim()), 300);
    return () => clearTimeout(timer); // 0.3 秒內又打字了：取消上一次的計時
  }, [text]);

  const suggestQuery = useQuery({
    queryKey: ["googlePlaces", keyword],
    queryFn: () => searchGooglePlaces(keyword),
    enabled: keyword.length >= 2, // 至少 2 個字才查
    staleTime: 5 * 60 * 1000, // 5 分鐘內查過一樣的字，直接用小白板上的
  });
  // 跟編輯頁同一個 queryKey：不會多打一次 API，兩邊共用同一份景點池
  const placesQuery = useQuery({
    queryKey: ["tripPlaces", tripId],
    queryFn: () => listTripPlaces(tripId),
  });
  const inPool = new Set(placesQuery.data?.map((p) => p.google_place_id));

  const addPlace = useMutation({
    mutationFn: (googlePlaceId: string) =>
      addGooglePlace(tripId, googlePlaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tripPlaces", tripId] });
      setText(""); // 加好了，清空搜尋框
      setKeyword("");
    },
  });

  return (
    <div className="mb-4">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="用 Google 找景點，例如：金閣寺"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      {addPlace.isError && (
        <p className="mt-1 text-sm text-red-600">{addPlace.error.message}</p>
      )}
      {suggestQuery.isError && (
        <p className="mt-1 text-sm text-red-600">
          {suggestQuery.error.message}
        </p>
      )}
      {keyword.length >= 2 && (
        <ul className="mt-2 flex flex-col gap-1 rounded-lg border border-gray-200 p-1">
          {suggestQuery.isPending && (
            <li className="px-3 text-sm text-gray-500">搜尋中…</li>
          )}
          {suggestQuery.data?.length === 0 && (
            <li className="px-3 text-sm text-gray-500">找不到符合的地點</li>
          )}
          {suggestQuery.data?.map((s) => (
            <li key={s.google_place_id}>
              <button
                type="button"
                onClick={() => addPlace.mutate(s.google_place_id)}
                disabled={inPool.has(s.google_place_id) || addPlace.isPending}
                className="w-full rounded-lg px-3 py-2 text-left hover:bg-blue-50 disabled:cursor-default disabled:hover:bg-transparent"
              >
                <span className="block text-sm font-semibold">{s.name}</span>
                <span className="block text-xs text-gray-500">
                  {inPool.has(s.google_place_id) ? "✓ 已在景點池" : s.detail}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
