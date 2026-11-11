"use client";

import {
  AdvancedMarker,
  APIProvider,
  Map as GoogleMap, // 改個名字，免得跟 JavaScript 內建的 Map 搞混
  Pin,
  useMap,
} from "@vis.gl/react-google-maps";
import { useEffect, useRef } from "react";

import type { ItineraryItem } from "@/app/lib/types";

// 瀏覽器用的金鑰，放在 frontend/.env.local。NEXT_PUBLIC_ 開頭的才會送到瀏覽器
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

type LatLng = { lat: number; lng: number };

type Stop = {
  id: number;
  name: string;
  number: number; // 第幾站，跟清單上的編號一樣
  position: LatLng;
};

type Props = {
  day: number;
  items: ItineraryItem[]; // 這一天的每一站，照順序（有草稿就是草稿）
};

export default function TripMap({ day, items }: Props) {
  if (!API_KEY) {
    return (
      <p className="rounded-lg bg-gray-100 p-4 text-sm text-gray-500">
        還沒設定 Google 地圖金鑰：在 frontend/.env.local 加上
        NEXT_PUBLIC_GOOGLE_MAPS_API_KEY，再重新啟動 npm run dev
      </p>
    );
  }

  // 有座標的站才畫得出來
  const stops: Stop[] = [];
  items.forEach((item, index) => {
    const { lat, lng } = item.destination;
    if (lat === null || lng === null) return;
    stops.push({
      id: item.id,
      name: item.destination.place_name,
      number: index + 1,
      position: { lat, lng },
    });
  });
  const path = stops.map((stop) => stop.position); // 照順序的座標，拿來連線、縮放

  return (
    <APIProvider apiKey={API_KEY}>
      <GoogleMap
        mapId="DEMO_MAP_ID" // 新版圖釘一定要有；DEMO_MAP_ID 是 Google 給開發測試用的
        defaultCenter={{ lat: 25.033, lng: 121.5654 }} // 這一天還沒排景點時，先顯示台北
        defaultZoom={12}
        gestureHandling="greedy" // 手機上一根手指就能拖地圖
        disableDefaultUI // 不要街景小人、衛星切換那些按鈕
        className="h-96 w-full overflow-hidden rounded-lg"
      >
        {stops.map((stop) => (
          <AdvancedMarker
            key={stop.id}
            position={stop.position}
            title={stop.name}
          >
            <Pin
              background="#2563eb"
              borderColor="#1e40af"
              glyphColor="#ffffff"
              glyph={String(stop.number)}
            />
          </AdvancedMarker>
        ))}
        <RouteLine path={path} />
        <FitToStops day={day} path={path} />
      </GoogleMap>
    </APIProvider>
  );
}

// 照順序把每一站連起來。Google 的線不是 React 元件，所以在 useEffect 裡自己畫、自己擦
function RouteLine({ path }: { path: LatLng[] }) {
  const map = useMap(); // 外面那張地圖；還沒載入好的時候是 null

  useEffect(() => {
    if (!map || path.length < 2) return;
    const line = new google.maps.Polyline({
      map,
      path,
      strokeColor: "#2563eb",
      strokeOpacity: 0.7,
      strokeWeight: 4,
    });
    return () => line.setMap(null); // 下次重畫之前、或離開頁面時，先把舊的線擦掉
  }, [map, path]);

  return null; // 線畫在地圖上，這個元件本身不用畫任何 HTML
}

// 換天、多一站或少一站時，把這一天的每一站都放進畫面
// （只拖拉順序、改時間的話，地圖不會跳來跳去）
function FitToStops({ day, path }: { day: number; path: LatLng[] }) {
  const map = useMap();
  const fittedKey = useRef(""); // 上一次縮放時是「第幾天:幾站」

  useEffect(() => {
    const key = `${day}:${path.length}`;
    if (!map || path.length === 0 || fittedKey.current === key) return;
    fittedKey.current = key;

    if (path.length === 1) {
      map.setCenter(path[0]); // 只有一站：放在正中間
      map.setZoom(15);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    path.forEach((point) => bounds.extend(point));
    map.fitBounds(bounds, 50); // 每一站都放進畫面，四周留 50px
  }, [map, day, path]);

  return null;
}
