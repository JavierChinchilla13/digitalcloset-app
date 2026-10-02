# VYSVI - Project Structure

A guide to how this repository is organised: what every directory and module is
for, how the pieces talk to each other, and where to look when you want to change
something. Read it top to bottom once; after that use it as a map.

> **Two other documents matter.** `PROJECT_BLUEPRINT.md` is the history: every task,
> why it was done, and what was verified (look up a "Task NN" mentioned in a code
> comment there). `DEPLOYMENT.md` is how to put the app on a server. This file is
> the *current shape* of the code.

## 1. What the app is

VYSVI is a digital wardrobe. A signed-in user uploads photos of garments (the
background is removed and the garment is fitted onto a standard 2D mannequin, the
**persona**), browses their closet, builds **outfits** by picking garments, sees
them layered on the persona, saves them, and groups things into **categories**
(called *collections* in the code).

```
 Browser (React + TypeScript, Vite)
   │  /api/**  (JSON over HTTP, Bearer JWT)                 images, direct upload
   ▼                                                  ┌──────────────────────────▶ Cloudinary
 Spring Boot API (Java 21)  ──JDBC──▶ PostgreSQL      │
   │                                                  │
   └─ email (SMTP)                  background removal runs IN THE BROWSER
                                    (backend-ai/ is an optional Python service)
```

Tech: React 19, TypeScript, Vite, Tailwind, Zustand (state), Fabric.js (the garment
editors), Framer Motion; Spring Boot 3.3, Spring Security + JWT, JPA, Flyway;
PostgreSQL; FastAPI + rembg (optional). Tests: Vitest (frontend), JUnit + MockMvc
(backend), pytest (Python). CI: GitHub Actions.

## 2. Repository layout

```
Digital-Closet/
├── frontend/            React app (Vite)                      → section 3
├── backend/             Spring Boot API                       → section 4
├── backend-ai/          Optional Python background-removal service → section 5
├── docker-compose.yml   The whole stack on one machine (db + api + web)
├── render.yaml          Render.com blueprint (api + static site)
├── .env.production.example   Settings template for docker-compose
├── scripts/backup-db.sh Database backup helper
├── .github/workflows/ci.yml  Tests + production-image smoke test on every push
├── DEPLOYMENT.md        How to deploy (Docker on one machine, or Render + Neon)
├── PROJECT_BLUEPRINT.md The roadmap / task history / decisions
├── PROJECT_STRUCTURE.md This file
├── CLAUDE.md            Working rules for the AI coding assistant
└── README.md            Short intro
```

Older notes that may be out of date (kept for history, not maintained):
`frontend/README.md`, `frontend/FRONTEND_CHANGES.md`, `backend/HELP.md`,
`backend/IMPLEMENTATION_SUMMARY.md`. The root `README.md`'s feature list predates
several features (it still mentions local-only outfit storage; outfits now live in
the database).

## 3. Frontend (`frontend/`)

### 3.1 Top level

| Path | Purpose |
|---|---|
| `index.html` | Single page shell. Contains a tiny script that applies the saved/device theme **before** first paint so the page never flashes the wrong theme. |
| `vite.config.ts` | Dev server (port 5173) proxying `/api` to the backend on 8080; Vitest settings (jsdom). |
| `package.json` | Scripts: `dev`, `build` (`tsc -b && vite build`), `test`, `lint`. |
| `tsconfig*.json`, `eslint.config.js`, `postcss.config.js` | Tooling. |
| `Dockerfile`, `Caddyfile`, `.dockerignore` | Production image: builds the site, serves it with Caddy (automatic HTTPS, `/api` proxy, SPA fallback). |
| `.env.example` | Environment variables (all `VITE_*`, i.e. **public**, baked in at build time): Cloudinary cloud name + unsigned preset, background-remover mode/URL, optional `VITE_API_URL`. |
| `public/` | Static files served as-is: `personas/` (the two mannequin PNGs), `marketing/` (landing-page GIFs and the demo's sample garments), logos/favicons. |
| `dist/` | Build output (git-ignored). |

### 3.2 `src/` entry points

| File | Purpose |
|---|---|
| `main.tsx` | Mounts React inside a top-level `ErrorBoundary`; applies the theme and follows the device's light/dark setting until the user picks one. |
| `App.tsx` | The router (all routes below) and `ProtectedRoute`; decides what `/` shows (the outfit builder when signed in, the landing page otherwise). |
| `index.css` | Tailwind layers and the **theme tokens** (CSS variables for light and dark, e.g. `--ink`, `--accent`). Components use these tokens, never hard-coded colours. |
| `layouts/MainLayout.tsx` | The frame around every page: navbar + page outlet, inside its own `ErrorBoundary` so one crashing page leaves the navbar usable. |

### 3.3 Routes (`App.tsx`)

| URL | Page | Who |
|---|---|---|
| `/` | `FlatOutfitBuilderPage` (signed in) or `LandingPage` | everyone |
| `/login`, `/signup`, `/forgot-password`, `/reset-password` | auth pages | public |
| `/demo` | `DemoPage` - a working builder on a sample closet, nothing saved | public |
| `/closet` | `ClosetPage` - browse/add/edit/delete garments | signed in |
| `/outfits` | `SavedOutfitsPage` - all saved outfits | signed in |
| `/outfits/flat/new`, `/outfits/flat/edit/:id` | `FlatOutfitBuilderPage` - the main builder | signed in |
| `/showcase` | `OutfitShowcasePage` - flip through outfits (reached from the navbar logo) | signed in |
| `/categories`, `/categories/:id` | `CategoriesPage`, `CategoryDetailPage` | signed in |
| `/settings` | `SettingsPage` - name, email, password, account status | signed in |
| `/persona` | `PersonaPage` - rename the personas | signed in |
| `/admin` | `AdminUsersPage` | admin only (`ProtectedRoute requireAdmin`) |
| `/outfits/new`, `/outfits/edit/:id`, `/dashboard` | older pages (see 3.10) | signed in |
| `*` | `NotFoundPage` | everyone |

`ProtectedRoute` (in `App.tsx`) sends signed-out visitors to `/login` and non-admins
away from `/admin`; the backend enforces the same rules independently.

### 3.4 Pages (`src/pages/`)

| Page | What it does |
|---|---|
| `LandingPage` | Marketing page with the real in-app GIFs (`public/marketing`). |
| `DemoPage` | The "try it" builder for signed-out visitors, on an in-memory sample closet. Anything that would need an account (save, add/edit/delete a garment, view on persona) opens `DemoSignupModal` instead. |
| `LoginPage`, `SignupPage`, `ForgotPasswordPage`, `ResetPasswordPage` | Account entry. Forgot-password answers identically whether or not the email exists. |
| `FlatOutfitBuilderPage` | **The main screen.** Left: browse/search/filter the closet. Right: your selection, optionally previewed on the persona with a Layers panel; save or update the outfit; "Create random outfit". Edit mode is the same page on `/outfits/flat/edit/:id`. |
| `ClosetPage` | Closet grid with persona/category filters, add (opens `UploadFlow`), edit, delete, favourites. |
| `SavedOutfitsPage` | Grid of `OutfitCard`s: wear, edit, duplicate, delete, set as main. |
| `OutfitShowcasePage` | Carousel of saved outfits (the main one first), pieces or persona view, "set as main outfit". |
| `CategoriesPage`, `CategoryDetailPage` | Create/rename/delete categories; see and edit what is in one. |
| `SettingsPage` | Account settings; email/password changes are confirmed with a 6-digit code mailed to the current address. |
| `PersonaPage` | Custom display names for the Male/Female personas. |
| `AdminUsersPage` | List users, deactivate/reactivate, create accounts (the only way to create an admin). |
| `NotFoundPage` | Catch-all. |

### 3.5 Components (`src/components/`)

**Closet and outfits**

| File | Purpose |
|---|---|
| `ClothingCard`, `OutfitCard` | The closet tile and the saved-outfit tile. |
| `CroppedThumbnail` | **Every garment thumbnail goes through this.** Draws the garment's picture fitted whole inside its card (using `hooks/useVisibleBounds` and `utils/cropDisplay`) so all garments fill their card alike. |
| `OutfitSelectionCards` | The selection-panel cards (`SelectionCard`, `ShoeSubRow`), shared by the builder and the demo. |
| `ClothingDetailsModal`, `DeleteConfirmationModal`, `EditClothingModal` | View, confirm-delete and edit a garment (the edit modal hosts the Fabric editors). |
| `CategoryPicker`, `ClothingCategoryFilter`, `PersonaTypeSwitcher` | Small pickers/filters used by the builder and upload flow. |
| `PersonaBadge` | The "M persona / F persona / Not fitted" sign every garment card carries. |

**The persona and layering**

| File | Purpose |
|---|---|
| `PersonaRenderer` | Draws the mannequin and the garments stacked on it (z-order by layer slot, click to pick a layer). |
| `PersonaLayer` | One garment layer (a modular jacket is several pictures in one group); applies the clipping masks. |
| `LayerPanel` | The "Layers" list: reorder pieces by drag and drop or arrows. |
| `PersonaSelector`, `PersonaSpotlight` | Older persona widgets; `PersonaSelector` is no longer used anywhere (see 3.10). |

**Upload and editing** (`FittingTool/`, `editor/`)

| File | Purpose |
|---|---|
| `FittingTool/UploadFlow` | The add-a-garment wizard: pick a photo → compress → remove the background (in the browser) → clean up → fit on the persona → save. Branches for shoes (left/right pair) and jackets (segmented into torso/sleeves/collar). |
| `FittingTool/FittingEditor`, `JacketFittingEditor`, `ShoeFittingEditor` | The fitting screens for ordinary garments, jackets and shoes. |
| `FittingTool/GarmentCleanup` | "Clean up" studio: erase/restore brush and trim the picture to the garment. |
| `FittingTool/JacketSegmentationTool`, `ShoeSymmetryCheck` | Jacket part segmentation; check that a left/right shoe pair is a mirror image. |
| `FittingTool/ShoeCanvas`, `Presets.ts` | The shoe canvas; the default per-category starting position/size on the persona. |
| `editor/ClothingCanvas`, `JacketCanvas` | The Fabric.js canvases (move/scale/rotate a garment; a jacket's parts move together or separately). |
| `editor/CanvasToolbar`, `TransformPanel`, `WarpPanel` | Toolbars and numeric controls; `WarpPanel` is the mesh warp tool (3×3 control points). |
| `editor/CanvasUtils.ts`, `FabricControls.ts` | The virtual coordinate system (750×1000, 3:4) and the look of Fabric's selection handles. |

**App chrome and shared UI:** `Navbar`, `UserMenu`, `BrandMark`, `ThemeToggle`,
`Toast` (`ToastProvider`/`useToast`), `ErrorBoundary`, `ErrorState`, `PasswordInput`,
`SectionWrapper`, `FeatureCard` (landing page card with a hover clip),
`DemoSignupModal`, `CreateUserModal` (admin).

### 3.6 State (`src/store/`, Zustand)

| Store | Holds | Persisted in the browser as |
|---|---|---|
| `useAuthStore` | JWT + the signed-in user | `auth-storage` |
| `useClothingStore` | The closet (items), favourites; fetch/add/update/delete via the API | `clothing-closet-storage` |
| `useOutfitStore` | Saved outfits and the main outfit id; CRUD + duplicate via the API | no |
| `useCollectionStore` | Categories and their items/outfits | no |
| `useOutfitDraftStore` | The outfit being built: ordered `selectedItemIds` + optional `layerOrder`. Also converts a draft to/from the API's outfit shape (`outfitItemsFromDraft`, `draftFromOutfitItems`). | no (in memory) |
| `usePersonaStore` | Which persona type is active (and the older per-category equip state) | `persona-storage` |
| `usePersonaSettingsStore` | Persona display names (synced with the backend) | no |
| `useThemeStore` | `light` / `dark` | `vysvi-theme` |
| `useDemoStore` | The demo's sample closet - in memory only, never sent anywhere | no |
| `useLocalOutfitStore` | Legacy browser-only outfit store, **unused** | `saved-outfits-storage` |

### 3.7 API layer (`src/api/`)

`axios.ts` is the one configured client: base URL `/api` (or `VITE_API_URL`), adds
the `Authorization: Bearer` header from the auth store, and on a 401/403 logs out
and goes to `/login`. One service file per backend area, each a thin wrapper:
`authService`, `userService`, `adminService`, `clothingService`, `outfitService`,
`collectionService`, `personaDisplayNameService`. `cloudinaryService` uploads an
image **directly from the browser** to Cloudinary (unsigned preset) and returns its
URL; the backend only ever stores that URL.

### 3.8 Logic helpers

**`src/utils/`** - pure functions, mostly unit-tested:

| File | Purpose |
|---|---|
| `personaEligibility` | Which selected items can be shown on a persona (fitted + matching persona type) and why the rest can't; builds the persona preview. |
| `layerOrder`, `shoeSelection` | The stacking order of pieces (default by category, user overrides); one shoe per foot rule. |
| `occlusion`, `layerGeometry`, `alphaBounds` | Realistic layering: shared placement geometry, the visible-pixel bounds of a picture, and the clipping rules (a shirt can't poke out of the jacket over it). |
| `cropDisplay`, `meshWarp`, `warpData` | Show a cropped / visible region of a picture; the mesh-warp maths; where warp data is stored (`modularData`). |
| `randomOutfit` | Picks the random outfit. |
| `personaSign`, `selectionDisplay` | Wording of the persona badge; fixed display order of the selection panel. |
| `segmentationService` | Jacket part segmentation with Transformers.js, in the browser. |
| `themeColors`, `cn` | Theme colours for the Fabric canvases; a class-name joiner. |

**`src/hooks/`:** `useFabricCanvas` (shared Fabric lifecycle + resize), `useOcclusionMasks`
(computes the clipping masks for the persona), `useVisibleBounds` (measures where a
picture is visible, cached per URL), `useSafeAction` (runs a store action and shows
a toast if it fails).

**`src/lib/background-removers/`:** one interface, two implementations - `browser`
(runs in the visitor's browser with a WASM model), `api` (calls `backend-ai`) - and
`index.ts` choosing between them (`VITE_BG_REMOVER_MODE`: `browser`, `api` or
`hybrid` = browser first, API as fallback).

### 3.9 Types and styling

`types/index.ts` is the one place for the shared types (`ClothingItem`,
`ClothingTransform`, `Outfit`, `OutfitRequest`, `PersonaType`, `ClothingCategory`,
`PersonaStatus`, ...), mirroring the backend's DTOs. `types/fabric.d.ts` patches
Fabric's typings. Styling is Tailwind plus the theme tokens in `index.css`.

### 3.10 Tests and legacy code

- `src/__tests__/` - Vitest + Testing Library suites (about 30 files, 270+ tests):
  stores, pure utils, and whole pages with the API modules mocked.
  `src/test/setup.ts` and `fixtures.ts` are the shared setup and `makeItem()` builder.
- **Legacy / orphaned (still in the repo, not part of the main flow):** `DashboardPage`
  and `sections/*` (an old dashboard no menu links to), `OutfitBuilderPage` (the old
  persona-first builder, still routable at `/outfits/new`), `PersonaSelector`,
  `useLocalOutfitStore`. Safe to delete after a check; they were kept to avoid
  unrelated changes.

## 4. Backend (`backend/`)

Spring Boot 3.3, Java 21, base package `com.javier.closetapp`. Feature-based
packages; each feature has `controller/` (HTTP only), `service/` (rules and ownership
checks), `entity/` + `repository/` (JPA), `dto/` (request/response shapes).

### 4.1 Packages

| Package | Purpose |
|---|---|
| `auth` | Register, login, forgot/reset password. `mail/` has the mailer interfaces (`PasswordResetMailer`, `VerificationCodeMailer`) with a **log** implementation (dev: prints the link/code to the console) and an **SMTP** implementation (production), chosen by `app.mail.mode`. HTML email templates are in `resources/mail/`. |
| `user` | The signed-in user's account (`/api/users/me`: profile, main outfit, code-confirmed email/password change, deactivate) and admin user management. `PendingAccountChange` stages a change until the emailed code is confirmed (only the code's hash is stored; wrong attempts are counted). |
| `clothing` | Garments: CRUD, soft delete (`active=false`). A garment carries its Cloudinary image URL, category, persona type, persona status, its transform on the persona, shoe side, and modular/warp data. |
| `outfit` | Outfits and their items (`slot`, `itemOrder`, optional `layerOrder`). Validates e.g. one shoe per foot. |
| `collection` | Categories: a user's named groups of garments and outfits (many-to-many join entities). |
| `persona` | Per-user display names for the personas. |
| `security` | `SecurityConfig` (the filter chain, CORS), `JwtService` / `JwtAuthenticationFilter` (stateless login), `RateLimitFilter` (limits `/api/auth/**` per visitor address). |
| `exception` | Domain exceptions and `GlobalExceptionHandler`, which maps each to the right HTTP status with a safe message (never raw internals). |
| `config` | `ApplicationConfig`: user lookup and password encoder (BCrypt). |
| `common/enums` | `ClothingCategory`, `AvatarType` (persona type), `PersonaStatus`, `Role`, `AccountChangeType`. |

### 4.2 HTTP API

All under `/api`; everything except `/api/auth/**` needs `Authorization: Bearer <jwt>`,
and the data endpoints only ever touch the caller's own rows.

| Prefix | Endpoints |
|---|---|
| `/auth` | `POST register`, `login`, `forgot-password`, `reset-password` (public, rate-limited) |
| `/clothing` | `GET`, `POST`, `PUT /{id}`, `DELETE /{id}` |
| `/outfits` | `GET`, `POST`, `PUT /{id}`, `DELETE /{id}` |
| `/collections` | `GET`, `POST`, `PUT /{id}`, `DELETE /{id}`; `POST`/`DELETE /{id}/items/{itemId}`, `/{id}/outfits/{outfitId}` |
| `/persona-display-names` | `GET`; `PUT`/`DELETE /{personaType}` |
| `/users/me` | `GET`, `PUT`; `PUT`/`DELETE main-outfit`; `POST password/request`, `password/confirm`, `email/request`, `email/confirm`; `PATCH deactivate` |
| `/users` | admin only: `GET`, `POST`, `PATCH /{id}/deactivate`, `PATCH /{id}/reactivate` |
| `/actuator/health` | public health check (nothing else of actuator is exposed) |

### 4.3 Security chain

Request → CORS → `RateLimitFilter` (only `/api/auth/**`) → `JwtAuthenticationFilter`
(valid token → authenticated user; a bad token simply doesn't authenticate) →
authorization rules (`/api/auth/**` and the health check are public, the rest needs
login; `@PreAuthorize("hasRole('ADMIN')")` on admin endpoints). Sessions are
stateless; CSRF is off because auth is a header, not a cookie. Registering always
creates a normal user - an admin is made by another admin (or, the first one, with a
SQL update; see `DEPLOYMENT.md`).

### 4.4 Database

PostgreSQL, schema owned by **Flyway** (`src/main/resources/db/migration/V1..V8`);
Hibernate only validates the entities against it (`ddl-auto=validate`).

Tables: `users`, `clothing_items`, `outfits`, `outfit_items`, `collections`,
`collection_items`, `collection_outfits`, `persona_display_names`,
`password_reset_tokens`, `pending_account_changes`.

Migrations: V1 baseline · V2 persona status · V3 collections · V4 persona display
names · V5 password reset tokens · V6 main outfit · V7 pending account changes ·
V8 outfit layer order. To change the schema add a **new** `V9__...sql`; never edit
an applied one.

### 4.5 Configuration (`src/main/resources/`)

| File | Purpose |
|---|---|
| `application.properties` | Defaults and the names of all settings; secrets come from environment variables (`DB_PASSWORD`, `JWT_SECRET`, SMTP...). Activates the `local` profile by default. |
| `application-local.properties` | **Git-ignored** dev secrets (DB password, JWT secret, optional SMTP); copy from `application-local.properties.example`. |
| `application-prod.properties` | Production profile: quiet logs, real email only, forwarded-address trust, small DB pool. Selected by `SPRING_PROFILES_ACTIVE=prod` (the Docker image sets it). |
| `Dockerfile`, `.dockerignore` | Production image (builds the jar, runs it as a non-root user). |

### 4.6 Tests (`src/test/`)

About 100 tests on an in-memory H2 database (profile `test`,
`application-test.properties`): `integration/` drives the whole app over HTTP with
MockMvc (wardrobe flow, settings, main outfit, layer order), `security/` covers
authentication, ownership (nobody can read or change another user's data), JWT,
health, client-error responses and the rate limit, and `ProductionProfileTest` pins
the production settings. Not covered by tests: the Flyway scripts themselves (H2
cannot run them) - CI's Docker job runs them against real PostgreSQL.

## 5. `backend-ai/` (optional)

A small FastAPI service: `server/main.py` exposes `POST /remove-bg` (an image in, a
transparent PNG out, using `rembg`) and `GET /health`, with size/format checks.
It is **not deployed** by default because the browser does the same job; run it
locally (`python server/main.py`, port 8000) and set `VITE_BG_REMOVER_MODE=api` or
`hybrid` to use it. Tests in `tests/` (the real-model test skips itself when the
model file is absent).

## 6. How the main things work

**Adding a garment.** `UploadFlow` → image compressed → background removed in the
browser (`lib/background-removers`) → optional cleanup/trim → fitted on the persona
in a Fabric editor (the result is a transform: position, scale, rotation) →
uploaded to Cloudinary (`cloudinaryService`) → saved with `POST /api/clothing`
(the URL + metadata). A garment that can't be fitted is still saved, with
`personaStatus` `NOT_FITTED` (shown in the closet but not on the persona).

**Building an outfit.** `FlatOutfitBuilderPage` keeps the selection in
`useOutfitDraftStore`. The persona preview is built by `computePersonaEligibility`
(drops pieces that aren't fitted or are for the other persona) and drawn by
`PersonaRenderer`, ordered by `layerOrder` utils (default by category, or the user's
Layers-panel order). Saving sends `OutfitRequest` (`outfitItemsFromDraft`) to
`/api/outfits`; the backend stores each piece's slot and `layerOrder`.

**Main outfit.** Stored on the user (`users.main_outfit_id`); Attire (`/`) opens it
for editing and Showcase opens on it.

**Persona status and eligibility.** `PersonaStatus`: `FITTED` (shown on the persona),
`NOT_FITTED`, `INELIGIBLE_NO_CUTOUT`. A garment also has a persona type (male/female);
only garments of the active persona's type are shown on it.

**Authentication.** Login/register return a JWT (24 h). The frontend keeps it in
`auth-storage` and sends it on every call. Password reset and email/password changes
use single-use, expiring tokens/codes whose **hashes** are stored.

**Theme.** `index.html` applies the theme before paint; `useThemeStore` flips
`data-theme` on `<html>`; the CSS variables in `index.css` do the rest.

## 7. Conventions

- **Comments.** Files and functions carry a short comment saying *why* (the
  reason, the trade-off, the task that introduced it). "Task NN" refers to
  `PROJECT_BLUEPRINT.md`.
  Every source file has a purpose comment; legacy modules say so (LEGACY / UNUSED).
- **Don't duplicate; reuse.** Look for an existing component/util first (the
  persona rendering, thumbnails, eligibility and layer rules each have one home).
- **Small tested changes.** Every change is checked with `npx tsc -b --force`,
  `npm test`, `npx vite build` (frontend) and `./mvnw test` (backend) - CI runs
  them all, plus a Docker smoke test.
- **Secrets** never go in git or in a `VITE_` variable; backend secrets are
  environment variables.
- **Schema changes** are new Flyway migrations.

## 8. Running things

```bash
# backend  (needs PostgreSQL + application-local.properties, see its .example)
cd backend && ./mvnw spring-boot:run          # http://localhost:8080
./mvnw test

# frontend
cd frontend && npm install && npm run dev     # http://localhost:5173 (proxies /api)
npx tsc -b --force && npm test && npx vite build

# whole stack in Docker (see DEPLOYMENT.md)
cp .env.production.example .env && docker compose up -d --build
```
