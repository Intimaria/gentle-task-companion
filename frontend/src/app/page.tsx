'use client'
import React from "react";
import Link from "next/link";
import TaskInput from "../components/TaskInput";
import MoodInput from "../components/MoodInput";
import CommCardsGrid from "../components/CommCardsGrid";
import { useDailyState } from "../hooks/useDailyState";
import { useState, useEffect } from "react";
import { useTranslation } from "../hooks/useTranslation";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";

// Utility: get local date as yyyy-mm-dd
function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function Home() {
const { t } = useTranslation();
const { user, loading, signIn, signOut } = useAuth();
const [showCommCards, setShowCommCards] = useState(false);
const [showCompleted, setShowCompleted] = useState(false);
const [showGratitudes, setShowGratitudes] = useState(false);
const [state, setState] = useDailyState();

// API task IDs indexed parallel to state.tasks (needed for updateTask)
const [apiTaskIds, setApiTaskIds] = useState<(string | undefined)[]>([]);

// API gratitude createdAt timestamps indexed parallel to state.gratitudes (needed for deleteGratitude)
const [apiGratitudeIds, setApiGratitudeIds] = useState<(string | undefined)[]>([]);

// Track deleted completed tasks in session (local) state
const [deletedCompletedTasks, setDeletedCompletedTasks] = useState<string[]>([]);

// Companion animal modal state
const [companionUrl, setCompanionUrl] = useState<string | null>(null);
const [companionLoading, setCompanionLoading] = useState(false);
const [companionOpen, setCompanionOpen] = useState(false);
const [companionSpecies, setCompanionSpecies] = useState<string>("cat");
const [justSaved, setJustSaved] = useState(false);
const [savingFav, setSavingFav] = useState(false);
const [saveError, setSaveError] = useState(false);

// ¿El usuario es admin? El botón /admin se muestra condicionalmente (RBAC).
const [isAdmin, setIsAdmin] = useState(false);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const [_date] = useState(() => getLocalDateString());

// Load dashboard on login
useEffect(() => {
  if (!user?.id) return;
  api.getDashboard().then((dashboard) => {
    // Merge open + done tasks into local state
    const openTasks = dashboard.tasks.open.map(t => ({
      text: t.text,
      status: t.status,
      _id: t.id,
    }));
    const doneTasks = dashboard.tasks.done.map(t => ({
      text: t.text,
      status: "completed" as const,
      _id: t.id,
    }));
    const merged = [...openTasks, ...doneTasks];

    setState(s => ({
      ...s,
      tasks: merged.map(({ text, status }) => ({ text, status })),
      mood: dashboard.moods.length > 0 ? dashboard.moods[0].mood : s.mood,
      gratitudes: dashboard.gratitudes.map(g => g.text),
    }));
    setApiTaskIds(merged.map(t => t._id));
    setApiGratitudeIds(dashboard.gratitudes.map(g => g.createdAt));
  }).catch(() => {
    // If API fails, keep local state as-is
  });
}, [user]);

// /admin/whoami tira 403 si no sos admin → capturamos y ocultamos el link.
useEffect(() => {
  if (!user?.id) { setIsAdmin(false); return; }
  api.whoami().then(w => setIsAdmin(w.isAdmin)).catch(() => setIsAdmin(false));
}, [user]);

// Al cerrar sesión, limpiar el estado local para no dejar datos personales visibles.
const handleSignOut = async () => {
  setState({ tasks: [], mood: null, gratitudes: [], newTask: "", newGratitude: "" });
  setApiTaskIds([]);
  setApiGratitudeIds([]);
  await signOut();
};


  const saveFavorite = async () => {
    if (!companionUrl || savingFav) return; // evita doble/triple guardado
    setSavingFav(true);
    setSaveError(false);
    try {
      await api.saveCompanion(companionSpecies, companionUrl);
      setJustSaved(true);
    } catch {
      setSaveError(true);
    } finally {
      setSavingFav(false);
    }
  };

  const openCompanion = async (species: string) => {
    // Distinta especie → limpiar la imagen anterior (no mostrar el animal previo);
    // misma especie ("Otro") → mantenerla para una transición suave.
    setJustSaved(false);
    setSaveError(false);
    if (species !== companionSpecies) setCompanionUrl(null);
    setCompanionSpecies(species);
    setCompanionOpen(true);
    setCompanionLoading(true);
    try {
      const res = await api.getCompanion(species);
      setCompanionUrl(res.url);
    } catch {
      setCompanionUrl(null);
    } finally {
      setCompanionLoading(false);
    }
  };

  const companionModal = companionOpen ? (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
      onClick={() => setCompanionOpen(false)}
    >
      <div
        className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full flex flex-col items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Caja de tamaño FIJO: el modal no cambia de tamaño entre cargando/imagen */}
        <div className="relative w-full h-64 flex items-center justify-center bg-fuchsia-50 rounded-xl overflow-hidden">
          {companionUrl && (
            <img src={companionUrl} alt={companionSpecies} className="max-h-full max-w-full object-contain" />
          )}
          {companionLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fuchsia-500" />
            </div>
          )}
          {!companionUrl && !companionLoading && (
            <p className="text-gray-400 text-sm">{t("couldntLoad")}</p>
          )}
        </div>
        <div className="flex gap-2">
          {user && companionUrl && !companionLoading && (
            <button
              onClick={saveFavorite}
              disabled={justSaved || savingFav}
              className="px-4 py-2 rounded-full bg-fuchsia-500 text-white font-semibold hover:bg-fuchsia-600 transition disabled:opacity-60"
            >
              {savingFav
                ? t("savingAnimal")
                : justSaved
                ? t("savedAnimal")
                : t("saveAnimal")}
            </button>
          )}
          <button
            onClick={() => openCompanion(companionSpecies)}
            className="px-4 py-2 rounded-full bg-fuchsia-100 text-fuchsia-800 font-semibold hover:bg-fuchsia-200 transition"
          >
            {t("another")}
          </button>
          <button
            onClick={() => setCompanionOpen(false)}
            className="px-4 py-2 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
          >
            {t("close")}
          </button>
        </div>
        {justSaved && (
          <p className="text-sm text-fuchsia-700 text-center">
            {t("savedConfirmPre")}
            <Link href="/perfil" className="underline font-semibold hover:text-fuchsia-900">
              {t("savedConfirmLink")}
            </Link>
          </p>
        )}
        {saveError && (
          <p className="text-sm text-red-500 text-center">
            {t("saveError")}
          </p>
        )}
      </div>
    </div>
  ) : null;

  const animalButtons = (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs text-gray-500">
        {t("calmMomentPrompt")}
      </p>
      <div className="flex gap-4">
        <button onClick={() => openCompanion("dog")} aria-label="perrito" className="text-3xl hover:scale-110 transition focus:outline-none">🐶</button>
        <button onClick={() => openCompanion("cat")} aria-label="gatito" className="text-3xl hover:scale-110 transition focus:outline-none">🐱</button>
        <button onClick={() => openCompanion("capybara")} aria-label="capybarita" className="text-3xl hover:scale-110 transition focus:outline-none">🦫</button>
      </div>
    </div>
  );

  // Show loading state
  if (loading) {
    return (
      <main className="flex flex-col min-h-screen items-center justify-center gap-8 p-4 pb-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <p className="text-gray-600">Loading...</p>
      </main>
    );
  }

  // Deslogueado: pantalla de bienvenida (sin datos personales).
  if (!user) {
    return (
      <main className="flex flex-col min-h-screen items-center justify-center gap-6 p-4">
        <Link href="/crisis">
          <button
            className="fixed top-6 right-6 bg-red-500 text-white rounded-full px-6 py-3 shadow-lg z-50 transition hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400"
            aria-label="Crisis Button"
          >
            Crisis
          </button>
        </Link>
        <section className="w-full max-w-md bg-white/70 backdrop-blur rounded-3xl shadow-xl p-10 text-center flex flex-col items-center gap-4">
          <span className="text-6xl" aria-hidden>🌸</span>
          <h1 className="text-2xl font-bold text-fuchsia-800">Gentle Task Companion</h1>
          <p className="text-gray-600">
            {t("welcomeTagline")}
          </p>
          <button
            onClick={signIn}
            className="mt-2 w-full px-6 py-3 rounded-full bg-fuchsia-500 text-white text-lg font-semibold shadow-lg hover:bg-fuchsia-600 transition focus:outline-none focus:ring-2 focus:ring-fuchsia-300"
          >
            {t("signIn")}
          </button>
          <p className="text-xs text-gray-500">
            {t("privacyNote")}
          </p>
          <div className="mt-2">
            {animalButtons}
          </div>
        </section>
        <div className="text-center">
          <span className="text-xs text-fuchsia-900/80 font-medium">
            {t("aboutPreLink")} <Link href="/about" className="underline hover:text-fuchsia-700 transition">{t("aboutLink")}</Link>
          </span>
        </div>
        {/* Herramientas útiles sin login (no dependen del usuario). */}
        <button
          onClick={() => setShowCommCards(true)}
          className="flex items-center gap-2 bg-white/85 backdrop-blur rounded-full px-5 py-3 shadow-md text-fuchsia-800 font-semibold hover:bg-white transition focus:outline-none focus:ring-2 focus:ring-fuchsia-300"
          aria-label="Communicate"
        >
          <span className="text-2xl">🗣️</span>
          <span className="text-sm">{t("nonVerbalCueCards")}</span>
        </button>
        {showCommCards && <CommCardsGrid onClose={() => setShowCommCards(false)} />}
        {companionModal}
      </main>
    );
  }

  const missingFields: string[] = [
    ...(!state.mood ? [t('mood')] : []),
    ...(state.tasks.length === 0 ? [t('chooseTasks')] : []),
    ...(state.gratitudes.length === 0 ? [t('gratitude')] : []),
  ];

  return (
    <>
    <main className="flex flex-col min-h-dvh items-center justify-start gap-8 p-4 pt-8 pb-28">
      <Link href="/crisis">
      <button
        className="fixed top-6 right-6 bg-red-500 text-white rounded-full px-6 py-3 shadow-lg z-50 transition hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400"
        aria-label="Crisis Button"
      >
        Crisis
      </button>
    </Link>

      <section className="w-full max-w-md bg-white/70 rounded-xl shadow p-6">
        <h2 className="text-xl font-bold mb-2">{t('chooseTasks')}</h2>
        <ul className="flex flex-col gap-2">
          {state.tasks.map((task, idx) => (
      <li key={apiTaskIds[idx] ?? `task-${task.text}`} className="flex items-center gap-2">
        <TaskInput
          value={task.text}
          status={task.status}
          onChange={text =>
            setState(s => {
              const tasks = [...s.tasks];
              tasks[idx] = { ...tasks[idx], text };
              return { ...s, tasks };
            })
          }
          onStatusChange={async (status) => {
            setState(s => {
              const tasks = [...s.tasks];
              tasks[idx] = { ...tasks[idx], status };
              return { ...s, tasks };
            });
            // Persist every status change to the API
            if (user?.id) {
              const taskId = apiTaskIds[idx];
              if (taskId) {
                try {
                  await api.updateTask(taskId, status);
                } catch {
                  // ignore API error; local state already updated
                }
              }
            }
          }}
        />
        <button
          className="ml-2 text-gray-400 hover:text-red-500 transition"
          onClick={async () => {
            const tid = apiTaskIds[idx];
            if (tid) {
              try {
                await api.deleteTask(tid);
              } catch {
                // ignore API error; proceed with local state update
              }
            }
            if (task.status === "completed") {
              setDeletedCompletedTasks(prev => [...prev, task.text]);
            }
            setState(s => ({
              ...s,
              tasks: s.tasks.filter((_, i) => i !== idx),
            }));
            setApiTaskIds(prev => prev.filter((_, i) => i !== idx));
          }}
          aria-label="Delete task"
        >
          🗑️
        </button>
      </li>
    ))}
  </ul>
  {state.tasks.length < 3 && (
    <div className="mt-2 flex gap-2">
      <input
        type="text"
        className="w-full rounded px-3 py-2 border border-gray-300 focus:outline-none focus:ring focus:ring-pink-200 transition-colors duration-300"
        placeholder={t('addTaskPlaceholder')}
        value={state.newTask || ""}
        onChange={e =>
          setState(s => ({ ...s, newTask: e.target.value }))
        }
        maxLength={100}
      />
      <button
        className="px-4 py-2 rounded bg-blue-200 text-blue-900 font-semibold shadow"
        onClick={async () => {
          if (state.newTask.trim()) {
            const text = state.newTask.trim();
            setState(s => ({
              ...s,
              tasks: [
                ...s.tasks,
                { text, status: "not_started" },
              ],
              newTask: "",
            }));
            // Persist to API if signed in
            if (user?.id) {
              try {
                const created = await api.addTask(text);
                setApiTaskIds(prev => [...prev, created.id]);
              } catch {
                setApiTaskIds(prev => [...prev, undefined]);
              }
            } else {
              setApiTaskIds(prev => [...prev, undefined]);
            }
          }
        }}
      >
        {t('addTask')}
      </button>

    </div>
  )}
  <p className="mt-4 text-xs text-gray-500 text-center">
   {t('taskInstructions')}
    </p>
</section>
      <section className="w-full max-w-md bg-white/70 rounded-xl shadow p-6">
        <h2 className="text-xl font-bold mb-2">{t('mood')}</h2>
        <MoodInput
          value={state.mood}
          onChange={async (mood) => {
            setState(s => ({ ...s, mood }));
            if (user?.id) {
              try {
                await api.addMood(mood);
              } catch {
                // ignore API error; local state already updated
              }
            }
          }}
        />
      </section>
<section className="w-full max-w-md bg-white/70 rounded-xl shadow p-6">
  <h2 className="text-xl font-bold mb-2">{t('gratitude')}</h2>
    <p className="mb-2 text-xs text-gray-500 text-left">{t('gratitudeScience')}</p>
  <ul className="flex flex-col gap-2 mb-2">
    {(state.gratitudes || []).map((g, idx) => (
      <li key={apiGratitudeIds[idx] ?? `g-${g}`} className="flex items-center gap-2">
        <span>{g}</span>
        <button
          className="ml-2 text-gray-400 hover:text-red-500 transition"
          onClick={async () => {
            const gts = apiGratitudeIds[idx];
            if (gts) {
              try {
                await api.deleteGratitude(gts);
              } catch {
                // ignore API error; proceed with local state update
              }
            }
            setState(s => ({
              ...s,
              gratitudes: s.gratitudes.filter((_, i) => i !== idx),
            }));
            setApiGratitudeIds(prev => prev.filter((_, i) => i !== idx));
          }}
          aria-label="Delete gratitude"
        >
          🗑️
        </button>
      </li>
    ))}
  </ul>
  {state.gratitudes.length < 5 && (

    <div className="flex gap-2">

      <input
        type="text"
        className="w-full rounded px-3 py-2 border border-gray-300 focus:outline-none focus:ring focus:ring-yellow-200 transition-colors duration-300"
        placeholder={t('addGratitudePlaceholder')}
        value={state.newGratitude}
        onChange={e =>
          setState(s => ({ ...s, newGratitude: e.target.value }))
        }
        maxLength={100}
      />
      <button
        className="px-4 py-2 rounded bg-yellow-200 text-yellow-900 font-semibold shadow"
        onClick={async () => {
          if (state.newGratitude.trim()) {
            const text = state.newGratitude.trim();
            setState(s => ({
              ...s,
              gratitudes: [...s.gratitudes, text],
              newGratitude: "",
            }));
            if (user?.id) {
              try {
                const created = await api.addGratitude(text);
                setApiGratitudeIds(prev => [...prev, created.createdAt]);
              } catch {
                setApiGratitudeIds(prev => [...prev, undefined]);
              }
            } else {
              setApiGratitudeIds(prev => [...prev, undefined]);
            }
          }
        }}
      >
        {t('addGratitude')}
      </button>
    </div>
  )}
</section>

    <section className="w-full max-w-md bg-white/70 rounded-xl shadow p-6 flex flex-col items-center gap-3">
      <h2 className="text-lg font-semibold text-fuchsia-700">
        {t("calmMoment")}
      </h2>
      {animalButtons}
      <Link href="/perfil" className="text-sm text-fuchsia-700 underline hover:text-fuchsia-900">
        {t("seeSavedAnimals")}
      </Link>
    </section>

    <section className="w-full max-w-md bg-white/70 rounded-xl shadow p-6">
      <h2 className="text-lg font-semibold mb-2 flex items-center gap-2 text-fuchsia-700">
        <span>📝</span> {t('todayYouWrote')}
      </h2>
      <ul className="text-base">
        <li>
          <span className="font-medium">{t('tasks')}:</span>{" "}
          {state.tasks.length > 0
            ? state.tasks.map((tk, i) => (
                <span key={i} className={tk.status === "completed" ? "line-through text-gray-400" : ""}>
                  {tk.text}{i < state.tasks.length - 1 ? ", " : ""}
                </span>
              ))
            : <span className="text-gray-400">—</span>}
        </li>
        <li>
          <span className="font-medium">{t('mood')}:</span>{" "}
          {state.mood ? state.mood : <span className="text-gray-400">—</span>}
        </li>
        <li>
          <span className="font-medium">{t('gratitude')}:</span>{" "}
          {state.gratitudes.length > 0
            ? state.gratitudes.map((g, i) => (
                <span key={i}>{g}{i < state.gratitudes.length - 1 ? ", " : ""}</span>
              ))
            : <span className="text-gray-400">—</span>}
        </li>
      </ul>
      {missingFields.length > 0 && (
        <div className="mt-4 text-pink-600 text-sm">
          {t('missingFields', { fields: missingFields.join(", ") })}
        </div>
      )}
    </section>

    {/* Sesión — sign out visible */}
    <section className="w-full max-w-md text-center flex flex-col items-center gap-3">
      <p className="text-sm text-gray-600">
        {t('welcomeBack')} <span className="font-semibold text-fuchsia-800">{user.email ?? user.id}</span>
      </p>
      <Link
        href="/perfil"
        className="px-5 py-2 rounded-full border border-fuchsia-200 text-fuchsia-700 font-medium bg-white/70 hover:bg-white transition focus:outline-none focus:ring-2 focus:ring-fuchsia-300 text-sm"
      >
        {t("viewMyProfile")}
      </Link>
      {isAdmin && (
        <Link
          href="/admin"
          className="px-5 py-2 rounded-full border border-violet-200 text-violet-700 font-medium bg-white/70 hover:bg-white transition focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm"
        >
          ⚙️ {t("adminNav")}
        </Link>
      )}
      <button
        onClick={handleSignOut}
        className="px-5 py-2 rounded-full bg-blue-500 text-white font-semibold shadow hover:bg-blue-600 transition focus:outline-none focus:ring-2 focus:ring-blue-300"
      >
        {t('signOut')}
      </button>
    </section>

    {/* About link and separator as a gentle footnote, outside the white box */}
    <div className="w-full flex justify-center">
      <div className="mt-4 mb-2 text-center bg-transparent">
        <span className="text-xs text-fuchsia-900/80 font-medium px-2 py-1 rounded">
          {t('aboutPreLink')} <Link href="/about" className="underline hover:text-fuchsia-700 transition focus:outline-none focus:ring-2 focus:ring-fuchsia-300 rounded text-xs">{t('aboutLink')}</Link>
        </span>
      </div>
    </div>
    </main>
    {/* Footer always visible at the bottom */}
<footer className="fixed bottom-0 left-0 w-full flex justify-around items-center py-3 bg-white/80 shadow-inner z-50">
  <button
    className="flex flex-col items-center text-fuchsia-600 focus:outline-none"
    onClick={() => setShowCommCards(true)}
    aria-label="Communicate"
  >
    <span className="text-2xl">🗣️</span>
    <span className="text-xs">{t('nonVerbalCueCards')}</span>
  </button>
  <button
    className="flex flex-col items-center text-green-600 focus:outline-none"
    onClick={() => setShowCompleted(true)}
    aria-label="Completed Tasks"
  >
    <span className="text-2xl">✅</span>
    <span className="text-xs">{t('completed')}</span>
  </button>
  <button
    className="flex flex-col items-center text-yellow-600 focus:outline-none"
    onClick={() => setShowGratitudes(true)}
    aria-label="Gratitudes"
  >
    <span className="text-2xl">🌼</span>
    <span className="text-xs">{t('gratitude')}</span>
  </button>
</footer>
{showCommCards && (
  <CommCardsGrid onClose={() => setShowCommCards(false)} />
)}
{showCompleted && (
  <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
    <div className="bg-white rounded-2xl p-8 shadow-2xl w-full max-w-md flex flex-col items-center">
      <h2 className="text-xl font-bold mb-4 text-green-700">{t('completedTasks')}</h2>
      <ul>
        {[
          ...state.tasks.filter(t => t.status === "completed").map(t => t.text),
          ...deletedCompletedTasks
        ].map((task, idx) => (
          <li key={idx} className="mb-2">{task}</li>
        ))}
      </ul>
      <button
        className="mt-2 px-6 py-2 rounded bg-fuchsia-200 text-fuchsia-900 font-semibold shadow"
        onClick={() => setShowCompleted(false)}
      >
        {t('close')}
      </button>
    </div>
  </div>
)}
{showGratitudes && (
  <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
    <div className="bg-white rounded-2xl p-8 shadow-2xl w-full max-w-md flex flex-col items-center">
      <h2 className="text-xl font-bold mb-4 text-yellow-700">{t('gratitudes')}</h2>
        <ul>
          {(state.gratitudes || []).map((g, idx) => (
            <li key={idx} className="mb-2">{g}</li>
          ))}
        </ul>
      <button
        className="mt-2 px-6 py-2 rounded bg-fuchsia-200 text-fuchsia-900 font-semibold shadow"
        onClick={() => setShowGratitudes(false)}
      >
        {t('close')}
      </button>
    </div>
  </div>
)}
{companionModal}
    </>
  );
}
