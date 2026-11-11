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
             + schedule-friday: FULL alternative Programme, Friday invitees only; they see it
               INSTEAD of `schedule` (VARIANTS in pages/info/[section].js; admins get tabs)
  FR: string                   — HTML from the rich-text editor
  EN: string
  // Edit content directly in Firestore console — no redeployment needed
  // Seed structure defined in src/lib/seedInfo.js

events/{eventId}                — the 6 "Mes réponses" questions:
                                  friday-dinner (friday), friday-night (fridayLodging)
                                  ceremony, dinner = "Dîner & Soirée" (all; Menu relies on `dinner`)
                                  saturday-night (lodging), brunch (all)
  audience: "all" | "friday" | "lodging" | "fridayLodging" — REQUIRED; rules hide docs without it.
                                 friday = "Invité vendredi", lodging = "Logé au Domaine" (Foyers tab),
                                 fridayLodging = both (derived). Clients must
                                 query where('audience','==',…) (unfiltered queries are rejected).
                                 Restricted audiences listed in src/lib/audiences.js
  dayKey: "friday" | "saturday" | "sunday" — groups "Mes réponses" into one section per day
  title: { FR, EN }            — bilingual label
  day:   { FR, EN }            — e.g. "Samedi soir" / "Saturday evening"
  timeStart: string            — "HH:MM"
  location: string
  order: number                — sort key (decimals ok; sorted client-side, no index)

access/{audience}               — invitation lists, admin-only (guests can never read)
  householdIds: string[]       — source of truth: invited households
  phones: string[]             — DERIVED from those households' managerPhones; used by rules.
                                 Resync after any managerPhones change
                                 (`node scripts/firestore.js friday sync`; import does it too)

fridayRsvps/{personId}          — answers to audience:"friday" events, readable by invitees only
lodgingRsvps/{personId}         — same for audience:"lodging" ("Logé au Domaine"; also mirrored as
fridayLodgingRsvps/{personId}     households.lodgedOnSite for "Mon profil") and "fridayLodging".
                                  Lists set at guest import or `node scripts/firestore.js friday|lodging …`
                                  (both rebuild access/fridayLodging = friday ∩ lodging)
  householdId: string
  attendance: { [eventId]: true | false | null }

settings/sections               — admin switches (public read): { menu: bool, rooms: bool, info: { [sectionId]: bool } }
                                  rooms OFF = guests don't see their room (profile + map highlight); UI-level only
                                  Off = guests see the entry greyed "Bientôt disponible"; admins still open it.
                                  Menu defaults to OFF (opens ~2 months before the wedding). UI: /admin/settings

photos/{photoId}                — storagePath + guestId + eventId + status (pending/approved/rejected)
notes/{noteId}                  — guestbook entries; guestId + content + createdAt
```

Meal preferences and RSVP attendance live directly on each `persons` doc (see above) —
there are no separate `meals`/`rsvps` collections. Exception: answers to Friday-only
events go to `fridayRsvps`, because `persons` is readable by every signed-in guest and
must never reveal who is invited on Friday.

**Security rules:** publish with `node scripts/deploy-rules.js` (`--diff` to compare with live).

**Invitation-only content rule:** anything for a restricted audience must be unreadable
by others at the security-rules level, not just hidden in the UI.

**Guest list workflow (Google Sheets):** `node scripts/guests-template.js` builds
`~/Downloads/invites-mariage.xlsx` from Firestore (+ docs/seed-example.json) with tabs
Invités / Foyers / Chambres. The admin edits it in Google Sheets, downloads it as .xlsx and
uploads it on `/admin/seed`. The format, parsing and validation live in ONE place:
`src/lib/guestSheet.mjs` (used by both the script and the page) — change columns there only.
Import goes through `src/lib/seedAccommodation.js` (idempotent; never overwrites
`mealPreferences`/`attendance`; "Invité vendredi" / "Logé au Domaine" replace
`access/friday` / `access/lodging` and rebuild `access/fridayLodging`;
an adult with no Foyer gets an auto household `hh-<personId>`). Import never deletes anyone.
