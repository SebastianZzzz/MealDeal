import type { MealPlan } from "../../types";

export interface StepTimer {
  remainingMs: number;
  endsAt: number | null;
}

export interface CookingSession {
  version: 1;
  signature: string;
  /** One-based current step; steps.length + 1 means that recipe is done. */
  progress: Record<string, number>;
  timers: Record<string, StepTimer>;
}

export type CookingAction =
  | { type: "complete"; recipeId: string; index: number }
  | { type: "start" | "pause" | "resetTimer"; recipeId: string; index: number; now: number }
  | { type: "restart"; recipeId: string };

export const timerKey = (recipeId: string, index: number) => JSON.stringify([recipeId, index]);

export function planSignature(plan: MealPlan): string {
  return JSON.stringify([plan.id, plan.chosen.id, plan.chosen.recipes]);
}

export function createSession(plan: MealPlan): CookingSession {
  return {
    version: 1,
    signature: planSignature(plan),
    progress: Object.fromEntries(plan.chosen.recipes.map((recipe) => {
      const saved = plan.progress[recipe.id];
      const valid = Number.isInteger(saved) && saved >= 1 && saved <= recipe.steps.length + 1;
      return [recipe.id, plan.status === "done" ? recipe.steps.length + 1 : valid ? saved : 1];
    })),
    timers: {},
  };
}

export function remainingMs(timer: StepTimer, now: number): number {
  return Math.max(0, timer.endsAt === null ? timer.remainingMs : timer.endsAt - now);
}

/** Treat browser storage as untrusted; a changed recipe starts a fresh session. */
export function restoreSession(plan: MealPlan, raw: string | null): CookingSession {
  const fresh = createSession(plan);
  if (plan.status === "done") return fresh;
  if (!raw) return fresh;
  try {
    const saved = JSON.parse(raw) as CookingSession;
    if (saved?.version !== 1 || saved.signature !== fresh.signature || !saved.progress || !saved.timers) return fresh;
    for (const recipe of plan.chosen.recipes) {
      const step = saved.progress[recipe.id];
      if (!Number.isInteger(step) || step < 1 || step > recipe.steps.length + 1) return fresh;
      fresh.progress[recipe.id] = step;
      const current = recipe.steps[step - 1];
      if (!current?.timerSec) continue;
      const key = timerKey(recipe.id, step);
      const timer = saved.timers[key];
      if (!timer || !Number.isFinite(timer.remainingMs) || timer.remainingMs < 0 || timer.remainingMs > current.timerSec * 1000) continue;
      if (timer.endsAt !== null && (!Number.isFinite(timer.endsAt) || timer.endsAt < 0)) continue;
      fresh.timers[key] = timer;
    }
    return fresh;
  } catch {
    return fresh;
  }
}

export function updateSession(plan: MealPlan, session: CookingSession, action: CookingAction): CookingSession {
  const recipe = plan.chosen.recipes.find((item) => item.id === action.recipeId);
  if (!recipe) return session;
  if (action.type === "restart") {
    const timers = { ...session.timers };
    for (const step of recipe.steps) delete timers[timerKey(recipe.id, step.index)];
    return { ...session, progress: { ...session.progress, [recipe.id]: 1 }, timers };
  }
  // Viewing a future step must never let the user skip unfinished steps.
  if (session.progress[recipe.id] !== action.index) return session;
  const step = recipe.steps[action.index - 1];
  if (!step) return session;
  const key = timerKey(recipe.id, action.index);
  const timers = { ...session.timers };
  if (action.type === "complete") {
    delete timers[key];
    return { ...session, progress: { ...session.progress, [recipe.id]: action.index + 1 }, timers };
  }
  if (!step.timerSec || step.timerSec <= 0) return session;
  const timer = timers[key] ?? { remainingMs: step.timerSec * 1000, endsAt: null };
  if (action.type === "resetTimer") delete timers[key];
  if (action.type === "start") {
    if (timer.endsAt !== null || timer.remainingMs <= 0) return session;
    timers[key] = { ...timer, endsAt: action.now + timer.remainingMs };
  }
  if (action.type === "pause") timers[key] = { remainingMs: remainingMs(timer, action.now), endsAt: null };
  return { ...session, timers };
}

export function formatTime(milliseconds: number): string {
  const seconds = Math.ceil(Math.max(0, milliseconds) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
