export const dynamic = "force-dynamic";

import { PublicNav } from "@/components/public/PublicNav";
import { TripCard } from "@/components/public/TripCard";
import type { Trip, Location } from "@/types/api";

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
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Trips</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {trips.map((t) => (
            <TripCard
              key={t.id}
              trip={t}
              location={t.location_id != null ? locMap.get(t.location_id) : null}
            />
          ))}
        </div>
        {trips.length === 0 && (
          <p className="text-gray-500 text-center py-16">No trips published yet.</p>
        )}
      </main>
    </>
  );
}
