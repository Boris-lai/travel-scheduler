"use client";

import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import GooglePlaceSearch from "@/app/components/GooglePlaceSearch";
import SortableStop from "@/app/components/SortableStop";
import TripMap from "@/app/components/TripMap";

import {
  addToDay,
  getTrip,
  listTripItinerary,
  listTripPlaces,
  removeItineraryItem,
  removeTripPlace,
  saveDayItinerary,
} from "@/app/lib/api";
import type { ItineraryItem, TimeField, TravelMode } from "@/app/lib/types";

// 第 N 天的日期 ＝ 出發日 ＋（N − 1）天。後端沒有存，前端自己算
function dayDate(startDate: string | null, day: number) {
  if (!startDate) return "";
  const date = new Date(`${startDate}T00:00:00`);
  date.setDate(date.getDate() + day - 1);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export default function TripEditPage() {
  // 網址 /trips/1 裡的「1」。資料夾叫 [tripId]，所以這裡就叫 tripId
  const params = useParams<{ tripId: string }>();
  const tripId = Number(params.tripId);
  const queryClient = useQueryClient();
  const [activeDay, setActiveDay] = useState(1); // 現在看第幾天
  // 草稿：這一天拖拉、改時間之後，還沒儲存的樣子。null ＝ 沒有改，直接顯示後端的資料
  const [draft, setDraft] = useState<ItineraryItem[] | null>(null);

  const tripQuery = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => getTrip(tripId),
    retry: false, // 找不到行程（404）就直接顯示，不要重試
  });
  const placesQuery = useQuery({
    queryKey: ["tripPlaces", tripId],
    queryFn: () => listTripPlaces(tripId),
    enabled: tripQuery.isSuccess, // 確定有這個行程，才去拿景點池
  });
  // 整個行程每一天的每一站，一次拿回來（才知道每個景點排在第幾天）
  const itineraryQuery = useQuery({
    queryKey: ["itinerary", tripId],
    queryFn: () => listTripItinerary(tripId),
    enabled: tripQuery.isSuccess,
  });

  // 改完資料後，景點池和每日行程都作廢重抓，最不容易漏
  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["tripPlaces", tripId] });
    queryClient.invalidateQueries({ queryKey: ["itinerary", tripId] });
  }

  const addItem = useMutation({
    mutationFn: (destinationId: number) =>
      addToDay(tripId, activeDay, destinationId),
    onSuccess: refresh,
  });
  const removeItem = useMutation({
    mutationFn: (itemId: number) => removeItineraryItem(tripId, itemId),
    onSuccess: refresh,
  });
  const removePlace = useMutation({
    mutationFn: (destinationId: number) =>
      removeTripPlace(tripId, destinationId),
    onSuccess: refresh, // 資料庫會連帶刪掉排好的那一站（CASCADE），所以每日行程也要重抓
  });
  const saveDay = useMutation({
    mutationFn: (items: ItineraryItem[]) =>
      saveDayItinerary(tripId, activeDay, items),
    onSuccess: async () => {
      // 先等新的資料回來，再丟掉草稿；順序反過來的話，畫面會閃一下舊的順序
      await queryClient.invalidateQueries({ queryKey: ["itinerary", tripId] });
      setDraft(null);
    },
  });

  if (tripQuery.isError) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <p className="mb-4 text-red-600">{tripQuery.error.message}</p>
        <Link href="/trips" className="text-blue-600 hover:underline">
          ← 回我的行程
        </Link>
      </main>
    );
  }

  const trip = tripQuery.data;
  if (!trip) {
    return <main className="mx-auto max-w-5xl p-6 text-gray-500">載入中…</main>;
  }

  const dayNumbers = Array.from({ length: trip.days }, (_, i) => i + 1); // 例如 [1, 2, 3]
  const allItems = itineraryQuery.data ?? [];
  // 這一天的每一站：有草稿就顯示草稿，沒有就顯示後端的資料
  const dayItems =
    draft ?? allItems.filter((item) => item.day_index === activeDay);
  const dirty = draft !== null; // 有沒有還沒儲存的變更
  // 每個景點排在第幾天：景點 id → 第幾天
  const scheduledDay = new Map(
    allItems.map((item) => [item.destination.id, item.day_index]),
  );
  const error =
    addItem.error ?? removeItem.error ?? removePlace.error ?? saveDay.error;

  // 丟掉草稿，回到後端的資料
  function discardDraft() {
    setDraft(null);
    saveDay.reset(); // 上一次儲存失敗的錯誤訊息也一起清掉
  }

  function changeDay(day: number) {
    if (day === activeDay) return;
    if (
      dirty &&
      !confirm(`第 ${activeDay} 天的變更還沒儲存，要放棄這些變更嗎？`)
    ) {
      return;
    }
    discardDraft();
    setActiveDay(day);
  }

  // 拖拉放開時：dnd-kit 只告訴我們「誰被拖到誰的位置」，順序要自己改
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return; // 放在原地，或拖到清單外面
    const from = dayItems.findIndex((item) => item.id === active.id);
    const to = dayItems.findIndex((item) => item.id === over.id);
    setDraft(arrayMove(dayItems, from, to)); // 把第 from 個搬到第 to 個，回傳新的陣列
  }

  function changeTime(itemId: number, field: TimeField, value: string | null) {
    setDraft(
      dayItems.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item,
      ),
    );
  }

  function changeMode(itemId: number, mode: TravelMode | null) {
    setDraft(
      dayItems.map((item) =>
        item.id === itemId ? { ...item, travel_mode: mode } : item,
      ),
    );
  }

  function handleRemovePlace(destinationId: number, name: string) {
    const day = scheduledDay.get(destinationId);
    if (
      day &&
      !confirm(
        `「${name}」已經排在第 ${day} 天，移除後那一站也會一起刪掉。確定嗎？`,
      )
    ) {
      return;
    }
    removePlace.mutate(destinationId);
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-3xl font-bold">{trip.title}</h1>
      <p className="mb-6 text-gray-500">
        {trip.days} 天{trip.start_date && `・${trip.start_date} 出發`}
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-red-600">
          {error.message}
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
        {/* 左邊：景點池 */}
        <section className="rounded-xl bg-white p-5 shadow">
          <h2 className="mb-3 text-lg font-bold">景點池</h2>
          <GooglePlaceSearch tripId={tripId} />
          {placesQuery.isError && (
            <p className="text-sm text-red-600">{placesQuery.error.message}</p>
          )}
          {placesQuery.data?.length === 0 && (
            <p className="text-sm text-gray-500">
              還沒有景點，到
              <Link href="/" className="text-blue-600 hover:underline">
                搜尋頁
              </Link>
              加入吧
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {placesQuery.data?.map((place) => (
              <li
                key={place.id}
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2"
              >
                <div className="flex-1">
                  <p className="font-semibold">{place.place_name}</p>
                  <p className="text-xs text-gray-500">{place.city_name}</p>
                </div>
                {scheduledDay.has(place.id) ? (
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-500">
                    第 {scheduledDay.get(place.id)} 天
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => addItem.mutate(place.id)}
                    disabled={dirty || addItem.isPending}
                    className="shrink-0 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    排到第 {activeDay} 天
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleRemovePlace(place.id, place.place_name)}
                  disabled={dirty}
                  title="從景點池移除"
                  className="px-1 text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:hover:text-gray-400"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* 右邊：每日行程 */}
        <section className="rounded-xl bg-white p-5 shadow">
          <div className="mb-4 flex flex-wrap gap-2">
            {dayNumbers.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => changeDay(day)}
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

          {/* 有草稿才出現：儲存或取消 */}
          {dirty && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm">
              <div className="flex-1 text-amber-800">
                <p className="font-semibold">第 {activeDay} 天有變更還沒儲存</p>
                <p className="text-xs">儲存或取消之後，才能新增、刪除景點</p>
              </div>
              <button
                type="button"
                onClick={discardDraft}
                disabled={saveDay.isPending}
                className="rounded-full px-3 py-1 font-semibold text-gray-600 hover:bg-amber-100"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => saveDay.mutate(dayItems)}
                disabled={saveDay.isPending}
                className="rounded-full bg-blue-600 px-4 py-1 font-semibold text-white hover:bg-blue-700 disabled:bg-gray-400"
              >
                {saveDay.isPending ? "儲存中…" : "儲存"}
              </button>
            </div>
          )}

          {itineraryQuery.isPending && (
            <p className="text-sm text-gray-500">載入中…</p>
          )}
          {itineraryQuery.isError && (
            <p className="text-sm text-red-600">
              {itineraryQuery.error.message}
            </p>
          )}
          {itineraryQuery.isSuccess && dayItems.length === 0 && (
            <p className="text-sm text-gray-500">
              這一天還沒有排景點，從左邊的景點池排進來吧
            </p>
          )}
          {/* DndContext：拖拉的範圍，放開時呼叫 handleDragEnd
              SortableContext：這一串可以排序，順序就是 items 裡 id 的順序 */}
          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={dayItems.map((item) => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <ol className="flex flex-col gap-2">
                {dayItems.map((item, index) => (
                  <SortableStop
                    key={item.id}
                    item={item}
                    index={index}
                    next={dayItems[index + 1]}
                    onTimeChange={(field, value) =>
                      changeTime(item.id, field, value)
                    }
                    onModeChange={(mode) => changeMode(item.id, mode)}
                    onRemove={() => removeItem.mutate(item.id)}
                    removeDisabled={dirty}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>

          {/* 地圖跟清單用同一份 dayItems：拖拉、換天，地圖都會跟著變 */}
          <div className="mt-4">
            <TripMap day={activeDay} items={dayItems} />
          </div>
        </section>
      </div>
    </main>
  );
}
