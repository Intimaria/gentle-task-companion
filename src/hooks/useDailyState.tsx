import { useEffect, useState } from "react";


export type TaskStatus = "not_started" | "in_progress" | "completed";
export type Task = { text: string; status: TaskStatus };
export type DailyState = {
  tasks: Task[];
  mood: string | null;
  gratitudes: string[];
  newTask: string; 
  newGratitude: string;  
};
function getTodayKey() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `daily-state-${today}`;
}

export function useDailyState() {
const [state, setState] = useState<DailyState>({
  tasks: [],
  mood: null,
  gratitudes: [],
  newTask: "",
  newGratitude: "",
});

  // Load from localStorage on mount
useEffect(() => {
  const saved = localStorage.getItem(getTodayKey());
  if (saved) {
    const parsed = JSON.parse(saved);
    setState(s => ({
      ...s,
      ...parsed,
      gratitudes: Array.isArray(parsed.gratitudes) ? parsed.gratitudes : [],
      newGratitude: typeof parsed.newGratitude === "string" ? parsed.newGratitude : "",
    }));
  }
}, []);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem(getTodayKey(), JSON.stringify(state));
  }, [state]);

  return [state, setState] as const;
}