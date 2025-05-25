import { supabase } from "./supabaseClient";
import type {  Task, Gratitude } from "../types/DailyEntry";



// Save or update contact
export async function saveContact(user_id: string, name: string, phone: string) {
  const { data, error } = await supabase
    .from("contacts")
    .upsert([{ user_id, name, phone }], { onConflict: "user_id" });
  if (error) throw error;
  return data;
}

// Fetch contact for user
export async function fetchContact(user_id: string) {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("user_id", user_id)
    .single();
  if (error) throw error;
  return data;
}

// Fetch a full entry with tasks and gratitudes
export async function fetchFullEntry(user_id: string, date: string) {
  const { data: entry, error: entryError } = await supabase
    .from("entries")
    .select("*")
    .eq("user_id", user_id)
    .eq("date", date)
    .single(); 

  if (entryError || !entry) throw entryError || new Error("No entry found");

  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("*")
    .eq("entry_id", entry.id);

  if (tasksError) throw tasksError;

  const { data: gratitudes, error: gratitudesError } = await supabase
    .from("gratitudes")
    .select("*")
    .eq("entry_id", entry.id);

  if (gratitudesError) throw gratitudesError;

  return { entry, tasks, gratitudes };
}

// Save or update today's entry, tasks, and gratitudes
export async function saveFullEntry(
  user_id: string,
  date: string,
  mood: string | null,
  tasks: Omit<Task, "id" | "entry_id">[],
  gratitudes: Omit<Gratitude, "id" | "entry_id">[]
) {
//  console.log("saveFullEntry called with:", { user_id, date, mood, tasks, gratitudes });

  // 1. Upsert entry
const { data: entryData, error: entryError } = await supabase
  .from("entries")
  .upsert([{ user_id, date, mood }], { onConflict: "user_id,date" }) // <--- ADD THIS
  .select()
  .single();

  // console.log("Upsert entry result:", entryData, entryError);

  if (entryError || !entryData) throw entryError || new Error("Could not upsert entry");

  const entry_id = entryData.id;

  // 2. Delete old tasks and gratitudes for this entry
  await supabase.from("tasks").delete().eq("entry_id", entry_id);
  await supabase.from("gratitudes").delete().eq("entry_id", entry_id);

  // 3. Insert new tasks
  if (tasks.length > 0) {
    await supabase.from("tasks").insert(
      tasks.map(t => ({ ...t, entry_id }))
    );
  }

  // 4. Insert new gratitudes
  if (gratitudes.length > 0) {
    await supabase.from("gratitudes").insert(
      gratitudes.map(g => ({ ...g, entry_id }))
    );
  }

  return true;
}