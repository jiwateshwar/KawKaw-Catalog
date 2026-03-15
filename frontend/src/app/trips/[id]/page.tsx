export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { PublicNav } from "@/components/public/PublicNav";
import { PhotoGrid } from "@/components/public/PhotoGrid";
import type { Trip, Location, PhotoPage } from "@/types/api";
import { format } from "date-fns";

async function getData(id: string) {
  const base = `${process.env.INTERNAL_API_URL ?? "http://api:8000"}/api`;
  const [tripRes, photosRes, locationsRes] = await Promise.all([
    fetch(`${base}/trips/${id}`, { next: { revalidate: 120 } }),
    fetch(`${base}/trips/${id}/photos?limit=48`, { next: { revalidate: 60 } }),
    fetch(`${base}/locations`, { next: { revalidate: 120 } }),
  ]);
  if (!tripRes.ok) return null;
  const trip = (await tripRes.json()) as Trip;
  const photos = (photosRes.ok ? await photosRes.json() : { items: [] }) as PhotoPage;
  const locations: Location[] = locationsRes.ok ? await locationsRes.json() : [];
  const location = trip.location_id != null
    ? (locations.find((l) => l.id === trip.location_id) ?? null)
    : null;
  return { trip, photos, location };
}

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getData(id);
  if (!data) notFound();
  const { trip, photos, location } = data;

  return (
    <>
      <PublicNav />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{trip.title}</h1>
          {(trip.start_date || location) && (
            <p className="text-gray-400 mt-1 text-sm">
              {trip.start_date && (
                <>
                  {format(new Date(trip.start_date), "PPP")}
                  {trip.end_date && trip.end_date !== trip.start_date && (
                    <> — {format(new Date(trip.end_date), "PPP")}</>
                  )}
                </>
              )}
              {trip.start_date && location && " · "}
              {location && `${location.name}${location.country ? `, ${location.country}` : ""}`}
            </p>
          )}
          {trip.description && (
            <p className="text-gray-400 mt-3 max-w-2xl">{trip.description}</p>
          )}
        </div>
        <PhotoGrid photos={photos.items} />
      </main>
    </>
  );
}
