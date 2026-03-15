export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { PublicNav } from "@/components/public/PublicNav";
import type { Photo } from "@/types/api";
import { format } from "date-fns";
import type { Metadata } from "next";

const SITE_URL = process.env.SITE_URL ?? "http://localhost:3000";

async function getPhoto(id: string): Promise<Photo | null> {
  const base = `${process.env.INTERNAL_API_URL ?? "http://api:8000"}/api`;
  const res = await fetch(`${base}/photos/${id}`, { next: { revalidate: 60 } });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const photo = await getPhoto(id);
  if (!photo) return {};

  const title =
    photo.title ??
    photo.species[0]?.common_name ??
    photo.filename;
  const description =
    photo.caption ??
    (photo.species.length > 0
      ? photo.species.map((s) => s.common_name).join(", ")
      : undefined);
  const pageUrl = `${SITE_URL}/photos/${id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: pageUrl,
      images: photo.thumb_lg_url
        ? [{ url: photo.thumb_lg_url.startsWith("http") ? photo.thumb_lg_url : `${SITE_URL}${photo.thumb_lg_url}` }]
        : [],
      type: "article",
    },
  };
}

export default async function PhotoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const photo = await getPhoto(id);
  if (!photo) notFound();

  const pageUrl = `${SITE_URL}/photos/${id}`;
  const waMessage = photo.title ? `${photo.title} — ${pageUrl}` : pageUrl;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(waMessage)}`;

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

          {/* Share */}
          <div>
            <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-2">Share</h3>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.121 1.532 5.85L.057 23.486a.75.75 0 0 0 .918.918l5.701-1.476A11.943 11.943 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.694 9.694 0 0 1-4.945-1.352l-.355-.21-3.683.953.977-3.596-.23-.369A9.694 9.694 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z" />
              </svg>
              Share on WhatsApp
            </a>
          </div>
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
