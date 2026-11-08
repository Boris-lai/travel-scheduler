// 後端 DestinationOut 的樣子（先列出畫面會用到的欄位）
export type Destination = {
  id: number;
  place_name: string;
  city_name: string | null;
  description: string | null;
  geo_tags: string | null;
};

// 後端 POST /api/search 回傳的樣子（schemas/search.py 的 SearchOut）
export type SearchResponse = {
  location: string;
  status: "completed" | "processing";
  task_id: string | null;
  destinations: Destination[];
};

// 後端 TripOut 的樣子（schemas/trip.py）
export type Trip = {
  id: number;
  title: string;
  days: number;
  start_date: string | null; // 例如 "2026-12-20"，沒填就是 null
  created_at: string;
};

// 建立行程時要送的資料（schemas/trip.py 的 TripCreate）
export type TripCreate = {
  title: string;
  days: number;
  start_date: string | null;
};

// 後端 ItineraryItemOut 的樣子（schemas/itinerary.py）：某一天裡的其中一站
export type ItineraryItem = {
  id: number; // 這一站的 id（不是景點的 id）
  day_index: number;
  position: number;
  arrival_time: string | null; // 例如 "09:00:00"
  departure_time: string | null;
  destination: Destination; // 這一站是哪個景點
};
