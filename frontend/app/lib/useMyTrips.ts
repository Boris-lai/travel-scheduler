import { useQuery } from "@tanstack/react-query";

import { readAnonTrips } from "@/app/lib/anonTrips";
import { listTrips } from "@/app/lib/api";
import type { Trip } from "@/app/lib/types";
import { useMe } from "@/app/lib/useMe";

// 我的行程：登入了問後端；沒登入就讀這台電腦瀏覽器裡的匿名行程
export function useMyTrips() {
  const { data: me, isPending: mePending } = useMe();

  const serverTrips = useQuery({
    queryKey: ["trips"],
    queryFn: listTrips,
    enabled: !!me,
  });
  const anonTrips = useQuery<Trip[]>({
    queryKey: ["anonTrips"],
    queryFn: readAnonTrips, // 不用問後端，直接讀 localStorage
    enabled: !mePending && !me, // 確定沒登入才讀
  });

  return me ? serverTrips : anonTrips;
}
