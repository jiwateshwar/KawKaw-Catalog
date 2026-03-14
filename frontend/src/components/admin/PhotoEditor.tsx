"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminPhotos, adminSpecies, adminLocations, adminTrips } from "@/lib/api";
import type { Photo, Species, Location, Trip } from "@/types/api";

interface Props {
  photo: Photo;
  onClose: () => void;
  onSaved: (updated: Photo) => void;
}

export function PhotoEditor({ photo, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(photo.title ?? "");
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [isPublished, setIsPublished] = useState(photo.is_published);
  const [isFeatured, setIsFeatured] = useState(photo.is_featured);
  const [locationId, setLocationId] = useState<number | "">(photo.location_id ?? "");
  const [tripId, setTripId] = useState<number | "">(photo.trip_id ?? "");
  const [speciesIds, setSpeciesIds] = useState<number[]>(photo.species.map((s) => s.id));
  const [speciesSearch, setSpeciesSearch] = useState("");

  const { data: allSpecies } = useQuery<Species[]>({
    queryKey: ["admin-species"],
    queryFn: () => adminSpecies.list() as Promise<Species[]>,
  });

  const { data: locations } = useQuery<Location[]>({
    queryKey: ["admin-locations"],
    queryFn: () => adminLocations.list() as Promise<Location[]>,
  });

  const { data: trips } = useQuery<Trip[]>({
    queryKey: ["admin-trips"],
    queryFn: () => adminTrips.list() as Promise<Trip[]>,
  });

  const save = useMutation({
    mutationFn: async () => {
      const updated = await adminPhotos.update(photo.id, {
        title: title || null,
        caption: caption || null,
        is_published: isPublished,
        is_featured: isFeatured,
        location_id: locationId || null,
        trip_id: tripId || null,
      }) as Photo;
      await adminPhotos.setSpecies(photo.id, speciesIds);
      return updated;
    },
    onSuccess: (updated) => onSaved(updated),
  });

  const filteredSpecies =
    allSpecies?.filter(
      (s) =>
        !speciesIds.includes(s.id) &&
        (s.common_name.toLowerCase().includes(speciesSearch.toLowerCase()) ||
          (s.scientific_name ?? "").toLowerCase().includes(speciesSearch.toLowerCase()))
    ) ?? [];

  return (
    <aside className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <h2 className="font-medium text-sm">Edit Photo</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">
          ×
        </button>
      </div>

      {/* Preview */}
      <div className="aspect-video bg-gray-800 overflow-hidden">
        {photo.thumb_md_url ? (
          <img src={photo.thumb_md_url} alt={photo.filename} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
            {photo.thumb_status}
          </div>
        )}
      </div>

      <div className="p-4 space-y-4 flex-1">
        {/* Toggles */}
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-300">Published</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-300">Featured</span>
          </label>
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
            placeholder="Add a title..."
          />
        </div>

        {/* Caption */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Caption</label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 resize-none"
            placeholder="Add a caption..."
          />
        </div>

        {/* Location */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Location</label>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value ? Number(e.target.value) : "")}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
          >
            <option value="">— None —</option>
            {locations?.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        {/* Trip */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Trip</label>
          <select
            value={tripId}
            onChange={(e) => setTripId(e.target.value ? Number(e.target.value) : "")}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
          >
            <option value="">— None —</option>
            {trips?.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </div>

        {/* Species tagger */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Species</label>
          {/* Selected tags */}
          <div className="flex flex-wrap gap-1 mb-2">
            {photo.species
              .filter((s) => speciesIds.includes(s.id))
              .map((s) => (
                <span
                  key={s.id}
                  className="bg-brand-600/20 text-brand-400 border border-brand-600/30 text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                >
                  {s.common_name}
                  <button
                    onClick={() => setSpeciesIds((prev) => prev.filter((id) => id !== s.id))}
                    className="hover:text-red-400"
                  >
                    ×
                  </button>
                </span>
              ))}
            {allSpecies
              ?.filter((s) => speciesIds.includes(s.id) && !photo.species.find((ps) => ps.id === s.id))
              .map((s) => (
                <span
                  key={s.id}
                  className="bg-brand-600/20 text-brand-400 border border-brand-600/30 text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                >
                  {s.common_name}
                  <button
                    onClick={() => setSpeciesIds((prev) => prev.filter((id) => id !== s.id))}
                    className="hover:text-red-400"
                  >
                    ×
                  </button>
                </span>
              ))}
          </div>
          {/* Search */}
          <input
            value={speciesSearch}
            onChange={(e) => setSpeciesSearch(e.target.value)}
            placeholder="Search species..."
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
          />
          {speciesSearch && (
            <div className="bg-gray-800 border border-gray-700 rounded mt-1 max-h-32 overflow-auto">
              {filteredSpecies.slice(0, 8).map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSpeciesIds((prev) => [...prev, s.id]);
                    setSpeciesSearch("");
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700"
                >
                  {s.common_name}
                  {s.scientific_name && (
                    <span className="text-gray-500 italic ml-1 text-xs">{s.scientific_name}</span>
                  )}
                </button>
              ))}
              {filteredSpecies.length === 0 && (
                <p className="px-3 py-2 text-xs text-gray-500">No matches</p>
              )}
            </div>
          )}
        </div>

        {/* EXIF info */}
        {(photo.camera_model || photo.captured_at) && (
          <div className="bg-gray-800 rounded p-3 text-xs text-gray-400 space-y-1">
            {photo.camera_model && <div>{photo.camera_make} {photo.camera_model}</div>}
            {photo.lens_model && <div>{photo.lens_model}</div>}
            {photo.focal_length_mm && <div>{photo.focal_length_mm}mm · f/{photo.aperture} · {photo.shutter_speed}s · ISO {photo.iso}</div>}
            {photo.captured_at && <div>{new Date(photo.captured_at).toLocaleDateString()}</div>}
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="p-4 border-t border-gray-800">
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm py-2 rounded-md transition-colors"
        >
          {save.isPending ? "Saving..." : "Save Changes"}
        </button>
        {save.isError && (
          <p className="text-red-400 text-xs mt-2">Failed to save. Try again.</p>
        )}
      </div>
    </aside>
  );
}
