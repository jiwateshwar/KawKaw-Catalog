"use client";

import Link from "next/link";
import type { Photo } from "@/types/api";

interface Props {
  photos: Photo[];
}

export function PhotoGrid({ photos }: Props) {
  if (photos.length === 0) {
    return <p className="text-gray-500 text-center py-12">No photos yet.</p>;
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "15px",
        alignItems: "start",
      }}
    >
      {photos.map((photo) => {
        const hasRatio = photo.width && photo.height;
        const aspectRatio = hasRatio
          ? `${photo.width} / ${photo.height}`
          : "4 / 3";

        const firstSpecies = photo.species[0] ?? null;

        return (
          <Link
            key={photo.id}
            href={`/photos/${photo.id}`}
            className="group relative block overflow-hidden rounded-lg bg-gray-800"
            style={{ aspectRatio }}
          >
            {photo.thumb_md_url ? (
              <img
                src={photo.thumb_md_url}
                alt={photo.title ?? photo.filename}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
                {photo.thumb_status === "pending" || photo.thumb_status === "processing"
                  ? "Processing…"
                  : "No preview"}
              </div>
            )}

            {firstSpecies && (
              <div
                style={{ pointerEvents: "none" }}
                className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pt-10 pb-3 px-3"
              >
                <p className="text-white text-sm font-medium leading-snug truncate drop-shadow">
                  {firstSpecies.common_name}
                </p>
                {firstSpecies.scientific_name && (
                  <p className="text-gray-300 text-xs italic leading-snug truncate drop-shadow mt-0.5">
                    {firstSpecies.scientific_name}
                  </p>
                )}
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}
