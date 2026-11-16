import { useQuery } from "@tanstack/react-query";
import { getMe } from "@/app/lib/api";

// 我是誰：每個用到的地方都呼叫 useMe()，拿到的是小白板上同一份資料（queryKey 一樣）
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: getMe,
  });
}
