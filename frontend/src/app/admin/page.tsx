'use client'
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../hooks/useAuth";
import { useTranslation } from "../../hooks/useTranslation";
import { api, uploadToPresigned, type MediaItem, type MediaKind } from "../../lib/api";

type Gate = "checking" | "allowed" | "denied";

export default function AdminPage() {
  const { t } = useTranslation();
  const { user, loading, signIn } = useAuth();
  const [gate, setGate] = useState<Gate>("checking");
  const [media, setMedia] = useState<MediaItem[]>([]);

  // Formulario de subida
  const [kind, setKind] = useState<MediaKind>("sound");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => api.listMedia().then((r) => setMedia(r.media)).catch(() => {});

  useEffect(() => {
    if (loading) return;
    if (!user) { setGate("denied"); return; }
    api.whoami()
      .then((w) => { setGate(w.isAdmin ? "allowed" : "denied"); if (w.isAdmin) refresh(); })
      .catch(() => setGate("denied"));
  }, [loading, user]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !name.trim() || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const { id, s3Key, putUrl } = await api.createUploadUrl(kind, file.type || "application/octet-stream");
      await uploadToPresigned(putUrl, file);
      await api.confirmMedia({ id, name: name.trim(), kind, s3Key, contentType: file.type || "application/octet-stream" });
      setName("");
      setFile(null);
      const input = document.getElementById("media-file") as HTMLInputElement | null;
      if (input) input.value = "";
      await refresh();
    } catch {
      setError(t("adminUploadError"));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(item: MediaItem) {
    try {
      await api.deleteMedia(item.kind, item.id);
    } catch { /* ignore; refrescamos igual */ }
    await refresh();
  }

  if (loading || gate === "checking") {
    return (
      <main className="flex flex-col min-h-screen items-center justify-center gap-8 p-4 pb-24">
        <p className="text-gray-600">{t("loading")}</p>
      </main>
    );
  }

  if (gate === "denied") {
    return (
      <main className="flex flex-col min-h-screen items-center justify-center gap-6 p-4 pb-24">
        <p className="text-gray-600 max-w-sm text-center">{t("adminOnly")}</p>
        {!user && (
          <button onClick={signIn} className="px-6 py-2 rounded bg-blue-500 text-white font-semibold shadow">
            {t("signIn")}
          </button>
        )}
        <Link href="/" className="text-fuchsia-700 hover:text-fuchsia-900 text-sm font-medium">← {t("backToHome")}</Link>
      </main>
    );
  }

  const sounds = media.filter((m) => m.kind === "sound");
  const meditations = media.filter((m) => m.kind === "meditation");

  return (
    <main className="flex flex-col min-h-screen items-center gap-8 p-4 pb-24">
      <div className="w-full max-w-md">
        <Link href="/" className="text-fuchsia-700 hover:text-fuchsia-900 text-sm font-medium">← {t("backToHome")}</Link>
      </div>

      <section className="w-full max-w-md bg-white/70 rounded-xl shadow p-6">
        <h1 className="text-2xl font-bold mb-1 text-fuchsia-800">{t("adminTitle")}</h1>
        <p className="text-gray-500 text-sm mb-5">{t("adminSubtitle")}</p>

        <form onSubmit={handleUpload} className="flex flex-col gap-3">
          <label className="text-sm font-medium text-gray-700">
            {t("adminKind")}
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as MediaKind)}
              className="mt-1 w-full px-2 py-2 border rounded"
            >
              <option value="sound">{t("mediaKindSound")}</option>
              <option value="meditation">{t("mediaKindMeditation")}</option>
            </select>
          </label>

          <label className="text-sm font-medium text-gray-700">
            {t("adminName")}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("adminNamePlaceholder")}
              className="mt-1 w-full px-2 py-2 border rounded"
            />
          </label>

          <label className="text-sm font-medium text-gray-700">
            {t("adminFile")}
            <input
              id="media-file"
              type="file"
              accept="audio/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 w-full text-sm"
            />
          </label>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={!file || !name.trim() || uploading}
            className="bg-blue-500 text-white rounded py-2 font-semibold shadow disabled:opacity-50"
          >
            {uploading ? t("adminUploading") : t("adminUpload")}
          </button>
        </form>
      </section>

      <section className="w-full max-w-md bg-white/70 rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold mb-3 text-fuchsia-700">{t("soothingSounds")}</h2>
        <MediaList items={sounds} onDelete={handleDelete} emptyText={t("adminNoMedia")} deleteLabel={t("delete")} />

        <h2 className="text-lg font-semibold mt-6 mb-3 text-fuchsia-700">{t("meditations")}</h2>
        <MediaList items={meditations} onDelete={handleDelete} emptyText={t("adminNoMedia")} deleteLabel={t("delete")} />
      </section>
    </main>
  );
}

function MediaList({
  items,
  onDelete,
  emptyText,
  deleteLabel,
}: {
  items: MediaItem[];
  onDelete: (item: MediaItem) => void;
  emptyText: string;
  deleteLabel: string;
}) {
  if (items.length === 0) return <p className="text-gray-400 text-sm">{emptyText}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((m) => (
        <li key={m.id} className="flex flex-col gap-1 border-b border-gray-100 pb-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-700">{m.name}</span>
            <button
              aria-label={deleteLabel}
              onClick={() => onDelete(m)}
              className="text-gray-400 hover:text-red-500 transition"
            >🗑️</button>
          </div>
          <audio controls src={m.url} className="w-full h-9" />
        </li>
      ))}
    </ul>
  );
}
