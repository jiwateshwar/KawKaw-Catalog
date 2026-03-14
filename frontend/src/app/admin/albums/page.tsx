"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAlbums } from "@/lib/api";
import type { Album } from "@/types/api";

export default function AdminAlbumsPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const { data: albums, isLoading } = useQuery<Album[]>({
    queryKey: ["admin-albums"],
    queryFn: () => adminAlbums.list() as Promise<Album[]>,
  });

  const create = useMutation({
    mutationFn: () =>
      adminAlbums.create({ title: newTitle, slug: newSlug || slugify(newTitle), description: newDesc || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-albums"] });
      setCreating(false); setNewTitle(""); setNewSlug(""); setNewDesc("");
    },
  });

  const togglePublish = useMutation({
    mutationFn: ({ id, val }: { id: number; val: boolean }) =>
      adminAlbums.update(id, { is_published: val }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-albums"] }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => adminAlbums.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-albums"] }),
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Albums</h1>
        <button
          onClick={() => setCreating(true)}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm px-4 py-2 rounded-md transition-colors"
        >
          + New Album
        </button>
      </div>

      {creating && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Title *</label>
              <input
                value={newTitle}
                onChange={(e) => { setNewTitle(e.target.value); if (!newSlug) setNewSlug(slugify(e.target.value)); }}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Slug *</label>
              <input
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Description</label>
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => newTitle && create.mutate()}
              disabled={!newTitle || create.isPending}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded transition-colors"
            >
              Create
            </button>
            <button onClick={() => setCreating(false)} className="text-gray-400 text-sm px-3 py-2">
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="space-y-2">
          {albums?.map((album) => (
            <div key={album.id} className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 flex items-center gap-4">
              <div className="flex-1">
                <p className="font-medium text-white">{album.title}</p>
                <p className="text-xs text-gray-500">/albums/{album.slug}</p>
              </div>
              <label className="flex items-center gap-1.5 text-sm text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={album.is_published}
                  onChange={(e) => togglePublish.mutate({ id: album.id, val: e.target.checked })}
                  className="rounded"
                />
                Published
              </label>
              <button
                onClick={() => { if (confirm(`Delete "${album.title}"?`)) remove.mutate(album.id); }}
                className="text-red-500 hover:text-red-400 text-xs"
              >
                Delete
              </button>
            </div>
          ))}
          {albums?.length === 0 && (
            <p className="text-gray-500 text-center py-8">No albums yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
