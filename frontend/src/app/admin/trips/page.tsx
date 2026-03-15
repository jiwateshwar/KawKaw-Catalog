"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminTrips, adminLocations, adminAlbums } from "@/lib/api";
import type { Trip, Location, Album } from "@/types/api";
import { format } from "date-fns";

export default function AdminTripsPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    start_date: "",
    end_date: "",
    location_id: "",
  });
  const [expandedTripId, setExpandedTripId] = useState<number | null>(null);

  const { data: trips, isLoading } = useQuery<Trip[]>({
    queryKey: ["admin-trips"],
    queryFn: () => adminTrips.list() as Promise<Trip[]>,
  });

  const { data: locations } = useQuery<Location[]>({
    queryKey: ["admin-locations"],
    queryFn: () => adminLocations.list() as Promise<Location[]>,
  });

  const { data: albums } = useQuery<Album[]>({
    queryKey: ["admin-albums"],
    queryFn: () => adminAlbums.list() as Promise<Album[]>,
  });

  const create = useMutation({
    mutationFn: () =>
      adminTrips.create({
        title: form.title,
        description: form.description || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        location_id: form.location_id ? Number(form.location_id) : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-trips"] });
      setCreating(false);
      setForm({ title: "", description: "", start_date: "", end_date: "", location_id: "" });
    },
  });

  const togglePublish = useMutation({
    mutationFn: ({ id, val }: { id: number; val: boolean }) =>
      adminTrips.update(id, { is_published: val }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-trips"] }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => adminTrips.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-trips"] }),
  });

  const assignAlbumTrip = useMutation({
    mutationFn: ({ albumId, tripId }: { albumId: number; tripId: number | null }) =>
      adminAlbums.update(albumId, { trip_id: tripId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-albums"] }),
  });

  // Albums not yet assigned to any trip
  const unassignedAlbums = (albums ?? []).filter((a) => a.trip_id === null);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Trips</h1>
        <button
          onClick={() => setCreating(true)}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm px-4 py-2 rounded-md transition-colors"
        >
          + New Trip
        </button>
      </div>

      {creating && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Title *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Start Date</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">End Date</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Location</label>
              <select
                value={form.location_id}
                onChange={(e) => setForm({ ...form, location_id: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              >
                <option value="">— None —</option>
                {locations?.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 resize-none"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => form.title && create.mutate()}
              disabled={!form.title || create.isPending}
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
          {trips?.map((trip) => {
            const tripAlbums = (albums ?? []).filter((a) => a.trip_id === trip.id);
            const isExpanded = expandedTripId === trip.id;

            return (
              <div key={trip.id} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                {/* Trip header row */}
                <div className="px-4 py-3 flex items-center gap-4">
                  <button
                    onClick={() => setExpandedTripId(isExpanded ? null : trip.id)}
                    className="text-gray-500 hover:text-white text-sm shrink-0 w-5 text-center"
                    title={isExpanded ? "Collapse" : "Expand albums"}
                  >
                    {isExpanded ? "▾" : "▸"}
                  </button>
                  <div className="flex-1">
                    <p className="font-medium text-white">{trip.title}</p>
                    {trip.start_date && (
                      <p className="text-xs text-gray-500">
                        {format(new Date(trip.start_date), "MMM d, yyyy")}
                        {trip.end_date &&
                          trip.end_date !== trip.start_date &&
                          ` — ${format(new Date(trip.end_date), "MMM d, yyyy")}`}
                        {tripAlbums.length > 0 && (
                          <span className="ml-2 text-gray-600">
                            · {tripAlbums.length} album{tripAlbums.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </p>
                    )}
                    {!trip.start_date && tripAlbums.length > 0 && (
                      <p className="text-xs text-gray-600">
                        {tripAlbums.length} album{tripAlbums.length !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                  <label className="flex items-center gap-1.5 text-sm text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={trip.is_published}
                      onChange={(e) =>
                        togglePublish.mutate({ id: trip.id, val: e.target.checked })
                      }
                      className="rounded"
                    />
                    Published
                  </label>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${trip.title}"?`)) remove.mutate(trip.id);
                    }}
                    className="text-red-500 hover:text-red-400 text-xs"
                  >
                    Delete
                  </button>
                </div>

                {/* Albums panel */}
                {isExpanded && (
                  <div className="border-t border-gray-800 bg-gray-950/40">
                    {tripAlbums.length === 0 ? (
                      <p className="text-xs text-gray-600 px-10 py-3">No albums in this trip.</p>
                    ) : (
                      <ul className="divide-y divide-gray-800/60">
                        {tripAlbums.map((album) => (
                          <li key={album.id} className="flex items-center gap-3 px-10 py-2">
                            <span className="flex-1 text-sm text-gray-300">{album.title}</span>
                            <span className="text-xs text-gray-600">/{album.slug}</span>
                            <button
                              onClick={() =>
                                assignAlbumTrip.mutate({ albumId: album.id, tripId: null })
                              }
                              disabled={assignAlbumTrip.isPending}
                              className="text-xs text-gray-500 hover:text-red-400 disabled:opacity-50"
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Add unassigned album to this trip */}
                    {unassignedAlbums.length > 0 && (
                      <div className="px-10 py-2 border-t border-gray-800/60">
                        <p className="text-[10px] text-gray-600 mb-1 uppercase tracking-wider">
                          Add album to trip
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          {unassignedAlbums.map((a) => (
                            <button
                              key={a.id}
                              onClick={() =>
                                assignAlbumTrip.mutate({ albumId: a.id, tripId: trip.id })
                              }
                              disabled={assignAlbumTrip.isPending}
                              className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2.5 py-1 rounded border border-gray-700 disabled:opacity-50"
                            >
                              + {a.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {trips?.length === 0 && <p className="text-gray-500 text-center py-8">No trips yet.</p>}
        </div>
      )}

      {/* Unassigned albums section */}
      {unassignedAlbums.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Albums not in a trip ({unassignedAlbums.length})
          </h2>
          <div className="space-y-1">
            {unassignedAlbums.map((album) => (
              <div
                key={album.id}
                className="bg-gray-900 border border-gray-800 rounded px-4 py-2 flex items-center gap-3"
              >
                <span className="flex-1 text-sm text-gray-300">{album.title}</span>
                <span className="text-xs text-gray-600">/{album.slug}</span>
                {trips && trips.length > 0 && (
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        assignAlbumTrip.mutate({
                          albumId: album.id,
                          tripId: Number(e.target.value),
                        });
                        e.target.value = "";
                      }
                    }}
                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none"
                  >
                    <option value="">Assign to trip…</option>
                    {trips.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
