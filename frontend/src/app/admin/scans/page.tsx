"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminScans,
  adminPhotos,
  adminLocations,
  adminMeta,
  adminSpecies,
  adminAlbums,
  adminTrips,
} from "@/lib/api";
import type {
  DirectoryEntry,
  Photo,
  PhotoPage,
  ScanJob,
  Location,
  GeocodeSuggestion,
  Trip,
  Album,
  Species,
  EbirdSpecies,
} from "@/types/api";
import { CropModal } from "@/components/admin/CropModal";

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(str: string): string {
  const base = str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = Date.now().toString(36).slice(-5);
  return `${base || "album"}-${suffix}`;
}

// ── Local types ───────────────────────────────────────────────────────────────

interface FolderLocation {
  id?: number;
  name: string;
  lat: number | null;
  lng: number | null;
  country?: string | null;
  isNew?: boolean;
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

  // Album + trip creation (album always shown, not hidden behind checkbox)
  const [albumName, setAlbumName] = useState("");
  const [albumTripId, setAlbumTripId] = useState<"" | number | "new">("");
  const [newTripName, setNewTripName] = useState("");

  // Crop modal
  const [cropPhoto, setCropPhoto] = useState<Photo | null>(null);

  // Sidebar collapse
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Local photo state — updated optimistically and merged with query refetches
  const [localPhotos, setLocalPhotos] = useState<Photo[]>([]);
  const folderLoadedRef = useRef<string | null>(null);

  // Album auto-link: album created during this folder session
  const [pendingAlbumId, setPendingAlbumId] = useState<number | null>(null);
  const albumLinkedRef = useRef<Set<number>>(new Set());

  // Active scan job
  const [pendingJobId, setPendingJobId] = useState<number | null>(null);

  // ── Queries ─────────────────────────────────────────────────────────────────

  const hasPendingThumbs = localPhotos.some(
    (p) => p.thumb_status === "pending" || p.thumb_status === "processing"
  );

  const { data: entries, isLoading: treeLoading } = useQuery<DirectoryEntry[]>({
    queryKey: ["browse", browsePath],
    queryFn: () => adminScans.browse(browsePath) as Promise<DirectoryEntry[]>,
  });

  const { data: dbLocations } = useQuery<Location[]>({
    queryKey: ["admin-locations"],
    queryFn: () => adminLocations.list() as Promise<Location[]>,
  });

  const { data: allSpecies } = useQuery<Species[]>({
    queryKey: ["admin-species"],
    queryFn: () => adminSpecies.list() as Promise<Species[]>,
  });

  const { data: trips } = useQuery<Trip[]>({
    queryKey: ["admin-trips"],
    queryFn: () => adminTrips.list() as Promise<Trip[]>,
  });

  const { data: photosPage, isLoading: photosLoading } = useQuery<PhotoPage>({
    queryKey: ["folder-photos", selectedFolderPath],
    queryFn: () =>
      adminPhotos.list({ folder_path: selectedFolderPath!, limit: 200 }) as Promise<PhotoPage>,
    enabled: !!selectedFolderPath,
    refetchInterval: hasPendingThumbs ? 3000 : false,
  });

  const { data: scanJob } = useQuery<ScanJob>({
    queryKey: ["scan-job", pendingJobId],
    queryFn: () => adminScans.get(pendingJobId!) as Promise<ScanJob>,
    enabled: !!pendingJobId,
    refetchInterval: 2000,
  });

  // eBird species near the folder location
  const locationCoords =
    folderLocation?.lat != null && folderLocation.lng != null
      ? { lat: folderLocation.lat, lng: folderLocation.lng }
      : null;

  const { data: ebirdSpecies } = useQuery<EbirdSpecies[]>({
    queryKey: ["ebird-species", locationCoords?.lat, locationCoords?.lng],
    queryFn: () =>
      adminMeta.ebird(locationCoords!.lat, locationCoords!.lng) as Promise<EbirdSpecies[]>,
    enabled: !!locationCoords,
    staleTime: 5 * 60 * 1000,
  });

  const ebirdSciNames = new Set(
    (ebirdSpecies ?? []).map((e) => e.scientific_name.toLowerCase())
  );

  // ── Sync localPhotos from query ───────────────────────────────────────────────

  useEffect(() => {
    if (!photosPage) return;
    if (folderLoadedRef.current !== selectedFolderPath) {
      folderLoadedRef.current = selectedFolderPath;
      setLocalPhotos([...photosPage.items].sort((a, b) => a.filename.localeCompare(b.filename)));
    } else {
      // Thumb polling refetch — only update thumbnail fields to preserve in-progress edits
      setLocalPhotos((prev) =>
        prev.map((p) => {
          const fresh = photosPage.items.find((f) => f.id === p.id);
          if (!fresh) return p;
          return {
            ...p,
            thumb_sm_url: fresh.thumb_sm_url,
            thumb_md_url: fresh.thumb_md_url,
            thumb_lg_url: fresh.thumb_lg_url,
            thumb_status: fresh.thumb_status,
            width: fresh.width,
            height: fresh.height,
            has_album: fresh.has_album,
          };
        })
      );
    }
  }, [photosPage, selectedFolderPath]);

  // Pre-fill album name from folder name
  useEffect(() => {
    if (selectedFolderPath) {
      setAlbumName(selectedFolderPath.split("/").pop() ?? "");
    }
  }, [selectedFolderPath]);

  // Stop polling when scan finishes
  useEffect(() => {
    if (!scanJob) return;
    if (scanJob.status === "done" || scanJob.status === "error") {
      setPendingJobId(null);
      folderLoadedRef.current = null; // force full reset so newly imported photos appear
      qc.invalidateQueries({ queryKey: ["folder-photos", selectedFolderPath] });
      qc.invalidateQueries({ queryKey: ["browse", browsePath] });
    }
  }, [scanJob?.status, scanJob, selectedFolderPath, browsePath, qc]);

  // Auto-link photos to pending album whenever localPhotos changes
  useEffect(() => {
    if (!pendingAlbumId || localPhotos.length === 0) return;
    const unlinked = localPhotos.map((p) => p.id).filter((id) => !albumLinkedRef.current.has(id));
    if (unlinked.length === 0) return;
    unlinked.forEach((id) => albumLinkedRef.current.add(id));
    adminAlbums.addPhotos(pendingAlbumId, unlinked).then(() => {
      folderLoadedRef.current = null;
      qc.invalidateQueries({ queryKey: ["folder-photos", selectedFolderPath] });
    });
  }, [pendingAlbumId, localPhotos, selectedFolderPath]);

  // ── Mutations ────────────────────────────────────────────────────────────────

  const importMutation = useMutation({
    mutationFn: () =>
      adminScans.start({ path: selectedFolderPath! }) as Promise<ScanJob>,
    onSuccess: (job) => setPendingJobId(job.id),
  });

  const applyToFolder = useMutation({
    mutationFn: async () => {
      // 1. Bulk-update location + date on all photos in folder
      const result = (await adminPhotos.bulkFolderUpdate({
        folder_path: selectedFolderPath!,
        location_id: folderLocation && !folderLocation.isNew ? (folderLocation.id ?? null) : null,
        location_name: folderLocation?.isNew ? folderLocation.name : null,
        location_lat: folderLocation?.isNew ? folderLocation.lat : null,
        location_lng: folderLocation?.isNew ? folderLocation.lng : null,
        location_country: folderLocation?.isNew ? (folderLocation.country ?? null) : null,
        shoot_date: folderDate || null,
      })) as { ok: boolean; location_id: number | null };

      if (result.location_id && folderLocation?.isNew) {
        setFolderLocation((prev) =>
          prev ? { ...prev, id: result.location_id!, isNew: false } : null
        );
      }

      // 2. Create album (if name provided); photos are linked via the pendingAlbumId effect
      if (albumName.trim()) {
        let tripId: number | null = null;

        if (albumTripId === "new" && newTripName.trim()) {
          const trip = (await adminTrips.create({ title: newTripName.trim() })) as Trip;
          tripId = trip.id;
          qc.invalidateQueries({ queryKey: ["admin-trips"] });
        } else if (typeof albumTripId === "number") {
          tripId = albumTripId;
        }

        const album = (await adminAlbums.create({
          title: albumName.trim(),
          slug: slugify(albumName.trim()),
          trip_id: tripId,
          is_published: false,
        })) as Album;

        // Store album ID — the auto-link effect will add current + future photos
        setPendingAlbumId(album.id);
        albumLinkedRef.current = new Set(); // reset so effect links all current photos

        qc.invalidateQueries({ queryKey: ["admin-albums"] });
      }

      return result;
    },
    onSuccess: () => {
      // Force a full reset so has_album and location_id update in the photo rows
      folderLoadedRef.current = null;
      qc.invalidateQueries({ queryKey: ["folder-photos", selectedFolderPath] });
      qc.invalidateQueries({ queryKey: ["admin-locations"] });
      qc.invalidateQueries({ queryKey: ["browse", browsePath] });
    },
  });

  // ── Derived data ─────────────────────────────────────────────────────────────

  const isImporting = importMutation.isPending || !!pendingJobId;
  const fileCount = selectedFolderEntry?.file_count ?? 0;
  const hasUnimported = fileCount > 0 && localPhotos.length < fileCount;

  // ── Photo update helper ───────────────────────────────────────────────────────

  const updatePhoto = useCallback((updated: Photo) => {
    setLocalPhotos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setCropPhoto((prev) => (prev?.id === updated.id ? updated : prev));
  }, []);

  // ── Navigation ───────────────────────────────────────────────────────────────

  const navigateTo = (path: string) => {
    setBrowsePath(path);
    setSelectedFolderPath(null);
    setSelectedFolderEntry(null);
    setCropPhoto(null);
    setLocalPhotos([]);
    folderLoadedRef.current = null;
    setPendingAlbumId(null);
    albumLinkedRef.current = new Set();
  };

  const openFolder = (entry: DirectoryEntry) => {
    setBrowsePath(entry.path);
    setSelectedFolderPath(entry.path);
    setSelectedFolderEntry(entry);
    setCropPhoto(null);
    setLocalPhotos([]);
    folderLoadedRef.current = null;
    setPendingJobId(null);
    setAlbumTripId("");
    setNewTripName("");
    setPendingAlbumId(null);
    albumLinkedRef.current = new Set();
  };

  const pathParts = browsePath ? browsePath.split("/").filter(Boolean) : [];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex h-full overflow-hidden">
        {/* ── Left: Folder tree ───────────────────────────────────────────────── */}
        {sidebarOpen ? (
          <aside className="w-64 shrink-0 border-r border-gray-800 flex flex-col overflow-hidden bg-gray-950">
            <div className="px-3 py-3 border-b border-gray-800 shrink-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Browse Media
                </p>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="text-gray-600 hover:text-gray-300 text-xs px-1"
                  title="Hide sidebar"
                >
                  ◀
                </button>
              </div>
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
              ) : entries?.filter((e) => e.is_dir).length === 0 ? (
                <p className="text-xs text-gray-600 p-3">No subfolders</p>
              ) : (
                <ul className="py-1">
                  {entries?.filter((e) => e.is_dir).map((entry) => (
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
        ) : (
          <button
            onClick={() => setSidebarOpen(true)}
            className="shrink-0 w-7 border-r border-gray-800 bg-gray-950 flex items-start justify-center pt-3 text-gray-600 hover:text-gray-300 text-xs"
            title="Show sidebar"
          >
            ▶
          </button>
        )}

        {/* ── Middle: Photo list ────────────────────────────────────────────────── */}
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
                  {localPhotos.length} imported
                  {fileCount > 0 && ` · ${fileCount} on disk`}
                </p>
              </div>

              {/* Folder settings */}
              <div className="px-5 py-3 border-b border-gray-800 bg-gray-900/20 shrink-0 space-y-2">
                {/* Row 1: Location + Date */}
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
                </div>

                {/* Row 2: Album (always visible) + Trip + Save button */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-gray-500 shrink-0">Album:</span>
                  <input
                    value={albumName}
                    onChange={(e) => setAlbumName(e.target.value)}
                    placeholder="Album name (leave blank to skip)…"
                    className="flex-1 min-w-48 bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                  <select
                    value={String(albumTripId)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAlbumTripId(v === "" ? "" : v === "new" ? "new" : Number(v));
                      if (v !== "new") setNewTripName("");
                    }}
                    className="shrink-0 bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="">— No trip —</option>
                    {trips?.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                    <option value="new">+ New trip…</option>
                  </select>
                  {albumTripId === "new" && (
                    <input
                      value={newTripName}
                      onChange={(e) => setNewTripName(e.target.value)}
                      placeholder="New trip name…"
                      className="flex-1 min-w-32 bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500"
                    />
                  )}
                  <button
                    onClick={() => applyToFolder.mutate()}
                    disabled={applyToFolder.isPending}
                    className="shrink-0 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white text-xs px-3 py-1.5 rounded transition-colors whitespace-nowrap"
                  >
                    {applyToFolder.isPending ? "Saving…" : "Save Folder Settings"}
                  </button>
                </div>

                {applyToFolder.isSuccess && (
                  <p className="text-xs text-green-400">Folder settings saved — photos updated.</p>
                )}
                {applyToFolder.isError && (
                  <p className="text-xs text-red-400">Failed to save. Try again.</p>
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
                        {fileCount - localPhotos.length} file
                        {fileCount - localPhotos.length !== 1 ? "s" : ""} not yet imported
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

              {/* Photo list */}
              <div className="flex-1 overflow-auto">
                {photosLoading ? (
                  <p className="text-gray-500 text-sm p-5">Loading photos…</p>
                ) : localPhotos.length === 0 ? (
                  <p className="text-gray-500 text-sm p-5">
                    No photos imported from this folder yet.
                    {fileCount > 0 && " Click Import above to add them."}
                  </p>
                ) : (
                  <div>
                    {localPhotos.map((photo) => (
                      <PhotoRow
                        key={photo.id}
                        photo={photo}
                        locationCoords={locationCoords}
                        allSpecies={allSpecies ?? []}
                        ebirdSpecies={ebirdSpecies ?? []}
                        ebirdSciNames={ebirdSciNames}
                        onPhotoUpdate={updatePhoto}
                        onCropClick={setCropPhoto}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Crop modal — rendered outside the flex layout so it can overlay everything */}
      {cropPhoto && (
        <CropModal
          photo={cropPhoto}
          onClose={() => setCropPhoto(null)}
          onSaved={(updated) => {
            updatePhoto(updated);
            // Refetch immediately so thumb polling kicks in right away
            qc.invalidateQueries({ queryKey: ["folder-photos", selectedFolderPath] });
            // Auto-publish if photo is in an album and not yet published
            if (updated.has_album && !updated.is_published) {
              adminPhotos.update(updated.id, { is_published: true }).then((fresh) =>
                updatePhoto(fresh as Photo)
              );
            }
          }}
        />
      )}
    </>
  );
}

// ── PhotoRow ──────────────────────────────────────────────────────────────────

function PhotoRow({
  photo,
  locationCoords,
  allSpecies,
  ebirdSpecies,
  ebirdSciNames,
  onPhotoUpdate,
  onCropClick,
}: {
  photo: Photo;
  locationCoords: { lat: number; lng: number } | null;
  allSpecies: Species[];
  ebirdSpecies: EbirdSpecies[];
  ebirdSciNames: Set<string>;
  onPhotoUpdate: (updated: Photo) => void;
  onCropClick: (photo: Photo) => void;
}) {
  const qc = useQueryClient();

  const [title, setTitle] = useState(photo.title ?? "");
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [speciesIds, setSpeciesIds] = useState<number[]>(photo.species.map((s) => s.id));
  const [speciesSearch, setSpeciesSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const saveMeta = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      adminPhotos.update(photo.id, data) as Promise<Photo>,
    onSuccess: (updated) => onPhotoUpdate(updated as Photo),
  });

  const saveSpeciesMutation = useMutation({
    mutationFn: (ids: number[]) =>
      adminPhotos
        .setSpecies(photo.id, ids)
        .then(() => adminPhotos.get(photo.id)) as Promise<Photo>,
    onSuccess: (updated) => onPhotoUpdate(updated as Photo),
  });

  const createAndTag = useMutation({
    mutationFn: (ebird: EbirdSpecies) =>
      adminSpecies.create({
        common_name: ebird.common_name,
        scientific_name: ebird.scientific_name || null,
      }) as Promise<Species>,
    onSuccess: (created) => {
      const newIds = [...speciesIds, created.id];
      setSpeciesIds(newIds);
      setSpeciesSearch("");
      setShowDropdown(false);
      saveSpeciesMutation.mutate(newIds);
      qc.invalidateQueries({ queryKey: ["admin-species"] });
      if (photo.has_album && !photo.is_published) saveMeta.mutate({ is_published: true });
    },
  });

  const addSpecies = (id: number) => {
    const newIds = [...speciesIds, id];
    setSpeciesIds(newIds);
    setSpeciesSearch("");
    setShowDropdown(false);
    saveSpeciesMutation.mutate(newIds);
    if (photo.has_album && !photo.is_published) saveMeta.mutate({ is_published: true });
  };

  const removeSpecies = (id: number) => {
    const newIds = speciesIds.filter((sid) => sid !== id);
    setSpeciesIds(newIds);
    saveSpeciesMutation.mutate(newIds);
  };

  const handlePublishChange = (val: boolean) => {
    onPhotoUpdate({ ...photo, is_published: val });
    saveMeta.mutate({ is_published: val });
  };

  // Species filtering
  const q = speciesSearch.toLowerCase();

  const filteredDb = allSpecies
    .filter(
      (s) =>
        !speciesIds.includes(s.id) &&
        q.length >= 1 &&
        (s.common_name.toLowerCase().includes(q) ||
          (s.scientific_name ?? "").toLowerCase().includes(q))
    )
    .sort((a, b) => {
      if (!locationCoords) return 0;
      const aE = ebirdSciNames.has((a.scientific_name ?? "").toLowerCase());
      const bE = ebirdSciNames.has((b.scientific_name ?? "").toLowerCase());
      if (aE && !bE) return -1;
      if (!aE && bE) return 1;
      return 0;
    })
    .slice(0, 6);

  const dbSciNames = new Set(
    allSpecies.filter((s) => s.scientific_name).map((s) => s.scientific_name!.toLowerCase())
  );

  const ebirdOnlyMatches =
    q.length >= 2
      ? (ebirdSpecies ?? [])
          .filter(
            (e) =>
              !dbSciNames.has(e.scientific_name.toLowerCase()) &&
              (e.common_name.toLowerCase().includes(q) ||
                e.scientific_name.toLowerCase().includes(q))
          )
          .slice(0, 4)
      : [];

  // Tier 3: global eBird taxonomy search (fires when ≥3 chars, no location needed)
  const { data: globalTaxonomy } = useQuery<EbirdSpecies[]>({
    queryKey: ["ebird-find", speciesSearch],
    queryFn: () => adminMeta.ebirdFind(speciesSearch) as Promise<EbirdSpecies[]>,
    enabled: showDropdown && speciesSearch.length >= 3,
    staleTime: 5 * 60 * 1000,
  });

  const ebirdLocationCodes = new Set((ebirdSpecies ?? []).map((e) => e.species_code));
  const globalOnlyMatches =
    q.length >= 3
      ? (globalTaxonomy ?? [])
          .filter(
            (e) =>
              !ebirdLocationCodes.has(e.species_code) &&
              !dbSciNames.has(e.scientific_name.toLowerCase())
          )
          .slice(0, 4)
      : [];

  const taggedSpecies = [
    ...photo.species.filter((s) => speciesIds.includes(s.id)),
    ...(allSpecies?.filter(
      (s) => speciesIds.includes(s.id) && !photo.species.find((ps) => ps.id === s.id)
    ) ?? []),
  ];

  const dropdownVisible =
    showDropdown &&
    speciesSearch.length >= 1 &&
    (filteredDb.length > 0 || ebirdOnlyMatches.length > 0 || globalOnlyMatches.length > 0 || speciesSearch.length >= 2);

  return (
    <div className="flex gap-4 px-5 py-3 border-b border-gray-800 hover:bg-gray-900/20 transition-colors">
      {/* Thumbnail + crop button */}
      <div className="shrink-0 w-40">
        <div
          className="w-40 h-28 bg-gray-800 rounded overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => onCropClick(photo)}
          title="Click to open crop tool"
        >
          {photo.thumb_sm_url ? (
            <img
              src={photo.thumb_sm_url}
              alt={photo.filename}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600">
              <span className="text-sm">
                {photo.thumb_status === "pending" || photo.thumb_status === "processing"
                  ? "⏳"
                  : photo.thumb_status === "error"
                  ? "✕"
                  : "?"}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => onCropClick(photo)}
          className="mt-1 w-full text-[10px] text-gray-600 hover:text-gray-300 transition-colors text-center"
        >
          ✂ Crop
        </button>
      </div>

      {/* Info + inline editing */}
      <div className="flex-1 min-w-0">
        {/* Filename + meta */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-sm font-medium text-white truncate max-w-xs">
            {photo.filename}
          </span>
          {photo.file_type !== "jpeg" && (
            <span className="text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded uppercase">
              {photo.file_type}
            </span>
          )}
          {photo.captured_at && (
            <span className="text-xs text-gray-600">
              {new Date(photo.captured_at).toLocaleDateString()}
            </span>
          )}
          {photo.camera_model && (
            <span className="text-xs text-gray-600">{photo.camera_model}</span>
          )}
          {saveMeta.isPending && (
            <span className="text-xs text-gray-600 italic">saving…</span>
          )}
        </div>

        {/* Title + Caption */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              const clean = title.trim() || null;
              if (clean !== (photo.title ?? null)) {
                const payload: Record<string, unknown> = { title: clean };
                if (clean && photo.has_album && !photo.is_published) payload.is_published = true;
                saveMeta.mutate(payload);
              }
            }}
            placeholder="Title…"
            className="bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500 placeholder-gray-600"
          />
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onBlur={() => {
              const clean = caption.trim() || null;
              if (clean !== (photo.caption ?? null)) {
                const payload: Record<string, unknown> = { caption: clean };
                if (clean && photo.has_album && !photo.is_published) payload.is_published = true;
                saveMeta.mutate(payload);
              }
            }}
            placeholder="Caption…"
            className="bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500 placeholder-gray-600"
          />
        </div>

        {/* Species + Published */}
        <div className="flex items-start gap-3">
          {/* Species tagger */}
          <div className="flex-1 min-w-0 relative">
            <div className="flex flex-wrap items-center gap-1">
              {taggedSpecies.map((s) => (
                <span
                  key={s.id}
                  className="bg-brand-600/20 text-brand-400 border border-brand-600/30 text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 shrink-0"
                >
                  {s.common_name}
                  <button
                    onClick={() => removeSpecies(s.id)}
                    className="hover:text-red-400 leading-none"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                value={speciesSearch}
                onChange={(e) => {
                  setSpeciesSearch(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                placeholder={taggedSpecies.length === 0 ? "Add species…" : "+"}
                className="bg-transparent text-xs text-white placeholder-gray-600 focus:outline-none border-b border-transparent focus:border-gray-600 min-w-24 max-w-40 py-0.5"
              />
            </div>

            {dropdownVisible && (
              <div className="absolute z-40 left-0 top-full mt-1 w-72 bg-gray-800 border border-gray-700 rounded shadow-xl max-h-52 overflow-auto">
                {filteredDb.map((s) => {
                  const isNearby =
                    locationCoords &&
                    ebirdSciNames.has((s.scientific_name ?? "").toLowerCase());
                  return (
                    <button
                      key={s.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addSpecies(s.id)}
                      className="w-full text-left px-2.5 py-1.5 text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-1.5"
                    >
                      {isNearby ? (
                        <span className="text-brand-400 text-xs shrink-0">📍</span>
                      ) : (
                        <span className="w-4 shrink-0" />
                      )}
                      <span className="flex-1 truncate">
                        {s.common_name}
                        {s.scientific_name && (
                          <span className="text-gray-500 italic ml-1 text-xs">
                            {s.scientific_name}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}

                {ebirdOnlyMatches.length > 0 && (
                  <>
                    {filteredDb.length > 0 && (
                      <div className="border-t border-gray-700 mx-2 my-1" />
                    )}
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider px-2.5 py-0.5">
                      From eBird — click to add &amp; tag
                    </p>
                    {ebirdOnlyMatches.map((e) => (
                      <button
                        key={e.species_code}
                        onMouseDown={(ev) => ev.preventDefault()}
                        onClick={() => createAndTag.mutate(e)}
                        disabled={createAndTag.isPending}
                        className="w-full text-left px-2.5 py-1.5 text-sm text-gray-400 hover:bg-gray-700 flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <span className="text-brand-500 text-xs shrink-0">📍+</span>
                        <span className="flex-1 truncate">
                          {e.common_name}
                          {e.scientific_name && (
                            <span className="text-gray-500 italic ml-1 text-xs">
                              {e.scientific_name}
                            </span>
                          )}
                        </span>
                      </button>
                    ))}
                  </>
                )}

                {globalOnlyMatches.length > 0 && (
                  <>
                    {(filteredDb.length > 0 || ebirdOnlyMatches.length > 0) && (
                      <div className="border-t border-gray-700 mx-2 my-1" />
                    )}
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider px-2.5 py-0.5">
                      eBird Global — click to add &amp; tag
                    </p>
                    {globalOnlyMatches.map((e) => (
                      <button
                        key={e.species_code}
                        onMouseDown={(ev) => ev.preventDefault()}
                        onClick={() => createAndTag.mutate(e)}
                        disabled={createAndTag.isPending}
                        className="w-full text-left px-2.5 py-1.5 text-sm text-gray-400 hover:bg-gray-700 flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <span className="text-gray-500 text-xs shrink-0">🌐+</span>
                        <span className="flex-1 truncate">
                          {e.common_name}
                          {e.scientific_name && (
                            <span className="text-gray-500 italic ml-1 text-xs">
                              {e.scientific_name}
                            </span>
                          )}
                        </span>
                      </button>
                    ))}
                  </>
                )}

                {filteredDb.length === 0 && ebirdOnlyMatches.length === 0 && globalOnlyMatches.length === 0 && (
                  <p className="px-2.5 py-2 text-xs text-gray-500">No matches</p>
                )}
              </div>
            )}
          </div>

          {/* Published toggle — requires photo to be in an album first */}
          <label
            className={`flex items-center gap-1.5 shrink-0 pt-0.5 ${photo.has_album ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
            title={photo.has_album ? undefined : "Save folder settings with an album name first"}
          >
            <input
              type="checkbox"
              checked={photo.is_published}
              disabled={!photo.has_album}
              onChange={(e) => handlePublishChange(e.target.checked)}
              className="rounded"
            />
            <span className="text-xs text-gray-400">
              {photo.has_album ? "Published" : "No album"}
            </span>
          </label>
        </div>
      </div>
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
            onMouseDown={(e) => {
              e.preventDefault();
              handleClear();
            }}
            className="shrink-0 text-gray-500 hover:text-white text-xs px-1.5 py-1"
          >
            ✕
          </button>
        )}
      </div>

      {value?.lat != null && (
        <p className="text-[10px] text-gray-600 mt-0.5">
          {value.lat.toFixed(4)}, {value.lng?.toFixed(4)}
          {value.isNew && (
            <span className="text-orange-500 ml-1">(new — will be saved on Apply)</span>
          )}
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
                    handleSelect({
                      name: s.name,
                      lat: s.lat,
                      lng: s.lng,
                      country: s.country,
                      isNew: true,
                    });
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
