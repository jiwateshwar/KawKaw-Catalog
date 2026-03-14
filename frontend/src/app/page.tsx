import { PublicNav } from "@/components/public/PublicNav";
import { PhotoGrid } from "@/components/public/PhotoGrid";
import { TripCard } from "@/components/public/TripCard";
import type { Photo, Trip, Species } from "@/types/api";

async function getData() {
  const base = `${process.env.INTERNAL_API_URL ?? "http://api:8000"}/api`;

  const [featuredRes, recentRes, tripsRes, speciesRes] = await Promise.allSettled([
    fetch(`${base}/photos/featured?limit=1`, { next: { revalidate: 300 } }),
    fetch(`${base}/photos?limit=12`, { next: { revalidate: 60 } }),
    fetch(`${base}/trips?limit=6`, { next: { revalidate: 300 } }),
    fetch(`${base}/species?limit=8`, { next: { revalidate: 300 } }),
  ]);

  const featured: Photo[] =
    featuredRes.status === "fulfilled" && featuredRes.value.ok
      ? await featuredRes.value.json()
      : [];
  const recent =
    recentRes.status === "fulfilled" && recentRes.value.ok
      ? await recentRes.value.json()
      : { items: [] };
  const trips: Trip[] =
    tripsRes.status === "fulfilled" && tripsRes.value.ok
      ? await tripsRes.value.json()
      : [];
  const speciesList: Species[] =
    speciesRes.status === "fulfilled" && speciesRes.value.ok
      ? await speciesRes.value.json()
      : [];

  return { featured, recent, trips, speciesList };
}

export default async function Home() {
  const { featured, recent, trips, speciesList } = await getData();
  const hero = featured[0] ?? null;

  return (
    <>
      <PublicNav />
      <main className="max-w-7xl mx-auto px-4 pb-16">
        {/* Hero */}
        {hero && (
          <section className="relative -mx-4 mb-12 overflow-hidden h-[70vh] max-h-[640px]">
            {hero.thumb_lg_url ? (
              <img
                src={hero.thumb_lg_url}
                alt={hero.title ?? hero.filename}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-600">
                No featured photo
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-gray-950/80 via-transparent" />
            <div className="absolute bottom-8 left-8 right-8">
              <div className="flex flex-wrap gap-2 mb-3">
                {hero.species.map((s) => (
                  <span key={s.id} className="bg-brand-600/80 text-white text-xs px-2 py-1 rounded-full">
                    {s.common_name}
                  </span>
                ))}
              </div>
              {hero.title && (
                <h1 className="text-3xl font-bold text-white">{hero.title}</h1>
              )}
              {hero.caption && (
                <p className="text-gray-300 mt-1 max-w-2xl">{hero.caption}</p>
              )}
            </div>
          </section>
        )}

        {/* Recently Published */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Recently Published</h2>
          <PhotoGrid photos={recent.items} />
        </section>

        {/* Latest Trips */}
        {trips.length > 0 && (
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-6">Latest Trips</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {trips.map((t) => (
                <TripCard key={t.id} trip={t} />
              ))}
            </div>
          </section>
        )}

        {/* Browse by Species */}
        {speciesList.length > 0 && (
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-6">Browse by Species</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {speciesList.map((sp) => (
                <a
                  key={sp.id}
                  href={`/species/${sp.id}`}
                  className="bg-gray-800 hover:bg-gray-700 rounded-lg p-4 transition-colors"
                >
                  <div className="font-medium text-white">{sp.common_name}</div>
                  {sp.scientific_name && (
                    <div className="text-xs text-gray-400 italic mt-0.5">{sp.scientific_name}</div>
                  )}
                  <div className="text-xs text-brand-500 mt-2">{sp.photo_count} photos</div>
                </a>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
