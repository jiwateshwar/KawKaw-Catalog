export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { PublicNav } from "@/components/public/PublicNav";
import { PhotoGrid } from "@/components/public/PhotoGrid";
import type { Album, PhotoPage } from "@/types/api";

async function getData(slug: string) {
  const base = `${process.env.INTERNAL_API_URL ?? "http://api:8000"}/api`;
  const [albumRes, photosRes] = await Promise.all([
    fetch(`${base}/albums/${slug}`, { next: { revalidate: 120 } }),
    fetch(`${base}/albums/${slug}/photos?limit=48`, { next: { revalidate: 60 } }),
  ]);
  if (!albumRes.ok) return null;
  return {
    album: (await albumRes.json()) as Album,
    photos: (photosRes.ok ? await photosRes.json() : { items: [] }) as PhotoPage,
  };
}

export default async function AlbumPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getData(slug);
  if (!data) notFound();
  const { album, photos } = data;

  return (
    <>
      <PublicNav />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{album.title}</h1>
          {album.description && (
            <p className="text-gray-400 mt-2 max-w-2xl">{album.description}</p>
          )}
        </div>
        <PhotoGrid photos={photos.items} />
      </main>
    </>
  );
}
