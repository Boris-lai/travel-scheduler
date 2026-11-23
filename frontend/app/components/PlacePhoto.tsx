"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { getDestinationPhoto } from "@/app/lib/api";

type Props = {
  destinationId: number;
  name: string; // 景點名稱：圖片載不出來、或用螢幕閱讀器的人，會看到（聽到）這個
};

// 景點照片：捲到畫面附近才去拿（每拿一張都算 Google 的額度），下面標出拍照的人
export default function PlacePhoto({ destinationId, name }: Props) {
  const boxRef = useRef<HTMLDivElement>(null); // 照片的框，等一下請瀏覽器盯著它
  const [nearScreen, setNearScreen] = useState(false); // 框有沒有捲到畫面附近過

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    // 請瀏覽器幫忙盯著這個框：進到畫面、或離畫面不到 200px，就通知我們
    const observer = new IntersectionObserver(
      // 瀏覽器有時會一次送好幾筆（例如很快就捲過去），只要有一筆說「進來了」就算
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNearScreen(true);
          observer.disconnect(); // 看到一次就夠了，不用再盯
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(box);
    // 收拾：卡片不見了（例如換搜別的城市），也不用再盯
    return () => observer.disconnect();
  }, []);

  const { data: photo, isError } = useQuery({
    queryKey: ["photo", destinationId],
    queryFn: () => getDestinationPhoto(destinationId),
    enabled: nearScreen, // 還沒捲到附近，就先不要拿
    staleTime: Infinity, // 這一頁開著的時候，同一個景點不要拿第二次（又算一次額度）
    retry: false,
  });

  return (
    <figure>
      {/* 框的比例先固定好：照片還沒到也先佔好位置，卡片才不會突然變高 */}
      <div ref={boxRef} className="aspect-[16/10] bg-platform">
        {photo && (
          // 點照片：到 Google 地圖看這張照片的大圖
          <a
            href={photo.maps_uri ?? undefined}
            target="_blank"
            rel="noreferrer"
          >
            {/* 不用 next/image：它會把照片抓到我們的伺服器、縮小後存起來，Google 不准存照片 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={name}
              className="h-full w-full object-cover"
            />
          </a>
        )}
        {(photo === null || isError) && (
          <p className="flex h-full items-center justify-center text-sm text-ink-2">
            {isError ? "照片載入失敗" : "沒有照片"}
          </p>
        )}
      </div>

      {/* Google 規定：照片要標出拍照的人，在地圖以外的地方還要寫 Google Maps */}
      {photo && (
        <figcaption className="flex justify-between gap-3 px-4 pt-2 text-xs text-ink-2">
          {photo.author_name && (
            <span className="truncate">
              照片：
              <a
                href={photo.author_uri ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="font-bold hover:underline"
              >
                {photo.author_name}
              </a>
            </span>
          )}
          <span className="ml-auto shrink-0">Google Maps</span>
        </figcaption>
      )}
    </figure>
  );
}
