import type { SearchResponse } from "./types";

// 搜尋景點。網址只寫 /api/search：先送到前端自己，再由 next.config.ts 轉給後端
export async function searchDestinations(
  location: string,
): Promise<SearchResponse> {
  const res = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location }),
  });
  if (!res.ok) {
    throw new Error(`後端回應 ${res.status}`);
  }
  return res.json();
}
