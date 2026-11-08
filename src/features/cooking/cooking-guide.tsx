"use client";

import Link from "next/link";
import { useEffect, useReducer, useState } from "react";
import { GRAMS_PER, type MealPlan, type UnitPrefs, type WeightUnit } from "@/types";
import { createSession, formatTime, remainingMs, restoreSession, timerKey, updateSession, type CookingAction, type CookingSession } from "./session";
import { canCook, saveCurrentProgress } from "./plan-storage";
import { syncCookingPlan } from "./cloud-client";
import styles from "./cooking.module.css";
import { plural } from "@/lib/plural";

type ViewState = { session: CookingSession; ready: boolean; warning: string; units: UnitPrefs; now: number };
type ViewAction = CookingAction
  | { type: "hydrate"; session: CookingSession; warning: string; units: UnitPrefs; now: number }
  | { type: "tick"; now: number }
  | { type: "units"; units: UnitPrefs }
  | { type: "saveError"; warning: string };

function Icon({ name, size = 20 }: { name: "arrow" | "clock" | "check" | "chevron" | "leaf" | "pot"; size?: number }) {
  const paths = {
    arrow: <path d="m14 6-6 6 6 6M8 12h12" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m6 9 6 6 6-6" />,
    leaf: <><path d="M20 4c-12-1-18 4-14 11 7 4 12-2 14-11Z" /><path d="M4 20 15 9" /></>,
    pot: <><path d="M5 10h14v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-6ZM3 10h18M8 6V3m4 3V2m4 4V3M2 13h3m14 0h3" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const defaultUnits: UnitPrefs = { lang: "en", weight: "g", volume: "ml", currency: "CAD" };

function readUnits(): UnitPrefs {
  try {
    const units: unknown = JSON.parse(localStorage.getItem("mealdeal.profile") || "null")?.units;
    if (units && typeof units === "object" && "weight" in units && typeof units.weight === "string" && Object.hasOwn(GRAMS_PER, units.weight)) {
      return { ...defaultUnits, weight: units.weight as WeightUnit };
    }
  } catch { /* Use grams if the profile is unavailable or invalid. */ }
  return defaultUnits;
}

function quantity(grams: number, unit: WeightUnit) {
  return `${new Intl.NumberFormat("en-CA", { maximumFractionDigits: unit === "g" ? 1 : 3 }).format(grams / GRAMS_PER[unit])} ${unit}`;
}

/** Accepts the final MealPlan from C. No network or recalculation is hidden here. */
export function CookingGuide({ plan, isDemo = false }: { plan: MealPlan; isDemo?: boolean }) {
  const [view, dispatch] = useReducer((state: ViewState, action: ViewAction): ViewState => {
    if (action.type === "hydrate") return { ready: true, session: action.session, warning: action.warning, units: action.units, now: action.now };
    if (action.type === "tick") return { ...state, now: action.now };
    if (action.type === "units") return { ...state, units: action.units };
    if (action.type === "saveError") return { ...state, warning: action.warning };
    return { ...state, session: updateSession(plan, state.session, action) };
  }, { session: createSession(plan), ready: false, warning: "", units: defaultUnits, now: 0 });
  const { units, now } = view;
  const [openRecipes, setOpenRecipes] = useState<Record<string, boolean>>({});
  const [openSteps, setOpenSteps] = useState<Record<string, number>>({});
  const [resetRecipe, setResetRecipe] = useState<string | null>(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudMessage, setCloudMessage] = useState("");
  const storageKey = `mealdeal.cooking.v1:${plan.userId}:${plan.id}`;

  useEffect(() => {
    let session = createSession(plan);
    let warning = "";
    try { session = restoreSession(plan, localStorage.getItem(storageKey)); }
    catch { warning = "Browser storage is unavailable. Keep this page open to retain your progress."; }
    dispatch({ type: "hydrate", session, warning, units: readUnits(), now: Date.now() });
  }, [plan, storageKey]);

  useEffect(() => {
    if (!view.ready) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(view.session));
      if (!isDemo) saveCurrentProgress(localStorage, plan, view.session.progress);
    }
    catch { dispatch({ type: "saveError", warning: "Your progress could not be saved. Keep this page open while cooking." }); }
  }, [isDemo, plan, storageKey, view.ready, view.session]);

  useEffect(() => {
    const tick = () => dispatch({ type: "tick", now: Date.now() });
    const interval = window.setInterval(tick, 500);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, []);

  const recipes = plan.chosen.recipes;
  const totalSteps = recipes.reduce((sum, recipe) => sum + recipe.steps.length, 0);
  const completedSteps = recipes.reduce((sum, recipe) => sum + Math.min(recipe.steps.length, view.session.progress[recipe.id] - 1), 0);
  const allDone = recipes.length > 0 && completedSteps === totalSteps;
  const activeTimers = recipes.flatMap((recipe) => recipe.steps.flatMap((step) => {
    const timer = view.session.timers[timerKey(recipe.id, step.index)];
    return timer?.endsAt !== null && timer?.endsAt !== undefined ? [{ recipe, step, left: remainingMs(timer, now) }] : [];
  }));

  function completeStep(recipeId: string, index: number) {
    dispatch({ type: "complete", recipeId, index });
    setOpenSteps((current) => ({ ...current, [recipeId]: index + 1 }));
  }

  async function syncAccount(restore: boolean) {
    setCloudBusy(true); setCloudMessage("");
    try {
      const remote = await syncCookingPlan(plan.id, restore ? undefined : view.session.progress);
      if (remote.userId !== plan.userId || JSON.stringify(remote.chosen.recipes) !== JSON.stringify(plan.chosen.recipes) || !canCook(remote)) {
        throw new Error("The saved account plan differs from this recipe. Reopen it from your shopping list.");
      }
      if (restore) {
        const next = saveCurrentProgress(localStorage, plan, remote.progress);
        const session = createSession(next);
        localStorage.setItem(storageKey, JSON.stringify(session));
        dispatch({ type: "hydrate", session, warning: "", units, now });
        setOpenSteps({});
      }
      setCloudMessage(restore ? "Account progress restored. Old local timers have been cleared." : "Cooking progress saved to your account.");
    } catch (cause) { setCloudMessage(cause instanceof Error ? cause.message : "Account sync is unavailable. Your local progress is still saved."); }
    finally { setCloudBusy(false); }
  }

  if (!view.ready) return <main className={styles.page}><p className={styles.eyebrow}>MEALDEAL / YOUR KITCHEN</p><h1>Getting your kitchen ready…</h1></main>;

  return <main className={styles.page}>
    {/* The app's top bar already shows the brand; this header only names the mode. */}
    <header className={styles.header}>
      <span className={styles.stage}><span /> COOKING MODE</span>
    </header>

    <nav className={styles.breadcrumb} aria-label="Meal stages"><span>01 &nbsp; Plan</span><span>02 &nbsp; Shop</span><strong>03 &nbsp; Cook</strong></nav>
    {isDemo && <p className={styles.demo}>Demo kitchen · sample recipes · no shopping required</p>}

    <section className={styles.intro}>
      <p className={styles.eyebrow}>GOOD FOOD, ONE STEP AT A TIME</p>
      <h1>{allDone ? "Made by you." : <>Let’s make<br />something good.</>}</h1>
      <p className={styles.subtitle}>{allDone ? "Your meal is ready. Take a seat and enjoy what you made." : "A little guidance. A meal to feel good about. Open a recipe when you’re ready to begin."}</p>
      <div className={styles.mealMeta}><span><Icon name="pot" size={17} /> {plural(recipes.length, "recipe")}</span><span><Icon name="clock" size={17} /> {Math.max(0, ...recipes.map((recipe) => recipe.totalMinutes))} min estimated</span></div>
    </section>

    <section className={styles.progressCard} aria-label="Cooking progress">
      <div><span className={styles.eyebrow}>{allDone ? "DINNER, DONE" : "YOUR PROGRESS"}</span><strong>{completedSteps} <span>/ {plural(totalSteps, "step")}</span></strong></div>
      <div className={styles.progressTrack} role="progressbar" aria-label="Completed cooking steps" aria-valuemin={0} aria-valuemax={totalSteps || 1} aria-valuenow={completedSteps}><span style={{ width: `${totalSteps ? completedSteps / totalSteps * 100 : 0}%` }} /></div>
      <p role="status">{view.warning || "Progress saved on this browser. Come back right where you left off."}</p>
    </section>

    {activeTimers.length > 0 && <aside className={styles.timerTray} aria-label="Running timers">
      {activeTimers.map(({ recipe, step, left }) => <button key={timerKey(recipe.id, step.index)} className={left === 0 ? styles.timerAlert : ""} onClick={() => {
        setOpenRecipes((current) => ({ ...current, [recipe.id]: true }));
        setOpenSteps((current) => ({ ...current, [recipe.id]: step.index }));
        window.setTimeout(() => document.getElementById(`recipe-${recipe.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
      }}><Icon name="clock" size={17} /><span>{recipe.title}</span><strong>{left === 0 ? "Time’s up" : formatTime(left)}</strong></button>)}
    </aside>}

    <div className={styles.sectionHeading}><h2>On the menu</h2><label>Show weight in <select aria-label="Display weight unit" value={units.weight} onChange={(event) => dispatch({ type: "units", units: { ...units, weight: event.target.value as WeightUnit } })}>{Object.keys(GRAMS_PER).map((unit) => <option key={unit} value={unit}>{unit === "jin" ? "jin (500 g)" : unit}</option>)}</select></label></div>

    <div className={styles.recipes}>
      {recipes.map((recipe, recipeIndex) => {
        const currentStep = view.session.progress[recipe.id];
        const done = currentStep > recipe.steps.length;
        const expanded = openRecipes[recipe.id] ?? false;
        const viewedStep = openSteps[recipe.id] ?? currentStep;
        return <article key={recipe.id} id={`recipe-${recipe.id}`} className={`${styles.recipe} ${done ? styles.recipeDone : ""}`}>
          <button className={styles.recipeHeader} aria-expanded={expanded} aria-controls={`body-${recipe.id}`} onClick={() => setOpenRecipes({ ...openRecipes, [recipe.id]: !expanded })}>
            <span className={`${styles.recipeArt} ${recipeIndex % 2 ? styles.riceArt : ""}`} aria-hidden="true">{recipeIndex % 2 ? "🍚" : "🍅"}</span>
            <span className={styles.recipeHeading}><span className={styles.recipeNumber}>RECIPE {String(recipeIndex + 1).padStart(2, "0")}{done && " · COMPLETE"}</span><h3>{recipe.title}</h3><span className={styles.recipeMeta}>{recipe.totalMinutes} min <span>·</span> {plural(recipe.servings, "portion")} <span>·</span> {Math.min(recipe.steps.length, currentStep - 1)}/{plural(recipe.steps.length, "step")}</span></span>
            <span className={`${styles.expandIcon} ${expanded ? styles.expanded : ""}`}><Icon name={done ? "check" : "chevron"} /></span>
          </button>

          <div id={`body-${recipe.id}`} hidden={!expanded} className={styles.recipeBody}>
            <section className={styles.ingredients} aria-label={`Ingredients for ${recipe.title}`}><div className={styles.ingredientsHeading}><h4>Everything you’ll need</h4><span>{recipe.servings === 1 ? "For 1 portion" : `For all ${recipe.servings} portions`}</span></div><ul>{recipe.ingredients.map((ingredient, index) => <li key={`${ingredient.name}-${index}`}><span>{ingredient.name}{ingredient.pantryItemId && <small>FROM YOUR PANTRY</small>}</span><strong>{quantity(ingredient.qtyG, units.weight)}</strong></li>)}</ul></section>

            <div className={styles.steps}>
              {recipe.steps.map((step) => {
                const finished = step.index < currentStep;
                const active = step.index === currentStep;
                const open = viewedStep === step.index;
                const key = timerKey(recipe.id, step.index);
                const timer = view.session.timers[key];
                const left = timer ? remainingMs(timer, now) : (step.timerSec ?? 0) * 1000;
                const running = timer?.endsAt !== null && timer?.endsAt !== undefined;
                return <section key={step.index} className={`${styles.step} ${open ? styles.stepOpen : ""}`}>
                  <button className={styles.stepHeader} aria-expanded={open} aria-controls={`step-${recipe.id}-${step.index}`} onClick={() => setOpenSteps({ ...openSteps, [recipe.id]: open ? 0 : step.index })}>
                    <span className={`${styles.stepNumber} ${finished ? styles.stepFinished : active ? styles.stepCurrent : ""}`}>{finished ? <Icon name="check" size={15} /> : String(step.index).padStart(2, "0")}</span>
                    <span>{step.summary}<small>{finished ? "Completed" : active ? "Your current step" : `Step ${step.index}`}</small></span><Icon name="chevron" size={16} />
                  </button>
                  <div id={`step-${recipe.id}-${step.index}`} hidden={!open} className={styles.stepDetail}>
                    <p>{step.detail}</p>
                    {active && !!step.timerSec && <div className={styles.timerBox}>
                      <div className={styles.timerTop}><span><Icon name="clock" size={16} /> STEP TIMER</span><span>{left === 0 ? "Check your food" : running ? "Running" : timer ? "Paused" : "Start when ready"}</span></div>
                      <div className={styles.clock} role="timer" aria-label={`${step.summary}, ${formatTime(left)} remaining`}>{formatTime(left)}</div>
                      {left === 0 && <p className={styles.timeUp} role="status">Time’s up. Check your food before moving on.</p>}
                      <div className={styles.timerButtons}><button disabled={left === 0} className={styles.timerPrimary} onClick={() => dispatch({ type: running ? "pause" : "start", recipeId: recipe.id, index: step.index, now: Date.now() })}>{running ? "Pause timer" : timer ? "Resume timer" : "Start timer"}</button><button className={styles.textButton} onClick={() => dispatch({ type: "resetTimer", recipeId: recipe.id, index: step.index, now: Date.now() })}>Reset</button></div>
                    </div>}
                    {active && <button className={styles.completeButton} onClick={() => completeStep(recipe.id, step.index)}><Icon name="check" size={18} />{step.index === recipe.steps.length ? "Finish this recipe" : "Done, next step"}<span>→</span></button>}
                    {!active && !finished && <p className={styles.previewNote}>Just a look ahead. Finish step {currentStep} to continue.</p>}
                  </div>
                </section>;
              })}
            </div>

            {done && <p className={styles.doneMessage} role="status"><Icon name="check" /> This one’s ready. Nicely done.</p>}
            <div className={styles.restart}>
              {resetRecipe === recipe.id ? <><span>Clear this recipe’s steps and timers?</span><div><button className={styles.textButton} onClick={() => setResetRecipe(null)}>Keep cooking</button><button className={styles.textButton} onClick={() => {
                dispatch({ type: "restart", recipeId: recipe.id });
                setOpenSteps({ ...openSteps, [recipe.id]: 1 });
                setResetRecipe(null);
              }}>Yes, start over</button></div></> : <button className={styles.textButton} onClick={() => setResetRecipe(recipe.id)}>Start this recipe over</button>}
            </div>
          </div>
        </article>;
      })}
    </div>

    {recipes.length === 0 && <section className={styles.empty}><h2>No recipes here yet.</h2><p>Choose a meal plan before entering cooking mode.</p><Link href="/cook">Back to Cook at Home</Link></section>}
    {allDone && <section className={styles.celebration} role="status"><span className={styles.finishMark}><Icon name="check" size={28} /></span><h2>Good food. Your own two hands.</h2><p>{recipes.length === 1 ? "Your recipe is complete." : `All ${recipes.length} recipes are complete.`} Your progress is saved here.</p><Link href="/" className={styles.homeButton}>Back to MealDeal <span>→</span></Link></section>}

    {!isDemo && <section className={styles.cloudSync} aria-label="Account progress"><h2>Keep your place.</h2><p>Progress saves on this browser automatically. Account sync is available when your plan has been connected to shared storage.</p><div><button disabled={cloudBusy} onClick={() => void syncAccount(false)}>Save to account</button><button disabled={cloudBusy} onClick={() => void syncAccount(true)}>Restore account progress</button></div>{cloudMessage && <p role="status">{cloudMessage}</p>}</section>}
    <footer className={styles.footer}><Icon name="leaf" size={17} /><p>A little less stress. A little more homemade.</p><span>Timers are reminders. Check your food as you cook.</span></footer>
    <Link className={styles.backLink} href={isDemo ? "/cook/cooking" : "/cook/shopping"}><Icon name="arrow" size={16} />{isDemo ? "Open your meal plan" : "Back to shopping list"}</Link>
    <nav className={styles.featureLinks} aria-label="More ways to eat"><Link href={isDemo ? "/cook/plan" : "/cook/demo"}>{isDemo ? "Plan a meal" : "Try a sample recipe"}</Link><Link href="/support">Food support</Link><Link href="/eat-out">Eat out</Link></nav>
  </main>;
}
