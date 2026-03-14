import { PublicNav } from "@/components/public/PublicNav";
import { TripCard } from "@/components/public/TripCard";
import type { Trip } from "@/types/api";

async function getTrips(): Promise<Trip[]> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://api:8000/api";
  const res = await fetch(`${base}/trips?limit=50`, { next: { revalidate: 120 } });
  if (!res.ok) return [];
  return res.json();
}

export default async function TripsPage() {
  const trips = await getTrips();

  return (
    <>
      <PublicNav />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Trips</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {trips.map((t) => <TripCard key={t.id} trip={t} />)}
        </div>
        {trips.length === 0 && (
          <p className="text-gray-500 text-center py-16">No trips published yet.</p>
        )}
      </main>
    </>
  );
}
