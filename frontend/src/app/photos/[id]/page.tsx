export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { PublicNav } from "@/components/public/PublicNav";
import type { Photo } from "@/types/api";
import { format } from "date-fns";

async function getPhoto(id: string): Promise<Photo | null> {
  const base = `${process.env.INTERNAL_API_URL ?? "http://api:8000"}/api`;
  const res = await fetch(`${base}/photos/${id}`, { next: { revalidate: 60 } });
  if (!res.ok) return null;
  return res.json();
}

export default async function PhotoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const photo = await getPhoto(id);
  if (!photo) notFound();

  return (
    <>
      <PublicNav />
      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Image */}
        <div className="lg:col-span-2">
          {photo.thumb_lg_url ? (
            <img
              src={photo.thumb_lg_url}
              alt={photo.title ?? photo.filename}
              className="w-full rounded-lg object-contain max-h-[80vh]"
            />
          ) : (
            <div className="w-full aspect-video bg-gray-800 rounded-lg flex items-center justify-center text-gray-500">
              {photo.thumb_status === "pending" ? "Processing thumbnail..." : "No preview"}
            </div>
          )}
          {photo.caption && (
            <p className="text-gray-400 mt-3 text-sm">{photo.caption}</p>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          {photo.title && <h1 className="text-2xl font-bold">{photo.title}</h1>}

          {/* Species */}
          {photo.species.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-2">Species</h3>
              <div className="flex flex-wrap gap-2">
                {photo.species.map((s) => (
                  <Link
                    key={s.id}
                    href={`/species/${s.id}`}
                    className="bg-brand-600/20 text-brand-400 hover:bg-brand-600/30 border border-brand-600/30 text-sm px-3 py-1 rounded-full transition-colors"
                  >
                    {s.common_name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Camera metadata */}
          <div>
            <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-2">Camera Info</h3>
            <dl className="space-y-1">
              {photo.camera_model && (
                <MetaRow label="Camera" value={`${photo.camera_make ?? ""} ${photo.camera_model}`.trim()} />
              )}
              {photo.lens_model && <MetaRow label="Lens" value={photo.lens_model} />}
              {photo.focal_length_mm && <MetaRow label="Focal length" value={`${photo.focal_length_mm}mm`} />}
              {photo.aperture && <MetaRow label="Aperture" value={`f/${photo.aperture}`} />}
              {photo.shutter_speed && <MetaRow label="Shutter" value={photo.shutter_speed + "s"} />}
              {photo.iso && <MetaRow label="ISO" value={String(photo.iso)} />}
              {photo.captured_at && (
                <MetaRow label="Date" value={format(new Date(photo.captured_at), "PPP")} />
              )}
            </dl>
          </div>

          {/* Trip link */}
          {photo.trip_id && (
            <Link
              href={`/trips/${photo.trip_id}`}
              className="block text-sm text-brand-400 hover:underline"
            >
              View this trip →
            </Link>
          )}
        </aside>
      </main>
    </>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-200 text-right">{value}</dd>
    </div>
  );
}
