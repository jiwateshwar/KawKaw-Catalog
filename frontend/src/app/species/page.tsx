import { PublicNav } from "@/components/public/PublicNav";
import Link from "next/link";
import type { Species } from "@/types/api";

async function getSpecies(): Promise<Species[]> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://api:8000/api";
  const res = await fetch(`${base}/species?limit=200`, { next: { revalidate: 120 } });
  if (!res.ok) return [];
  return res.json();
}

export default async function SpeciesPage() {
  const speciesList = await getSpecies();

  return (
    <>
      <PublicNav />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Species</h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {speciesList.map((sp) => (
            <Link
              key={sp.id}
              href={`/species/${sp.id}`}
              className="bg-gray-800 hover:bg-gray-700 rounded-lg p-4 transition-colors"
            >
              <div className="font-semibold text-white">{sp.common_name}</div>
              {sp.scientific_name && (
                <div className="text-xs italic text-gray-400 mt-0.5">{sp.scientific_name}</div>
              )}
              {sp.family && (
                <div className="text-xs text-gray-500 mt-0.5">{sp.family}</div>
              )}
              <div className="text-xs text-brand-500 mt-2">{sp.photo_count} photos</div>
            </Link>
          ))}
        </div>
        {speciesList.length === 0 && (
          <p className="text-gray-500 text-center py-16">No species added yet.</p>
        )}
      </main>
    </>
  );
}
