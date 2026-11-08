# MealDeal frontend design system

The rules every screen follows. If something here is not possible for a new screen, change this file
in the same PR so it stays the single source of truth.

- **Tokens and shared classes:** `src/app/globals.css`
- **Shared components:** `src/components/` (`top-bar.tsx`, `range-field.tsx`, `brand.tsx`)
- **Community screens** (Food support, Eat out): `src/features/community.module.css`. It uses the same tokens.
- **Cooking mode:** `src/features/cooking/cooking.module.css`. It uses the same fonts and tokens.

Mobile first: design at **390 × 844**. The app column is at most **440px** wide and centred on larger screens.

---

## 1. Principles

1. **One look everywhere.** Use the shared classes and tokens. No new colours, radii or font sizes in a page file.
2. **Tap, don't type.** Prefer chips, segmented controls, sliders and dropdowns. A text field is only for things we can't list, and it is always optional ("Other (optional)").
3. **The main action is obvious.** Each screen has at most one primary (filled) button.
4. **Say what happened.** Every add, remove, save, lookup or error shows one short status line in the same place.
5. **Numbers come from code.** The UI never shows an AI-estimated price or nutrition value.
6. **Label sample data.** Fictional merchants, sample prices and demo content say so on screen.

---

## 2. Colour tokens

Defined on `:root` in `globals.css`. Use the variable, never the hex value.

| Token | Hex | Use |
|---|---|---|
| `--canvas` | `#f4f1ea` | Page background (warm café cream) |
| `--canvas-deep` | `#ebe6dc` | Slider track, segmented-control track, view switch |
| `--surface` | `#ffffff` | Cards, inputs, sheets, outlined buttons |
| `--ink` | `#1d2b26` | Body text |
| `--ink-soft` | `#3b4a44` | Secondary text inside notices |
| `--muted` | `#5b6862` | Hints, metadata, progress messages (low importance only) |
| `--line` / `--line-strong` | `#e0dacd` / `#c9c1b1` | Borders, dividers, unselected chip outline |
| `--green` | `#00704a` | The one action colour: primary buttons, selected chips, links, success text |
| `--green-hover` | `#005c3d` | Hover and pressed state of green |
| `--green-deep` | `#1e3932` | Headings, emphasised values, dark bands (Food support row) |
| `--mint` / `--mint-soft` | `#d8ebe2` / `#edf5f0` | Tags, notices, hover background of outlined controls |
| `--gold` / `--gold-soft` | `#b88a3e` / `#f6ecd9` | **Deals only** ("Real deal" badge) and the selected map pin |
| `--danger` / `--danger-soft` | `#b3261e` / `#fbe9e7` | Errors only |

Rules:
- **Green means "do this" or "done".** Don't use it for decoration.
- **Grey (`--muted`) is for low-importance text only.** A result the user is waiting for (location found, item added, plan saved) is never grey. Use **green**, with the key value in **bold**.
- **Red is only for errors.** **Gold is only for deals.**
- Colour is never the only signal. Selected items are also announced (`aria-pressed`), and errors also say what went wrong.
- Text contrast is at least 4.5:1. Every pair in the table above passes on `--canvas` and `--surface`.

---

## 3. Typography

Loaded with `next/font` in `src/app/layout.tsx`:
- **Fraunces** (600/700) is the display font: page titles, card titles, big numbers. Use `var(--font-display)`.
- **DM Sans** (400/500/700) is for everything else. Use `var(--font-body)`.

| Role | Size / weight | Where |
|---|---|---|
| Page title (`h1`) | 34px Fraunces 600, `--green-deep` | One per screen. Home uses 36px. |
| Section / card title (`h2`, `h3`) | 20–23px Fraunces 600, `--green-deep` | |
| Big value | 26–30px Fraunces 600, tabular numbers | Slider values, totals, prices |
| Body | **16px** DM Sans 400, line-height 1.55 | Minimum for reading text |
| Labels, buttons | 15–16px DM Sans 700 | |
| Hints, status lines | 14–15px | Never smaller than 14px |
| Eyebrow (`.planning-eyebrow`) | 12px, 700, uppercase, 1.2px letter-spacing, `--green` | "COOK AT HOME / PLAN" above a title |

Nothing is smaller than **12px**. Cooking steps use **18px**, because the phone sits on the counter.

---

## 4. Shape, spacing, elevation

- **Radius:** controls (buttons, chips, segmented, view switch) are pills (`999px`); cards are `16px` (`--radius-card`); inputs are `12px` (`--radius-input`); sheets are `24px` at the top.
- **Tap targets:** at least **44 × 44px**. Buttons are 50px tall; chips are 44px.
- **Spacing:** use 8px steps (8 / 12 / 16 / 20 / 24). Page side padding is 20px. Gaps between chips are 8px.
- **Shadows:** `--shadow-card` for cards and icon buttons; `--shadow-float` only for things that float (FAB, sheet).
- **Icons:** [Lucide](https://lucide.dev) (`lucide-react`), 18–24px, stroke 2. Never use text arrows (`→ ↗ ⇄`) or emoji as icons.

---

## 5. Components

### Top bar (`src/components/top-bar.tsx`)
Rendered once in the root layout. Pages must **not** add their own logo or back link.
- **Left:** a round **Back** icon button (`.icon-btn`, chevron) on every screen except home, then the brand. Back goes to a **fixed parent screen** (the `PARENTS` map), not browser history.
- **Right:** the **account button**. It shows initials when signed in and a person icon otherwise. It opens the **account sheet**, a bottom sheet with Log in, or My kitchen, Diet and allergies, Units and Log out.
- There is no hamburger menu: the home cards are the feature menu.

### Buttons (`.btn`)
| Variant | Class | Use |
|---|---|---|
| Primary | `.btn.primary` | The one main action on the screen: Continue, Find meals, Choose this plan, Start cooking, Save changes, Directions |
| Secondary | `.btn` or `.btn.secondary` | Other actions: Add, Update pantry, Website, Use my location |
| Text | `.btn.text` | Low-weight actions: Clear shopping area |
| Icon | `.icon-btn` | Back, account, close, remove (trash), always with an `aria-label` |

- Pill, 50px tall, 16px bold text, optional Lucide icon on the left.
- **Hover darkens the same colour** (green → green-hover; outlined → mint-soft). It never switches to another variant's colour.
- Pressed: `scale(.96)`. Disabled: 45% opacity.

### Action bar (`.action-bar`)
Multi-step screens (onboarding, plan, shopping, Eat Out) put their main actions in **one row after all of the page's content**, separated by a top border. It scrolls with the page: **never fixed, sticky or floating** over the content.
- **Order:** secondary on the left (Previous / Skip), primary on the right and wider (Continue / Save changes).
- One step = one topic. Unrelated settings get their own step (Nutrition goal is separate from Shopping range), so most steps fit on one phone screen.

### Checkboxes and switches
No square boxes anywhere.
- **List tick** (shopping list): plain `input[type=checkbox]`, a 26px circle; checked = green fill with a white tick.
- **On/off setting** (Cook once, eat a few times; On sale): `input[type=checkbox].switch` with `role="switch"`, a 48×28 pill with a sliding knob, placed on the right of its label.
- Show a setting only when it applies (batch cooking appears only for Multiple meals, and is sent as off for One meal).

### Chips: multi-select (`.chip`)
For choices where several can be on: dietary needs, allergies, cuisines, equipment, filters.
- Pill, 44px, white with a `--line-strong` outline.
- **Selected = solid green fill with white text. No check mark.** The fill already says "selected"; a check would change the chip's width and make the row jump.
- Toggle with `aria-pressed`.
- **Custom chips** (added through "Other"): one pill made of the toggle and a small round **×** (`.chip-custom`, `.chip-toggle`, `.chip-remove`). They keep the same 8px gap as other chips.
  - A custom item stays in the list while editing, even when unselected, so a mis-tap is easy to undo. Its × removes it. Only selected items are saved.

### Segmented control: single choice (`.segmented`)
For short exclusive choices inside a card: Ingredient / Seasoning; Not sure / A little / Some / Plenty.
- A `--canvas-deep` track; the selected segment is raised white with `--green-deep` text.
- It deliberately looks different from chips, so users can tell **one choice** (segmented) from **many choices** (chips).
- The **view switch** (Map / List) uses the same pattern at full width.

### "Other (optional)" input
Under a chip group: a text field and an **Add** button (Enter also adds), followed by **one status line** for that group.
- Status messages: "X added and selected." / "X is already in the list." / "X was already in the list, so it is selected now." / "X removed." / the reason it was refused.
- `autocomplete="off"`, max 40 characters.
- Every entry is checked: local format (letters only, at most 4 words), then a local vocabulary, then the smallest model for unknown words. It **fails closed**, and the server checks again on save (`src/lib/custom-choices.ts`, `src/lib/choice-model.ts`).

### Slider with minus / plus (`RangeField`, `src/components/range-field.tsx`)
For numbers: budget, people, cooking time, distance.
- Label on the left, the current value on the right (big Fraunces number), then **− slider +**, then the min and max underneath.
- − and + are round outlined buttons with Lucide icons. Don't write "−1 / +1" on them; the step is implied.
- Buttons disable at the limits. The filled part of the track is green (`--progress`).
- A slider whose top end means "no limit" shows that word at the end (cooking time: "Any length").

### Dropdown (`.field select`)
Only for long or ordered lists (units, days, meals a day, meal balance). The custom chevron is in green.

### Cards
- `.card`: white, 16px radius, `--line` border, `--shadow-card`, 20px padding.
- **List item card** (`.pantry-item`): a name row with a trash icon button, then segmented controls.
- **Place card** (`.place-card`): a tag, a Fraunces title, the address, and When / Who clamped to 2 lines in the carousel, then Directions (primary) and Website.

### Status lines
| Tone | Style | Example |
|---|---|---|
| Progress / neutral | `--muted`, 14–15px | "Finding you…", "Checking "durian"…" |
| **Success / result** | **`--green`, key value in bold `--green-deep`** | "Found you near **Kitsilano, Vancouver**. Not right? Enter a postal code." |
| Error | `--danger`, bold | "That isn't a Canadian postal code. Use the format A1A 1A1, like V6T 1Z4." |

- Use `role="status"` and keep the line's space reserved (`min-height`) so the layout doesn't jump.
- **Fixed templates:** the sentence is fixed and only the found value changes (bold).

### Location picker (`LocationPicker`)
The **same component** everywhere a place is needed (Cook's Shopping range step, Eat Out). Top to bottom:
1. Map with the point and the **distance circle** (UBC until a location is set).
2. Status line (templates above), with an inline **Clear** link once set.
3. One row: **Use my location** + postal code + **Set** (postal format checked locally first).
4. Distance slider (`RangeField`); the circle follows it.

Only an area (about 100 m) is kept.

### Long lists
Paginate instead of one long strip: a few items per page (Eat Out: 3) with **Previous · Page n of N · Next** under the list; turning a page scrolls back to the top. When a location is set, show it in one line above the list ("Within **3 km** of **Kitsilano**" · Change).

### Notices and errors
- `.planning-notice` (mint) for information the user should read: sample data, sync warnings.
- `.planning-error` (danger-soft) for failures. Errors say **what to change**. Example: "The cheapest complete plan we found costs **$41.20** for 3 meals × 2 people, over your $25 budget. Raise the budget, plan fewer meals, or add food you already have."

### Home
- Two **photo cards**, Cook at home and Eat out: a photo, a Fraunces title, a one-line description, and a green round arrow.
- One **dark green row** for Food support.
- A **floating "Share a price" button** (`.fab`), bottom right, with a camera icon and a label. Never icon-only. The shopping list also links to Share a price, because that is where students see prices.

### Maps (Leaflet + OpenStreetMap, `src/features/support/support-map.tsx`)
- No API key. Wrap the map in an element with `isolation: isolate`, so Leaflet's z-index never covers the top bar.
- Numbered green pins; the selected pin is **gold** and slightly larger.
- **Food support:** Map / List switch.
  - With nothing selected, a dashed hint card says "Tap a pin…".
  - Selecting a pin opens a **swipeable card carousel** (scroll-snap) under the map. Neighbour cards peek at 94% scale and 55% opacity, never tilted.
  - The centred card highlights its pin and pans the map. Previous / Next buttons do the same for people who can't swipe.
  - The list view shows everything, including places without an address.
- **Shopping area:** a small single-pin map under the location result.

### Photos and illustrations
- Photos: JPEG, about 760px wide, under 150 KB. Put them in `public/images/`.
- Dishes without a photo use the drawn tiles in `src/features/surplus/dish-art.tsx`. Don't use stock photos of real brands.

---

## 6. Motion

- Page enter: 0.22s fade and 4px rise.
- Sheet: slides up over 0.26s.
- Carousel and pin: about 0.25s.
- Press: scale 0.92–0.96.
- No decorative looping animation, except functional progress (loading spinner).
- `prefers-reduced-motion: reduce` turns all animation and smooth scrolling off. This is already global in `globals.css`.

---

## 7. Accessibility checklist (every PR)

- Real `<button>`, `<a href>`, `<input>` + `<label>`; never `onClick` on a `div`.
- Icon-only buttons have `aria-label`. Decorative icons are `aria-hidden`.
- Toggles use `aria-pressed`; dialogs use `role="dialog" aria-modal` and close with Escape; status lines use `role="status"`.
- Tap targets are at least 44px; text is at least 14px (body 16px); contrast is at least 4.5:1.
- Everything works with the keyboard, with a visible focus ring (`:focus-visible`, green outline).

---

## 8. Copy

- English only. Sentence case. Short sentences; no exclamation marks in errors.
- Buttons are verbs: "Find meals", "Save changes", "Share a price".
- Units come from the user's settings; quantities are stored in grams and converted in code.
- Never promise what we can't check. Say "Check the official page before you go", and label sample data.

---

## 9. Don't

- New colours, fonts, radii or shadows in a page file.
- A second logo, back link or menu inside a page (the top bar does that).
- Fixed, sticky or floating step buttons; put them in the action bar after the content.
- A check mark *and* a fill for "selected".
- Text arrows or emoji as icons.
- Grey text for a result the user is waiting for.
- Free-text fields that are required, or that skip the choice checks.
