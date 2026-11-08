import type { Destination } from "@/app/lib/types";

type Props = {
  destination: Destination;
  children?: React.ReactNode; // 卡片右下角要放的東西（例如按鈕），可以不放
};

export default function AttractionCard({ destination, children }: Props) {
  return (
    <div className="flex flex-col rounded-xl bg-white p-5 shadow">
      <h3 className="mb-2 text-xl font-bold">{destination.place_name}</h3>
      <p className="mb-4 line-clamp-3 flex-1 text-sm text-gray-600">
        {destination.description}
      </p>
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-600">
          📍 {destination.geo_tags ?? destination.city_name}
        </span>
        {children}
      </div>
    </div>
  );
}
