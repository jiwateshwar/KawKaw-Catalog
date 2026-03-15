/**
 * Lightweight fetch wrapper for the KawKaw Catalog API.
 * All requests go through /api (proxied by Next.js → FastAPI).
 */

const BASE = "/api";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include", // send httpOnly cookies
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, detail?.detail ?? res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---- Auth ----
export const auth = {
  login: (username: string, password: string) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: () => request("/auth/me"),
  refresh: (refresh_token: string) =>
    request("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token }),
    }),
};

// ---- Public ----
export const photos = {
  list: (params?: Record<string, string | number | undefined>) =>
    request(`/photos?${new URLSearchParams(clean(params)).toString()}`),
  featured: (limit = 12) => request(`/photos/featured?limit=${limit}`),
  get: (id: number) => request(`/photos/${id}`),
};

export const species = {
  list: (params?: Record<string, string | number | undefined>) =>
    request(`/species?${new URLSearchParams(clean(params)).toString()}`),
  get: (id: number) => request(`/species/${id}`),
  photos: (id: number, params?: Record<string, string | number | undefined>) =>
    request(`/species/${id}/photos?${new URLSearchParams(clean(params)).toString()}`),
};

export const albums = {
  list: () => request("/albums"),
  get: (slug: string) => request(`/albums/${slug}`),
  photos: (slug: string, params?: Record<string, string | number | undefined>) =>
    request(`/albums/${slug}/photos?${new URLSearchParams(clean(params)).toString()}`),
};

export const trips = {
  list: (params?: Record<string, string | number | undefined>) =>
    request(`/trips?${new URLSearchParams(clean(params)).toString()}`),
  get: (id: number) => request(`/trips/${id}`),
  photos: (id: number, params?: Record<string, string | number | undefined>) =>
    request(`/trips/${id}/photos?${new URLSearchParams(clean(params)).toString()}`),
};

export const locations = {
  list: () => request("/locations"),
};

// ---- Admin ----
export const adminPhotos = {
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    request(`/admin/photos?${new URLSearchParams(clean(params)).toString()}`),
  get: (id: number) => request(`/admin/photos/${id}`),
  update: (id: number, data: object) =>
    request(`/admin/photos/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  setSpecies: (id: number, species_ids: number[]) =>
    request(`/admin/photos/${id}/species`, {
      method: "POST",
      body: JSON.stringify({ species_ids }),
    }),
  setCrop: (id: number, crop: { crop_x: number; crop_y: number; crop_w: number; crop_h: number }) =>
    request(`/admin/photos/${id}/crop`, {
      method: "POST",
      body: JSON.stringify(crop),
    }),
  bulkPublish: (photo_ids: number[], is_published: boolean) =>
    request("/admin/photos/bulk-publish", {
      method: "POST",
      body: JSON.stringify({ photo_ids, is_published }),
    }),
  bulkFolderUpdate: (data: object) =>
    request("/admin/photos/bulk-folder-update", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export const adminSpecies = {
  list: () => request("/admin/species"),
  create: (data: object) =>
    request("/admin/species", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: object) =>
    request(`/admin/species/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) =>
    request(`/admin/species/${id}`, { method: "DELETE" }),
};

export const adminAlbums = {
  list: () => request("/admin/albums"),
  create: (data: object) =>
    request("/admin/albums", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: object) =>
    request(`/admin/albums/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) =>
    request(`/admin/albums/${id}`, { method: "DELETE" }),
  addPhotos: (id: number, photo_ids: number[]) =>
    request(`/admin/albums/${id}/photos`, {
      method: "POST",
      body: JSON.stringify({ photo_ids }),
    }),
  removePhoto: (albumId: number, photoId: number) =>
    request(`/admin/albums/${albumId}/photos/${photoId}`, { method: "DELETE" }),
  reorder: (id: number, ordered_photo_ids: number[]) =>
    request(`/admin/albums/${id}/photos/order`, {
      method: "PATCH",
      body: JSON.stringify({ ordered_photo_ids }),
    }),
};

export const adminTrips = {
  list: () => request("/admin/trips"),
  create: (data: object) =>
    request("/admin/trips", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: object) =>
    request(`/admin/trips/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) =>
    request(`/admin/trips/${id}`, { method: "DELETE" }),
};

export const adminLocations = {
  list: () => request("/admin/locations"),
  create: (data: object) =>
    request("/admin/locations", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: object) =>
    request(`/admin/locations/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) =>
    request(`/admin/locations/${id}`, { method: "DELETE" }),
};

export const adminScans = {
  start: (data: object) =>
    request("/admin/scans", { method: "POST", body: JSON.stringify(data) }),
  list: () => request("/admin/scans"),
  get: (id: number) => request(`/admin/scans/${id}`),
  browse: (path = "") =>
    request(`/admin/scans/browse?path=${encodeURIComponent(path)}`),
  thumbnailStatus: () => request("/admin/thumbnails/status"),
  retryErrors: () => request("/admin/thumbnails/retry-errors", { method: "POST" }),
};

export const adminSettings = {
  get: () => request("/admin/settings"),
  update: (data: object) =>
    request("/admin/settings", { method: "PATCH", body: JSON.stringify(data) }),
  resetApp: () => request("/admin/settings/reset-app", { method: "POST" }),
  resetContent: () => request("/admin/settings/reset-content", { method: "POST" }),
  backupUrl: "/api/admin/settings/backup",
};

export const adminMeta = {
  geocode: (q: string) =>
    request(`/admin/geocode?q=${encodeURIComponent(q)}`),
  ebird: (lat: number, lng: number, dist = 50) =>
    request(`/admin/ebird?lat=${lat}&lng=${lng}&dist=${dist}`),
  ebirdFind: (q: string) =>
    request(`/admin/ebird/find?q=${encodeURIComponent(q)}`),
};

// Helper: remove undefined values from params object
function clean(
  obj?: Record<string, string | number | boolean | undefined>
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!obj) return out;
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null) out[k] = String(v);
  }
  return out;
}
