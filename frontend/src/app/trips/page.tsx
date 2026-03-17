export const dynamic = "force-dynamic";

import { PublicNav } from "@/components/public/PublicNav";
import Link from "next/link";
import type { Trip, Location } from "@/types/api";
import { format, parseISO } from "date-fns";

async function getData() {
  const base = `${process.env.INTERNAL_API_URL ?? "http://api:8000"}/api`;
  const [tripsRes, locationsRes] = await Promise.all([
    fetch(`${base}/trips?limit=50`, { next: { revalidate: 120 } }),
    fetch(`${base}/locations`, { next: { revalidate: 120 } }),
  ]);
  const trips: Trip[] = tripsRes.ok ? await tripsRes.json() : [];
  const locations: Location[] = locationsRes.ok ? await locationsRes.json() : [];
  return { trips, locations };
}

export default async function TripsPage() {
  const { trips, locations } = await getData();
  const locMap = new Map(locations.map((l) => [l.id, l]));

  return (
    <>
      <PublicNav />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-10">Trips</h1>

        {trips.length === 0 ? (
          <p className="text-gray-500 text-center py-16">No trips published yet.</p>
        ) : (
          <div className="relative border-l-2 border-gray-800 ml-3 space-y-12 pb-4">
            {trips.map((trip) => {
              const loc = trip.location_id != null ? locMap.get(trip.location_id) : null;
              return (
                <div key={trip.id} className="relative flex">
                  {/* Timeline dot */}
                  <div className="absolute -left-[1.125rem] top-2 w-4 h-4 rounded-full bg-brand-500 border-2 border-gray-950 shrink-0 z-10" />

                  {/* Content */}
                  <div className="flex-1 ml-7">
                    <Link href={`/trips/${trip.id}`} className="group block">
                      {/* Header */}
                      <div className="mb-3">
                        <h2 className="text-xl font-semibold text-white group-hover:text-brand-400 transition-colors leading-tight">
                          {trip.title}
                        </h2>
                        {(trip.start_date || loc) && (
                          <p className="text-sm text-gray-400 mt-0.5">
                            {trip.start_date && (
                              <>
                                {format(parseISO(trip.start_date), "d MMMM yyyy")}
                                {trip.end_date && trip.end_date !== trip.start_date && (
                                  <> — {format(parseISO(trip.end_date), "d MMMM yyyy")}</>
                                )}
                              </>
                            )}
                            {trip.start_date && loc && " · "}
                            {loc && `${loc.name}${loc.country ? `, ${loc.country}` : ""}`}
                          </p>
                        )}
                        {trip.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                            {trip.description}
                          </p>
                        )}
                      </div>

                      {/* Image strip */}
                      {trip.preview_photos.length > 0 && (
                        <div className="flex gap-1 h-44 rounded-lg overflow-hidden">
                          {trip.preview_photos.map((url, i) => (
                            <div key={i} className="flex-1 min-w-0 overflow-hidden">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={url}
                                alt=""
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
