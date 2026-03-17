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
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-10">Albums</h1>

        {albums.length === 0 ? (
          <p className="text-gray-500 text-center py-16">No albums published yet.</p>
        ) : (
          <div className="relative border-l-2 border-gray-800 ml-3 space-y-12 pb-4">
            {albums.map((album) => {
              const loc = album.location_id != null ? locMap.get(album.location_id) : null;
              return (
                <div key={album.id} className="relative flex">
                  {/* Timeline dot */}
                  <div className="absolute -left-[1.125rem] top-2 w-4 h-4 rounded-full bg-brand-500 border-2 border-gray-950 shrink-0 z-10" />

                  {/* Content */}
                  <div className="flex-1 ml-7">
                    <Link href={`/albums/${album.slug}`} className="group block">
                      {/* Header */}
                      <div className="mb-3">
                        <h2 className="text-xl font-semibold text-white group-hover:text-brand-400 transition-colors leading-tight">
                          {album.title}
                        </h2>
                        {(album.shoot_date || loc) && (
                          <p className="text-sm text-gray-400 mt-0.5">
                            {album.shoot_date && format(parseISO(album.shoot_date), "d MMMM yyyy")}
                            {album.shoot_date && loc && " · "}
                            {loc && `${loc.name}${loc.country ? `, ${loc.country}` : ""}`}
                          </p>
                        )}
                        {album.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                            {album.description}
                          </p>
                        )}
                      </div>

                      {/* Image strip */}
                      {album.preview_photos.length > 0 && (
                        <div className="flex gap-1 h-44 rounded-lg overflow-hidden">
                          {album.preview_photos.map((url, i) => (
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
