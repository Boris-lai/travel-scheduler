import type {
  Destination,
  ItineraryItem,
  LegEstimate,
  LoginInput,
  PlaceSuggestion,
  SearchResponse,
  SignupInput,
  TravelMode,
  Trip,
  TripCreate,
  User,
} from "@/app/lib/types";

// 所有 API 共用的小幫手：送出請求 → 檢查有沒有成功 → 把回應變成物件
// <T> 是「這支 API 會回什麼」的空格，呼叫時再填，例如 apiFetch<Trip[]>(...)
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    // 後端的錯誤訊息放在 detail 裡，例如「找不到這個行程」
    const body = await res.json().catch(() => null);
    throw new Error(
      typeof body?.detail === "string" ? body.detail : `後端回應 ${res.status}`,
    );
  }
  if (res.status === 204) {
    return undefined as T; // 刪除成功，後端沒有回任何內容
  }
  return res.json();
}

// ---------- 搜尋 ----------

// 網址只寫 /api/...：先送到前端自己，再由 next.config.ts 轉給後端
export function searchDestinations(location: string) {
  return apiFetch<SearchResponse>("/api/search", {
    method: "POST",
    body: JSON.stringify({ location }),
  });
}

// 打字時的建議：後端再去問 Google。中文、空白放進網址前要先編碼
export function searchGooglePlaces(text: string) {
  return apiFetch<PlaceSuggestion[]>(
    `/api/places/autocomplete?text=${encodeURIComponent(text)}`,
  );
}

// ---------- 行程 ----------

export function listTrips() {
  return apiFetch<Trip[]>("/api/trips");
}

export function getTrip(tripId: number) {
  return apiFetch<Trip>(`/api/trips/${tripId}`);
}

export function createTrip(input: TripCreate) {
  return apiFetch<Trip>("/api/trips", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteTrip(tripId: number) {
  return apiFetch<void>(`/api/trips/${tripId}`, { method: "DELETE" });
}

// ---------- 景點池 ----------

export function listTripPlaces(tripId: number) {
  return apiFetch<Destination[]>(`/api/trips/${tripId}/places`);
}

export function addTripPlace(tripId: number, destinationId: number) {
  return apiFetch<Destination>(`/api/trips/${tripId}/places`, {
    method: "POST",
    body: JSON.stringify({ destination_id: destinationId }),
  });
}

// 用 Google 的地點加進景點池（資料庫還沒有這個景點的話，後端會先建立）
export function addGooglePlace(tripId: number, googlePlaceId: string) {
  return apiFetch<Destination>(`/api/trips/${tripId}/places/google`, {
    method: "POST",
    body: JSON.stringify({ google_place_id: googlePlaceId }),
  });
}

export function removeTripPlace(tripId: number, destinationId: number) {
  return apiFetch<void>(`/api/trips/${tripId}/places/${destinationId}`, {
    method: "DELETE",
  });
}

// ---------- 每日行程 ----------

// 整個行程每一天的每一站，一次拿回來
export function listTripItinerary(tripId: number) {
  return apiFetch<ItineraryItem[]>(`/api/trips/${tripId}/itinerary`);
}

export function addToDay(tripId: number, day: number, destinationId: number) {
  return apiFetch<ItineraryItem>(`/api/trips/${tripId}/days/${day}/itinerary`, {
    method: "POST",
    body: JSON.stringify({ destination_id: destinationId }),
  });
}

export function removeItineraryItem(tripId: number, itemId: number) {
  return apiFetch<void>(`/api/trips/${tripId}/itinerary/${itemId}`, {
    method: "DELETE",
  });
}

// 儲存某一天：這一天的每一站照新的順序排好，每一站帶著自己的時間
// （後端 schemas/itinerary.py 的 ItineraryDaySave）
export function saveDayItinerary(
  tripId: number,
  day: number,
  items: ItineraryItem[],
) {
  return apiFetch<ItineraryItem[]>(
    `/api/trips/${tripId}/days/${day}/itinerary`,
    {
      method: "PUT",
      body: JSON.stringify({
        items: items.map((item) => ({
          id: item.id,
          arrival_time: item.arrival_time,
          departure_time: item.departure_time,
          travel_mode: item.travel_mode,
        })),
      }),
    },
  );
}

// 一段路（from → to）用某種交通方式，大概要多久
export function estimateLeg(
  from: Destination,
  to: Destination,
  mode: TravelMode,
) {
  const params = new URLSearchParams({
    mode,
    from_lat: String(from.lat),
    from_lng: String(from.lng),
    to_lat: String(to.lat),
    to_lng: String(to.lng),
  });
  return apiFetch<LegEstimate>(`/api/legs/estimate?${params}`);
}

// ---------- 會員 ----------
// cookie（手環）不用自己帶：網址跟網頁同一個網站，瀏覽器每次都會自動帶上

// 我是誰：沒登入回 null
export function getMe() {
  return apiFetch<User | null>("/api/me");
}

export function signup(input: SignupInput) {
  return apiFetch<User>("/api/signup", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function login(input: LoginInput) {
  return apiFetch<User>("/api/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function logout() {
  return apiFetch<void>("/api/logout", { method: "POST" });
}
