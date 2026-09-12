'use client'
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../lib/api";
import { useTranslation } from "../../hooks/useTranslation";
import type { Dashboard } from "../../types/api";

type ProfileData = {
  moods: Dashboard["moods"];
  doneTasks: Dashboard["tasks"]["done"];
  gratitudes: Dashboard["gratitudes"];
  streakDays: number;
};

export default function PerfilPage() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [saved, setSaved] = useState<{ id: string; species: string; savedAt: string; url: string }[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user?.id) return;
    api.getDashboard().then((dashboard) => {
      setData({
        moods: dashboard.moods,
        doneTasks: dashboard.tasks.done,
        gratitudes: dashboard.gratitudes,
        streakDays: dashboard.stats.streakDays,
      });
    }).catch(() => {
      setData(null);
    });
    api.getSaved().then(r => setSaved(r.saved)).catch(() => {});
  }, [user]);

  if (loading) {
    return (
      <main className="flex flex-col min-h-screen items-center justify-center gap-8 p-4 pb-24">
        <p className="text-gray-600">{t("loading")}</p>
      </main>
    );
  }

  if (!user) return null;

  const isEmpty =
    !data ||
    (data.moods.length === 0 && data.doneTasks.length === 0 && data.gratitudes.length === 0);

  return (
    <main className="flex flex-col min-h-screen items-center justify-center gap-8 p-4 pb-24">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="text-fuchsia-700 hover:text-fuchsia-900 transition text-sm font-medium"
        >
          ← {t("backToHome")}
        </Link>
      </div>

      <section className="w-full max-w-md bg-white/70 rounded-xl shadow p-6">
        <h1 className="text-2xl font-bold mb-4 text-fuchsia-800">
          {t("myProfile")}
        </h1>

        {data && data.streakDays > 0 && (
          <p className="text-fuchsia-600 font-semibold mb-4">
            💛 {data.streakDays} {t("selfCareDays")}
          </p>
        )}

        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-3 text-fuchsia-700">{t("myAnimals")}</h2>
          {saved.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {saved.map((a) => (
                <img key={a.id} src={a.url} alt={a.species} className="w-full h-24 object-cover rounded-lg" />
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">
              {t("noSavedAnimals")}
            </p>
          )}
        </div>

        {isEmpty ? (
          <p className="text-gray-400">{t("noEntriesYet")}</p>
        ) : (
          <>
            {data && data.moods.length > 0 && (
              <div className="w-full mb-6">
                <h2 className="font-medium text-gray-700 mb-2">
                  {t("mood")}{t("moodOverTime")}
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {data.moods.map((m, i) => (
                    <li key={i} className="text-xs bg-blue-50 rounded px-2 py-1 flex items-center gap-1">
                      {m.mood} <span className="text-gray-400">{m.createdAt.slice(0, 10)}</span>
                      <button
                        aria-label={t("deleteMood")}
                        className="ml-2 text-gray-400 hover:text-red-500 transition"
                        onClick={async () => {
                          try { await api.deleteMood(m.createdAt); } catch { /* ignore; remove locally anyway */ }
                          setData(d => d && ({ ...d, moods: d.moods.filter(x => x.createdAt !== m.createdAt) }));
                        }}
                      >🗑️</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data && data.doneTasks.length > 0 && (
              <div className="w-full mb-6">
                <h2 className="font-medium text-gray-700 mb-2">{t("completedTasks")}</h2>
                <ul>
                  {data.doneTasks.map((task, i) => (
                    <li key={i} className="mb-1 text-sm line-through text-gray-400 flex items-center gap-1">
                      {task.text}
                      <button
                        aria-label={t("deleteTask")}
                        className="ml-2 text-gray-400 hover:text-red-500 transition no-underline"
                        onClick={async () => {
                          try { await api.deleteTask(task.id); } catch { /* ignore; remove locally anyway */ }
                          setData(d => d && ({ ...d, doneTasks: d.doneTasks.filter(x => x.id !== task.id) }));
                        }}
                      >🗑️</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data && data.gratitudes.length > 0 && (
              <div className="w-full mb-2">
                <h2 className="font-medium text-gray-700 mb-2">{t("gratitudes")}</h2>
                <ul>
                  {data.gratitudes.map((g, i) => (
                    <li key={i} className="mb-1 text-sm flex items-center gap-1">
                      {g.text}
                      <button
                        aria-label={t("deleteGratitude")}
                        className="ml-2 text-gray-400 hover:text-red-500 transition"
                        onClick={async () => {
                          try { await api.deleteGratitude(g.createdAt); } catch { /* ignore; remove locally anyway */ }
                          setData(d => d && ({ ...d, gratitudes: d.gratitudes.filter(x => x.createdAt !== g.createdAt) }));
                        }}
                      >🗑️</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
