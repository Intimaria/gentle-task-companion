import { getAccessToken } from "./oidc";
import type { Dashboard, Mood, ApiTask, ApiGratitude, Profile } from "../types/api";

const BASE = process.env.NEXT_PUBLIC_API_URL!;

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const api = {
  getDashboard: () => req<Dashboard>("/dashboard"),
  addMood: (mood: string, note?: string) => req<Mood>("/moods", { method: "POST", body: JSON.stringify({ mood, note }) }),
  addTask: (text: string) => req<ApiTask>("/tasks", { method: "POST", body: JSON.stringify({ text }) }),
  updateTask: (id: string, status: "not_started" | "in_progress" | "completed") => req<ApiTask>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  listTasks: (status?: "not_started" | "in_progress" | "completed") => req<{ tasks: ApiTask[] }>(`/tasks${status ? `?status=${status}` : ""}`),
  addGratitude: (text: string) => req<ApiGratitude>("/gratitudes", { method: "POST", body: JSON.stringify({ text }) }),
  listGratitudes: () => req<{ gratitudes: ApiGratitude[] }>("/gratitudes"),
  getProfile: () => req<Profile>("/me"),
  putProfile: (p: Profile) => req<Profile>("/me", { method: "PUT", body: JSON.stringify(p) }),
  deleteTask: (id: string) => req<void>(`/tasks/${id}`, { method: "DELETE" }),
  deleteMood: (createdAt: string) => req<void>(`/moods?ts=${encodeURIComponent(createdAt)}`, { method: "DELETE" }),
  deleteGratitude: (createdAt: string) => req<void>(`/gratitudes?ts=${encodeURIComponent(createdAt)}`, { method: "DELETE" }),
  getCompanion: (species: string) => req<{ species: string; url: string }>(`/companion?species=${species}`, { cache: "no-store" }),
  saveCompanion: (species: string, url: string) =>
    req<{ id: string }>("/companion/save", { method: "POST", body: JSON.stringify({ species, url }) }),
  getSaved: () =>
    req<{ saved: { id: string; species: string; savedAt: string; url: string }[] }>("/companion/saved"),

  // Media (admin gestiona; listado público)
  whoami: () => req<{ sub: string; isAdmin: boolean }>("/admin/whoami"),
  listMedia: (kind?: MediaKind) =>
    req<{ media: MediaItem[] }>(`/media${kind ? `?kind=${kind}` : ""}`),
  createUploadUrl: (kind: MediaKind, contentType: string) =>
    req<{ id: string; s3Key: string; putUrl: string }>("/admin/media/upload-url", {
      method: "POST",
      body: JSON.stringify({ kind, contentType }),
    }),
  confirmMedia: (item: { id: string; name: string; kind: MediaKind; s3Key: string; contentType: string }) =>
    req<{ ok: boolean }>("/admin/media", { method: "POST", body: JSON.stringify(item) }),
  deleteMedia: (kind: MediaKind, id: string) =>
    req<void>(`/admin/media/${kind}/${id}`, { method: "DELETE" }),
};

export type MediaKind = "sound" | "meditation";
export interface MediaItem {
  id: string;
  name: string;
  kind: MediaKind;
  url: string;
}

// Sube el archivo directamente a MinIO/S3 con la URL prefirmada (sin pasar por el backend).
export async function uploadToPresigned(putUrl: string, file: File): Promise<void> {
  const res = await fetch(putUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });
  if (!res.ok) throw new Error(`upload failed: ${res.status}`);
}
