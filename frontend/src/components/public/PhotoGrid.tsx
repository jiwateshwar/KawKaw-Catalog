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
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      {photos.map((photo) => (
        <Link
          key={photo.id}
          href={`/photos/${photo.id}`}
          className="group block aspect-square bg-gray-800 overflow-hidden rounded-lg relative"
        >
          {photo.thumb_sm_url ? (
            <img
              src={photo.thumb_sm_url}
              alt={photo.title ?? photo.filename}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
              {photo.thumb_status === "pending" || photo.thumb_status === "processing"
                ? "Processing..."
                : "No preview"}
            </div>
          )}
          {/* Species overlay */}
          {photo.species.length > 0 && (
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-white text-xs truncate">
                {photo.species.map((s) => s.common_name).join(", ")}
              </p>
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}
