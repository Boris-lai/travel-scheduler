// 後端 DestinationOut 的樣子（先列出畫面會用到的欄位）
export type Destination = {
  id: number;
  place_name: string;
  city_name: string | null;
  description: string | null;
  geo_tags: string | null;
  lat: number | null; // 緯度，地圖插針用
  lng: number | null; // 經度
  google_place_id: string | null; // Google 的地點 id
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
  share_token: string | null; // 有分享才有：分享連結裡的那串亂碼
};

// 後端 TripCreateOut：建立行程時回的資料。沒登入建立的，會多一把鑰匙
export type TripCreated = Trip & {
  edit_token: string | null;
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
  travel_mode: TravelMode | null; // 從這一站到下一站怎麼去；還沒選是 null，最後一站用不到
  destination: Destination; // 這一站是哪個景點
};

// 每一站可以填的兩個時間
export type TimeField = "arrival_time" | "departure_time";

// 後端 GET /api/places/autocomplete 回傳的一筆（schemas/place.py）
export type PlaceSuggestion = {
  google_place_id: string;
  name: string; // 例如「金閣寺」
  detail: string | null; // 例如「日本京都府京都市北區……」
};

// 交通方式（後端 schemas/leg.py 的 TravelMode）
export type TravelMode = "WALK" | "DRIVE" | "TRANSIT";

// 後端 GET /api/legs/estimate 回傳的樣子：一段路大概要多久
export type LegEstimate = {
  distance_meters: number;
  duration_minutes: number;
  estimated: boolean; // true：直線距離估算的
};

// 後端 UserOut 的樣子（schemas/auth.py）：登入的會員
export type User = {
  id: number;
  email: string;
  name: string;
};

// 註冊時要送的資料（schemas/auth.py 的 SignupIn）
export type SignupInput = {
  email: string;
  password: string;
  name: string;
};

// 登入時要送的資料（schemas/auth.py 的 LoginIn）
export type LoginInput = {
  email: string;
  password: string;
};

// 後端 POST /api/trips/{id}/share 回傳的樣子（schemas/share.py 的 ShareOut）
export type ShareResult = {
  share_token: string;
};

// 後端 GET /api/share/{token} 回傳的樣子（schemas/share.py 的 SharedTripOut）：只能看的行程
export type SharedTrip = {
  title: string;
  days: number;
  start_date: string | null;
  items: ItineraryItem[]; // 每一天的每一站
};
