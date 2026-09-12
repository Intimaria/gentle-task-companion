export interface Mood { mood: string; note?: string; createdAt: string; }
export interface ApiTask { id: string; text: string; status: "not_started" | "in_progress" | "completed"; createdAt: string; completedAt?: string; }
export interface ApiGratitude { text: string; createdAt: string; }
export interface Profile { preferredSpecies?: string; locale?: string; emergencyContact?: { name: string; phone: string }; }
export interface Dashboard {
  profile: Profile;
  moods: Mood[];
  tasks: { open: ApiTask[]; done: ApiTask[] };
  gratitudes: ApiGratitude[];
  stats: { tasksDone: number; streakDays: number };
}
