import type { Hono } from "hono";
import { createApp } from "./app";
import { authFromEnv } from "./auth/oidc";
import { createMood, listMoods, deleteMood } from "./data/moods";
import { createTask, listTasks, updateTaskStatus, deleteTask } from "./data/tasks";
import { createGratitude, listGratitudes, deleteGratitude } from "./data/gratitudes";
import { getProfile, putProfile } from "./data/profile";
import { getDashboard } from "./data/dashboard";
import { getRandomAnimal } from "./data/companion";
import { saveAnimal, listSaved } from "./data/storage";
import { listMedia, createUploadUrl, confirmMedia, deleteMedia } from "./data/media";

/** Wiring único de deps → app. Lo usan server.ts (node) y lambda.ts (aws-lambda). */
export function createAppFromEnv(): Hono {
  return createApp({
    auth: authFromEnv(),
    moods: { createMood, listMoods, deleteMood },
    tasks: { createTask, listTasks, updateTaskStatus, deleteTask },
    gratitudes: { createGratitude, listGratitudes, deleteGratitude },
    profile: { getProfile, putProfile },
    getDashboard,
    getRandomAnimal,
    saveAnimal,
    listSaved,
    listMedia,
    createUploadUrl,
    confirmMedia,
    deleteMedia,
  });
}
