import { notFound } from "next/navigation";
import { PublicNav } from "@/components/public/PublicNav";
import { PhotoGrid } from "@/components/public/PhotoGrid";
import type { Species, PhotoPage } from "@/types/api";

async function getData(id: string) {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://api:8000/api";
  const [spRes, photosRes] = await Promise.all([
    fetch(`${base}/species/${id}`, { next: { revalidate: 120 } }),
    fetch(`${base}/species/${id}/photos?limit=48`, { next: { revalidate: 60 } }),
  ]);
  if (!spRes.ok) return null;
  return {
    species: (await spRes.json()) as Species,
    photos: (photosRes.ok ? await photosRes.json() : { items: [] }) as PhotoPage,
  };
}

export default async function SpeciesDetailPage({ params }: { params: { id: string } }) {
  const data = await getData(params.id);
  if (!data) notFound();
  const { species, photos } = data;

  return (
    <>
      <PublicNav />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{species.common_name}</h1>
          {species.scientific_name && (
            <p className="text-lg italic text-gray-400 mt-1">{species.scientific_name}</p>
          )}
          {species.family && (
            <p className="text-sm text-gray-500 mt-1">
              {species.order_name && <>{species.order_name} · </>}{species.family}
            </p>
          )}
          <p className="text-brand-500 text-sm mt-2">{species.photo_count} published photos</p>
          {species.notes && <p className="text-gray-400 mt-3 max-w-2xl">{species.notes}</p>}
        </div>
        <PhotoGrid photos={photos.items} />
      </main>
    </>
  );
}
