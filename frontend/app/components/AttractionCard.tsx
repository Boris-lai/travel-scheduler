import PlacePhoto from "@/app/components/PlacePhoto";
import type { Destination } from "@/app/lib/types";

type Props = {
  destination: Destination;
  children?: React.ReactNode; // 卡片最下面要放的東西（例如「加入＋」），可以不放
};

// 一個景點：像車站的站牌，白底細框，站名用最粗的字
export default function AttractionCard({ destination, children }: Props) {
  return (
    <article className="flex flex-col overflow-hidden rounded-md border border-rule bg-board">
      <PlacePhoto
        destinationId={destination.id}
        name={destination.place_name}
      />
      <div className="flex-1 p-4">
        <h3 className="text-lg leading-snug font-black">
          {destination.place_name}
        </h3>
        <p className="mt-1 text-sm text-ink-2">
          {destination.geo_tags ?? destination.city_name}
        </p>
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed">
          {destination.description}
        </p>
      </div>
      {/* 有按鈕才多一條底下的區塊 */}
      {children && (
        <div className="flex justify-end border-t border-rule px-4 py-2">
          {children}
        </div>
      )}
    </article>
  );
}
