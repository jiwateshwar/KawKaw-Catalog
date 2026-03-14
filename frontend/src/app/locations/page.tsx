export const dynamic = "force-dynamic";

import { PublicNav } from "@/components/public/PublicNav";
import Link from "next/link";
import type { Location } from "@/types/api";

async function getLocations(): Promise<Location[]> {
  const base = `${process.env.INTERNAL_API_URL ?? "http://api:8000"}/api`;
  const res = await fetch(`${base}/locations`, { next: { revalidate: 120 } });
  if (!res.ok) return [];
  return res.json();
}

export default async function LocationsPage() {
  const locations = await getLocations();

  return (
    <>
      <PublicNav />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Locations</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className="bg-gray-800 rounded-lg p-5"
            >
              <h3 className="font-semibold text-white">{loc.name}</h3>
              {(loc.country || loc.region) && (
                <p className="text-sm text-gray-400 mt-0.5">
                  {[loc.region, loc.country].filter(Boolean).join(", ")}
                </p>
              )}
              <p className="text-sm text-brand-500 mt-2">{loc.photo_count} photos</p>
            </div>
          ))}
        </div>
        {locations.length === 0 && (
          <p className="text-gray-500 text-center py-16">No locations yet.</p>
        )}
      </main>
    </>
  );
}
