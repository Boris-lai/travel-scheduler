"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";

import AttractionCard from "@/app/components/AttractionCard";
import HomeHero from "./components/HomeHero";

import {
  addTripPlace,
  listTripPlaces,
  searchDestinations,
} from "@/app/lib/api";
import { useMyTrips } from "@/app/lib/useMyTrips";

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

  // 「加入到哪個行程」的選單：登入了是帳號的行程，沒登入是這台電腦的匿名行程
  const { data: trips } = useMyTrips();
  // 選的行程要在清單裡才算數（例如登出之後，原本選的行程就不在清單裡了）
  const selectedTrip = trips?.find((trip) => trip.id === tripId);

  // 選好的行程，景點池裡已經有哪些景點
  const poolQuery = useQuery({
    queryKey: ["tripPlaces", tripId],
    queryFn: () => listTripPlaces(tripId!), // ! 的意思是「這裡一定不是 null」，下一行保證了
    enabled: !!selectedTrip, // 還沒選行程（或選的不在清單裡），就不用拿
  });
  const inPool = new Set(poolQuery.data?.map((place) => place.id)); // 已經加入的景點 id

  const addPlace = useMutation({
    mutationFn: (destinationId: number) => addTripPlace(tripId!, destinationId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["tripPlaces", tripId] }),
  });

  // 每張卡片右下角的按鈕
  function addButton(destinationId: number) {
    if (!selectedTrip) return null; // 還沒選行程（或選的不在清單裡），就不顯示
    if (inPool.has(destinationId)) {
      return <span className="text-sm font-bold text-ink-2">✓ 已加入</span>;
    }
    return (
      <button
        type="button"
        onClick={() => addPlace.mutate(destinationId)}
        disabled={addPlace.isPending}
        className="rounded-full border-2 border-ink px-4 py-1 text-sm font-bold hover:bg-ink hover:text-white disabled:opacity-50"
      >
        加入＋
      </button>
    );
  }

  // 開始搜尋：在輸入框按「搜尋」、或點了路線上的城市，都走這裡
  function startSearch(location: string) {
    if (!location) return; // 什麼都沒打，就不搜
    setSearched(location);
    setTaskFailed(false);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      <HomeHero
        keyword={keyword}
        onKeywordChange={setKeyword}
        onSearch={startSearch}
        searching={isFetching}
      />

      {isError && (
        <p className="mb-4 rounded-md border-l-4 border-[#E5302F] bg-board p-3">
          搜尋失敗：請確認後端（uvicorn）有在跑
        </p>
      )}

      {taskFailed && (
        <p className="mb-4 rounded-md border-l-4 border-[#E5302F] bg-board p-3">
          AI 找景點失敗了，請重新整理頁面後再搜一次
        </p>
      )}

      {/* AI 在背景找的時候：像車站的電子看板，深藍底白字 */}
      {data?.status === "processing" && !taskFailed && (
        <p className="mb-4 rounded-md bg-ink p-4 text-white">
          資料庫裡「{data.location}」的景點還不夠，AI 正在背景幫你找，大約 1
          分鐘。找到會自動顯示，不用重新整理。
        </p>
      )}

      {data && (
        <section>
          {/* 結果的標題列：左邊是城市和景點數，右邊是「加入到」哪個行程 */}
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b-2 border-ink pb-3">
            <h2 className="text-2xl font-black">
              {data.location}
              <span className="ml-2 font-num text-lg font-bold text-ink-2">
                {data.destinations.length} 個景點
              </span>
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label htmlFor="trip-select" className="text-ink-2">
                加入到
              </label>
              <select
                id="trip-select"
                value={selectedTrip?.id ?? ""}
                onChange={(e) =>
                  setTripId(e.target.value ? Number(e.target.value) : null)
                }
                className="rounded-md border border-rule bg-board px-3 py-1.5 font-bold"
              >
                <option value="">選一個行程</option>
                {trips?.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.title}
                  </option>
                ))}
              </select>
              {trips?.length === 0 && (
                <Link href="/trips" className="font-bold underline">
                  先去建立一個行程
                </Link>
              )}
            </div>
          </div>

          {addPlace.isError && (
            <p className="mb-4 rounded-md border-l-4 border-[#E5302F] bg-board p-3 text-sm">
              {addPlace.error.message}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.destinations.map((d) => (
              <AttractionCard key={d.id} destination={d}>
                {addButton(d.id)}
              </AttractionCard>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
