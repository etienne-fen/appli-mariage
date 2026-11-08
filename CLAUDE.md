# Architecture & Planned Features for Appli Mariage

## Overview
- Mobile-first PWA built with Next.js and Firebase.
- Firebase services: Authentication (phone/SMS sign-in), Firestore for app data, Cloud Storage for media, Hosting for deployment.
- No outbound SMS from app; guests authenticate via phone OTP only (Firebase Auth). General announcements are distributed separately (WhatsApp / email).

## High-level architecture
- Frontend: Next.js (React) as a PWA using `manifest.json` + service worker (via `next-pwa`).
- Firebase client SDK initialized in `src/firebase/firebaseClient.js` using `NEXT_PUBLIC_*` env vars.
- Authentication flow: Firebase Phone Auth (reCAPTCHA on web), one-time codes for guest sign-in.
- Data model (Firestore): collections for `guests`, `events`, `rsvps`, `photos`, `notes`.
- Storage: Cloud Storage for uploaded photos and attachments, access rules scoped by event/guest.
- Hosting: Firebase Hosting with Next.js static export (`output: 'export'`). All data is fetched client-side via the Firebase SDK so no SSR or API routes are needed. Build outputs to `out/`, deployed via `npm run deploy`.

## Planned features (phases)
1. Skeleton & Auth
   - Phone/SMS sign-in (Firebase Auth, client-only flow)
   - Basic user session handling and protected routes
2. Guest experience
   - View event details (date, location, schedule)
   - RSVP flow linked to guest record
   - Save contacts / quick actions (add to calendar)
3. Media & Sharing
   - Photo and video uploads to Cloud Storage (guest-contributions album)
   - Gallery page with lazy loading and simple moderation
   - Cloud Function mirrors approved uploads to a shared Google Photos album or Google Drive folder via Google APIs (guests keep a permanent copy outside the app)
4. Admin tools (secure)
   - Admin-only dashboard to manage guests, send notices (outside app), and moderate uploads
5. Offline / PWA polish
   - Caching strategies for assets and key API reads
   - Add-to-home-screen UX and fast cold-start

## Security & privacy notes
- Use Firebase security rules for Firestore and Storage to prevent unauthorized reads/writes.
- Minimize personally-identifiable data stored; use phone numbers only for authentication and link to guest records with opt-in preferences.

## Files created in this skeleton
- `package.json`, `next.config.js` (PWA plugin)
- `pages/` basic Next.js app pages
- `public/manifest.json` + `public/icons/` placeholders
- `src/firebase/firebaseClient.js` and `.env.local.example` for credentials
- `firebase.json` and `.firebaserc` (placeholders)
- `firestore.rules` with starter access rules

## Firestore schema

Full rationale, invariants, and the source-data import shape live in
[docs/data-model.md](docs/data-model.md) (see [docs/seed-example.json](docs/seed-example.json)
for the expected import JSON). Summary:

```
persons/{personId}              — stable identity; phone is auth-only, not the doc key
  prenom: string
  nom: string
  kind: "adult" | "child"
  phone: string | null          — E.164, unique; null for children (they never log in)
  householdId: string           — → households
  isPrimaryContact: bool        — RSVP-referent flag only, doesn't affect write access
  partnerId: string | null      — → persons, reciprocal
  roomId: string                — → rooms
  mealPreferences: { regime: string|null, allergies: string[], notes: string }
  attendance: { [eventId]: true | false | null }

households/{householdId}        — co-management unit; composition is import-sourced, not guest-editable
  displayName: string
  primaryContactId: string      — → persons
  managerPhones: string[]       — derived at import: phones of adult members (write access)

rooms/{roomId}                  — slug `batiment-niveau-chambre`
  batiment: string               — Escoubet | Escoubas | Yourtes
  niveau: string                 — Rez de chaussée | Étage | Extérieur
  chambre: string
  type: "chambre" | "dortoir"
  capacite: number

info/{sectionId}                — public content pages (no auth required to read)
  sectionId: schedule | dresscode | accommodation | faq | contact
  FR: { ...section-specific fields... }
  EN: { ...section-specific fields... }
  // Edit content directly in Firestore console — no redeployment needed
  // Seed structure defined in src/lib/seedInfo.js

events/{eventId}                — fixed IDs: ceremony|cocktail|dinner|party|brunch
  title: { FR, EN }            — bilingual label
  day:   { FR, EN }            — e.g. "Samedi" / "Saturday"
  timeStart: string            — "HH:MM"
  location: string
  order: number                — sort key

photos/{photoId}                — storagePath + guestId + eventId + status (pending/approved/rejected)
notes/{noteId}                  — guestbook entries; guestId + content + createdAt
```

Meal preferences and RSVP attendance live directly on each `persons` doc (see above) —
there are no separate `meals`/`rsvps` collections. Import via the "Accommodation" block
on `/admin/seed`, using `src/lib/seedAccommodation.js` (idempotent; re-importing never
overwrites `mealPreferences`/`attendance` already saved by a guest).
