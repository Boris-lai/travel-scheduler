import type { Trip } from "@/app/lib/types";

// 沒登入時建立的行程：行程本身在資料庫，鑰匙（edit_token）存在這台電腦的瀏覽器裡
export type AnonTrip = Trip & { edit_token: string };

const KEY = "anon_trips"; // 在 localStorage 裡的名字

export function readAnonTrips(): AnonTrip[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return []; // 內容壞掉，或不在瀏覽器裡（伺服器上沒有 localStorage），都當成沒有
  }
}

function writeAnonTrips(trips: AnonTrip[]) {
  localStorage.setItem(KEY, JSON.stringify(trips));
}

export function addAnonTrip(trip: AnonTrip) {
  writeAnonTrips([trip, ...readAnonTrips()]);
}

export function removeAnonTrip(tripId: number) {
  writeAnonTrips(readAnonTrips().filter((t) => t.id !== tripId));
}

// 這台電腦有沒有這個行程的鑰匙
export function anonTokenFor(tripId: number): string | null {
  return readAnonTrips().find((t) => t.id === tripId)?.edit_token ?? null;
}
