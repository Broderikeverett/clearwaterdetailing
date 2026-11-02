# 🤡 Travis Meme Factory

A dark-mode, mobile-first meme studio dedicated to making our friend Travis look ridiculous.
React 18 + TypeScript + Vite. No backend, no paid APIs — everything runs and saves on-device.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # static site in dist/ (deploy anywhere: Netlify, Vercel, GitHub Pages)
npm run build:single # one self-contained HTML file in dist-single/ (AirDrop it, email it, host it anywhere)
```

## Features

| Area | What it does |
| --- | --- |
| **Meme Studio** (`#/create`) | Upload a photo, crop to Orig/1:1/4:5/9:16/16:9, zoom and pan the photo, and add any number of text boxes. Drag to move; handles to resize (⤡), rotate (↻), and change wrap width (↔). Pinch on mobile. Set the font (11), color, outline, size, alignment, CAPS/mOcK case, background box, and shadow. Add emoji stickers and "Travis face" photo cutouts. Layers panel, undo/redo (Ctrl+Z), and PNG export at 1080, 2000, or 3000px, plus the native share sheet. |
| **Templates** (`#/templates`) | 12 built-in formats: Drake, Distracted Boyfriend, Two Buttons, Expanding Brain, Change My Mind, Woman Yelling at Cat, Mocking SpongeBob, One Does Not Simply, Surprised Pikachu, Galaxy Brain, Breaking News, and Classic. Upload your own custom templates. |
| **Roast AI** (`#/roasts`) | Offline caption engine with 10 categories, mixing hand-written and combinatorial jokes. Copy a roast, or turn it into a meme in one tap. |
| **Breaking News** (`#/news`) | Fake headline generator rendered as a cable-news chyron, plus write-your-own. |
| **Meme Battle** (`#/battle`) | Two memes (saved or freshly generated) go head to head. Votes feed an Elo leaderboard. |
| **Meme of the Day** | Picks a saved meme with a seeded random per date and gives it a ridiculous title. Rerollable. |
| **Saved** (`#/saved`) | Edit, download, or delete memes. Create, rename, or delete collections and move memes between them. |
| **MAKE TRAVIS LOOK STUPID** | Random template + caption + stickers, using photos from the Travis Photo Bank. |

## How it works

- `src/lib/render.ts` holds the single canvas renderer used for the live editor, thumbnails, and PNG export, so what you see is exactly what you download.
- `src/lib/templates.ts` draws the templates procedurally from shapes and emoji, so no copyrighted image files ship in the repo.
- `src/lib/db.ts` is the IndexedDB persistence for memes, collections, photos, leaderboard, and custom templates. It falls back to memory if storage is blocked.
- Fonts are bundled through `@fontsource`, so exports look identical on every device and work offline.

Data lives in the browser it was made in. Clearing site data deletes memes.
