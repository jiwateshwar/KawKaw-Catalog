import { PublicNav } from "@/components/public/PublicNav";
import Link from "next/link";
import type { Album } from "@/types/api";

async function getAlbums(): Promise<Album[]> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://api:8000/api";
  const res = await fetch(`${base}/albums`, { next: { revalidate: 120 } });
  if (!res.ok) return [];
  return res.json();
}

export default async function AlbumsPage() {
  const albums = await getAlbums();

  return (
    <>
      <PublicNav />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Albums</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {albums.map((album) => (
            <Link
              key={album.id}
              href={`/albums/${album.slug}`}
              className="bg-gray-800 hover:bg-gray-700 rounded-lg p-5 transition-colors block"
            >
              <h3 className="font-semibold text-white">{album.title}</h3>
              {album.description && (
                <p className="text-sm text-gray-400 mt-1 line-clamp-2">{album.description}</p>
              )}
            </Link>
          ))}
        </div>
        {albums.length === 0 && (
          <p className="text-gray-500 text-center py-16">No albums published yet.</p>
        )}
      </main>
    </>
  );
}
