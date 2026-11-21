# MediTrust Ghana

High-fidelity prototype of MediTrust Ghana: a mobile-first app (also usable on a laptop) that checks a medicine against a person's own health profile before they take it, explains possible risks in plain language, and directs them to a pharmacist or doctor.

**Decision support only.** MediTrust does not diagnose, prescribe, suggest substitutes or tell anyone to stop a medicine. All medicine data and safety rules in this prototype are illustrative and must be reviewed by a pharmacist.

Project: AI in Business group project.

## Run it locally

```bash
npm install
npm run dev      # open the printed link; on a laptop the app shows in a phone frame
npm test         # rules-engine tests, including the four demo patients
npm run build    # production build in dist/ (installable PWA)
```

## How it is built

- **React + Vite + TypeScript**, styled with Tailwind; animations with Motion.
- **Mobile-first PWA**: add to the home screen, opens full screen, works offline.
- **Everything runs on the device.** The profile and past checks are stored only in the browser; nothing is sent to a server.
- `src/data/medicines.ts`: illustrative medicine list (real ingredients, invented demo brand names).
- `src/data/rules.ts`: the safety rules table that decides every flag (pending pharmacist review).
- `src/engine/checks.ts`: the three checks (G6PD and pregnancy, self-medication, duplicate ingredient).
- `src/engine/explain.ts`: plain-language wording and the safety filter for any generated text.
