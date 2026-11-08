# MealDeal

A working mobile-first implementation of the MealDeal Figma framework, built with React, TypeScript and Vinext/Vite.

## Run locally

Requires Node.js 22.13 or later.

```sh
npm install
npm run dev
```

Open the local address printed by the server. Production build: `npm run build`.

## Implemented

- Mobile layout with the Figma cream, pale green and forest green palette.
- All action buttons start light; pressed buttons and selected options turn dark green.
- Real native range sliders with synchronized labels and bounded minus/plus controls.
- Single-select and multi-select preferences, equipment, pantry and staples.
- Separate optional Other fields for equipment, pantry and staples. Enter or the add button adds a selected option. Case-insensitive duplicates reuse the existing option. IME composition is supported.
- Kitchen summaries update immediately. Save returns to the page that opened the editor.
- Browser history and in-app Back return to the previous page.
- Local browser persistence for preferences, custom items, prices, shopping checks, sample listings and reservations.
- Meal samples filtered by estimated budget, cooking time and supported vegetarian/vegan preferences; sample shopping estimates scale with people and plan length.
- Shopping checkboxes, copy list, cooking steps and pause/resume/reset countdown.
- Sample surplus listings, sorting, area filters, sample reservation and listing forms.
- Basic keyboard support, focus states, reduced-motion support and accessible labels.

## Scope and limits

This is a front-end demo, not a connected food or payment service. Prices and availability are sample data. Sharing and listings stay in localStorage in the current browser; no personal data or photo is uploaded. The photo picker retains only a filename for the current session and does not perform OCR. Food preferences are saved, but samples do not establish allergen safety, halal certification or personalized nutrition. Multi-meal plans repeat a sample recipe.

Figma API access was rate limited during implementation. This version uses the page structure and visual references already confirmed in the chat; it is not a pixel-perfect Figma export. The original food illustrations could not be retrieved, so homepage image slots currently use lightweight graphic placeholders. Replace those slots with the original licensed assets when available.

## Main files

- `app/page.tsx`: application routes, shared controls and state.
- `app/globals.css`: responsive layout and design tokens.
- `app/layout.tsx`: application metadata.
- `public/favicon.svg`: application icon.

Data storage key: `mealdeal-v1`. Clearing that key resets the demo. No backend credentials are required.
