import Link from "next/link";
import type { Trip, Location } from "@/types/api";
import { format } from "date-fns";

interface Props {
  trip: Trip;
  location?: Location | null;
}

export function TripCard({ trip, location }: Props) {
  return (
    <Link
      href={`/trips/${trip.id}`}
      className="bg-gray-800 hover:bg-gray-700 rounded-lg p-5 transition-colors block"
    >
      <h3 className="font-semibold text-white">{trip.title}</h3>
      {(trip.start_date || location) && (
        <p className="text-sm text-gray-400 mt-1">
          {trip.start_date && (
            <>
              {format(new Date(trip.start_date), "MMM d, yyyy")}
              {trip.end_date && trip.end_date !== trip.start_date && (
                <> — {format(new Date(trip.end_date), "MMM d, yyyy")}</>
              )}
            </>
          )}
          {trip.start_date && location && " · "}
          {location && `${location.name}${location.country ? `, ${location.country}` : ""}`}
        </p>
      )}
      {trip.description && (
        <p className="text-sm text-gray-400 mt-2 line-clamp-2">{trip.description}</p>
      )}
    </Link>
  );
}
