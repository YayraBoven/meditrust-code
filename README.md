# MediTrust Ghana

High-fidelity prototype of MediTrust Ghana: a mobile-first app (also usable on a laptop) that checks a medicine against a person's own health profile before they take it, explains possible risks in plain language, and directs them to a pharmacist or doctor.

**Decision support only.** MediTrust does not diagnose, prescribe, suggest substitutes or tell anyone to stop a medicine. All medicine data and safety rules in this prototype are illustrative and must be reviewed by a pharmacist.

**Live prototype:** https://meditrust-code-y5ac.vercel.app (open on a phone and choose *Add to Home Screen*).

Project: AI in Business group project.

## Run it locally

```bash
npm install
npm run dev      # open the printed link; on a laptop the app shows in a phone frame
npm test         # rules-engine tests, including the four demo patients
npm run build    # production build in dist/ (installable PWA)
```

## AI features

- **AI pack reading** (`api/identify.ts`): the photo only is sent to Google Gemini (free tier), which reports what is printed on the pack. Falls back to on-device reading (Tesseract.js) if unavailable.
- **About this medicine**: trusted summaries from MedlinePlus (U.S. National Library of Medicine), with an optional, clearly labelled AI rewrite in simple words (`api/simplify.ts`) that uses only that text.
- Set `GEMINI_API_KEY` in Vercel → Settings → Environment Variables (and in `.env.local` for local dev).

## How it is built

- **React + Vite + TypeScript**, styled with Tailwind; animations with Motion.
- **Mobile-first PWA**: add to the home screen, opens full screen, works offline.
- **Everything runs on the device.** The profile and past checks are stored only in the browser; nothing is sent to a server.
- `src/data/medicines.ts`: illustrative medicine list (real ingredients, invented demo brand names).
- `src/data/rules.ts`: the safety rules table that decides every flag (pending pharmacist review).
- `src/engine/checks.ts`: the three checks (G6PD and pregnancy, self-medication, duplicate ingredient).
- `src/engine/explain.ts`: plain-language wording and the safety filter for any generated text.

## Languages (Twi, Ewe, Ga, Dagbani)

- All app text goes through `t()` (`src/i18n/index.ts`); translations are keyed by the English sentence and
  stored in `src/i18n/<lang>.json`. Missing translations fall back to English.
- `npx tsx scripts/translate.ts --extract-only` lists every sentence (`src/i18n/strings.json`).
- `KHAYA_API_KEY=... npx tsx scripts/translate.ts` machine-translates missing sentences with GhanaNLP Khaya
  (watch the plan's monthly quota).
- Review sheets for fluent speakers: `docs/translations/<lang>.csv` (open in Excel or Google Sheets).
  Fill the "Correction or new translation" column, save as CSV, then run `npx tsx scripts/translate.ts --import`.
- "Listen" in local languages uses Khaya text-to-speech through the Vercel function `api/tts.ts`.
  Set `KHAYA_API_KEY` in Vercel → Project → Settings → Environment Variables (and in `.env.local` for local dev).
  The key is never sent to the browser.
