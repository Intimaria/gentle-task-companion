'use client'
import React from "react";
import Link from "next/link";
import TaskInput from "../components/TaskInput";
import MoodInput from "../components/MoodInput";
import CommCardsGrid from "../components/CommCardsGrid"; 
import { useDailyState } from "../hooks/useDailyState";
import { useState, useEffect } from "react";
import { fetchFullEntry, saveFullEntry } from "../lib/dailyEntryApi";
import type { DailyEntry, Task, Gratitude } from "../types/DailyEntry";
import { supabase } from "../lib/supabaseClient";
import { useTranslation } from "../hooks/useTranslation";
import { useAuth } from "../hooks/useAuth";

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
const { user, loading, signUp, signIn, signOut } = useAuth();
const [showCommCards, setShowCommCards] = useState(false);
const [showCompleted, setShowCompleted] = useState(false);
const [showGratitudes, setShowGratitudes] = useState(false);
const [showHistory, setShowHistory] = useState(false);
const [state, setState] = useDailyState();
const [history, setHistory] = useState<HistoryEntry[]>([]);

// Auth form state
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [isSignUp, setIsSignUp] = useState(false);
const [authError, setAuthError] = useState<string | null>(null);
const [authSuccess, setAuthSuccess] = useState<string | null>(null);
const [showPassword, setShowPassword] = useState(false);

// Password validation
const [passwordRequirements, setPasswordRequirements] = useState({
  minLength: false,
  hasLowercase: false,
  hasUppercase: false,
  hasNumber: false,
  hasSpecialChar: false,
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const [entry, setEntry] = useState<DailyEntry | null>(null);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const [tasks, setTasks] = useState<Task[]>([]);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const [gratitudes, setGratitudes] = useState<Gratitude[]>([]);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const [date, setDate] = useState(() => getLocalDateString());
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const [mood, setMood] = useState<string | null>(null);

// Track deleted completed tasks in session (local) state
const [deletedCompletedTasks, setDeletedCompletedTasks] = useState<string[]>([]);

type HistoryEntry = {
  entry: DailyEntry;
  tasks: Task[];
  gratitudes: Gratitude[];
};

useEffect(() => {
  if (!user?.id) return;
  handleSave();

}, [state.tasks, state.gratitudes, state.mood, user]);

useEffect(() => {
  if (showHistory && user?.id) {
    supabase
      .from("entries")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(30) // Show up to 30 days
      .then(async ({ data: entries }) => {
       // console.log("Fetched entries:", entries, "Error:", error);
        if (!entries) return setHistory([]);
        const fullEntries = await Promise.all(
          entries.map(async (entry: DailyEntry) => {
            try {
              const { tasks, gratitudes } = await fetchFullEntry(user.id, entry.date);
            //  console.log("Fetched full entry:", entry, tasks, gratitudes);
              return { entry, tasks, gratitudes };
            } catch  {
            //  console.error("Error fetching full entry for", entry, e);
              return null;
            }
          })
        );
        setHistory(fullEntries.filter(Boolean) as HistoryEntry[]);
      });
  }
}, [showHistory, user]);

const missingFields = [];
if (!state.tasks || state.tasks.length === 0) missingFields.push(t("tasks"));
if (!state.mood) missingFields.push(t("mood"));
if (!state.gratitudes || state.gratitudes.length === 0) missingFields.push(t("gratitude"));

// Handle email/password authentication
const handleAuth = async (e: React.FormEvent) => {
  e.preventDefault();
  setAuthError(null);
  setAuthSuccess(null);
  
  const authFunction = isSignUp ? signUp : signIn;
  const { error } = await authFunction(email, password);
  
  if (error) {
    setAuthError(error.message);
  } else {
    if (isSignUp) {
      setAuthSuccess(t('registrationSuccess'));
      // Clear form and success message after showing success for a few seconds
      setTimeout(() => {
        resetForm();
        setIsSignUp(false); // Switch back to sign-in mode
      }, 4000); // 4 seconds to read the message
    } else {
      // Clear form immediately on successful sign-in
      resetForm();
    }
  }
};

// Validate password requirements
const validatePassword = (pwd: string) => {
  setPasswordRequirements({
    minLength: pwd.length >= 6,
    hasLowercase: /[a-z]/.test(pwd),
    hasUppercase: /[A-Z]/.test(pwd),
    hasNumber: /\d/.test(pwd),
    hasSpecialChar: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd),
  });
};

// Handle password change
const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const newPassword = e.target.value;
  setPassword(newPassword);
  if (isSignUp) {
    validatePassword(newPassword);
  }
};

// Clear success message and reset form when switching modes or component unmounts
const resetForm = () => {
  setEmail('');
  setPassword('');
  setAuthError(null);
  setAuthSuccess(null);
  setPasswordRequirements({
    minLength: false,
    hasLowercase: false,
    hasUppercase: false,
    hasNumber: false,
    hasSpecialChar: false,
  });
};

  useEffect(() => {
    if (!user?.id) return;
    fetchFullEntry(user.id, date)
      .then(({ entry, tasks, gratitudes }) => {
        setEntry(entry);
        setTasks(tasks);
        setGratitudes(gratitudes);
        setMood(entry.mood);
      })
      .catch(() => {
        setEntry(null);
        setTasks([]);
        setGratitudes([]);
        setMood(null);
      });
  }, [user, date]);

    async function handleSave() {
    if (!user?.id) return;
      await saveFullEntry(
        user.id,
        date,
        state.mood,
        state.tasks.map(({ text, status }) => ({ text, status })),
        state.gratitudes.map((text) => ({ text }))
      );
  }

  // Show loading state
  if (loading) {
    return (
      <main className="flex flex-col min-h-screen items-center justify-center gap-8 p-4 pb-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <p className="text-gray-600">Loading...</p>
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-screen items-center justify-center gap-8 p-4 pb-24">
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
      <li key={idx} className="flex items-center gap-2">
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
          onStatusChange={status =>
            setState(s => {
              const tasks = [...s.tasks];
              tasks[idx] = { ...tasks[idx], status };
              return { ...s, tasks };
            })
          }
        />
        <button
          className="ml-2 text-gray-400 hover:text-red-500 transition"
          onClick={() => {
            if (task.status === "completed") {
              setDeletedCompletedTasks(prev => [...prev, task.text]);
            }
            setState(s => ({
              ...s,
              tasks: s.tasks.filter((_, i) => i !== idx),
            }));
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
        onClick={() => {
          if (state.newTask.trim()) {
            setState(s => ({
              ...s,
              tasks: [
                ...s.tasks,
                { text: s.newTask.trim(), status: "not_started" },
              ],
              newTask: "",
            }));
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
          onChange={mood => setState(s => ({ ...s, mood }))}
        />
      </section>
<section className="w-full max-w-md bg-white/70 rounded-xl shadow p-6">
  <h2 className="text-xl font-bold mb-2">{t('gratitude')}</h2>
    <p className="mb-2 text-xs text-gray-500 text-left">{t('gratitudeScience')}</p>
  <ul className="flex flex-col gap-2 mb-2">
    {(state.gratitudes || []).map((g, idx) => (
      <li key={idx} className="flex items-center gap-2">
        <span>{g}</span>
        <button
          className="ml-2 text-gray-400 hover:text-red-500 transition"
          onClick={() =>
            setState(s => ({
              ...s,
              gratitudes: s.gratitudes.filter((_, i) => i !== idx),
            }))
          }
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
        onClick={() => {
          if (state.newGratitude.trim()) {
            setState(s => ({
              ...s,
              gratitudes: [...s.gratitudes, s.newGratitude.trim()],
              newGratitude: "",
            }));
          }
        }}
      >
        {t('addGratitude')}
      </button>
    </div>
  )}
</section>

    {/* Auth Section */}
    <section className="w-full max-w-md bg-white/70 rounded-xl shadow p-6">
      {user ? (
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-2">
            {t('welcomeBack')} {user.email}
          </p>
          <button
            onClick={signOut}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            {t('signOut')}
          </button>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-3">
            {t('saveProgressMessage')}
          </p>
          
          <form onSubmit={handleAuth} className="space-y-3">
            <input
              type="email"
              placeholder={t('email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder={t('password')}
                value={password}
                onChange={handlePasswordChange}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            
            {isSignUp && password && (
              <div className="text-xs space-y-1 p-3 bg-gray-50 rounded-lg">
                <p className="font-medium text-gray-700 mb-2">{t('passwordRequirements')}:</p>
                <div className={`flex items-center ${passwordRequirements.minLength ? 'text-green-600' : 'text-red-500'}`}>
                  <span className="mr-2">{passwordRequirements.minLength ? '✓' : '✗'}</span>
                  {t('passwordMinLength')}
                </div>
                <div className={`flex items-center ${passwordRequirements.hasLowercase ? 'text-green-600' : 'text-red-500'}`}>
                  <span className="mr-2">{passwordRequirements.hasLowercase ? '✓' : '✗'}</span>
                  {t('passwordLowercase')}
                </div>
                <div className={`flex items-center ${passwordRequirements.hasUppercase ? 'text-green-600' : 'text-red-500'}`}>
                  <span className="mr-2">{passwordRequirements.hasUppercase ? '✓' : '✗'}</span>
                  {t('passwordUppercase')}
                </div>
                <div className={`flex items-center ${passwordRequirements.hasNumber ? 'text-green-600' : 'text-red-500'}`}>
                  <span className="mr-2">{passwordRequirements.hasNumber ? '✓' : '✗'}</span>
                  {t('passwordNumber')}
                </div>
                <div className={`flex items-center ${passwordRequirements.hasSpecialChar ? 'text-green-600' : 'text-red-500'}`}>
                  <span className="mr-2">{passwordRequirements.hasSpecialChar ? '✓' : '✗'}</span>
                  {t('passwordSpecialChar')}
                </div>
              </div>
            )}
            
            {authError && (
              <div className="text-xs text-red-500 p-3 bg-red-50 rounded-lg border border-red-200">
                <p>{authError}</p>
              </div>
            )}
            
            {authSuccess && (
              <div className="text-xs text-green-600 p-3 bg-green-50 rounded-lg border border-green-200 relative">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setIsSignUp(false);
                  }}
                  className="absolute top-2 right-2 text-green-400 hover:text-green-600 text-lg leading-none"
                >
                  ×
                </button>
                <p className="font-medium pr-6">{authSuccess}</p>
                <p className="mt-1 text-gray-600 pr-6">{t('checkEmailConfirmation')}</p>
              </div>
            )}
            
            <button
              type="submit"
              disabled={isSignUp && (!Object.values(passwordRequirements).every(Boolean) || !email || !password)}
              className={`w-full px-4 py-2 rounded-lg transition-colors ${
                isSignUp && (!Object.values(passwordRequirements).every(Boolean) || !email || !password)
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {isSignUp ? t('signUp') : t('signIn')}
            </button>
            
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                resetForm();
              }}
              className="text-xs text-blue-500 hover:text-blue-700 underline"
            >
              {isSignUp ? t('alreadyHaveAccount') : t('needAccount')}
            </button>
          </form>
          
          <p className="text-xs text-gray-500 mt-2">
            {t('optionalMessage')}
          </p>
        </div>
      )}
    </section>

    <hr className="my-8 border-gray-300" />
    <section className="w-full max-w-md bg-white/70 rounded-xl shadow p-6 mb-8">
      <h2 className="text-lg font-semibold mb-2 flex items-center gap-2 text-fuchsia-700">
        <span>📝</span> {t('todayYouWrote')}
      </h2>
      <ul className="text-base">
        <li>
          <span className="font-medium">{t('tasks')}:</span>{" "}
          {state.tasks.length > 0
            ? state.tasks.map((t, i) => (
                <span key={i} className={t.status === "completed" ? "line-through text-gray-400" : ""}>
                  {t.text}
                  {i < state.tasks.length - 1 ? ", " : ""}
                </span>
              ))
            : <span className="text-gray-400">—</span>}
        </li>
        <li>
          <span className="font-medium">{t('mood')}:</span>{" "}
          {state.mood ? state.mood : <span className="text-gray-400">—</span>}
        </li>
        <li>
          <span className="font-medium">{t('gratitude')}:</span>
          {" "}
          {state.gratitudes.length > 0
            ? state.gratitudes.map((g, i) => (
                <span key={i}>
                  {g}
                  {i < state.gratitudes.length - 1 ? ", " : ""}
                </span>
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
    {/* About link and separator as a gentle footnote, outside the white box */}
    <div className="w-full flex justify-center">
      <div className="mt-4 mb-2 text-center bg-transparent">
        <span className="text-xs text-fuchsia-900/80 font-medium px-2 py-1 rounded">
          {t('aboutPreLink')} <Link href="/about" className="underline hover:text-fuchsia-700 transition focus:outline-none focus:ring-2 focus:ring-fuchsia-300 rounded text-xs">{t('aboutLink')}</Link>
        </span>
      </div>
    </div>
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
  <button
    className="flex flex-col items-center text-blue-600 focus:outline-none"
    onClick={() => setShowHistory(true)}
    aria-label="History"
  >
    <span className="text-2xl">📅</span>
    <span className="text-xs">{t('history')}</span>
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
{showHistory && (
  <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
    <div className="bg-white rounded-2xl p-8 shadow-2xl w-full max-w-md flex flex-col items-center">
      <h2 className="text-xl font-bold mb-4 text-blue-700">{t('history')}</h2>
      <ul>
        {history.length === 0 && <li className="text-gray-400">{t('noEntriesYet')}</li>}
        {history.map(({ entry, tasks, gratitudes }, idx) => (
          <li key={idx} className="mb-4">
            <div className="font-medium">{entry.date}</div>
            <div>{t('tasks')}: {tasks.map(t => t.text).join(", ")}</div>
            <div>{t('mood')}: {entry.mood}</div>
            <div>{t('gratitude')}: {gratitudes.map(g => g.text).join(", ")}</div>
          </li>
        ))}
      </ul>
      <button
        className="mt-2 px-6 py-2 rounded bg-fuchsia-200 text-fuchsia-900 font-semibold shadow"
        onClick={() => setShowHistory(false)}
      >
        {t('close')}
      </button>
    </div>
  </div>
)}
    </main>
  );
}