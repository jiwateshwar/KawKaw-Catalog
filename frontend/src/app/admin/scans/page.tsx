"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminScans, adminPhotos, adminLocations, adminMeta } from "@/lib/api";
import type {
  DirectoryEntry,
  Photo,
  PhotoPage,
  ScanJob,
  Location,
  GeocodeSuggestion,
} from "@/types/api";
import { PhotoEditor } from "@/components/admin/PhotoEditor";

// ── Local types ───────────────────────────────────────────────────────────────

interface FolderLocation {
  id?: number;
  name: string;
  lat: number | null;
  lng: number | null;
  country?: string | null;
  isNew?: boolean; // from Nominatim, not yet in DB
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BrowsePage() {
  const qc = useQueryClient();

  // Folder tree
  const [browsePath, setBrowsePath] = useState("");
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);
  const [selectedFolderEntry, setSelectedFolderEntry] = useState<DirectoryEntry | null>(null);

  // Folder-level metadata
  const [folderLocation, setFolderLocation] = useState<FolderLocation | null>(null);
  const [folderDate, setFolderDate] = useState("");

  // Photo editor
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);

  // Optimistic publish overrides
  const [publishOverrides, setPublishOverrides] = useState<Record<number, boolean>>({});

  // Active scan job
  const [pendingJobId, setPendingJobId] = useState<number | null>(null);

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: entries, isLoading: treeLoading } = useQuery<DirectoryEntry[]>({
    queryKey: ["browse", browsePath],
    queryFn: () => adminScans.browse(browsePath) as Promise<DirectoryEntry[]>,
  });

  const { data: dbLocations } = useQuery<Location[]>({
    queryKey: ["admin-locations"],
    queryFn: () => adminLocations.list() as Promise<Location[]>,
  });

  const { data: photosPage, isLoading: photosLoading } = useQuery<PhotoPage>({
    queryKey: ["folder-photos", selectedFolderPath],
    queryFn: () =>
      adminPhotos.list({ folder_path: selectedFolderPath!, limit: 200 }) as Promise<PhotoPage>,
    enabled: !!selectedFolderPath,
  });

  const { data: scanJob } = useQuery<ScanJob>({
    queryKey: ["scan-job", pendingJobId],
    queryFn: () => adminScans.get(pendingJobId!) as Promise<ScanJob>,
    enabled: !!pendingJobId,
    refetchInterval: 2000,
  });

  useEffect(() => {
    if (!scanJob) return;
    if (scanJob.status === "done" || scanJob.status === "error") {
      setPendingJobId(null);
      qc.invalidateQueries({ queryKey: ["folder-photos", selectedFolderPath] });
      qc.invalidateQueries({ queryKey: ["browse", browsePath] });
    }
  }, [scanJob?.status, scanJob, selectedFolderPath, browsePath, qc]);

  // ── Mutations ────────────────────────────────────────────────────────────────

  const importMutation = useMutation({
    mutationFn: () =>
      adminScans.start({ path: selectedFolderPath! }) as Promise<ScanJob>,
    onSuccess: (job) => setPendingJobId(job.id),
  });

  const applyToFolder = useMutation({
    mutationFn: () =>
      adminPhotos.bulkFolderUpdate({
        folder_path: selectedFolderPath!,
        location_id: folderLocation && !folderLocation.isNew ? (folderLocation.id ?? null) : null,
        location_name: folderLocation?.isNew ? folderLocation.name : null,
        location_lat: folderLocation?.isNew ? folderLocation.lat : null,
        location_lng: folderLocation?.isNew ? folderLocation.lng : null,
        location_country: folderLocation?.isNew ? (folderLocation.country ?? null) : null,
        shoot_date: folderDate || null,
      }) as Promise<{ ok: boolean; location_id: number | null }>,
    onSuccess: (data) => {
      if (data.location_id && folderLocation?.isNew) {
        setFolderLocation((prev) =>
          prev ? { ...prev, id: data.location_id!, isNew: false } : null
        );
      }
      qc.invalidateQueries({ queryKey: ["folder-photos", selectedFolderPath] });
      qc.invalidateQueries({ queryKey: ["admin-locations"] });
      qc.invalidateQueries({ queryKey: ["browse", browsePath] });
    },
  });

  const togglePublish = useMutation({
    mutationFn: ({ id, value }: { id: number; value: boolean }) =>
      adminPhotos.update(id, { is_published: value }) as Promise<Photo>,
    onMutate: ({ id, value }) =>
      setPublishOverrides((prev) => ({ ...prev, [id]: value })),
    onError: (_err, { id }) =>
      setPublishOverrides((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folder-photos", selectedFolderPath] });
      qc.invalidateQueries({ queryKey: ["browse", browsePath] });
    },
  });

  // ── Derived data ─────────────────────────────────────────────────────────────

  const allPhotos = (photosPage?.items ?? []).map((p) => ({
    ...p,
    is_published: publishOverrides[p.id] ?? p.is_published,
  }));
  const publishedPhotos = allPhotos.filter((p) => p.is_published);
  const unpublishedPhotos = allPhotos.filter((p) => !p.is_published);

  const isImporting = importMutation.isPending || !!pendingJobId;
  const fileCount = selectedFolderEntry?.file_count ?? 0;
  const hasUnimported = fileCount > 0 && allPhotos.length < fileCount;

  const locationCoords =
    folderLocation?.lat != null && folderLocation.lng != null
      ? { lat: folderLocation.lat, lng: folderLocation.lng }
      : null;

  // ── Navigation ───────────────────────────────────────────────────────────────

  const navigateTo = (path: string) => {
    setBrowsePath(path);
    setSelectedFolderPath(null);
    setSelectedFolderEntry(null);
    setEditingPhoto(null);
    setPublishOverrides({});
  };

  const openFolder = (entry: DirectoryEntry) => {
    setBrowsePath(entry.path);
    setSelectedFolderPath(entry.path);
    setSelectedFolderEntry(entry);
    setEditingPhoto(null);
    setPublishOverrides({});
    setPendingJobId(null);
  };

  const pathParts = browsePath ? browsePath.split("/").filter(Boolean) : [];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: Folder tree ───────────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 border-r border-gray-800 flex flex-col overflow-hidden bg-gray-950">
        <div className="px-3 py-3 border-b border-gray-800 shrink-0">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Browse Media
          </p>
          <div className="flex items-center gap-1 flex-wrap text-xs">
            <button
              onClick={() => navigateTo("")}
              className="text-brand-400 hover:underline"
            >
              Root
            </button>
            {pathParts.map((part, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="text-gray-600">/</span>
                <button
                  onClick={() => navigateTo(pathParts.slice(0, i + 1).join("/"))}
                  className="text-brand-400 hover:underline truncate max-w-[80px]"
                  title={part}
                >
                  {part}
                </button>
              </span>
            ))}
          </div>
        </div>

        {browsePath && (
          <button
            onClick={() => {
              const parts = browsePath.split("/");
              parts.pop();
              navigateTo(parts.join("/"));
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-gray-800 border-b border-gray-800 shrink-0"
          >
            ← Back
          </button>
        )}

        <div className="flex-1 overflow-auto">
          {treeLoading ? (
            <p className="text-xs text-gray-600 p-3">Loading…</p>
          ) : entries?.length === 0 ? (
            <p className="text-xs text-gray-600 p-3">Empty folder</p>
          ) : (
            <ul className="py-1">
              {entries?.map((entry) => (
                <FolderRow
                  key={entry.path}
                  entry={entry}
                  selected={selectedFolderPath === entry.path}
                  onSelect={openFolder}
                />
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* ── Middle: Photo grid ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedFolderPath ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-500 text-sm">Select a folder to view photos</p>
          </div>
        ) : (
          <>
            {/* Folder header */}
            <div className="px-5 py-2.5 border-b border-gray-800 shrink-0 flex items-center justify-between bg-gray-900/40">
              <p className="text-sm font-medium text-white truncate">
                {selectedFolderPath.split("/").pop()}
              </p>
              <p className="text-xs text-gray-500 ml-3 shrink-0">
                {allPhotos.length} imported
                {fileCount > 0 && ` · ${fileCount} on disk`}
              </p>
            </div>

            {/* Folder settings */}
            <div className="px-5 py-3 border-b border-gray-800 bg-gray-900/20 shrink-0">
              <div className="flex items-end gap-3">
                <div className="flex-1 min-w-0">
                  <label className="block text-xs text-gray-500 mb-1">Location</label>
                  <LocationPicker
                    value={folderLocation}
                    onChange={setFolderLocation}
                    dbLocations={dbLocations ?? []}
                  />
                </div>
                <div className="shrink-0">
                  <label className="block text-xs text-gray-500 mb-1">Date</label>
                  <input
                    type="date"
                    value={folderDate}
                    onChange={(e) => setFolderDate(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <button
                  onClick={() => applyToFolder.mutate()}
                  disabled={
                    applyToFolder.isPending ||
                    (!folderLocation && !folderDate)
                  }
                  className="shrink-0 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white text-xs px-3 py-1.5 rounded transition-colors whitespace-nowrap"
                >
                  {applyToFolder.isPending ? "Applying…" : "Apply to all"}
                </button>
              </div>
              {applyToFolder.isSuccess && (
                <p className="text-xs text-green-400 mt-1.5">Applied to all photos in this folder.</p>
              )}
              {applyToFolder.isError && (
                <p className="text-xs text-red-400 mt-1.5">Failed to apply. Try again.</p>
              )}
            </div>

            {/* Import banner */}
            {(hasUnimported || isImporting) && (
              <div className="mx-5 mt-4 bg-orange-950/30 border border-orange-700/30 rounded-lg px-4 py-3 flex items-center justify-between shrink-0">
                <div>
                  {scanJob?.status === "running" ? (
                    <p className="text-sm text-orange-300">
                      Importing… {scanJob.files_imported} / {scanJob.files_found} files
                    </p>
                  ) : (
                    <p className="text-sm text-orange-300">
                      {fileCount - allPhotos.length} file
                      {fileCount - allPhotos.length !== 1 ? "s" : ""} not yet imported
                    </p>
                  )}
                  {scanJob?.status === "error" && (
                    <p className="text-xs text-red-400 mt-0.5">{scanJob.error_message}</p>
                  )}
                </div>
                <button
                  onClick={() => importMutation.mutate()}
                  disabled={isImporting}
                  className="ml-4 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded transition-colors shrink-0"
                >
                  {isImporting ? "Importing…" : "Import"}
                </button>
              </div>
            )}

            {/* Photo grid */}
            <div className="flex-1 overflow-auto p-5">
              {photosLoading ? (
                <p className="text-gray-500 text-sm">Loading photos…</p>
              ) : allPhotos.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  No photos imported from this folder yet.
                  {fileCount > 0 && " Click Import above to add them."}
                </p>
              ) : (
                <div className="space-y-6">
                  {publishedPhotos.length > 0 && (
                    <section>
                      <p className="text-xs font-semibold text-green-500 uppercase tracking-wider mb-3">
                        Published ({publishedPhotos.length})
                      </p>
                      <PhotoGrid
                        photos={publishedPhotos}
                        selectedId={editingPhoto?.id}
                        onSelect={setEditingPhoto}
                        onTogglePublish={(p) =>
                          togglePublish.mutate({ id: p.id, value: !p.is_published })
                        }
                      />
                    </section>
                  )}
                  {unpublishedPhotos.length > 0 && (
                    <section>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        Not Published ({unpublishedPhotos.length})
                      </p>
                      <PhotoGrid
                        photos={unpublishedPhotos}
                        selectedId={editingPhoto?.id}
                        onSelect={setEditingPhoto}
                        onTogglePublish={(p) =>
                          togglePublish.mutate({ id: p.id, value: !p.is_published })
                        }
                      />
                    </section>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Right: Photo editor ──────────────────────────────────────────────── */}
      {editingPhoto && (
        <PhotoEditor
          photo={editingPhoto}
          locationCoords={locationCoords}
          onClose={() => setEditingPhoto(null)}
          onSaved={(updated) => {
            setEditingPhoto(updated);
            setPublishOverrides((prev) => {
              const next = { ...prev };
              delete next[updated.id];
              return next;
            });
            qc.invalidateQueries({ queryKey: ["folder-photos", selectedFolderPath] });
            qc.invalidateQueries({ queryKey: ["browse", browsePath] });
          }}
        />
      )}
    </div>
  );
}

// ── LocationPicker ────────────────────────────────────────────────────────────

function LocationPicker({
  value,
  onChange,
  dbLocations,
}: {
  value: FolderLocation | null;
  onChange: (loc: FolderLocation | null) => void;
  dbLocations: Location[];
}) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);
  const [geoSuggestions, setGeoSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!value) setQuery("");
  }, [value]);

  // Debounced geocode
  useEffect(() => {
    if (query.length < 2) {
      setGeoSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setGeoLoading(true);
      try {
        const results = (await adminMeta.geocode(query)) as GeocodeSuggestion[];
        setGeoSuggestions(results);
      } catch {
        setGeoSuggestions([]);
      } finally {
        setGeoLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const filteredDb = dbLocations.filter((l) =>
    l.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (loc: FolderLocation) => {
    setQuery(loc.name);
    setOpen(false);
    onChange(loc);
  };

  const handleClear = () => {
    setQuery("");
    setOpen(false);
    onChange(null);
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value) onChange(null);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Search location…"
          className="w-full bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500"
        />
        {value && (
          <button
            onMouseDown={(e) => { e.preventDefault(); handleClear(); }}
            className="shrink-0 text-gray-500 hover:text-white text-xs px-1.5 py-1"
          >
            ✕
          </button>
        )}
      </div>

      {value?.lat != null && (
        <p className="text-[10px] text-gray-600 mt-0.5">
          {value.lat.toFixed(4)}, {value.lng?.toFixed(4)}
          {value.isNew && <span className="text-orange-500 ml-1">(new — will be saved on Apply)</span>}
          {!value.isNew && <span className="text-green-700 ml-1">saved</span>}
        </p>
      )}

      {open && query.length >= 2 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden max-h-64 overflow-y-auto">
          {filteredDb.length > 0 && (
            <>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider px-2.5 py-1 bg-gray-900/80">
                Saved locations
              </p>
              {filteredDb.map((loc) => (
                <button
                  key={loc.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect({
                      id: loc.id,
                      name: loc.name,
                      lat: loc.latitude,
                      lng: loc.longitude,
                      country: loc.country,
                      isNew: false,
                    });
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                >
                  <span className="text-green-500 text-xs shrink-0">●</span>
                  <span className="flex-1 truncate">{loc.name}</span>
                  {loc.latitude != null && (
                    <span className="text-xs text-gray-500 shrink-0">
                      {loc.latitude.toFixed(2)}, {loc.longitude?.toFixed(2)}
                    </span>
                  )}
                </button>
              ))}
            </>
          )}

          {geoLoading ? (
            <p className="text-xs text-gray-500 px-2.5 py-2">Searching…</p>
          ) : geoSuggestions.length > 0 ? (
            <>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider px-2.5 py-1 bg-gray-900/80">
                OpenStreetMap
              </p>
              {geoSuggestions.map((s, i) => (
                <button
                  key={i}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect({ name: s.name, lat: s.lat, lng: s.lng, country: s.country, isNew: true });
                  }}
                  className="w-full text-left px-2.5 py-2 text-sm text-gray-200 hover:bg-gray-700"
                >
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-gray-500 truncate">{s.display_name}</div>
                </button>
              ))}
            </>
          ) : null}

          {filteredDb.length === 0 && geoSuggestions.length === 0 && !geoLoading && (
            <p className="text-xs text-gray-500 px-2.5 py-2">No results found</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── FolderRow ─────────────────────────────────────────────────────────────────

function FolderRow({
  entry,
  selected,
  onSelect,
}: {
  entry: DirectoryEntry;
  selected: boolean;
  onSelect: (e: DirectoryEntry) => void;
}) {
  const { photo_count, published_count } = entry;

  let dotClass = "";
  if (photo_count > 0) {
    if (published_count === photo_count) dotClass = "bg-green-500";
    else if (published_count > 0) dotClass = "bg-yellow-400";
    else dotClass = "bg-gray-500";
  }

  return (
    <li>
      <button
        onClick={() => onSelect(entry)}
        className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
          selected
            ? "bg-gray-800 text-white"
            : "text-gray-300 hover:bg-gray-800/60 hover:text-white"
        }`}
      >
        <span className="relative shrink-0 text-base leading-none">
          {entry.is_dir ? "📁" : "📄"}
          {dotClass && (
            <span
              className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-gray-950 ${dotClass}`}
            />
          )}
        </span>
        <span className="flex-1 truncate">{entry.name}</span>
        {entry.is_dir && (
          <span className="text-xs text-gray-600 shrink-0 tabular-nums">
            {photo_count > 0 ? (
              <span className={published_count === photo_count ? "text-green-700" : ""}>
                {published_count}/{photo_count}
              </span>
            ) : entry.file_count !== null && entry.file_count > 0 ? (
              entry.file_count
            ) : null}
          </span>
        )}
      </button>
    </li>
  );
}

// ── PhotoGrid ─────────────────────────────────────────────────────────────────

function PhotoGrid({
  photos,
  selectedId,
  onSelect,
  onTogglePublish,
}: {
  photos: Photo[];
  selectedId?: number;
  onSelect: (p: Photo) => void;
  onTogglePublish: (p: Photo) => void;
}) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
      {photos.map((photo) => (
        <PhotoCard
          key={photo.id}
          photo={photo}
          selected={photo.id === selectedId}
          onSelect={() => onSelect(photo)}
          onTogglePublish={() => onTogglePublish(photo)}
        />
      ))}
    </div>
  );
}

// ── PhotoCard ─────────────────────────────────────────────────────────────────

function PhotoCard({
  photo,
  selected,
  onSelect,
  onTogglePublish,
}: {
  photo: Photo;
  selected: boolean;
  onSelect: () => void;
  onTogglePublish: () => void;
}) {
  return (
    <div
      className={`relative group rounded overflow-hidden ring-2 transition-all ${
        selected ? "ring-brand-500" : "ring-transparent hover:ring-gray-600"
      }`}
    >
      <div className="aspect-square bg-gray-800 cursor-pointer" onClick={onSelect}>
        {photo.thumb_sm_url ? (
          <img
            src={photo.thumb_sm_url}
            alt={photo.filename}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            <span className="text-xs text-center px-1">
              {photo.thumb_status === "pending"
                ? "⏳"
                : photo.thumb_status === "processing"
                ? "⚙"
                : photo.thumb_status === "error"
                ? "✕"
                : "?"}
            </span>
          </div>
        )}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onTogglePublish(); }}
        title={photo.is_published ? "Unpublish" : "Publish"}
        className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
          photo.is_published
            ? "bg-green-500 text-white"
            : "bg-gray-900/80 text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-700"
        }`}
      >
        {photo.is_published ? "✓" : "+"}
      </button>

      {(photo.file_type === "raw" || photo.file_type === "video") && (
        <span className="absolute bottom-1 left-1 bg-black/60 text-gray-400 text-[10px] px-1 rounded leading-tight">
          {photo.file_type === "raw" ? "RAW" : "VID"}
        </span>
      )}

      {photo.species.length > 0 && (
        <div className="absolute bottom-0 inset-x-0 bg-black/70 text-[10px] text-center py-0.5 text-brand-300 opacity-0 group-hover:opacity-100 transition-opacity truncate px-1">
          {photo.species.map((s) => s.common_name).join(", ")}
        </div>
      )}
    </div>
  );
}
