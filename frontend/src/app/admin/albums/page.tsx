"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAlbums, adminLocations, adminTrips } from "@/lib/api";
import type { Album, Location, Trip } from "@/types/api";
import { format, parseISO } from "date-fns";

type ViewMode = "month" | "year" | "location";

type LocationDrill =
  | { level: "countries" }
  | { level: "regions"; country: string }
  | { level: "cities"; country: string; region: string | null }
  | { level: "albums"; locationId: number; locationName: string; country: string; region: string | null };

type AlbumWithLoc = Album & { _loc: Location | null };

const INPUT_CLS = "w-full bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500";

function AlbumRow({
  album,
  locations,
  trips,
  onToggle,
  onDelete,
  onSaved,
}: {
  album: AlbumWithLoc;
  locations: Location[];
  trips: Trip[];
  onToggle: (args: { id: number; val: boolean }) => void;
  onDelete: (id: number) => void;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: album.title,
    slug: album.slug,
    description: album.description ?? "",
    shoot_date: album.shoot_date ?? "",
    location_id: album.location_id != null ? String(album.location_id) : "",
    trip_id: album.trip_id != null ? String(album.trip_id) : "",
  });

  const saveMut = useMutation({
    mutationFn: () =>
      adminAlbums.update(album.id, {
        title: form.title,
        slug: form.slug,
        description: form.description || null,
        shoot_date: form.shoot_date || null,
        location_id: form.location_id ? Number(form.location_id) : null,
        trip_id: form.trip_id ? Number(form.trip_id) : null,
      }),
    onSuccess: () => {
      setEditing(false);
      onSaved();
    },
  });

  if (editing) {
    return (
      <div className="bg-gray-900 border border-brand-600/40 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Slug</label>
            <input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Date</label>
            <input
              type="date"
              value={form.shoot_date}
              onChange={(e) => setForm({ ...form, shoot_date: e.target.value })}
              className={INPUT_CLS}
            />
          </div>
          <div>
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
          <div>
            <label className="text-xs text-gray-500 block mb-1">Trip</label>
            <select
              value={form.trip_id}
              onChange={(e) => setForm({ ...form, trip_id: e.target.value })}
              className={INPUT_CLS}
            >
              <option value="">— None —</option>
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional…"
              className={INPUT_CLS}
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
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white truncate">{album.title}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-gray-600">/albums/{album.slug}</span>
          {album.shoot_date && (
            <span className="text-xs text-gray-500">
              {format(parseISO(album.shoot_date), "d MMM yyyy")}
            </span>
          )}
          {album._loc && (
            <span className="text-xs text-gray-500">
              · {album._loc.name}
              {album._loc.country ? `, ${album._loc.country}` : ""}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-gray-400 hover:text-white shrink-0 transition-colors"
      >
        Edit
      </button>
      <label className="flex items-center gap-1.5 text-sm text-gray-400 cursor-pointer shrink-0">
        <input
          type="checkbox"
          checked={album.is_published}
          onChange={(e) => onToggle({ id: album.id, val: e.target.checked })}
          className="rounded"
        />
        Published
      </label>
      <button
        onClick={() => onDelete(album.id)}
        className="text-red-500 hover:text-red-400 text-xs shrink-0"
      >
        Delete
      </button>
    </div>
  );
}

export default function AdminAlbumsPage() {
  const qc = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [locationDrill, setLocationDrill] = useState<LocationDrill>({ level: "countries" });
  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const { data: albums, isLoading } = useQuery<Album[]>({
    queryKey: ["admin-albums"],
    queryFn: () => adminAlbums.list() as Promise<Album[]>,
  });

  const { data: locations } = useQuery<Location[]>({
    queryKey: ["admin-locations"],
    queryFn: () => adminLocations.list() as Promise<Location[]>,
  });

  const { data: trips } = useQuery<Trip[]>({
    queryKey: ["admin-trips"],
    queryFn: () => adminTrips.list() as Promise<Trip[]>,
  });

  const create = useMutation({
    mutationFn: () =>
      adminAlbums.create({
        title: newTitle,
        slug: newSlug || slugify(newTitle),
        description: newDesc || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-albums"] });
      setCreating(false);
      setNewTitle("");
      setNewSlug("");
      setNewDesc("");
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

  const locationMap = new Map((locations ?? []).map((l) => [l.id, l]));

  const albumsWithLoc: AlbumWithLoc[] = (albums ?? []).map((a) => ({
    ...a,
    _loc: a.location_id != null ? (locationMap.get(a.location_id) ?? null) : null,
  }));

  const handleDelete = (id: number, title: string) => {
    if (confirm(`Delete "${title}"?`)) remove.mutate(id);
  };

  const handleSaved = () => qc.invalidateQueries({ queryKey: ["admin-albums"] });

  const rowProps = {
    locations: locations ?? [],
    trips: trips ?? [],
    onToggle: togglePublish.mutate,
    onSaved: handleSaved,
  };

  // ── Month/Year view ─────────────────────────────────────────────────────────

  const renderMonthView = () => {
    const byYear = new Map<number, Map<number, AlbumWithLoc[]>>();
    const undated: AlbumWithLoc[] = [];

    for (const a of albumsWithLoc) {
      if (!a.shoot_date) {
        undated.push(a);
        continue;
      }
      const d = parseISO(a.shoot_date);
      const y = d.getFullYear();
      const m = d.getMonth();
      if (!byYear.has(y)) byYear.set(y, new Map());
      if (!byYear.get(y)!.has(m)) byYear.get(y)!.set(m, []);
      byYear.get(y)!.get(m)!.push(a);
    }

    const years = [...byYear.keys()].sort((a, b) => b - a);

    return (
      <div className="space-y-6">
        {years.map((year) => {
          const isCollapsed = collapsedYears.has(year);
          const total = [...byYear.get(year)!.values()].reduce((s, a) => s + a.length, 0);
          return (
            <div key={year}>
              <button
                onClick={() =>
                  setCollapsedYears((prev) => {
                    const next = new Set(prev);
                    isCollapsed ? next.delete(year) : next.add(year);
                    return next;
                  })
                }
                className="flex items-center gap-2 text-base font-semibold text-gray-200 mb-3 hover:text-white transition-colors"
              >
                <span className="text-gray-500 w-3">{isCollapsed ? "▸" : "▾"}</span>
                {year}
                <span className="text-xs text-gray-500 font-normal">({total})</span>
              </button>
              {!isCollapsed && (
                <div className="ml-4 space-y-4">
                  {[...byYear.get(year)!.entries()]
                    .sort((a, b) => b[0] - a[0])
                    .map(([month, monthAlbums]) => (
                      <div key={month}>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                          {format(new Date(year, month), "MMMM")}
                          <span className="text-gray-600 font-normal ml-1">
                            ({monthAlbums.length})
                          </span>
                        </h3>
                        <div className="space-y-1">
                          {monthAlbums
                            .sort((a, b) =>
                              (b.shoot_date ?? "").localeCompare(a.shoot_date ?? "")
                            )
                            .map((a) => (
                              <AlbumRow
                                key={a.id}
                                album={a}
                                {...rowProps}
                                onDelete={(id) => handleDelete(id, a.title)}
                              />
                            ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })}
        {undated.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-gray-500 mb-3">
              No Date{" "}
              <span className="font-normal text-xs">({undated.length})</span>
            </h2>
            <div className="space-y-1">
              {undated.map((a) => (
                <AlbumRow
                  key={a.id}
                  album={a}
                  {...rowProps}
                  onDelete={(id) => handleDelete(id, a.title)}
                />
              ))}
            </div>
          </div>
        )}
        {albums?.length === 0 && (
          <p className="text-gray-500 text-center py-8">No albums yet.</p>
        )}
      </div>
    );
  };

  // ── Year view ───────────────────────────────────────────────────────────────

  const renderYearView = () => {
    const byYear = new Map<number, AlbumWithLoc[]>();
    const undated: AlbumWithLoc[] = [];

    for (const a of albumsWithLoc) {
      if (!a.shoot_date) {
        undated.push(a);
        continue;
      }
      const y = parseISO(a.shoot_date).getFullYear();
      if (!byYear.has(y)) byYear.set(y, []);
      byYear.get(y)!.push(a);
    }

    const years = [...byYear.keys()].sort((a, b) => b - a);

    return (
      <div className="space-y-6">
        {years.map((year) => (
          <div key={year}>
            <h2 className="text-base font-semibold text-gray-200 mb-3">
              {year}{" "}
              <span className="text-xs text-gray-500 font-normal">
                ({byYear.get(year)!.length})
              </span>
            </h2>
            <div className="space-y-1">
              {byYear
                .get(year)!
                .sort((a, b) => (b.shoot_date ?? "").localeCompare(a.shoot_date ?? ""))
                .map((a) => (
                  <AlbumRow
                    key={a.id}
                    album={a}
                    {...rowProps}
                    onDelete={(id) => handleDelete(id, a.title)}
                  />
                ))}
            </div>
          </div>
        ))}
        {undated.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-gray-500 mb-3">
              No Date{" "}
              <span className="font-normal text-xs">({undated.length})</span>
            </h2>
            <div className="space-y-1">
              {undated.map((a) => (
                <AlbumRow
                  key={a.id}
                  album={a}
                  {...rowProps}
                  onDelete={(id) => handleDelete(id, a.title)}
                />
              ))}
            </div>
          </div>
        )}
        {albums?.length === 0 && (
          <p className="text-gray-500 text-center py-8">No albums yet.</p>
        )}
      </div>
    );
  };

  // ── Location view ───────────────────────────────────────────────────────────

  const renderLocationView = () => {
    const navItem = (label: string, count: number, onClick: () => void) => (
      <button
        key={label}
        onClick={onClick}
        className="w-full text-left px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg hover:bg-gray-800 flex items-center gap-3 transition-colors"
      >
        <span className="flex-1 font-medium text-white">{label}</span>
        <span className="text-xs text-gray-500">
          {count} album{count !== 1 ? "s" : ""} ▸
        </span>
      </button>
    );

    const crumbs: { label: string; onClick?: () => void }[] = [
      { label: "Countries", onClick: () => setLocationDrill({ level: "countries" }) },
    ];
    if (locationDrill.level !== "countries") {
      const { country } = locationDrill;
      crumbs.push({
        label: country,
        onClick:
          locationDrill.level !== "regions"
            ? () => setLocationDrill({ level: "regions", country })
            : undefined,
      });
    }
    if (
      (locationDrill.level === "cities" || locationDrill.level === "albums") &&
      locationDrill.region
    ) {
      const { country, region } = locationDrill;
      crumbs.push({
        label: region,
        onClick:
          locationDrill.level !== "cities"
            ? () => setLocationDrill({ level: "cities", country, region })
            : undefined,
      });
    }
    if (locationDrill.level === "albums") {
      crumbs.push({ label: locationDrill.locationName });
    }

    let content: React.ReactNode;

    if (locationDrill.level === "countries") {
      const countries = new Map<string, number>();
      for (const a of albumsWithLoc) {
        const c = a._loc?.country ?? "(No Country)";
        countries.set(c, (countries.get(c) ?? 0) + 1);
      }
      content = (
        <div className="space-y-1">
          {[...countries.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([c, n]) =>
              navItem(c, n, () => setLocationDrill({ level: "regions", country: c }))
            )}
        </div>
      );
    } else if (locationDrill.level === "regions") {
      const { country } = locationDrill;
      const countryAlbums = albumsWithLoc.filter(
        (a) => (a._loc?.country ?? "(No Country)") === country
      );
      const regions = new Map<string, number>();
      for (const a of countryAlbums) {
        const r = a._loc?.region ?? "(No Region)";
        regions.set(r, (regions.get(r) ?? 0) + 1);
      }
      if (regions.size === 1 && regions.has("(No Region)")) {
        const cities = new Map<string, { id: number; count: number }>();
        for (const a of countryAlbums) {
          if (!a._loc) continue;
          const c = a._loc.name;
          if (!cities.has(c)) cities.set(c, { id: a._loc.id, count: 0 });
          cities.get(c)!.count++;
        }
        content = (
          <div className="space-y-1">
            {[...cities.entries()]
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([c, { id, count }]) =>
                navItem(c, count, () =>
                  setLocationDrill({
                    level: "albums",
                    locationId: id,
                    locationName: c,
                    country,
                    region: null,
                  })
                )
              )}
          </div>
        );
      } else {
        content = (
          <div className="space-y-1">
            {[...regions.entries()]
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([r, n]) =>
                navItem(r, n, () =>
                  setLocationDrill({
                    level: "cities",
                    country,
                    region: r === "(No Region)" ? null : r,
                  })
                )
              )}
          </div>
        );
      }
    } else if (locationDrill.level === "cities") {
      const { country, region } = locationDrill;
      const filtered = albumsWithLoc.filter(
        (a) =>
          (a._loc?.country ?? "(No Country)") === country &&
          (a._loc?.region ?? null) === region
      );
      const cities = new Map<string, { id: number; count: number }>();
      for (const a of filtered) {
        if (!a._loc) continue;
        const c = a._loc.name;
        if (!cities.has(c)) cities.set(c, { id: a._loc.id, count: 0 });
        cities.get(c)!.count++;
      }
      content = (
        <div className="space-y-1">
          {[...cities.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([c, { id, count }]) =>
              navItem(c, count, () =>
                setLocationDrill({
                  level: "albums",
                  locationId: id,
                  locationName: c,
                  country,
                  region,
                })
              )
            )}
        </div>
      );
    } else {
      const { locationId } = locationDrill;
      const locAlbums = albumsWithLoc
        .filter((a) => a.location_id === locationId)
        .sort((a, b) => (b.shoot_date ?? "").localeCompare(a.shoot_date ?? ""));
      content = (
        <div className="space-y-1">
          {locAlbums.map((a) => (
            <AlbumRow
              key={a.id}
              album={a}
              {...rowProps}
              onDelete={(id) => handleDelete(id, a.title)}
            />
          ))}
          {locAlbums.length === 0 && (
            <p className="text-gray-500 text-center py-8">No albums here.</p>
          )}
        </div>
      );
    }

    return (
      <div>
        <div className="flex items-center gap-1 mb-5 flex-wrap text-sm">
          {crumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-gray-600">/</span>}
              {b.onClick ? (
                <button onClick={b.onClick} className="text-brand-400 hover:underline">
                  {b.label}
                </button>
              ) : (
                <span className="text-white font-medium">{b.label}</span>
              )}
            </span>
          ))}
        </div>
        {content}
      </div>
    );
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Albums</h1>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg overflow-hidden border border-gray-700">
            {(["month", "year", "location"] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setViewMode(m);
                  setLocationDrill({ level: "countries" });
                }}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  viewMode === m
                    ? "bg-brand-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {m === "month" ? "Month/Year" : m === "year" ? "Year" : "Location"}
              </button>
            ))}
          </div>
          <button
            onClick={() => setCreating(true)}
            className="bg-brand-600 hover:bg-brand-700 text-white text-sm px-4 py-2 rounded-md transition-colors"
          >
            + New Album
          </button>
        </div>
      </div>

      {creating && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Title *</label>
              <input
                value={newTitle}
                onChange={(e) => {
                  setNewTitle(e.target.value);
                  if (!newSlug) setNewSlug(slugify(e.target.value));
                }}
                className={INPUT_CLS}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Slug *</label>
              <input
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                className={INPUT_CLS}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Description</label>
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className={INPUT_CLS}
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
            <button
              onClick={() => setCreating(false)}
              className="text-gray-400 text-sm px-3 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-gray-500">Loading…</p>
      ) : viewMode === "month" ? (
        renderMonthView()
      ) : viewMode === "year" ? (
        renderYearView()
      ) : (
        renderLocationView()
      )}
    </div>
  );
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
