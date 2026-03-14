"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { adminScans } from "@/lib/api";
import type { ThumbnailStatus, ScanJob } from "@/types/api";

export default function AdminDashboard() {
  const { data: thumbStatus } = useQuery<ThumbnailStatus>({
    queryKey: ["thumb-status"],
    queryFn: () => adminScans.thumbnailStatus() as Promise<ThumbnailStatus>,
    refetchInterval: 15000,
  });

  const { data: scans } = useQuery<ScanJob[]>({
    queryKey: ["scans"],
    queryFn: () => adminScans.list() as Promise<ScanJob[]>,
  });

  const lastScan = scans?.[0] ?? null;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-8">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Thumbnails Done" value={thumbStatus?.done ?? "—"} color="green" />
        <StatCard label="Pending" value={thumbStatus?.pending ?? "—"} color="yellow" />
        <StatCard label="Processing" value={thumbStatus?.processing ?? "—"} color="blue" />
        <StatCard label="Errors" value={thumbStatus?.error ?? "—"} color="red" />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3 mb-8">
        <Link
          href="/admin/photos"
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm px-4 py-2 rounded-md transition-colors"
        >
          Browse Photos
        </Link>
        <Link
          href="/admin/scans"
          className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2 rounded-md transition-colors"
        >
          Import Folder
        </Link>
        <Link
          href="/admin/species"
          className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2 rounded-md transition-colors"
        >
          Manage Species
        </Link>
      </div>

      {/* Last scan */}
      {lastScan && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <h2 className="text-sm font-medium text-gray-400 mb-3">Last Import</h2>
          <p className="text-white font-medium">{lastScan.root_path}</p>
          <div className="flex gap-4 mt-2 text-sm text-gray-400">
            <span>Status: <span className={lastScan.status === "done" ? "text-green-400" : lastScan.status === "error" ? "text-red-400" : "text-yellow-400"}>{lastScan.status}</span></span>
            <span>Found: {lastScan.files_found}</span>
            <span>Imported: {lastScan.files_imported}</span>
            <span>Skipped: {lastScan.files_skipped}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: "green" | "yellow" | "blue" | "red";
}) {
  const colors = {
    green: "text-green-400",
    yellow: "text-yellow-400",
    blue: "text-blue-400",
    red: "text-red-400",
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${colors[color]}`}>{value}</p>
    </div>
  );
}
