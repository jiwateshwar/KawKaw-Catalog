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

export function CropModal({ photo, onClose, onSaved }: Props) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // react-easy-crop gives us the cropped area both in pixels and as percentages.
  // We store the percentage-based (0–1) version which is independent of display size.
  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const imageUrl = photo.thumb_md_url ?? photo.thumb_sm_url;

  async function handleSave() {
    if (!croppedAreaPixels || !imageUrl) return;

    // We need pixel → fraction conversion. react-easy-crop only gives us
    // pixel values relative to the natural image size when using a URL source,
    // but because we use the md thumbnail (which may be smaller than original),
    // we send the fraction computed from the cropper's own percentageCrop instead.
    // We re-fire with the percentage version by storing it separately.
    setSaving(true);
    setError(null);
    try {
      const updated = await adminPhotos.setCrop(photo.id, {
        crop_x: normalizedCrop.x,
        crop_y: normalizedCrop.y,
        crop_w: normalizedCrop.width,
        crop_h: normalizedCrop.height,
      }) as Photo;
      onSaved(updated);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save crop.");
    } finally {
      setSaving(false);
    }
  }

  // We track the percentage-based crop from onCropComplete's first argument.
  const [normalizedCrop, setNormalizedCrop] = useState({ x: 0, y: 0, width: 1, height: 1 });

  const onCropCompleteWithPct = useCallback((percentageCrop: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
    setNormalizedCrop({
      x: percentageCrop.x / 100,
      y: percentageCrop.y / 100,
      width: percentageCrop.width / 100,
      height: percentageCrop.height / 100,
    });
  }, []);

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
      <div className="bg-gray-900 rounded-lg flex flex-col" style={{ width: 680, maxHeight: "90vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 shrink-0">
          <h2 className="text-sm font-medium text-white">Crop Photo</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">
            ×
          </button>
        </div>

        {/* Cropper area */}
        <div className="relative bg-black" style={{ height: 420 }}>
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={undefined}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropCompleteWithPct}
            style={{
              containerStyle: { background: "#000" },
            }}
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
            Saving crop will regenerate thumbnails.
          </p>
          <div className="flex gap-2">
            {error && <p className="text-red-400 text-xs self-center mr-2">{error}</p>}
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
