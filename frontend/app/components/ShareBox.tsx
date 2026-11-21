"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { shareTrip, stopSharing } from "@/app/lib/api";
import type { Trip } from "@/app/lib/types";

// 編輯頁上面的分享區：產生連結、複製、停止分享
export default function ShareBox({ trip }: { trip: Trip }) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  // 分享的狀態改了：讓這個行程作廢重抓，trip.share_token 才會是新的
  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["trip", trip.id] });
  }
  const share = useMutation({
    mutationFn: () => shareTrip(trip.id),
    onSuccess: refresh,
  });
  const stop = useMutation({
    mutationFn: () => stopSharing(trip.id),
    onSuccess: refresh,
  });

  if (!trip.share_token) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => share.mutate()}
          disabled={share.isPending}
          className="rounded-full border border-blue-600 px-4 py-1 font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50"
        >
          {share.isPending ? "產生中…" : "產生分享連結"}
        </button>
        {share.isError && (
          <span className="text-red-600">{share.error.message}</span>
        )}
      </div>
    );
  }

  // 行程資料是瀏覽器自己去拿的，這個元件只會在瀏覽器裡畫，所以可以用 window
  const url = `${window.location.origin}/share/${trip.share_token}`;

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // 2 秒後變回「複製」
  }

  function handleStop() {
    if (confirm("停止分享之後，傳出去的連結就打不開了。確定嗎？")) {
      stop.mutate();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-green-50 p-3 text-sm">
      <span className="font-semibold text-green-800">分享中：</span>
      <input
        readOnly
        value={url}
        onFocus={(e) => e.target.select()}
        aria-label="分享連結"
        className="min-w-0 flex-1 rounded border border-green-200 bg-white px-2 py-1"
      />
      <button
        type="button"
        onClick={copy}
        className="rounded-full bg-green-600 px-3 py-1 font-semibold text-white hover:bg-green-700"
      >
        {copied ? "已複製 ✓" : "複製"}
      </button>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-green-700 hover:underline"
      >
        打開看看
      </a>
      <button
        type="button"
        onClick={handleStop}
        disabled={stop.isPending}
        className="px-2 text-gray-500 hover:text-red-600 disabled:opacity-50"
      >
        停止分享
      </button>
    </div>
  );
}
