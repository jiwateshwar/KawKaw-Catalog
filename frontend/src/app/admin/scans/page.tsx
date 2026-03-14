"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminScans, adminLocations } from "@/lib/api";
import type { DirectoryEntry, ScanJob, Location } from "@/types/api";
import { format } from "date-fns";

export default function ScansPage() {
  const [browsePath, setBrowsePath] = useState("");
  const [importModal, setImportModal] = useState<string | null>(null); // path to import
  const qc = useQueryClient();

  const { data: entries, isLoading: browsing } = useQuery<DirectoryEntry[]>({
    queryKey: ["browse", browsePath],
    queryFn: () => adminScans.browse(browsePath) as Promise<DirectoryEntry[]>,
  });

  const { data: scans } = useQuery<ScanJob[]>({
    queryKey: ["scans"],
    queryFn: () => adminScans.list() as Promise<ScanJob[]>,
    refetchInterval: 5000,
  });

  const { data: locations } = useQuery<Location[]>({
    queryKey: ["admin-locations"],
    queryFn: () => adminLocations.list() as Promise<Location[]>,
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Import Folder</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Folder browser */}
        <div>
          <h2 className="text-base font-medium mb-3 text-gray-300">Browse Media Folder</h2>
          {browsePath && (
            <button
              onClick={() => {
                const parts = browsePath.split("/");
                parts.pop();
                setBrowsePath(parts.join("/"));
              }}
              className="text-sm text-brand-400 hover:underline mb-3 block"
            >
              ← Back
            </button>
          )}
          <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
            {browsing ? (
              <p className="text-gray-500 p-4 text-sm">Loading...</p>
            ) : entries?.length === 0 ? (
              <p className="text-gray-500 p-4 text-sm">No folders found in MEDIA_ROOT.</p>
            ) : (
              <ul className="divide-y divide-gray-800">
                {entries?.map((entry) => (
                  <li key={entry.path} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-800/50">
                    <button
                      onClick={() => entry.is_dir && setBrowsePath(entry.path)}
                      className="flex items-center gap-2 text-sm text-left flex-1"
                      disabled={!entry.is_dir}
                    >
                      <span className="text-gray-400">{entry.is_dir ? "📁" : "📄"}</span>
                      <span className="text-white">{entry.name}</span>
                      {entry.is_dir && entry.file_count !== null && entry.file_count > 0 && (
                        <span className="text-xs text-brand-500 ml-1">{entry.file_count} files</span>
                      )}
                    </button>
                    {entry.is_dir && (
                      <button
                        onClick={() => setImportModal(entry.path)}
                        className="ml-3 bg-brand-600 hover:bg-brand-700 text-white text-xs px-3 py-1 rounded transition-colors shrink-0"
                      >
                        Import
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Scan history */}
        <div>
          <h2 className="text-base font-medium mb-3 text-gray-300">Import History</h2>
          <div className="space-y-3">
            {scans?.map((job) => (
              <div key={job.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <p className="text-sm text-white font-medium truncate pr-4">{job.root_path}</p>
                  <StatusBadge status={job.status} />
                </div>
                <div className="flex gap-3 mt-2 text-xs text-gray-500">
                  <span>Found: {job.files_found}</span>
                  <span>Imported: <span className="text-brand-400">{job.files_imported}</span></span>
                  <span>Skipped: {job.files_skipped}</span>
                </div>
                {job.shoot_date && (
                  <p className="text-xs text-gray-500 mt-1">Date: {job.shoot_date}</p>
                )}
                <p className="text-xs text-gray-600 mt-1">
                  {format(new Date(job.started_at), "PPP p")}
                </p>
                {job.error_message && (
                  <p className="text-xs text-red-400 mt-1">{job.error_message}</p>
                )}
              </div>
            ))}
            {(!scans || scans.length === 0) && (
              <p className="text-gray-500 text-sm">No imports yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Import modal */}
      {importModal && (
        <ImportModal
          path={importModal}
          locations={locations ?? []}
          onClose={() => setImportModal(null)}
          onStarted={() => {
            setImportModal(null);
            qc.invalidateQueries({ queryKey: ["scans"] });
          }}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    running: "bg-yellow-500/20 text-yellow-400",
    done: "bg-green-500/20 text-green-400",
    error: "bg-red-500/20 text-red-400",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${styles[status as keyof typeof styles] ?? "bg-gray-700 text-gray-400"}`}>
      {status}
    </span>
  );
}

function ImportModal({
  path,
  locations,
  onClose,
  onStarted,
}: {
  path: string;
  locations: Location[];
  onClose: () => void;
  onStarted: () => void;
}) {
  const folderName = path.split("/").filter(Boolean).pop() ?? path;

  const [locationId, setLocationId] = useState<number | "">("");
  const [locationName, setLocationName] = useState("");
  const [shootDate, setShootDate] = useState("");
  const [createTrip, setCreateTrip] = useState(false);
  const [tripName, setTripName] = useState(folderName);
  const [useNewLocation, setUseNewLocation] = useState(false);

  const startScan = useMutation({
    mutationFn: () =>
      adminScans.start({
        path,
        location_id: useNewLocation ? null : locationId || null,
        location_name: useNewLocation ? locationName || null : null,
        shoot_date: shootDate || null,
        create_trip: createTrip,
        trip_name: createTrip ? tripName : null,
      }),
    onSuccess: onStarted,
  });

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-white">Configure Import</h2>
          <p className="text-sm text-gray-400 mt-1 font-mono break-all">{path}</p>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Location</label>
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setUseNewLocation(false)}
              className={`text-xs px-3 py-1 rounded ${!useNewLocation ? "bg-brand-600 text-white" : "bg-gray-800 text-gray-400"}`}
            >
              Existing
            </button>
            <button
              onClick={() => setUseNewLocation(true)}
              className={`text-xs px-3 py-1 rounded ${useNewLocation ? "bg-brand-600 text-white" : "bg-gray-800 text-gray-400"}`}
            >
              Create new
            </button>
          </div>
          {useNewLocation ? (
            <input
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="Location name"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
            />
          ) : (
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value ? Number(e.target.value) : "")}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
            >
              <option value="">— No location —</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Shoot Date</label>
          <input
            type="date"
            value={shootDate}
            onChange={(e) => setShootDate(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
          />
          <p className="text-xs text-gray-500 mt-1">Used as fallback for photos without EXIF date</p>
        </div>

        {/* Create trip */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={createTrip}
              onChange={(e) => setCreateTrip(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-300">Create a Trip for this import</span>
          </label>
          {createTrip && (
            <input
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
              placeholder="Trip name"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 mt-2"
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => startScan.mutate()}
            disabled={startScan.isPending}
            className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm py-2 rounded-md transition-colors"
          >
            {startScan.isPending ? "Starting..." : "Start Import"}
          </button>
        </div>

        {startScan.isError && (
          <p className="text-red-400 text-sm">Failed to start import. Check the path and try again.</p>
        )}
      </div>
    </div>
  );
}
