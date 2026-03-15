export const dynamic = "force-dynamic";

import { PublicNav } from "@/components/public/PublicNav";
import Link from "next/link";
import type { Album, Location } from "@/types/api";
import { format, parseISO } from "date-fns";

async function getData() {
  const base = `${process.env.INTERNAL_API_URL ?? "http://api:8000"}/api`;
  const [albumsRes, locationsRes] = await Promise.all([
    fetch(`${base}/albums`, { next: { revalidate: 120 } }),
    fetch(`${base}/locations`, { next: { revalidate: 120 } }),
  ]);
  const albums: Album[] = albumsRes.ok ? await albumsRes.json() : [];
  const locations: Location[] = locationsRes.ok ? await locationsRes.json() : [];
  return { albums, locations };
}

export default async function AlbumsPage() {
  const { albums, locations } = await getData();
  const locMap = new Map(locations.map((l) => [l.id, l]));

  return (
    <>
      <PublicNav />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Albums</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {albums.map((album) => {
            const loc = album.location_id != null ? locMap.get(album.location_id) : null;
            return (
              <Link
                key={album.id}
                href={`/albums/${album.slug}`}
                className="bg-gray-800 hover:bg-gray-700 rounded-lg p-5 transition-colors block"
              >
                <h3 className="font-semibold text-white">{album.title}</h3>
                {(album.shoot_date || loc) && (
                  <p className="text-sm text-gray-400 mt-1">
                    {album.shoot_date && format(parseISO(album.shoot_date), "MMM yyyy")}
                    {album.shoot_date && loc && " · "}
                    {loc && `${loc.name}${loc.country ? `, ${loc.country}` : ""}`}
                  </p>
                )}
                {album.description && (
                  <p className="text-sm text-gray-500 mt-1.5 line-clamp-2">
                    {album.description}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
        {albums.length === 0 && (
          <p className="text-gray-500 text-center py-16">No albums published yet.</p>
        )}
      </main>
    </>
  );
}
