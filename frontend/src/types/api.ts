export interface SpeciesTag {
  id: number;
  common_name: string;
  scientific_name: string | null;
}

export interface Photo {
  id: number;
  filename: string;
  file_type: "raw" | "jpeg" | "video";
  thumb_sm_url: string | null;
  thumb_md_url: string | null;
  thumb_lg_url: string | null;
  thumb_status: "pending" | "processing" | "done" | "error";
  width: number | null;
  height: number | null;
  crop_x: number | null;
  crop_y: number | null;
  crop_w: number | null;
  crop_h: number | null;
  captured_at: string | null;
  camera_make: string | null;
  camera_model: string | null;
  lens_model: string | null;
  focal_length_mm: number | null;
  aperture: number | null;
  shutter_speed: string | null;
  iso: number | null;
  title: string | null;
  caption: string | null;
  is_published: boolean;
  is_featured: boolean;
  published_at: string | null;
  location_id: number | null;
  trip_id: number | null;
  imported_at: string;
  species: SpeciesTag[];
  has_album: boolean;
}

export interface PhotoPage {
  items: Photo[];
  next_cursor: number | null;
  total: number | null;
}

export interface Species {
  id: number;
  common_name: string;
  scientific_name: string | null;
  family: string | null;
  order_name: string | null;
  notes: string | null;
  photo_count: number;
  cover_photo_id: number | null;
}

export interface Location {
  id: number;
  name: string;
  country: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  photo_count: number;
}

export interface Trip {
  id: number;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  location_id: number | null;
  cover_photo_id: number | null;
  is_published: boolean;
  created_at: string;
}

export interface Album {
  id: number;
  title: string;
  description: string | null;
  slug: string;
  cover_photo_id: number | null;
  trip_id: number | null;
  sort_order: number;
  is_published: boolean;
  created_at: string;
}

export interface ScanJob {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: "running" | "done" | "error";
  root_path: string | null;
  location_id: number | null;
  trip_id: number | null;
  shoot_date: string | null;
  files_found: number;
  files_imported: number;
  files_skipped: number;
  error_message: string | null;
}

export interface DirectoryEntry {
  name: string;
  path: string;
  is_dir: boolean;
  child_count: number | null;
  file_count: number | null;
  photo_count: number;
  published_count: number;
}

export interface GeocodeSuggestion {
  display_name: string;
  name: string;
  lat: number;
  lng: number;
  country: string | null;
}

export interface EbirdSpecies {
  species_code: string;
  common_name: string;
  scientific_name: string;
}

export interface ThumbnailStatus {
  pending: number;
  processing: number;
  done: number;
  error: number;
}

export interface User {
  id: number;
  username: string;
  email: string | null;
  is_active: boolean;
}
