# Evento Frontend Implementation Plan

> [!IMPORTANT]
> **Responsive design:** ALL pages and components must be fully responsive. Use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`). Key breakpoints: mobile-first, tablet ≥768px, desktop ≥1280px.

**Goal:** Build the complete frontend UI for the Evento app across 4 pages and 2 modals, using mock data first, with iterative per-page feedback cycles.

**Architecture:** Single-page React + Vite app using React Router v7 for routing, TanStack Query for async state, Shadcn UI components, TailwindCSS v4 (already configured). Firebase SDK handles all auth (no backend auth endpoints). All pages implemented with mock data first; API wiring deferred to Phase 7.

**Tech Stack:** React 19, Vite 7, React Router 7, TanStack Query v5, Shadcn UI, TailwindCSS v4, Firebase SDK, lucide-react icons, Geist Variable font.

---

## Key Design Decisions

> [!IMPORTANT]
> **Blue theme (not purple):** All accent colors use blue shades (`hsl(220, 90%, 56%)` family). Any purple from mockups is replaced with blue.
>
> **Less dark backgrounds:** Main background `oklch(0.16 0.01 240)` (slightly lighter than default `0.145`), cards at `oklch(0.20 0.02 240)`.
>
> **Mockup annotation exclusions (red annotations):**
> - Sign In: No "Privacy Policy / ToS / Support" footer links
> - Sign Up: No "Joined by 2,000+ creators" social proof banner; no ToS footer text; field label is "Email" (not "Work Email")
> - Events List (list view): Nav shows only "Events" + "Settings" (Dashboard/Templates/Analytics crossed out)
> - Event Space: Left sidebar has "Quick Links" → "All Events" link + max 3 recent events (no WORKSPACE/Assets); "Recent Events" → see below; no "DRAFT" tag in topbar
> - Media Viewer: Heart/favorite icon added per annotation

---

## Proposed Changes

### Phase 0 — Foundation

#### [MODIFY] [package.json](file:///Volumes/Jaaga1/repos/evento/apps/web/package.json)
Add `firebase` SDK. Run: `pnpm add firebase` in `apps/web`.

#### [MODIFY] [.env.example](file:///Volumes/Jaaga1/repos/evento/apps/web/.env.example)
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_API_URL=http://localhost:8000
```
All values found in Firebase Console → Project Settings → Web app config.

#### [MODIFY] [index.css](file:///Volumes/Jaaga1/repos/evento/apps/web/src/index.css)
Override CSS variables for blue-themed dark mode: `--primary` (blue oklch), `--background` (slightly lighter dark), `--card`, `--accent`.

#### [NEW] [src/lib/firebase.ts](file:///Volumes/Jaaga1/repos/evento/apps/web/src/lib/firebase.ts)
Initialize Firebase app from `VITE_FIREBASE_*` env vars. Export `auth` instance.

#### [NEW] [src/contexts/AuthContext.tsx](file:///Volumes/Jaaga1/repos/evento/apps/web/src/contexts/AuthContext.tsx)
`AuthProvider` using `onAuthStateChanged`. Exports `useAuth()` → `{ user, loading, signOut }`.

#### [NEW] [src/components/ProtectedRoute.tsx](file:///Volumes/Jaaga1/repos/evento/apps/web/src/components/ProtectedRoute.tsx)
- If unauthenticated: redirect to `/signin?next=<attempted-path>` (preserves the URL)
- After sign-in succeeds: read `?next=` param and redirect there; default to `/events`
- Show loading spinner during auth state check

#### [MODIFY] [App.tsx](file:///Volumes/Jaaga1/repos/evento/apps/web/src/App.tsx)
- `BrowserRouter` + `Routes`
- Public: `/signin`, `/signup`
- Protected (via `ProtectedRoute`): `/events`, `/events/:id`
- Default redirect: `/` → `/events`
- Wrapped in `AuthProvider` + `QueryClientProvider`

#### Logo & Favicon assets
- Copy generated `evento_logo_icon_*.png` → `apps/web/public/favicon.png` (used as favicon)
- Copy generated `evento_logo_full_*.png` → `apps/web/src/assets/logo.png` (used in navbar, sign-in, sign-up)
- Update `index.html` favicon link to point to `/favicon.png`
- Inline SVG version of the E icon mark will be created as `src/components/brand/Logo.tsx` for crisp rendering at all sizes

#### Shadcn components to add
`pnpm dlx shadcn@latest add input label dialog select dropdown-menu` in `apps/web`.

---

### Phase 1 — Sign In Page

#### [NEW] [src/pages/SignInPage.tsx](file:///Volumes/Jaaga1/repos/evento/apps/web/src/pages/SignInPage.tsx)
Two-column layout (50/50, full-height):

**Left panel** (brand):
- App logo using `<Logo />` component (E icon mark + "Evento" wordmark from generated asset)
- Headline: "Generate rich, mixed-media event content with AI"
- Subtitle
- Three feature tiles with appropriate lucide icons: TEXT (FileText), AUDIO (Mic), VIDEO (Play)

**Right panel** (form):
- "Welcome back" heading + subtitle
- Google OAuth button
- "OR CONTINUE WITH" divider
- Email Address input, Password input (with visibility toggle)
- "Keep me logged in" checkbox
- "Sign in to Account" CTA (blue, full width)
- "Don't have an account? Create an account" → `/signup`
- **No** footer links

**Auth behavior:**
- Google → `signInWithPopup`; Email → `signInWithEmailAndPassword`
- On success → navigate to `?next=` param value or `/events`

---

### Phase 2 — Sign Up Page

#### [NEW] [src/pages/SignUpPage.tsx](file:///Volumes/Jaaga1/repos/evento/apps/web/src/pages/SignUpPage.tsx)

**Left panel**: Icon badges, headline, description. **No** social proof banner.

**Right panel**:
- `<Logo />` (E icon + "Evento" text, smaller size)
- "Create your account" heading
- Google sign-up button + "OR EMAIL" divider
- Full Name, Email (label: "Email" only), Password (with toggle)
- "Create account" CTA (blue)
- "Already have an account? Log in" → `/signin`
- **No** ToS footer

**Auth behavior:** Google → `signInWithPopup`; Form → `createUserWithEmailAndPassword` + `updateProfile`. On success → navigate to `/events`.

---

### Phase 3 — Events List Page

#### [NEW] [src/components/layout/Navbar.tsx](file:///Volumes/Jaaga1/repos/evento/apps/web/src/components/layout/Navbar.tsx)
- Left: Logo + "Evento" wordmark
- Center: Search input (placeholder: "Search events...")
- Right: Settings icon, user avatar with **dropdown menu on click** → shows user name/email + "Sign Out" option

#### [NEW] [src/components/EventCard.tsx](file:///Volumes/Jaaga1/repos/evento/apps/web/src/components/EventCard.tsx)
- Cover image + white heart icon (top-right, absolute)
- Event name, date + time
- **No** status badge, **No** collaborator avatars/count/tag row

#### [NEW] [src/components/EventListRow.tsx](file:///Volumes/Jaaga1/repos/evento/apps/web/src/components/EventListRow.tsx)
- Columns: **EVENT NAME** (name + subtitle), **DATE CREATED**, **ACTIONS**
- Actions: single "favorite/unfavorite" toggle icon button
- **No** event icon/emoji tile, no Last AI Activity, no Status badge, no ellipsis menu

#### [NEW] [src/pages/EventsListPage.tsx](file:///Volumes/Jaaga1/repos/evento/apps/web/src/pages/EventsListPage.tsx)
- `<Navbar />`
- "My Events" heading + subtitle
- Card/List toggle + "＋ Create New Event" button
- **Card view:** Grid with `EventCard` + a "＋ New Event" placeholder card
- **List view:** Table with `EventListRow` rows
- **No** footer
- Mock data: 7 events hardcoded

---

### Phase 4 — Create New Event Modal

#### [NEW] [src/components/modals/CreateEventModal.tsx](file:///Volumes/Jaaga1/repos/evento/apps/web/src/components/modals/CreateEventModal.tsx)
Shadcn `Dialog`:
- Header: Party icon + "Start a New Event" + ✕ close
- EVENT NAME input
- Row: EVENT DATE (date **and time** picker — native `datetime-local` input styled with calendar icon) + EVENT TYPE (Select: Conference, Workshop, Concert, etc.)
- **EVENT DESCRIPTION** textarea — no "AI Assisted" badge, no helper text below
- Footer: "Cancel" (ghost) + "Generate Event Space ⚡" (blue)

---

### Phase 5 — Event Space Page

#### [NEW] [src/pages/EventSpacePage.tsx](file:///Volumes/Jaaga1/repos/evento/apps/web/src/pages/EventSpacePage.tsx)
Three-panel layout:

**Top Navbar**: Logo left | Event name center | Bell + Settings + user avatar (with dropdown) right

**Fixed content filter bar** (below navbar): Icon buttons with tooltips — ALL | Favorites (Heart) | Email (Mail) | Images (Image) | Videos (Video)

**Left sidebar** — collapsible:
- Default: ~240px wide with full content
- Collapsed: thin rail (~48px) showing only expand button
- Content when open:
  - **"Quick Links"** section header → **"All Events"** clickable link (navigates to `/events`)
  - **"Recent Events"** section → max **3** most recent event links (clickable, current highlighted blue)
- **"＋ New Event"** button at bottom

**Main content** (scrollable):
- Content sections (Email Newsletter Draft, Event Poster Designs, etc.)
- **Action buttons (copy, heart, download) appear on hover only** — hidden by default, visible on card/section hover

**Right AI Assistant panel** — collapsible:
- Default: ~320px wide
- Collapsed: thin rail (~48px) with expand button
- Content when open:
  - "● AI Assistant" header + collapse icon
  - Message thread: AI bubbles (left) + user bubbles (right)
  - **Media thumbnails interleaved** in both AI and user messages
  - Input bar: "＋" attachment (PDF, text, image files only) + "Type a request..." input

---

### Phase 6 — Media Viewer Modal

#### [NEW] [src/components/modals/MediaViewerModal.tsx](file:///Volumes/Jaaga1/repos/evento/apps/web/src/components/modals/MediaViewerModal.tsx)
- **Triggered by:** clicking any media item in the Event Space main content area
- Full-screen overlay (dark bg)
- Top bar: title + subtitle (Variant • WxH px) on left | heart icon + download + ✕ on right
- Center: large media preview (`object-contain`)
- Left / Right navigation arrows
- Bottom filmstrip: horizontal thumbnail strip, active item with blue border

---

### Phase 7 — API Wiring (deferred)

Replace mock data with real API calls after all UI phases are approved:
- TanStack Query for `GET /events`, `GET /events/:id`
- WebSocket stream for Event Space AI chat
- Firebase ID token in `Authorization: Bearer <token>` header

---

## Verification Plan

Run dev server after each phase: `cd apps/web && pnpm dev` → `http://localhost:5173`

| Phase | Check |
|-------|-------|
| Sign In | Google + email auth work; `/events` redirects unauthenticated to `/signin?next=/events`; after sign-in redirects to `/events` |
| Sign Up | Creates Firebase user; navigates to `/events` |
| Events List | Card/List toggle; Create Event modal opens; user avatar dropdown shows Sign Out |
| Event Space | Collapsible sidebars; hover actions; filter bar; AI chat with thumbnails; media click opens viewer modal |
| Media Viewer | Opens on media click; prev/next navigation; filmstrip |

TypeScript build check: `cd apps/web && pnpm build`
