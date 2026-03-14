"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminPhotos } from "@/lib/api";
import type { Photo, PhotoPage } from "@/types/api";
import { PhotoEditor } from "@/components/admin/PhotoEditor";

const TABS = [
  { label: "All", filter: {} },
  { label: "Unpublished", filter: { is_published: false } },
  { label: "Published", filter: { is_published: true } },
  { label: "Pending Thumbnails", filter: { thumb_status: "pending" } },
];

export default function AdminPhotosPage() {
  const [tab, setTab] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<PhotoPage>({
    queryKey: ["admin-photos", tab],
    queryFn: () =>
      adminPhotos.list(TABS[tab].filter) as Promise<PhotoPage>,
    refetchInterval: 10000,
  });

  const bulkPublish = useMutation({
    mutationFn: ({ ids, publish }: { ids: number[]; publish: boolean }) =>
      adminPhotos.bulkPublish(ids, publish),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-photos"] });
      setSelected(new Set());
    },
  });

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allIds = data?.items.map((p) => p.id) ?? [];
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  return (
    <div className="flex h-full">
      {/* Photo list */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">Photos</h1>
          {selected.size > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => bulkPublish.mutate({ ids: [...selected], publish: true })}
                className="bg-brand-600 hover:bg-brand-700 text-white text-xs px-3 py-1.5 rounded transition-colors"
              >
                Publish {selected.size}
              </button>
              <button
                onClick={() => bulkPublish.mutate({ ids: [...selected], publish: false })}
                className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1.5 rounded transition-colors"
              >
                Unpublish {selected.size}
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-gray-800">
          {TABS.map((t, i) => (
            <button
              key={i}
              onClick={() => { setTab(i); setSelected(new Set()); }}
              className={`px-4 py-2 text-sm transition-colors ${
                tab === i
                  ? "border-b-2 border-brand-500 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Select all */}
        {data && data.items.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() =>
                setSelected(allSelected ? new Set() : new Set(allIds))
              }
              className="rounded"
            />
            <span className="text-sm text-gray-400">Select all ({data.items.length})</span>
          </div>
        )}

        {isLoading ? (
          <p className="text-gray-500">Loading...</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {data?.items.map((photo) => (
              <div
                key={photo.id}
                className={`relative group aspect-square bg-gray-800 rounded overflow-hidden cursor-pointer ${
                  selected.has(photo.id) ? "ring-2 ring-brand-500" : ""
                }`}
              >
                <div
                  className="absolute inset-0"
                  onClick={() => setEditingPhoto(photo)}
                >
                  {photo.thumb_sm_url ? (
                    <img
                      src={photo.thumb_sm_url}
                      alt={photo.filename}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs p-1 text-center">
                      {photo.thumb_status === "pending" ? "Pending" : "No thumb"}
                    </div>
                  )}
                </div>

                {/* Checkbox */}
                <div
                  className="absolute top-1 left-1 z-10"
                  onClick={(e) => { e.stopPropagation(); toggleSelect(photo.id); }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(photo.id)}
                    readOnly
                    className="rounded"
                  />
                </div>

                {/* Published indicator */}
                {photo.is_published && (
                  <div className="absolute top-1 right-1 w-2 h-2 bg-brand-500 rounded-full" />
                )}

                {/* Species count */}
                {photo.species.length > 0 && (
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 text-xs text-center py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {photo.species.map((s) => s.common_name).join(", ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {data?.items.length === 0 && !isLoading && (
          <p className="text-gray-500 text-center py-16">
            No photos here.{" "}
            <a href="/admin/scans" className="text-brand-400 hover:underline">
              Import a folder →
            </a>
          </p>
        )}
      </div>

      {/* Photo editor panel */}
      {editingPhoto && (
        <PhotoEditor
          photo={editingPhoto}
          onClose={() => setEditingPhoto(null)}
          onSaved={(updated) => {
            setEditingPhoto(updated);
            qc.invalidateQueries({ queryKey: ["admin-photos"] });
          }}
        />
      )}
    </div>
  );
}
