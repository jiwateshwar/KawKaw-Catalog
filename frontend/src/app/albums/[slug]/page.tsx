export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { PublicNav } from "@/components/public/PublicNav";
import { PhotoGrid } from "@/components/public/PhotoGrid";
import type { Album, Location, PhotoPage } from "@/types/api";
import { format, parseISO } from "date-fns";

async function getData(slug: string) {
  const base = `${process.env.INTERNAL_API_URL ?? "http://api:8000"}/api`;
  const [albumRes, photosRes, locationsRes] = await Promise.all([
    fetch(`${base}/albums/${slug}`, { next: { revalidate: 120 } }),
    fetch(`${base}/albums/${slug}/photos?limit=48`, { next: { revalidate: 60 } }),
    fetch(`${base}/locations`, { next: { revalidate: 120 } }),
  ]);
  if (!albumRes.ok) return null;
  const album = (await albumRes.json()) as Album;
  const photos = (photosRes.ok ? await photosRes.json() : { items: [] }) as PhotoPage;
  const locations: Location[] = locationsRes.ok ? await locationsRes.json() : [];
  const location = album.location_id != null
    ? (locations.find((l) => l.id === album.location_id) ?? null)
    : null;
  return { album, photos, location };
}

export default async function AlbumPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getData(slug);
  if (!data) notFound();
  const { album, photos, location } = data;

  return (
    <>
      <PublicNav />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{album.title}</h1>
          {(album.shoot_date || location) && (
            <p className="text-gray-400 mt-1 text-sm">
              {album.shoot_date && format(parseISO(album.shoot_date), "d MMMM yyyy")}
              {album.shoot_date && location && " · "}
              {location && `${location.name}${location.country ? `, ${location.country}` : ""}`}
            </p>
          )}
          {album.description && (
            <p className="text-gray-400 mt-2 max-w-2xl">{album.description}</p>
          )}
        </div>
        <PhotoGrid photos={photos.items} />
      </main>
    </>
  );
}
