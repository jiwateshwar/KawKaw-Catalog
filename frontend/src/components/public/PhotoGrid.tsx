"use client";

import Link from "next/link";
import type { Photo } from "@/types/api";

interface Props {
  photos: Photo[];
}

function isLandscape(photo: Photo): boolean {
  if (photo.width && photo.height) return photo.width > photo.height;
  return false; // unknown dimensions → treat as portrait
}

export function PhotoGrid({ photos }: Props) {
  if (photos.length === 0) {
    return <p className="text-gray-500 text-center py-12">No photos yet.</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 auto-rows-auto"
         style={{ gridAutoFlow: "dense" }}>
      {photos.map((photo) => {
        const landscape = isLandscape(photo);
        const firstSpecies = photo.species[0] ?? null;

        return (
          <Link
            key={photo.id}
            href={`/photos/${photo.id}`}
            className={[
              "group relative block overflow-hidden rounded-lg bg-gray-800",
              landscape ? "col-span-2 aspect-[3/2]" : "col-span-1 aspect-[2/3]",
            ].join(" ")}
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

            {/* Species label — always visible at bottom */}
            {firstSpecies && (
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent pt-8 pb-3 px-3">
                <p className="text-white text-sm font-medium leading-tight truncate">
                  {firstSpecies.common_name}
                </p>
                {firstSpecies.scientific_name && (
                  <p className="text-gray-300 text-xs italic leading-tight truncate mt-0.5">
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
