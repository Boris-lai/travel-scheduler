import type { Destination } from "@/app/lib/types";

type Props = {
  destination: Destination;
};

export default function AttractionCard({ destination }: Props) {
  return (
    <div className="rounded-xl bg-white p-5 shadow">
      <h3 className="mb-2 text-xl font-bold">{destination.place_name}</h3>
      <p className="mb-4 line-clamp-3 text-sm text-gray-600">
        {destination.description}
      </p>
      <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-600">
        📍 {destination.geo_tags ?? destination.city_name}
      </span>
    </div>
  );
}
