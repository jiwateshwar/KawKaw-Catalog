"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminTrips, adminLocations, adminAlbums } from "@/lib/api";
import type { Trip, Location, Album } from "@/types/api";
import { format, parseISO } from "date-fns";

type TripWithAlbums = Trip & { _albums: Album[]; _location: Location | null };

const INPUT_CLS = "w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500";

function TripCard({
  trip,
  locations,
  unassignedAlbums,
  onTogglePublish,
  onDelete,
  onSaved,
  onAssignAlbum,
}: {
  trip: TripWithAlbums;
  locations: Location[];
  unassignedAlbums: Album[];
  onTogglePublish: (id: number, val: boolean) => void;
  onDelete: (id: number, title: string) => void;
  onSaved: () => void;
  onAssignAlbum: (albumId: number, tripId: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({
    title: trip.title,
    description: trip.description ?? "",
    start_date: trip.start_date ?? "",
    end_date: trip.end_date ?? "",
    location_id: trip.location_id != null ? String(trip.location_id) : "",
  });

  const saveMut = useMutation({
    mutationFn: () =>
      adminTrips.update(trip.id, {
        title: form.title,
        description: form.description || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        location_id: form.location_id ? Number(form.location_id) : null,
      }),
    onSuccess: () => {
      setEditing(false);
      onSaved();
    },
  });

  if (editing) {
    return (
      <div className="relative flex gap-0">
        <div className="absolute left-0 top-4 w-3 h-3 rounded-full bg-brand-500 border-2 border-gray-950 -translate-x-1/2 z-10" />
        <div className="flex-1 ml-5 bg-gray-900 border border-brand-600/40 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Title *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={INPUT_CLS}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Start Date</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">End Date</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className={INPUT_CLS}
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Location</label>
              <select
                value={form.location_id}
                onChange={(e) => setForm({ ...form, location_id: e.target.value })}
                className={INPUT_CLS}
              >
                <option value="">— None —</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                    {l.country ? `, ${l.country}` : ""}
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
                className={`${INPUT_CLS} resize-none`}
              />
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => saveMut.mutate()}
              disabled={!form.title || saveMut.isPending}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded transition-colors"
            >
              {saveMut.isPending ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-gray-400 hover:text-white text-xs px-3 py-1.5"
            >
              Cancel
            </button>
            {saveMut.isError && (
              <span className="text-xs text-red-400">Save failed.</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex gap-0">
      <div className="absolute left-0 top-4 w-3 h-3 rounded-full bg-brand-500 border-2 border-gray-950 -translate-x-1/2 z-10" />
      <div className="flex-1 ml-5 bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-white">{trip.title}</p>
              {trip.is_published ? (
                <span className="text-[10px] bg-green-900/40 text-green-400 border border-green-700/30 px-1.5 py-0.5 rounded-full">
                  Published
                </span>
              ) : (
                <span className="text-[10px] bg-gray-800 text-gray-500 border border-gray-700 px-1.5 py-0.5 rounded-full">
                  Draft
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-gray-500">
              {trip.start_date && (
                <span>
                  {format(parseISO(trip.start_date), "MMM d, yyyy")}
                  {trip.end_date && trip.end_date !== trip.start_date && (
                    <> — {format(parseISO(trip.end_date), "MMM d, yyyy")}</>
                  )}
                </span>
              )}
              {trip._location && (
                <span>
                  · {trip._location.name}
                  {trip._location.country ? `, ${trip._location.country}` : ""}
                </span>
              )}
              {trip._albums.length > 0 ? (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="text-brand-400 hover:underline"
                >
                  · {trip._albums.length} album{trip._albums.length !== 1 ? "s" : ""}
                  {expanded ? " ▾" : " ▸"}
                </button>
              ) : (
                <span>· No albums</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 pt-0.5">
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              Edit
            </button>
            <label className="flex items-center gap-1.5 text-sm text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={trip.is_published}
                onChange={(e) => onTogglePublish(trip.id, e.target.checked)}
                className="rounded"
              />
              Published
            </label>
            <button
              onClick={() => onDelete(trip.id, trip.title)}
              className="text-red-500 hover:text-red-400 text-xs"
            >
              Delete
            </button>
          </div>
        </div>

        {expanded && (
          <div className="border-t border-gray-800 bg-gray-950/40">
            {trip._albums.length === 0 ? (
              <p className="text-xs text-gray-600 px-10 py-3">No albums in this trip.</p>
            ) : (
              <ul className="divide-y divide-gray-800/60">
                {trip._albums.map((album) => (
                  <li key={album.id} className="flex items-center gap-3 px-10 py-2">
                    <span className="flex-1 text-sm text-gray-300">{album.title}</span>
                    {album.shoot_date && (
                      <span className="text-xs text-gray-600">
                        {format(parseISO(album.shoot_date), "d MMM yyyy")}
                      </span>
                    )}
                    <span className="text-xs text-gray-700">/albums/{album.slug}</span>
                    <button
                      onClick={() => onAssignAlbum(album.id, null)}
                      className="text-xs text-gray-500 hover:text-red-400"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {unassignedAlbums.length > 0 && (
              <div className="px-10 py-2 border-t border-gray-800/60">
                <p className="text-[10px] text-gray-600 mb-1.5 uppercase tracking-wider">
                  Add album to trip
                </p>
                <div className="flex gap-2 flex-wrap">
                  {unassignedAlbums.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => onAssignAlbum(a.id, trip.id)}
                      className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2.5 py-1 rounded border border-gray-700"
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
    </div>
  );
}

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

  const locationMap = new Map((locations ?? []).map((l) => [l.id, l]));

  const tripsEnriched: TripWithAlbums[] = (trips ?? []).map((t) => ({
    ...t,
    _albums: (albums ?? []).filter((a) => a.trip_id === t.id),
    _location: t.location_id != null ? (locationMap.get(t.location_id) ?? null) : null,
  }));

  const byYear = new Map<number, TripWithAlbums[]>();
  const undatedTrips: TripWithAlbums[] = [];

  for (const t of tripsEnriched) {
    if (!t.start_date) {
      undatedTrips.push(t);
      continue;
    }
    const y = parseISO(t.start_date).getFullYear();
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(t);
  }

  for (const arr of byYear.values()) {
    arr.sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? ""));
  }

  const years = [...byYear.keys()].sort((a, b) => b - a);
  const unassignedAlbums = (albums ?? []).filter((a) => a.trip_id === null);

  const cardProps = {
    locations: locations ?? [],
    unassignedAlbums,
    onTogglePublish: (id: number, val: boolean) => togglePublish.mutate({ id, val }),
    onDelete: (id: number, title: string) => {
      if (confirm(`Delete "${title}"?`)) remove.mutate(id);
    },
    onSaved: () => {
      qc.invalidateQueries({ queryKey: ["admin-trips"] });
    },
    onAssignAlbum: (albumId: number, tripId: number | null) =>
      assignAlbumTrip.mutate({ albumId, tripId }),
  };

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Trips</h1>
        <button
          onClick={() => setCreating(true)}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm px-4 py-2 rounded-md transition-colors"
        >
          + New Trip
        </button>
      </div>

      {creating && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-8 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Title *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={INPUT_CLS}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Start Date</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">End Date</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className={INPUT_CLS}
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Location</label>
              <select
                value={form.location_id}
                onChange={(e) => setForm({ ...form, location_id: e.target.value })}
                className={INPUT_CLS}
              >
                <option value="">— None —</option>
                {locations?.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                    {l.country ? `, ${l.country}` : ""}
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
                className={`${INPUT_CLS} resize-none`}
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
        <p className="text-gray-500">Loading…</p>
      ) : trips?.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No trips yet.</p>
      ) : (
        <div>
          {years.map((year) => (
            <div key={year} className="mb-10">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-px flex-1 bg-gray-800" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-3 py-1 bg-gray-900 border border-gray-800 rounded-full">
                  {year}
                </span>
                <div className="h-px flex-1 bg-gray-800" />
              </div>
              <div className="relative border-l border-gray-700 ml-1.5 space-y-4">
                {byYear.get(year)!.map((trip) => (
                  <TripCard key={trip.id} trip={trip} {...cardProps} />
                ))}
              </div>
            </div>
          ))}

          {undatedTrips.length > 0 && (
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-px flex-1 bg-gray-800" />
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-widest px-3 py-1 bg-gray-900 border border-gray-800 rounded-full">
                  No Date
                </span>
                <div className="h-px flex-1 bg-gray-800" />
              </div>
              <div className="relative border-l border-gray-700 ml-1.5 space-y-4">
                {undatedTrips.map((trip) => (
                  <TripCard key={trip.id} trip={trip} {...cardProps} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
