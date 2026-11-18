"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";

import AttractionCard from "@/app/components/AttractionCard";
import {
  addTripPlace,
  listTripPlaces,
  listTrips,
  searchDestinations,
} from "@/app/lib/api";
import { useMe } from "./lib/useMe";

export default function Home() {
  const queryClient = useQueryClient(); // 拿到前端的小白板，等一下要讓某一筆作廢
  const [keyword, setKeyword] = useState(""); // 輸入框裡現在打的字
  const [searched, setSearched] = useState(""); // 按下搜尋那一刻的關鍵字
  const [taskFailed, setTaskFailed] = useState(false); // AI 在背景找景點失敗了
  const [tripId, setTripId] = useState<number | null>(null); // 要加進哪個行程

  // 拿 searched 去後端搜尋。等待中、出錯、快取，都交給 TanStack Query 管
  const { data, isFetching, isError } = useQuery({
    queryKey: ["search", searched], // 快取的名字，就像第 4 課 Redis 的 search:京都
    queryFn: () => searchDestinations(searched),
    enabled: searched !== "", // 還沒搜尋過，就先不要打 API
    staleTime: 5 * 60 * 1000, // 5 分鐘內再搜同一個地點，直接用快取，不再問後端
    refetchOnWindowFocus: false, // 切回這個分頁時不要自動重抓：重抓可能又派一次 worker
    retry: false, // 失敗就直接顯示錯誤，不要自動重試
  });

  // 後端說「AI 在找」時，會給一張號碼牌（task_id）
  const taskId = data?.status === "processing" ? data.task_id : null;

  // 有號碼牌，就用 SSE 坐著等叫號
  useEffect(() => {
    if (!taskId) return; // 沒有號碼牌就不用等

    const es = new EventSource(`/api/search/stream/${taskId}`);

    es.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.status === "completed") {
        // 叫號了：讓小白板上這個地點作廢，useQuery 會自己再搜一次，拿到新景點
        queryClient.invalidateQueries({ queryKey: ["search", searched] });
      } else {
        setTaskFailed(true); // failed 或 timeout
      }
      es.close(); // 拿到結果就掛斷，不然 EventSource 會自動重新連線
    };

    es.onerror = () => {
      // 連線斷掉時（例如後端重開），EventSource 會自己重新連線，不用管它。
      // 只有連不上後端（回應錯誤）時它才會放棄，這時才算失敗
      if (es.readyState === EventSource.CLOSED) {
        setTaskFailed(true);
      }
    };

    // 收拾：換搜別的城市、或離開這一頁時，掛斷這條連線
    return () => es.close();
  }, [taskId, searched, queryClient]);

  // 「加入到哪個行程」的選單要用的行程清單：登入了才去拿
  const { data: me } = useMe();
  const tripsQuery = useQuery({
    queryKey: ["trips"],
    queryFn: listTrips,
    enabled: !!me,
  });

  // 選好的行程，景點池裡已經有哪些景點
  const poolQuery = useQuery({
    queryKey: ["tripPlaces", tripId],
    queryFn: () => listTripPlaces(tripId!), // ! 的意思是「這裡一定不是 null」，下一行保證了
    enabled: tripId !== null && !!me, // 還沒選行程、或沒登入，就不用拿
  });
  const inPool = new Set(poolQuery.data?.map((place) => place.id)); // 已經加入的景點 id

  const addPlace = useMutation({
    mutationFn: (destinationId: number) => addTripPlace(tripId!, destinationId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["tripPlaces", tripId] }),
  });

  // 每張卡片右下角的按鈕
  function addButton(destinationId: number) {
    if (tripId === null || !me) return null; // 還沒選行程、或沒登入，就不顯示
    if (inPool.has(destinationId)) {
      return (
        <span className="text-xs font-semibold text-gray-400">✓ 已加入</span>
      );
    }
    return (
      <button
        type="button"
        onClick={() => addPlace.mutate(destinationId)}
        disabled={addPlace.isPending}
        className="shrink-0 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-gray-400"
      >
        加入＋
      </button>
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); // 表單送出時，瀏覽器預設會重新整理頁面，把它擋掉
    setSearched(keyword.trim());
    setTaskFailed(false);
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="mb-6 text-3xl font-bold">Easy Travel Scheduler</h1>

      <form onSubmit={handleSubmit} className="mb-8 flex gap-2">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="想去哪裡？例如：京都"
          className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2"
        />
        <button
          type="submit"
          disabled={isFetching}
          className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isFetching ? "搜尋中…" : "搜尋"}
        </button>
      </form>

      {/* 登入了才顯示「加入到」選單；沒登入的話，提示先登入 */}
      {me ? (
        <div className="mb-6 flex items-center gap-2 text-sm">
          <span className="text-gray-600">加入到：</span>
          <select
            value={tripId ?? ""}
            onChange={(e) =>
              setTripId(e.target.value ? Number(e.target.value) : null)
            }
            className="rounded-lg border border-gray-300 bg-white px-3 py-1"
          >
            <option value="">選一個行程</option>
            {tripsQuery.data?.map((trip) => (
              <option key={trip.id} value={trip.id}>
                {trip.title}
              </option>
            ))}
          </select>
          {tripsQuery.data?.length === 0 && (
            <Link href="/trips" className="text-blue-600 hover:underline">
              先去建立一個行程
            </Link>
          )}
          {addPlace.isError && (
            <span className="text-red-600">{addPlace.error.message}</span>
          )}
        </div>
      ) : (
        <p className="mb-6 text-sm text-gray-500">
          <Link href="/login" className="text-blue-600 hover:underline">
            登入
          </Link>
          之後，可以把景點加進你的行程
        </p>
      )}

      {isError && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-red-600">
          搜尋失敗：請確認後端（uvicorn）有在跑
        </p>
      )}

      {taskFailed && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-red-600">
          AI 找景點失敗了，請重新整理頁面後再搜一次
        </p>
      )}

      {data?.status === "processing" && !taskFailed && (
        <p className="mb-4 rounded-lg bg-yellow-50 p-3 text-yellow-700">
          🤖 資料庫裡「{data.location}」的景點還不夠，AI 正在背景幫你找，大約 1
          分鐘。找到會自動顯示，不用重新整理。
        </p>
      )}

      {data && (
        <>
          <p className="mb-4 text-gray-600">
            「{data.location}」的景點：{data.destinations.length} 個
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {data.destinations.map((d) => (
              <AttractionCard key={d.id} destination={d}>
                {addButton(d.id)}
              </AttractionCard>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
