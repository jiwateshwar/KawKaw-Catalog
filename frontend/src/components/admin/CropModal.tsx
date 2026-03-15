"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import { adminPhotos } from "@/lib/api";
import type { Photo } from "@/types/api";

interface Props {
  photo: Photo;
  onClose: () => void;
  onSaved: (updated: Photo) => void;
}

type Preset = "free" | "landscape" | "portrait";

export function CropModal({ photo, onClose, onSaved }: Props) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<Preset>("free");

  const [normalizedCrop, setNormalizedCrop] = useState({
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  });

  const onCropComplete = useCallback((percentageCrop: Area, _areaPixels: Area) => {
    setNormalizedCrop({
      x: percentageCrop.x / 100,
      y: percentageCrop.y / 100,
      width: percentageCrop.width / 100,
      height: percentageCrop.height / 100,
    });
  }, []);

  const imageUrl = photo.thumb_md_url ?? photo.thumb_sm_url;

  // Aspect ratios derived from the photo's stored dimensions
  // (these are post-EXIF-rotation so portrait/landscape is already correct)
  const naturalW = photo.width ?? 4;
  const naturalH = photo.height ?? 3;
  const landscapeRatio = naturalW / naturalH;
  const portraitRatio = naturalH / naturalW;

  const aspectForPreset: Record<Preset, number | undefined> = {
    free: undefined,
    landscape: landscapeRatio,
    portrait: portraitRatio,
  };

  const handlePreset = (p: Preset) => {
    setPreset(p);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  async function handleSave() {
    if (!imageUrl) return;
    setSaving(true);
    setError(null);
    try {
      const updated = (await adminPhotos.setCrop(photo.id, {
        crop_x: normalizedCrop.x,
        crop_y: normalizedCrop.y,
        crop_w: normalizedCrop.width,
        crop_h: normalizedCrop.height,
      })) as Photo;
      onSaved(updated);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save crop.");
    } finally {
      setSaving(false);
    }
  }

  if (!imageUrl) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
        <div className="bg-gray-900 rounded-lg p-6 text-gray-400 text-sm">
          No preview available — thumbnail not yet generated.
          <button onClick={onClose} className="block mt-4 text-white underline">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div
        className="bg-gray-900 rounded-lg flex flex-col"
        style={{ width: 720, maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-medium text-white">Crop Photo</h2>
            <span className="text-xs text-gray-600 truncate max-w-64">{photo.filename}</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-lg leading-none ml-4"
          >
            ×
          </button>
        </div>

        {/* Preset buttons */}
        <div className="px-5 py-2.5 border-b border-gray-800 shrink-0 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Crop ratio:</span>
          {(["free", "landscape", "portrait"] as Preset[]).map((p) => (
            <button
              key={p}
              onClick={() => handlePreset(p)}
              className={`px-3 py-1 text-xs rounded transition-colors border ${
                preset === p
                  ? "bg-brand-600 border-brand-600 text-white"
                  : "border-gray-700 text-gray-400 hover:text-white hover:border-gray-500"
              }`}
            >
              {p === "free"
                ? "Free"
                : p === "landscape"
                ? `Landscape (${naturalW}:${naturalH})`
                : `Portrait (${naturalH}:${naturalW})`}
            </button>
          ))}
          {photo.width && photo.height && (
            <span className="ml-auto text-xs text-gray-600">
              original {photo.width}×{photo.height}px
            </span>
          )}
        </div>

        {/* Cropper area */}
        <div className="relative bg-black flex-1" style={{ minHeight: 380 }}>
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={aspectForPreset[preset]}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            style={{ containerStyle: { background: "#000" } }}
          />
        </div>

        {/* Zoom slider */}
        <div className="px-5 py-3 flex items-center gap-3 border-t border-gray-800 shrink-0">
          <span className="text-xs text-gray-500 w-10">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-brand-500"
          />
          <span className="text-xs text-gray-500 w-8 text-right">{zoom.toFixed(1)}×</span>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 flex items-center justify-between border-t border-gray-800 shrink-0">
          <p className="text-xs text-gray-500">
            Crop is applied to the original file — thumbnails will regenerate automatically.
          </p>
          <div className="flex items-center gap-2">
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 text-sm bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-md transition-colors"
            >
              {saving ? "Saving…" : "Apply Crop"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
