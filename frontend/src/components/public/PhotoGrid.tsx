"use client";

import Link from "next/link";
import type { Photo } from "@/types/api";

interface Props {
  photos: Photo[];
}

type Orientation = "landscape" | "portrait" | "square";

function getOrientation(photo: Photo): Orientation {
  if (!photo.width || !photo.height) return "square";
  const ratio = photo.width / photo.height;
  if (ratio > 1.25) return "landscape"; // wider than tall
  if (ratio < 0.80) return "portrait";  // noticeably taller than wide
  return "square";
}

const GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gridAutoFlow: "dense",
  gridAutoRows: "260px",
  gap: "15px",
};

function cellStyle(orientation: Orientation): React.CSSProperties {
  if (orientation === "landscape") return { gridColumn: "span 2" };
  if (orientation === "portrait")  return { gridRow: "span 2" };
  return {};
}

export function PhotoGrid({ photos }: Props) {
  if (photos.length === 0) {
    return <p className="text-gray-500 text-center py-12">No photos yet.</p>;
  }

  return (
    <>
      {/* On screens narrower than 600px collapse all spans so nothing overflows */}
      <style>{`
        @media (max-width: 600px) {
          .kk-photo-grid > a {
            grid-column: span 1 !important;
            grid-row: span 1 !important;
          }
        }
      `}</style>

      <div className="kk-photo-grid" style={GRID_STYLE}>
        {photos.map((photo) => {
          const orientation = getOrientation(photo);
          const firstSpecies = photo.species[0] ?? null;

          return (
            <Link
              key={photo.id}
              href={`/photos/${photo.id}`}
              style={cellStyle(orientation)}
              className="group relative block overflow-hidden rounded-lg bg-gray-800"
            >
              {photo.thumb_md_url ? (
                <img
                  src={photo.thumb_md_url}
                  alt={photo.title ?? photo.filename}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  className="group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
                  {photo.thumb_status === "pending" || photo.thumb_status === "processing"
                    ? "Processing…"
                    : "No preview"}
                </div>
              )}

              {/* Species label — always visible */}
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
    </>
  );
}
