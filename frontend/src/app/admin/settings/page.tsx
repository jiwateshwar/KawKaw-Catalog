"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminSettings } from "@/lib/api";

interface AppSettings {
  app_title: string;
  app_description: string | null;
}

export default function AdminSettingsPage() {
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery<AppSettings>({
    queryKey: ["admin-settings"],
    queryFn: () => adminSettings.get() as Promise<AppSettings>,
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Initialise form once settings load
  const [formReady, setFormReady] = useState(false);
  if (settings && !formReady) {
    setTitle(settings.app_title);
    setDescription(settings.app_description ?? "");
    setFormReady(true);
  }

  // Confirmation guard for destructive actions
  const [confirmTarget, setConfirmTarget] = useState<"content" | "app" | null>(null);
  const [confirmInput, setConfirmInput] = useState("");

  const saveSettings = useMutation({
    mutationFn: () =>
      adminSettings.update({
        app_title: title,
        app_description: description || null,
      }) as Promise<AppSettings>,
    onSuccess: (updated) => {
      qc.setQueryData(["admin-settings"], updated);
    },
  });

  const resetApp = useMutation({
    mutationFn: () => adminSettings.resetApp() as Promise<AppSettings>,
    onSuccess: (updated) => {
      setTitle(updated.app_title);
      setDescription(updated.app_description ?? "");
      qc.setQueryData(["admin-settings"], updated);
      setConfirmTarget(null);
      setConfirmInput("");
    },
  });

  const resetContent = useMutation({
    mutationFn: () => adminSettings.resetContent(),
    onSuccess: () => {
      // Invalidate all catalog queries
      qc.invalidateQueries();
      setConfirmTarget(null);
      setConfirmInput("");
    },
  });

  const handleDestructiveAction = () => {
    if (confirmTarget === "content") resetContent.mutate();
    if (confirmTarget === "app") resetApp.mutate();
  };

  const CONFIRM_WORD = confirmTarget === "content" ? "RESET CONTENT" : "RESET SETTINGS";
  const confirmReady = confirmInput.trim().toUpperCase() === CONFIRM_WORD;

  if (isLoading) {
    return (
      <div className="p-8 text-gray-500 text-sm">Loading settings…</div>
    );
  }

  return (
    <div className="p-8 max-w-2xl space-y-10">
      <h1 className="text-2xl font-bold text-white">Settings</h1>

      {/* ── App Settings ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
          App Settings
        </h2>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Site Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              placeholder="KawKaw Catalog"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Site Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 resize-none"
              placeholder="A personal bird photography catalog…"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => saveSettings.mutate()}
              disabled={saveSettings.isPending}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded transition-colors"
            >
              {saveSettings.isPending ? "Saving…" : "Save"}
            </button>
            {saveSettings.isSuccess && (
              <span className="text-xs text-green-400">Saved.</span>
            )}
            {saveSettings.isError && (
              <span className="text-xs text-red-400">Failed to save.</span>
            )}
          </div>
        </div>
      </section>

      {/* ── Database Backup ───────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
          Database Backup
        </h2>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <p className="text-sm text-gray-400 mb-4">
            Download a full JSON export of all catalog data — photos, species, albums, trips,
            locations, and settings. User accounts are not included.
          </p>
          <a
            href={adminSettings.backupUrl}
            download
            className="inline-block bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2 rounded transition-colors"
          >
            ↓ Download Backup
          </a>
        </div>
      </section>

      {/* ── Danger Zone ───────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-red-500 uppercase tracking-wider mb-4">
          Danger Zone
        </h2>
        <div className="bg-gray-900 border border-red-900/40 rounded-lg divide-y divide-gray-800">
          {/* Reset App Settings */}
          <div className="p-5 flex items-start justify-between gap-6">
            <div>
              <p className="text-sm font-medium text-white">Reset App Settings</p>
              <p className="text-xs text-gray-500 mt-1">
                Resets the site title and description to factory defaults. User accounts are
                not affected.
              </p>
            </div>
            <button
              onClick={() => {
                setConfirmTarget("app");
                setConfirmInput("");
              }}
              className="shrink-0 bg-red-900/40 hover:bg-red-800/60 border border-red-700/40 text-red-300 text-xs px-3 py-1.5 rounded transition-colors"
            >
              Reset Settings
            </button>
          </div>

          {/* Reset Content */}
          <div className="p-5 flex items-start justify-between gap-6">
            <div>
              <p className="text-sm font-medium text-white">Reset Content</p>
              <p className="text-xs text-gray-500 mt-1">
                Permanently deletes all photos, species, albums, trips, locations, and scan
                history. Thumbnail files on disk are also removed. This cannot be undone.
              </p>
            </div>
            <button
              onClick={() => {
                setConfirmTarget("content");
                setConfirmInput("");
              }}
              className="shrink-0 bg-red-900/40 hover:bg-red-800/60 border border-red-700/40 text-red-300 text-xs px-3 py-1.5 rounded transition-colors"
            >
              Reset Content
            </button>
          </div>
        </div>
      </section>

      {/* ── Confirmation modal ────────────────────────────────────────────── */}
      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-gray-900 border border-red-800/60 rounded-lg p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-2">
              {confirmTarget === "content"
                ? "Reset all content?"
                : "Reset app settings?"}
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              {confirmTarget === "content"
                ? "This will permanently delete every photo, species, album, trip, location, and scan record. Thumbnails on disk will also be removed. There is no undo."
                : "This will reset the site title and description to their factory defaults."}
            </p>
            <p className="text-xs text-gray-500 mb-2">
              Type{" "}
              <span className="font-mono text-red-400 bg-gray-800 px-1 rounded">
                {CONFIRM_WORD}
              </span>{" "}
              to confirm.
            </p>
            <input
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              autoFocus
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 font-mono mb-4"
              placeholder={CONFIRM_WORD}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setConfirmTarget(null);
                  setConfirmInput("");
                }}
                className="text-sm text-gray-400 hover:text-white px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                onClick={handleDestructiveAction}
                disabled={!confirmReady || resetContent.isPending || resetApp.isPending}
                className="bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm px-4 py-1.5 rounded transition-colors"
              >
                {resetContent.isPending || resetApp.isPending ? "Working…" : "Confirm"}
              </button>
            </div>
            {(resetContent.isError || resetApp.isError) && (
              <p className="text-xs text-red-400 mt-3">Operation failed. Check server logs.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
