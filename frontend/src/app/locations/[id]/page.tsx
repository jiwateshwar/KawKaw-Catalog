export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { PublicNav } from "@/components/public/PublicNav";
import { PhotoGrid } from "@/components/public/PhotoGrid";
import type { Location, PhotoPage } from "@/types/api";

async function getData(id: string) {
  const base = `${process.env.INTERNAL_API_URL ?? "http://api:8000"}/api`;
  const [locRes, photosRes] = await Promise.all([
    fetch(`${base}/locations/${id}`, { next: { revalidate: 120 } }),
    fetch(`${base}/photos?location_id=${id}&limit=48`, { next: { revalidate: 60 } }),
  ]);
  if (!locRes.ok) return null;
  const location = (await locRes.json()) as Location;
  const photos = (photosRes.ok ? await photosRes.json() : { items: [] }) as PhotoPage;
  return { location, photos };
}

export default async function LocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getData(id);
  if (!data) notFound();
  const { location, photos } = data;

  return (
    <>
      <PublicNav />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{location.name}</h1>
          {(location.region || location.country) && (
            <p className="text-gray-400 mt-1 text-sm">
              {[location.region, location.country].filter(Boolean).join(", ")}
            </p>
          )}
          {location.latitude != null && location.longitude != null && (
            <a
              href={`https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}&zoom=12`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs text-brand-500 hover:text-brand-400 mt-1"
            >
              {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)} ↗
            </a>
          )}
          <p className="text-sm text-gray-500 mt-2">{location.photo_count} photos</p>
        </div>
        <PhotoGrid photos={photos.items} />
      </main>
    </>
  );
}
