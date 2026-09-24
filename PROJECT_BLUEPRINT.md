# 🧥 DIGITAL CLOSET

## Development Blueprint → Production-Ready MVP

> **Purpose:** Master roadmap for stabilizing, completing, testing, and deploying Digital Closet.
>
> **Strategy:** Fix what is broken → secure what exists → unify the outfit system → consolidate the clothing pipeline → polish UX → test → deploy.
>
> **Core principle:** **Do not rewrite the parts of the application that are already technically strong.**

---

# 🗺️ PROJECT AT A GLANCE

```text
                    DIGITAL CLOSET
                          │
                          ▼
              ┌───────────────────────┐
              │  PHASE 0              │
              │  🧹 STABILIZE         │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  PHASE 1              │
              │  🔐 SECURITY          │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  PHASE 2              │
              │  👕 OUTFITS           │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  PHASE 3              │
              │  🧩 CLOTHING SYSTEM   │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  PHASE 4              │
              │  ✨ UX / UI POLISH    │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  PHASE 5              │
              │  🧪 TESTING           │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  PHASE 6              │
              │  🚀 PRODUCTION        │
              └───────────────────────┘
```

### Current State

**Overall:** 🟡 Functional but unfinished

The existing application has strong foundations: JWT authentication, clothing CRUD, Fabric.js editors, persona rendering, and a browser-first background-removal architecture.

However, there is currently a **build-breaking issue**, security vulnerabilities, an unfinished outfit persistence architecture, dead code, and missing production hardening.

---

# 🟢 WHAT IS ALREADY STRONG

These systems should **not be rewritten**:

- JWT authentication end-to-end
- Clothing CRUD + DTO mapping
- Fabric.js editor architecture
- `ClothingCanvas`
- `JacketCanvas`
- `ShoeCanvas`
- `GarmentCleanup`
- `CanvasUtils`
- `FabricControls`
- Persona compositor
- `PersonaRenderer`
- `PersonaLayer`
- Browser-first background removal
- Python fallback for background removal
- Virtual `1000 × 750` coordinate system
- Feature-based Spring package structure
- Manual DTO mapping
- Direct browser → Cloudinary uploads

The original investigation specifically identifies these as technically strong foundations.

---

# 🔥 CURRENT PRIORITY

## PHASE 0 — 🧹 STABILIZATION

**Goal:** Return the repository to a clean, buildable state before adding anything new.

### Why first?

The current `HEAD` contains a build-breaking line in:

```text
frontend/src/pages/ClosetPage.tsx
```

A stray `db.query(...)` references undefined identifiers.

Nothing else should be built on top of the broken state.

### Tasks

- [x] **CF1** — Remove broken `db.query(...)`
- [x] TypeScript baseline & critical fixes (missing `toCanvasX` import, `erasableSyntaxOnly` config, `PersonaState` import, `onEdit`/`onDelete` dead props, `createdAt`/`uploadDate` mismatch)
- [x] **CF2** — Restore delete confirmation
- [x] **CF13** — Delete `HomePage.tsx`
- [x] Delete old `Canvas.tsx`
- [x] Delete unused `removeBackground()`
- [x] Remove unused frontend dependencies
- [x] Remove unused Cloudinary Maven dependency
- [x] Remove stray tutorial test
- [x] Run frontend build
- [x] Run backend compile

### Definition of Done

```text
npm run build                    ✅
mvnw -q compile                  ✅
mvnw spring-boot:run             ✅
Delete confirmation              ✅
No references to deleted code    ✅
```

### ✅ Phase 0 complete

All tasks above are done. Phase 1 is in progress — see below.

---

# 🔐 PHASE 1 — SECURITY & CORRECTNESS

**Goal:** Close vulnerabilities and establish reliable backend behavior.

**Priority:** 🔴 Critical

The current system has real issues including privilege escalation, an outfit ownership/IDOR vulnerability, plaintext secrets, unsafe error handling, missing validation, and missing production CORS configuration.

## Security Tasks

### Authentication

- [x] **CF3** — Prevent self-assignment of `ROLE_ADMIN`
- [x] Remove `role` from registration DTO
- [x] Always create new accounts as `ROLE_USER`

### Secrets

- [x] **CF4** — Move DB password to environment variables
- [x] Move JWT secret to environment variables
- [x] Add local development properties
- [x] Gitignore local secrets

### JWT

- [x] **CF5** — Replace incorrectly encoded JWT secret
- [x] Generate a proper random Base64 secret

### Ownership

- [x] **CF6** — Fix Outfit IDOR *(done ahead of CF4/CF5/CF7 — see Master Task List note)*
- [x] Verify clothing ownership before attaching items to outfits

### Clothing Lifecycle

- [x] **CF7** — Implement soft-delete
- [x] Filter inactive clothing from reads
- [x] Preserve clothing referenced by outfits

### API Errors

- [x] **CF8** — Add `ResourceNotFoundException`
- [x] Add `ForbiddenOperationException`
- [x] Map errors to 404 / 403
- [x] Stop leaking generic exception messages

### Validation

- [x] **CF9** — Add DTO validation
- [x] Add `@Valid`
- [x] Add `@NotBlank`
- [x] Add `@Email`
- [x] Add `@Size`

### CORS

- [x] **CF10** — Add explicit CORS configuration
- [x] Read allowed origins from environment

### Python AI

- [x] **CF11** — Restrict CORS
- [x] Validate image MIME type
- [x] Limit upload/read size
- [x] Replace `print()` with logging
- [x] Remove unused PIL import
- [x] Pin dependencies

### Database

- [x] **CF15** — Introduce Flyway
- [x] Convert existing SQL scripts into migrations
- [x] Set Hibernate `ddl-auto=validate`

### Cleanup

- [x] **CF12** — Remove or resolve dead `/api/ai/**` security rule

---

## 🏁 PHASE 1 DEFINITION OF DONE

```text
Registration cannot create admins              ✅
Secrets are not committed                      ✅
JWT secret is correctly encoded                ✅
Users cannot access another user's clothing    ✅
Users cannot attach another user's clothing    ✅
Clothing deletion is soft-delete               ✅
API returns proper 403/404                     ✅
Request validation works                       ✅
CORS works outside Vite proxy                  ✅
Python service is hardened                     ✅
Database schema is Flyway-managed              ✅
```

---

# 👕 PHASE 2 — OUTFIT SYSTEM UNIFICATION

**Goal:** Make backend persistence the source of truth for outfits.

### Current Problem

There are currently two competing concepts:

```text
Frontend
   │
   └── useLocalOutfitStore
             │
             └── localStorage


Backend
   │
   └── OutfitService
             │
             └── PostgreSQL
```

The backend outfit infrastructure is already mostly implemented, but the UI is still using the local store.

The payload shapes also differ: the frontend currently stores category/slot IDs while the backend supports per-item transforms.

### Decision

Use:

```text
Backend = Source of Truth
```

Simplify outfits to:

```text
{
  name,
  description,
  avatarType,
  items: [
    {
      itemId,
      slot,
      itemOrder
    }
  ]
}
```

Keep the existing transform columns in the database as nullable/unused future capability.

### Tasks

- [x] Simplify backend `OutfitRequest` *(already matched the target shape as of Task 11; `OutfitItemRequest`/`OutfitItemResponse` were the pieces that actually needed simplifying)*
- [x] Simplify `OutfitItemRequest` *(and `OutfitItemResponse`, for request/response consistency — Task 15)*
- [x] Update `outfitService.ts` *(removed a duplicate, stricter `OutfitRequest` interface — Task 15)*
- [x] Make `useOutfitStore.ts` the primary store *(Task 16)*
- [x] ~~Create localStorage → backend migration~~ *(**Task 17 removed** — investigation found no evidence of production users/data: no deployment config, no CI/CD, git remote is a personal dev repo, `main` had a build-breaking bug on `HEAD` until Task 1. Building migration infrastructure to protect data that was never at risk wasn't justified.)*
- [x] ~~Migrate existing `saved-outfits-storage`~~ *(same reasoning, removed with Task 17)*
- [x] Update `SavedOutfitsPage` *(Task 16)*
- [x] Update `OutfitBuilderPage` *(Task 16 — also updated `OutfitsSection`, `AvatarSection`, and `OutfitCard`, which weren't originally listed here but needed the same treatment)*
- [x] Decide whether local store remains as offline cache *(Decided: no — `useLocalOutfitStore.ts` is now fully unused; kept in place only until a separate deletion task confirms the new backend flow is stable)*
- [x] Remove localStorage as primary source *(Task 16 — confirmed via repo-wide search: nothing outside `useLocalOutfitStore.ts` itself references it anymore)*

### 🏁 Definition of Done

```text
Create outfit      → PostgreSQL ✅
Edit outfit        → PostgreSQL ✅
Delete outfit      → PostgreSQL ✅
Reload browser     → outfit survives ✅
New device         → outfit survives ✅
No primary UI reads from localStorage ✅
```

### Architecture After Phase 2

```text
             ┌───────────────┐
             │    React      │
             └───────┬───────┘
                     │
                     ▼
              useOutfitStore
                     │
                     ▼
               outfitService
                     │
                     ▼
                REST API
                     │
                     ▼
              OutfitService
                     │
                     ▼
                PostgreSQL
```

---

# 🧩 PHASE 3 — CLOTHING FITTING SYSTEM

**Goal:** Consolidate the editor architecture without rewriting the working Fabric.js implementation.

### Current Editors

```text
                 Fabric.js
                    │
       ┌────────────┼────────────┐
       │            │            │
       ▼            ▼            ▼
 ClothingCanvas JacketCanvas ShoeCanvas
       │            │            │
       └────────────┼────────────┘
                    │
              GarmentCleanup
```

The architecture works. The main issue is duplicated canvas lifecycle code.

### Tasks

- [x] Extract `useFabricCanvas`
- [x] Apply it to all editors
- [x] Add `openness` to `ClothingTransform`
- [x] Remove `as any`
- [x] Type `PersonaRenderer.layers`
- [x] Remove unused persona biometric state
- [x] Re-enable accessories

### Accessory Workflow

```text
ACCESSORY
   │
   ▼
ClothingCanvas
   │
   ▼
Background Removal
   │
   ▼
Fabric fitting
   │
   ▼
PersonaRenderer
```

No specialized accessory editor is necessary.

### 🏁 Definition of Done

```text
Shared Fabric lifecycle       ✅
No persona-rendering `any`    ✅
Accessory upload              ✅
Accessory fitting             ✅
Accessory rendering           ✅
```

---

# ✨ PHASE 4 — UX / UI POLISH

**Goal:** Remove visible rough edges before users interact with the application.

### Tasks

- [ ] **CF14** — Implement or remove Forgot Password
- [ ] Add role-based route guard
- [ ] Use existing `isAdmin`
- [ ] Add error boundary around `PersonaRenderer`
- [ ] Add error boundary around `UploadFlow`
- [ ] Ensure failures display recoverable UI
- [ ] Remove dead buttons

### UX Principle

Never leave the user with:

```text
Something failed
      ↓
   blank screen
```

Instead:

```text
Something failed
      ↓
┌────────────────────────┐
│ We couldn't complete   │
│ this action.            │
│                         │
│       Try Again         │
└────────────────────────┘
```

---

# 🧪 PHASE 5 — TESTING

**Goal:** Build the regression protection the application currently lacks.

Testing should prioritize the bugs and security issues already identified.

## Testing Order

### 1. Backend Security

- [ ] Clothing ownership tests
- [ ] Outfit ownership tests
- [ ] Registration role escalation test

### 2. JWT

- [ ] Token generation
- [ ] Token validation
- [ ] Token expiration
- [ ] Secret handling

### 3. Backend Integration

```text
Register
   ↓
Login
   ↓
Create clothing
   ↓
Create outfit
   ↓
Delete clothing
   ↓
Verify permissions
```

### 4. Frontend Delete Regression

- [ ] Clicking delete opens confirmation
- [ ] `removeItem()` is NOT called immediately
- [ ] Confirming delete removes item

### 5. Upload Round Trip

```text
Upload
 ↓
Background removal
 ↓
Cloudinary
 ↓
Backend
 ↓
Clothing Store
 ↓
PersonaLayer
```

### 6. Outfit Round Trip

```text
Create
 ↓
Backend
 ↓
Reload
 ↓
Backend
 ↓
Render
```

### 7. Python AI

- [ ] Valid image → PNG
- [ ] PNG contains alpha channel
- [ ] Non-image → 4xx
- [ ] No leaked exception text

### 🏁 Definition of Done

```text
CI
 │
 ├── Backend tests       ✅
 ├── Frontend tests      ✅
 ├── Python tests        ✅
 └── Regression tests    ✅
```

---

# 🚀 PHASE 6 — PRODUCTION DEPLOYMENT

**Goal:** Ship the application.

## Production Architecture

```text
                         INTERNET
                            │
                            ▼
                    ┌───────────────┐
                    │    FRONTEND   │
                    │     React     │
                    └───────┬───────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
        Cloudinary                  Spring Boot API
        Image Storage                     │
                                         │
                              ┌──────────┴──────────┐
                              │                     │
                              ▼                     ▼
                         PostgreSQL           Python AI
                                              rembg
```

## Production Checklist

### Frontend

- [ ] Production build succeeds
- [ ] API URL configured
- [ ] No localhost assumptions

### Java Backend

- [ ] CF3–CF10 complete
- [ ] CF15 complete
- [ ] Production profile
- [ ] Environment secrets

### PostgreSQL

- [ ] Managed database
- [ ] Flyway migrations
- [ ] Automated backups

### Python

- [ ] CF11 complete
- [ ] Deployed
- [ ] `/health` monitored

### Cloudinary

- [ ] Upload preset scoped
- [ ] File-size limits
- [ ] Allowed formats
- [ ] Folder restrictions

### Secrets

- [ ] DB password externalized
- [ ] JWT secret externalized
- [ ] Cloudinary credentials/config externalized
- [ ] No secrets committed

### CORS

- [ ] Production frontend domain allowed

### Monitoring

- [ ] Health checks
- [ ] Python uptime check
- [ ] Basic production logging

---

# 🤖 IMAGE / AI PIPELINE

This architecture should **not be rebuilt**.

```text
User selects image
       │
       ▼
 optimizeImage()
       │
       ▼
Browser Background Removal
       │
       ├─────────────── SUCCESS ───────────────┐
       │                                       │
       │                                       ▼
       │                                Continue pipeline
       │
       └──────────── FAILURE
                       │
                       ▼
                 Python rembg
                       │
                 ┌─────┴─────┐
                 │           │
               SUCCESS     FAILURE
                 │           │
                 │           ▼
                 │       Original image
                 │
                 ▼
          Manual Cleanup
                 │
                 ▼
             Crop / Mask
                 │
                 ▼
       Jacket Segmentation
       (jackets only)
                 │
                 ▼
          Fabric.js Fitting
                 │
                 ▼
          Rasterize PNG
                 │
                 ▼
            Cloudinary
                 │
                 ▼
          Java REST API
                 │
                 ▼
             PostgreSQL
```

The recommended architecture keeps browser processing as the common path, with Python as a fallback, and uses Transformers.js specifically for jacket segmentation.

---

# 🗄️ DATA MODEL

The existing relationship is fundamentally correct.

```text
                    ┌──────────────┐
                    │     USER     │
                    └──────┬───────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
       CLOTHING ITEM                 OUTFIT
              │                         │
              │                         │
              │                    ┌────┴────┐
              │                    │         │
              │                    ▼         │
              └──────────────► OUTFIT ITEM ◄┘
```

### Relationships

```text
User
 ├── ClothingItem
 └── Outfit
       └── OutfitItem
              └── ClothingItem
```

### Keep

- `User`
- `ClothingItem`
- `Outfit`
- `OutfitItem`
- `AvatarType`
- Existing transform architecture

### Change

- [ ] Enforce `isActive`
- [ ] Simplify outfit request payload
- [ ] Enforce clothing ownership

### Do NOT add

- Persona table
- Complex abstraction layers
- Unnecessary entity redesign

---

# 🏗️ FRONTEND ARCHITECTURE

## Keep

```text
PersonaRenderer
PersonaLayer
CanvasUtils
FabricControls
ClothingCanvas
JacketCanvas
ShoeCanvas
GarmentCleanup
UploadFlow
useClothingStore
usePersonaStore
useAuthStore
background-removers
```

## Refactor

```text
useFabricCanvas
      │
      ├── ClothingCanvas
      ├── JacketCanvas
      ├── ShoeCanvas
      └── GarmentCleanup
```

## Delete

```text
HomePage.tsx
Canvas.tsx
segmentationService.removeBackground()
konva
react-konva
use-image
react-moveable
```

## Transitional

```text
useOutfitStore
        ↓
TARGET / PRIMARY

useLocalOutfitStore
        ↓
MIGRATION / OPTIONAL CACHE
```

---

# ☕ BACKEND ARCHITECTURE

Keep the existing feature-based structure:

```text
auth/
user/
clothing/
outfit/
```

Each feature can continue using:

```text
controller
service
repository
entity
dto
```

### Add

```text
CurrentUserService
        │
        └── Shared authentication lookup


ResourceNotFoundException
ForbiddenOperationException
        │
        ▼
GlobalExceptionHandler
```

### Keep Simple

Do **not** introduce:

- MapStruct
- ModelMapper
- Generic repository abstractions
- CQRS
- Per-service interfaces
- Enterprise ceremony

The original plan explicitly recommends keeping the backend incremental and appropriately simple for the current scale.

---

# 👔 CLOTHING CATEGORY STATUS

| Category     | Current State | Action            |
| ------------ | ------------- | ----------------- |
| 👕 TOP       | Complete      | Maintain          |
| 👖 BOTTOM    | Complete      | Maintain          |
| 👗 DRESS     | Complete      | Maintain          |
| 🧥 JACKET    | Advanced      | Stabilize only    |
| 👟 SHOES     | Complete      | Maintain          |
| 👜 ACCESSORY | Disabled      | Re-enable Phase 3 |

### Jacket

Do **not** expand the jacket system right now.

Already implemented:

- AI segmentation
- Smart Split fallback
- Independent sleeves
- Group transforms
- Warp
- Opening mask
- Layer-based interior/background behavior

The recommendation is to stabilize rather than expand this subsystem.

### Shoes

Already supports:

- Left/right shoes
- Symmetry checking
- Different pairs
- Optional footwear

No structural work required.

---

# 🧭 ARCHITECTURE DECISIONS

## Decision 01 — Outfit Persistence

### ✅ Backend

Backend becomes the source of truth.

Reason:

```text
localStorage
   ❌
browser-specific
device-specific
easy to lose

PostgreSQL
   ✅
persistent
multi-device
fits digital wardrobe concept
```

---

## Decision 02 — Image Storage

### ✅ Direct Cloudinary Upload

```text
Browser → Cloudinary
         ↓
        URL
         ↓
Java Backend
         ↓
PostgreSQL
```

Do not introduce a Java image proxy for the MVP.

---

## Decision 03 — AI

### ✅ Hybrid

```text
Browser AI
   ↓ failure
Python AI
   ↓ failure
Original Image
```

Keep Python because it improves compatibility/quality while remaining self-hosted.

---

## Decision 04 — Persona

### ✅ Keep Current Architecture

The Fabric editing / CSS rendering split is considered a strong design.

Remove currently unused biometric state:

- `skinTone`
- `bodyType`
- `height`
- `hairId`

Reintroduce later only if actual persona variants become a scoped feature.

---

## Decision 05 — Fabric.js

### ✅ Keep Fabric.js

Extract common lifecycle logic.

Do not rewrite the editors.

---

## Decision 06 — Clothing Deletion

### ✅ Soft Delete

```text
Delete request
     ↓
isActive = false
     ↓
Database row preserved
```

This protects saved outfits from orphaned references.

---

## Decision 07 — Python Service

### ✅ Keep

It remains the fallback for browsers where client-side processing fails.

---

## Decision 08 — Dead Code

### Delete

```text
HomePage
Canvas
unused segmentation removeBackground
Konva
react-konva
use-image
react-moveable
cloudinary-http44
tutorial test
```

### Keep

```text
useOutfitStore
outfitService
useLocalOutfitStore
```

because they are part of the outfit migration.

---

# 📋 MASTER TASK LIST

Execute in this exact order.

### Phase 0

- [x] **01** Fix broken `ClosetPage.tsx`
- [x] **01.5** TypeScript baseline & critical fixes
- [x] **02** Restore delete confirmation
- [x] **03** Delete dead frontend code
- [x] **04** Remove dead backend dependency/test

### Phase 1

- [x] **05** Fix registration privilege escalation
- [x] **06** Externalize secrets + fix JWT secret
- [x] **07** Introduce Flyway
- [x] **08** Implement soft-delete
- [x] **09** Fix outfit IDOR *(completed out of declared order, ahead of 06–08 — see note below)*
- [x] **10** Implement proper exception handling
- [x] **11** Add request validation
- [x] **12** Configure CORS
- [x] **13** Harden Python service
- [x] **14** Remove/resolve `/api/ai/**`

### Phase 2

- [x] **15** Simplify outfit contract
- [x] **16** Migrate frontend to backend outfits
- [x] ~~**17** Migrate existing localStorage outfits~~ *(REMOVED — no production data to migrate; see investigation note under Phase 2's task list above)*

### Phase 3

- [x] **18** Extract `useFabricCanvas`
- [x] **19** Fix persona/type gaps
- [x] **20** Re-enable accessories

### Phase 3.5 — TypeScript baseline *(added by the Product Pivot Addendum)*

- [x] **25** Add `fabric.d.ts` augmentation for `name` + canvas pan props
- [x] **26** Sweep unused declarations
- [x] **27** Narrow Fabric API usage (`getOriginalSize`, `TPointerEvent`, `_last*`)
- [x] **28** Resolve `segmentationService.ts` typing (investigate first)

### Phase 7 — Item eligibility & category data model

- [x] **29** Add `PersonaStatus` enum + entity field + `V2` migration
- [x] **30** Thread `personaStatus` through clothing DTOs and service
- [x] **31** Add "skip persona" branch to `UploadFlow`
- [x] **32** Add "keep original background" branch to `UploadFlow`
- [x] **33** Create `Collection` entity, repository, service, `V3` migration
- [x] **34** Add collection REST endpoints + ownership checks

### Phase 8 — Flat outfit builder

- [x] **35** Create `useOutfitDraftStore` + pure draft↔`OutfitRequest` adapters
- [x] **36** Build `FlatOutfitBuilderPage` (browse + multi-select, no persona)
- [x] **37** Add save/update draft → backend outfit
- [x] **38** Add optional persona preview toggle (eligible items only)
- [x] **39** Re-route post-login landing to the flat builder

### Phase 8.5 — Flat builder UX pass *(inserted 2026-09-01, see below)*

- [x] **40** Fix `Navbar.tsx` regression + rename Persona → Attire
- [x] **41** Back-button copy + Saved Outfits stale-link fix
- [x] **42** Selection display-order constant + grouping/pairing helpers
- [x] **43** Re-layout "Your Selection" panel using Task 42
- [x] **44** Add `markItemAsFitted` action
- [x] **45** Add "Adjust & Fit" to `EditClothingModal`
- [x] **46** Toast + upgraded alert UI
- [x] **47** Add a persona-type entry point to the navbar

### Phase 9 — Categories experience

*(renumbered 2026-09-01 from 40–43 to 48–51 to avoid colliding with the
Phase 8.5 tasks above — see Open Question #20 resolution)*

- [ ] **48** Create `useCollectionStore` + `collectionService`
- [ ] **49** Build categories management page
- [ ] **50** Inline "add to category" in `UploadFlow`
- [ ] **51** Inline "add to category" in outfit save

### Phase 9.5 — Categories polish + persona consistency *(planned 2026-09-03, before Phase 10)*

- [x] **59** Add search, category-type filter, persona-type filter,
      persona badge to `AddItemsModal` (+ its own density fix)
- [x] **60** Implement persona display names (backend-persisted)
- [x] **61** Extract Task 38's persona-eligibility filtering into a
      shared utility (pure refactor, no behavior change)
- [x] **62** Apply shared eligibility filter + alert + fit actions to
      `OutfitCard`'s persona toggle
- [x] **63** Remove dead post-pivot `document.getElementById('persona')`
      scroll-target calls (`OutfitCard.tsx`, `ClothingCard.tsx`)
- [x] **64** Realign `CategoryDetailPage`'s main item grid to the
      `SelectionCard` compact pattern *(done incidentally during the
      post-Task-59 feedback-round rewrite of this file, not its own pass)*
- [x] **65** Fix `ClothingCard`'s fixed-width-in-grid layout bug
      (`/closet`)

### Phase 9.6 — Shoe fix + VYSVI redesign *(planned 2026-09-21, before Phase 10)*

- [x] **66** Fix shoes not appearing on the persona (unsided shoes had no slot)
- [x] **67** Theme infrastructure: semantic tokens, light/dark/system store,
      no-flash script, navbar toggle, fonts
- [x] **68** Mechanical token migration (`white`/`black` utilities -> `ink`
      tokens, `on-accent`) + remove glows
- [x] **69** Shared components restyle (Navbar, footer, Toast, cards, modals)
- [x] **70** Page passes in both modes (Landing, Login/Signup, Closet,
      Outfits, Attire, Categories, Category detail, Persona)
- [x] **71** Editor / fitting tools (Fabric.js colors from tokens)
- [x] **72** Branding: VYSVI rename, logo swap-in, favicon, page title

### Phase 9.7 — Shoe-save bug, real logo, Outfit Showcase, Attire redesign *(planned 2026-09-21, before Phase 10)*

- [x] **73** Fix shoe-save losing its image (blob URL never uploaded to Cloudinary)
- [x] **74** Process the real logo (favicon + Landing hero + asset for Task 75)
- [x] **75** New Outfit Showcase page (majestic carousel, reachable via the logo)
- [x] **76** Redesign the Attire browse panel (3 sections, category dropdown,
      fix the selection-shrink bug)

### Phase 10 — Persona fitting repair & deformation

*(renumbered 2026-09-01 from 44–48 to 52–56, same reason as Phase 9 above)*

- [x] **52** Reproduce + confirm crop tool defects live; report before fixing
- [x] **53** Fix crop stale closure + mask-follows-garment (+ the
      blank-canvas bug found in Task 52, per explicit request)
- [x] **54** Add un-crop / reset affordance to `CanvasToolbar`
- [x] **55** Remove dead warp scaffolding (source was already gone in
      Task 26; removed the leftover `fabric-warpvas` dependency)
- [x] **56** Prototype bake-on-save deformation for one garment type
      (3x3 mesh warp on tops, baked to PNG, original + points kept in
      `modularData`)

### Phase 4 *(deferred — runs after Phase 10)*

- [ ] **21** Resolve Forgot Password (next - Phase 4 in progress)
- [ ] **22** Add route guards + error boundaries

### Phase 5 *(deferred)*

- [ ] **23** Implement regression/test suite

### Phase 6 *(deferred)*

- [ ] **24** Production readiness + deployment

### Phase 11 — Documentation *(last)*

*(renumbered 2026-09-01 from 49–50 to 57–58, same reason as Phase 9/10 above)*

- [ ] **57** Comment the codebase thoroughly
- [ ] **58** Write `PROJECT_STRUCTURE.md`

> **Execution order is NOT task-number order.** Run
> **25–28 → 29–48 → 21–24 → 49–50**. Phase numbers 7–11 continue after the
> existing Phase 6 purely to avoid renumbering this document; the rationale
> for running them first is in the Product Pivot Addendum.

> **Note:** Task 09 (outfit IDOR) was completed immediately after Task 05,
> ahead of Tasks 06–08, because it was identified in-session as the next
> highest-priority security fix without cross-checking this file first.
> Tasks 06–08 remain outstanding. Resuming strict declared order from
> Task 06 onward.

---

# 🧑‍💻 HOW TO WORK WITH CLAUDE

## One task at a time.

Do **not** ask Claude:

```text
"Implement the entire roadmap."
```

Instead:

```text
TASK 01
   ↓
Implement
   ↓
Run tests/build
   ↓
Review changes
   ↓
Commit
   ↓
TASK 02
```

### Recommended workflow

```text
┌─────────────────────┐
│ Pick ONE task       │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ Ask Claude to       │
│ implement it        │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ Review diff         │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ Run tests/build     │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ Commit              │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ Mark task complete  │
└──────────┬──────────┘
           ▼
       NEXT TASK
```

---

# 🚦 CURRENT SPRINT

## ✅ COMPLETED

```text
01    Fix broken ClosetPage.tsx
01.5  TypeScript baseline & critical fixes
02    Restore delete confirmation
03    Delete dead frontend code
04    Remove dead backend dependency/test
05    Fix registration privilege escalation
06    Externalize secrets + fix JWT secret
07    Introduce Flyway
08    Implement soft-delete
09    Fix outfit IDOR (out of order, see Master Task List note)
10    Implement proper exception handling
11    Add request validation
12    Configure CORS
13    Harden Python service
14    Remove/resolve dead /api/ai/** security rule
15    Simplify outfit contract
16    Migrate frontend to backend outfits
18    Extract useFabricCanvas
19    Fix persona/type gaps
20    Re-enable accessories
25    Add fabric.d.ts augmentation
26    Sweep unused declarations
27    Narrow Fabric API usage
28    Resolve segmentationService.ts typing
29    Add PersonaStatus enum + entity field + V2 migration
30    Thread personaStatus through clothing DTOs and service
31    Add "skip persona" branch to UploadFlow
32    Add "keep original background" branch to UploadFlow
33    Create Collection entity, repository, service, V3 migration
34    Add collection REST endpoints + ownership checks
35    Create useOutfitDraftStore + draft/OutfitRequest adapters
36    Build FlatOutfitBuilderPage
37    Add save/update draft to backend outfit
38    Add optional persona preview toggle
39    Re-route post-login landing to the flat builder
40    Fix Navbar regression + rename Persona -> Attire
47    Add a persona-type entry point to the navbar (out of order, see Master Task List note)
42    Selection display-order constant + grouping/pairing helpers
43    Re-layout "Your Selection" panel using Task 42
44    Add markItemAsFitted action
45    Add "Adjust & Fit" to EditClothingModal
46    Toast + upgraded alert UI
41    Back-button copy + Saved Outfits stale-link fix (out of order, see Master Task List note)
```

## 🎉 PHASE 1 — SECURITY & CORRECTNESS: COMPLETE

Merged into `main`. Now on `phase-2-outfit-system-unification`.

## ✂️ TASK 17 REMOVED

Investigated before implementing Task 16: no evidence this app has ever
been deployed (no CI/CD, no Dockerfile, no hosting config; git remote
is a personal dev repo; `main` had a build-breaking bug on `HEAD` until
Task 1). Any `saved-outfits-storage` data is the developer's own local
test data, not at-risk production data. Building one-time migration
infrastructure for it wasn't justified — removed from the roadmap
rather than implemented. `useLocalOutfitStore.ts` is left in place,
unused; its existing localStorage data is simply orphaned, not deleted.

## ✅ TASK 18 COMPLETE — EXTRACT `useFabricCanvas` (Phase 3 — Clothing Fitting System)

Extracted the shared Fabric.js lifecycle boilerplate (refs, container
ref, `ResizeObserver`-driven fit-to-container sizing) from
`ClothingCanvas`, `JacketCanvas`, and `ShoeCanvas` into
`frontend/src/hooks/useFabricCanvas.ts`. `GarmentCleanup`'s one-shot
polling measurement (measures once at creation, never resizes) was
extracted separately as `measureContainerWithRetry` rather than forced
into the `ResizeObserver` pattern, since its sizing model is
fundamentally different.

Verified via a pre-merge review that the hook's default
`resizeThreshold: 0` causes `ClothingCanvas`/`ShoeCanvas` to skip
re-running their "load mannequin/garment" effect on exact-duplicate-
size resize events (previously always re-ran, unguarded). Confirmed
that effect is a pure, idempotent function of its inputs with no
non-idempotent side effects, so this is a net risk reduction, not a
regression. `JacketCanvas` passes `resizeThreshold: 5`, reproducing
its original `>5px` anti-jitter guard exactly.

`npx tsc -b --force`: 142 errors, matching the pre-existing baseline
with zero new errors. `npx vite build`: passes. Committed as `1fbf06f`
on `phase-3-fabric-editor-cleanup`.

## ✅ TASK 19 COMPLETE — FIX PERSONA/TYPE GAPS (Phase 3 — Clothing Fitting System)

Added `openness?: number` to `ClothingTransform` (it previously only
existed on `ModularJacketData` and was smuggled onto per-segment
transforms via an untyped `any[]`). Removed the two
`(finalTransform as any).openness` casts in `PersonaLayer.tsx`, now
reading the properly-typed field directly. Exported `PersonaLayerProps`
from `PersonaLayer.tsx` and typed `PersonaRenderer`'s `layers` array
with it (was `any[]`), so `<PersonaLayer {...layer} />` is now
type-checked instead of bypassed. Removed `PersonaState`'s
`skinTone`/`bodyType`/`height`/`hairId` after confirming via a
repo-wide grep they were only ever set to hardcoded defaults in
`usePersonaStore.ts`, never read anywhere else.

`npx tsc -b --force`: 142 errors, matching the pre-existing baseline,
none in the 4 touched files. `npx vite build`: passes. Committed as
`d4df21a` on `phase-3-fabric-editor-cleanup`.

## ✅ TASK 20 COMPLETE — RE-ENABLE ACCESSORIES (Phase 3 — Clothing Fitting System)

Investigated first: accessories were already fully wired up at the
data/rendering layer (`usePersonaStore`, `ClothingCard`, `Presets.ts`,
`PersonaRenderer`) and the backend `ClothingCategory` enum had no
restriction - the backend's own docs noted "Accessory deactivated in
current UI cycle." Found exactly 5 UI-level filters hiding
`ClothingCategory.ACCESSORY` from category pickers (upload wizard,
closet tabs, closet homepage preview, outfit builder sidebar,
edit-item modal) and removed all 5. No routing changes needed -
accessories fall through to the same generic `ClothingCanvas`-based
fitting step already used by TOP/BOTTOM/DRESS.

`npx tsc -b --force`: 142 errors, identical line-for-line to the
pre-change baseline. `npx vite build`: passes. Verified live in-browser
that ACCESSORY renders as a selectable category on the Closet page and
Outfit Builder sidebar with no runtime errors (full upload-wizard E2E
not verified live - browser tooling used couldn't drive the native
file-picker dialog, and the test account had 0 existing items to
exercise the edit-modal picker with; verified via code instead that
the upload wizard's fix is structurally identical to the two pickers
confirmed live). Committed as `e8b6701` on `phase-3-fabric-editor-cleanup`.

## 🎉 PHASE 3 — CLOTHING FITTING SYSTEM: COMPLETE

All 7 tasks done (18, 19, 20) on `phase-3-fabric-editor-cleanup`.

**Unplanned fix (`6a03578`, same branch):** live-testing Task 20 against
an empty-closet test account surfaced a pre-existing infinite fetch
loop in `PersonaRenderer.tsx` - it re-fetched `/api/clothing` forever
whenever the closet had 0 items (guard never cleared), hammering the
backend and continuing to retry after the backend was stopped. Not
caused by Tasks 18-20; fixed by fetching once on mount, matching the
pattern already used correctly in `ClosetSection.tsx`/`ClosetPage.tsx`/
`OutfitBuilderPage.tsx`. `tsc`/`vite build` verified clean.

## 🔭 PIVOT PLANNED — PHASE 4 DEFERRED

Before starting Phase 4, the project pivoted from persona-first to
item-first (flat outfit builder, custom categories, optional persona
fitting). A full plan was investigated and appended to the end of this
document as the **Product Pivot Addendum** (Phases 3.5, 7, 8, 9, 10, 11).

**Next task is no longer 21.** The addendum's execution order is
**25–28 → 29–48 → 21–24 → 49–50**, starting with TypeScript baseline
remediation because `npm run build` (`tsc -b && vite build`) currently
**fails** on the 142 pre-existing errors — only bare `npx vite build`
succeeds, which is why the app still runs.

**15 open questions** in the addendum need answers before Phase 7
implementation can start.

## ✅ GIT CHECKPOINT COMPLETE

`phase-3-fabric-editor-cleanup` fast-forward-merged into `main` (`6a03578`,
pushed). New branch `phase-3-5-typescript-baseline` cut from that same
commit, pushed with tracking.

## ✅ TASK 25 COMPLETE — FABRIC TYPE AUGMENTATION (Phase 3.5)

Verified from Fabric v7.4.0's own source (not assumed) that
`FabricObject`'s constructor funnels options through
`CommonMethods._setOptions`, which does `this[key] = value` for every
unknown option — so `name` genuinely works at runtime and this was purely
a typing gap. Added `frontend/src/types/fabric.d.ts` declaring `name` on
both `FabricObject` and `BaseFabricObject` (`clipPath` is typed as the
latter — caught one straggler this way) and `lastPosX`/`lastPosY` on
`Canvas`. Zero runtime behavior changed, zero existing files touched —
one new file only.

`npx tsc -b --force`: 142 → **98** errors (−44: 38 `name` + 6 `lastPos`),
confirmed zero of those remain and no new error types introduced.
`npx vite build`: passes. Committed as `cae972a` on
`phase-3-5-typescript-baseline`.

## ✅ TASK 26 COMPLETE — SWEEP UNUSED DECLARATIONS (Phase 3.5)

Removed all 77 `TS6133`/`TS6192` unused-import/variable errors across
29 files — the largest single baseline group. Per your instruction,
also removed the dead jacket-warp scaffolding now rather than deferring
to Phase 10: `FabricWarpvas` dynamic import, `isWarpMode` prop/ref in
`JacketCanvas.tsx`, and the `isWarpMode` state in
`JacketFittingEditor.tsx` that only ever passed through and reset it
(confirmed via grep it drove no real UI logic before deleting).

Caught one self-inflicted break during verification: stripping
`OutfitsSection.tsx`'s `React` import broke it, since that file calls
`React.useState`/`React.useEffect` directly rather than importing the
hooks by name (new `TS2686`). Restored it, then checked every other
touched file for the same pattern — none of the rest use it.

`npx tsc -b --force`: 98 → **21** errors, exactly on target, no new
error codes — remaining 21 are exactly the `getOriginalSize` (4),
`TPointerEvent clientX/Y` (6), `_last*` (5), and `segmentationService.ts`
(6) groups reserved for Tasks 27–28. `npx vite build`: passes. Not
live-tested in-browser (both dev servers were down; pure static
dead-code sweep, verified by two independent tools). Committed as
`e0fc99c` on `phase-3-5-typescript-baseline`.

**Phase 3.5 running total: 142 → 21 (85% cleared).**

## ✅ TASK 27 COMPLETE — NARROW FABRIC API USAGE (Phase 3.5)

Resolved all 15 remaining `TS2339` errors by narrowing rather than
widening types, across 4 files:

- `getOriginalSize()` guarded with `instanceof FabricImage` at all 4
  sites (`ClothingCanvas.tsx`, `ShoeCanvas.tsx`) — verified these
  objects are always `FabricImage` in practice (loaded via
  `loadFabricImage`), so the guard is provably always-true today.
- `TPointerEvent` (`MouseEvent | TouchEvent | PointerEvent`) narrowed
  with `'clientX' in opt.e` at all 6 pan-tool sites in
  `GarmentCleanup.tsx`. Incidentally closes a latent bug: on touch
  devices this previously produced `NaN` and corrupted the viewport
  transform; desktop mouse/pointer behavior (the only exercised path)
  is unchanged.
- `_lastLeft/_lastTop/_lastScaleX/_lastScaleY/_lastAngle` (5, all in
  `JacketCanvas.tsx`) replaced with a component-scoped
  `WeakMap<FabricObject, {...}>` — same per-object tracking and
  fallback semantics, off Fabric's own object instead of bolted onto it.

`npx tsc -b --force`: 21 → **6** errors, exactly the
`segmentationService.ts` group reserved for Task 28. `npx vite build`:
passes. Not live-tested in-browser (dev servers were down); verified by
careful code-level equivalence review instead since this task changed
runtime logic, not just types. Committed as `7d95d5e` on
`phase-3-5-typescript-baseline`.

**Phase 3.5 running total: 142 → 6 (96% cleared).**

## ✅ TASK 28 COMPLETE — RESOLVE `segmentationService.ts` TYPING (Phase 3.5, final task)

Investigated first, as planned. `image_processor_only` was never a real
`pipeline()` option in the installed `@huggingface/transformers` v4.2.0
— it was a workaround for an older version that unconditionally tried
(and 404'd) fetching a tokenizer for every pipeline. v4 now
conditionally probes `expected_files` for `tokenizer.json` before
requesting it, so the underlying problem is fixed upstream and the flag
is obsolete. Confirmed it had zero runtime effect even before this fix
(silently dropped by `pipeline()`'s destructuring) — removing it changed
nothing observable. Also guarded the two `labelMap` lookups against
`s.label` being `null` (the v4 output type allows it), preserving the
exact current behavior. Confirmed `segmentationService.ts` is live code
(called from `UploadFlow.tsx`'s jacket upload paths), not dead
scaffolding, before touching it. No genuine behavioral bug found among
the 6 errors.

`npx tsc -b --force`: 6 → **0** errors. `npm run build` (the full
`tsc -b && vite build` script, not just bare `vite build`): **passes
end-to-end for the first time in this engagement.** Live-verified: the
user hit `ERR_CONNECTION_REFUSED` testing the jacket upload flow
because the FastAPI/rembg microservice (port 8000) wasn't running —
unrelated to this fix. All three services (Postgres, backend via
IntelliJ, AI microservice) confirmed live afterward. Committed as
`62db99f` on `phase-3-5-typescript-baseline`.

## 🎉 PHASE 3.5 — TYPESCRIPT BASELINE: COMPLETE

**142 → 0 errors.** `npm run build` passes end-to-end. All 4 tasks
(25–28) done on `phase-3-5-typescript-baseline`. Merged into `main`
(`62db99f`, pushed). New branch `phase-7-item-eligibility` cut from
that same commit, pushed with tracking.

## ✅ TASK 29 COMPLETE — ADD `PersonaStatus` ENUM + ENTITY FIELD + `V2` MIGRATION (Phase 7)

Data foundation for the item-first pivot: whether a `ClothingItem` can
be shown on the persona. Added the `PersonaStatus` enum
(`FITTED`/`NOT_FITTED`/`INELIGIBLE_NO_CUTOUT`, a single enum rather than
two booleans per the addendum's recommendation — "not background-removed"
+ "persona fitted" is not a valid combination), the entity field
(defaults to `FITTED`), and an additive `V2__add_persona_status.sql`
migration. DTOs, service, controller, and frontend intentionally
untouched — that's Task 30.

Verified against the real dev DB via a temporary instance on spare port
8081 (not touching the running IntelliJ instance on 8080): Flyway
applied the migration cleanly, Hibernate's `ddl-auto=validate` accepted
the new schema, and all 16 existing rows backfilled correctly to
`FITTED`. Confirmed via `psql` directly. Temporary instance cleanly
stopped afterward. Committed as `407cae3` on `phase-7-item-eligibility`.

## ✅ TASK 30 COMPLETE — THREAD `personaStatus` THROUGH CLOTHING DTOs AND SERVICE (Phase 7)

Wired the field added in Task 29 through `ClothingRequest`,
`ClothingResponse`, and `ClothingService` (both `createItem` and
`updateItem`), following the exact pattern already used for
`personaType`/`isModular`. Backend-only.

Verified with a full authenticated round-trip against the real dev DB
via a temporary instance on spare port 8081 (not touching the running
IntelliJ instance): create without `personaStatus` defaults to `FITTED`,
create with `NOT_FITTED` is respected, update to `INELIGIBLE_NO_CUTOUT`
applies, and a second update with no `personaStatus` in the payload
leaves it unchanged (partial-update semantics intact). `GET /api/clothing`
correctly includes the field. Test data cleaned up afterward. Committed
as `8fd5393` on `phase-7-item-eligibility`.

## ✅ TASKS 31–32 COMPLETE — SKIP PERSONA / SKIP BACKGROUND REMOVAL (Phase 7)

Two new `UploadFlow.tsx` choices, both using the `PersonaStatus` values
from Task 29. **Task 31 "Skip Persona Fitting"** (on `PREVIEW`, after
removal succeeds): saves as `NOT_FITTED`, bypassing `FITTING`/
`JACKET_FITTING`; added a small dedicated `SKIP_PERSONA` step for name/
description since that UI normally lives inside `FittingEditor.tsx`
(intentionally not touched). **Task 32 "Skip Background Removal"**
(on `CONFIG`, before removal ever runs — placed upfront rather than at
`PREVIEW` because removal is a real cost, AI inference or a network
round-trip, that a user who already knows they want the original
shouldn't have to wait through): saves as `INELIGIBLE_NO_CUTOUT` with
the raw original image. Distinct from the pre-existing
`continueWithOriginal` path, which still routes through
`GARMENT_CLEANUP` → `FITTING` for manual cutout and stays
persona-eligible — this new path attempts no cutout at all. Both
entry points share one generalized `SKIP_PERSONA` step (heading,
preview image, and the "Back" target all branch on a
`skipPersonaStatus` variable) rather than duplicating it — caught and
fixed a bug in the process: "Back" previously always returned to
`PREVIEW`, which would render blank for the no-cutout path since
`backgroundRemovedUrl` is `null` there. Both save with
`DEFAULT_TRANSFORMS[personaType][category]` so a later "promote to
fitted" flow (Task 48) has sensible starting coordinates. `SHOES`
excluded from both, matching the flow's existing separate-shoe-editor
boundary.

`npx tsc -b --force`: 0 errors maintained. `npx vite build`: passes.
Full click-through E2E blocked by tooling (no connected browser could
drive a native file-picker); verified both exact save payloads
(`transform` + `personaStatus` together) against the real dev DB via a
temporary instance on spare port 8081, cleaned up afterward. Committed
together as `da6b7ee` on `phase-7-item-eligibility` (Task 31 hadn't
been committed yet when Task 32 was requested, and Task 32 restructures
what Task 31 built, so a clean split wasn't meaningful).

## ✅ TASK 33 COMPLETE — CREATE `Collection` ENTITY, REPOSITORY, SERVICE, `V3` MIGRATION (Phase 7)

Data model for "Categories" (7b), mirroring `Outfit`/`OutfitItem`/
`OutfitService` exactly. `Collection` (owner, name, createdAt) plus
`CollectionItem`/`CollectionOutfit` join rows — an item/outfit may
belong to several collections (open questions #1–3, confirmed
2026-09-01). Ownership checks included in the service now, not
deferred to Task 34, matching how `ClothingService`/`OutfitService`
already put authorization in the service layer rather than the
controller. `V3__add_collections.sql` is additive: a case-insensitive
unique index on `(owner_user_id, lower(name))` plus unique indexes on
both join tables as a DB-level backstop behind the service's own
duplicate check. Deleting a collection cascade-deletes only its
membership rows via JPA's `orphanRemoval` — referenced items/outfits
are untouched (resolves open question #9 by the design itself, no
special-casing needed).

**Flagged:** `Collection` shares its simple name with `java.util.Collection`
— noted in the entity's own javadoc; every file keeps `java.util`
imports explicit (no wildcards) to avoid ambiguity.

Verified against the real dev DB via a temporary instance on spare port
8081: Flyway applied `V3` cleanly, Hibernate's `ddl-auto=validate`
accepted every new mapping, `psql` confirmed all 3 tables/FKs/unique
indexes. Not functionally tested via HTTP — no controller yet (Task 34).
Committed as `27d8d5e` on `phase-7-item-eligibility`.

## ✅ TASK 34 COMPLETE — ADD COLLECTION REST ENDPOINTS + OWNERSHIP CHECKS (Phase 7, final task)

New `CollectionController` (create/list/rename/delete a collection,
add/remove item, add/remove outfit) following `OutfitController`'s
exact pattern, plus 4 new DTOs. Updated `CollectionService` to map to
`CollectionResponse` internally instead of returning raw entities,
matching `ClothingService`/`OutfitService`'s existing convention.

Ran a full IDOR test against the real dev DB via a temporary instance
on spare port 8081 (not touching the running IntelliJ instance), with
two separate test accounts: all 5 cross-user attempts correctly
blocked with 403 (rename/delete another user's collection by ID, list
correctly scoped to the caller, adding another user's clothing
item/outfit into your own collection). Also confirmed idempotent
re-add produces no duplicate row, and deleting a collection
cascade-deletes only its membership join rows (verified via `psql`)
while referenced items/outfits stay untouched. Test data cleaned up
afterward. Committed as `e3a5f97` on `phase-7-item-eligibility`.

## 🎉 PHASE 7 — ITEM ELIGIBILITY & CATEGORY DATA MODEL: COMPLETE

All 6 tasks (29–34) done on `phase-7-item-eligibility`. Merged into
`main` (`e3a5f97`, pushed). New branch `phase-8-flat-outfit-builder`
cut from that same commit, pushed with tracking.

## ✅ TASK 35 COMPLETE — CREATE `useOutfitDraftStore` + DRAFT↔`OutfitRequest` ADAPTERS (Phase 8)

`selectedItemIds: number[]` store, deliberately separate from
`usePersonaStore`'s category-bucketed equip representation (a flat
selection may include `NOT_FITTED`/`INELIGIBLE_NO_CUTOUT` items the
persona equip model can't represent). Two pure adapters —
`outfitItemsFromDraft` derives each item's `slot` from its category
(needed so a later persona preview, Task 38, can still bucket items
via the existing, unchanged `equippedFromOutfitItems`); shoes without a
recorded `side` get no slot, flagged as a known boundary rather than
guessed at. `draftFromOutfitItems` is the trivial reverse. Confirmed
`useOutfitStore.ts` untouched — only one new file.

`npx tsc -b --force`: 0 errors. `npx vite build`: passes. Nothing
wires this into the UI yet, so no click-through was possible;
hand-traced both adapters against a mixed TOP/SHOES/JACKET selection
instead. Committed as `2ea77c7` on `phase-8-flat-outfit-builder`.

## ✅ TASK 36 COMPLETE — BUILD `FlatOutfitBuilderPage` (Phase 8)

Browse + multi-select UI at the new route `/outfits/flat/new`, using
Task 35's `useOutfitDraftStore`: category sidebar + search, browsable
grid, and a live "Your Selection" panel with per-item remove — no save
button yet (Task 37). Deliberately does **not** filter the browse grid
by persona type the way `ClosetPage`/`OutfitBuilderPage` do — each card
shows a MALE/FEMALE badge instead, and both types can be freely mixed
into one selection. This makes a call on open question #7
(mixed-persona outfits) for the *selection* UI specifically, in favor
of allowing it; the persona *preview* (Task 38) can still filter
independently. Route added additively — existing `/outfits/new`,
`/outfits/edit/:id`, and the post-login landing are untouched, and
there's no link to the new route anywhere in the UI yet (direct-URL
only until Task 39).

Full live click-through against the real running backend: created 3
real clothing items via the API (mixed categories/persona types) for a
throwaway account, verified multi-select, toggle-off,
remove-from-panel (syncs back to the grid), category filter
(independent of existing selection), search, and clear-all all work
correctly. `npx tsc -b --force`: 0 errors. `npx vite build`: passes.
Test items cleaned up afterward. Committed as `b61f527` on
`phase-8-flat-outfit-builder`.

## ✅ TASK 37 COMPLETE — ADD SAVE/UPDATE DRAFT → BACKEND OUTFIT (Phase 8)

Editable name input + Save/Update button on `FlatOutfitBuilderPage`,
using Task 35's `outfitItemsFromDraft`. Edit mode (`/outfits/flat/edit/:id`,
added additively) loads an existing outfit via `draftFromOutfitItems`
+ `setDraft`, mirroring `OutfitBuilderPage`'s `id`-param pattern
exactly. `avatarType` is read-only from `usePersonaStore().persona.type`
— never mutated — implementing open question #6's recommended default.
Caught and fixed a variable-shadowing issue on `useParams()`'s `id`
while wiring this up.

Full live E2E against the real backend: created a new outfit (verified
`avatarType` default + slot derivation via API), loaded it in edit
mode (verified the draft pre-populated correctly), removed an item,
saved again, and confirmed via API it updated the same `outfitId`
rather than duplicating. Confirmed `clearDraft()` resets state
correctly after saving. `npx tsc -b --force`: 0 errors. `npx vite build`:
passes. Test data cleaned up afterward. Committed as `2c64410` on
`phase-8-flat-outfit-builder`.

## ✅ TASK 38 COMPLETE — ADD OPTIONAL PERSONA PREVIEW TOGGLE (Phase 8)

"Preview On Persona" / "List View" toggle on `FlatOutfitBuilderPage`.
Filters the selection to `FITTED` items matching the preview persona's
type, reuses `equippedFromOutfitItems` (Task 16) and `PersonaRenderer`
completely unchanged. Rather than resolving open question #7
(mixed-persona outfits) further, made its tradeoff visible: excluded
items are counted and explained ("N items hidden — not persona-fitted
yet" / "...for the other persona (X)") instead of silently vanishing.

Full live E2E against the real backend: 3 items covering
`FITTED`+MALE, `NOT_FITTED`+MALE, `FITTED`+FEMALE — confirmed the
exclusion panel showed exactly the right counts/reasons, the one
eligible item rendered at its correct transform position, and toggling
back to List View left the underlying selection untouched.
`npx tsc -b --force`: 0 errors. `npx vite build`: passes. Test data
cleaned up. Committed as `675fe18` on `phase-8-flat-outfit-builder`.

## ✅ TASK 39 COMPLETE — RE-ROUTE POST-LOGIN LANDING TO THE FLAT BUILDER (Phase 8, final task)

Open question #8 resolved: flat builder for everyone post-login
(`AskUserQuestion`, 2026-09-01), not a persona dashboard kept only for
users with fitted items. `App.tsx`'s `/` route now renders
`FlatOutfitBuilderPage` when authenticated instead of `DashboardPage`;
`DashboardPage` stays reachable at a new `/dashboard` route rather than
being deleted. Closes out Phase 8 (Tasks 35–39). Committed as `887bcd9`
on `phase-8-flat-outfit-builder`.

## ✅ TASK 40 + 47 COMPLETE — FIX NAVBAR REGRESSION, RENAME PERSONA → ATTIRE, ADD PERSONA NAVBAR ICON

Live regression found and fixed: `Navbar.tsx`'s dead anchor-scroll
interception (`handleNavClick`, `IntersectionObserver`, `activeSection`)
assumed `/` still hosted the old scrolling `DashboardPage` and swallowed
every nav click while on `/` after Task 39 changed what `/` renders —
entirely removed. `Persona` nav link renamed to `Attire`, repointed from
`/persona` to `/`; `/persona` and `/dashboard` remain reachable,
unlinked from primary nav. This reopened a discoverability gap (raised
directly by the user — "Where is the persona??"), resolved via
`AskUserQuestion` (open question #16) by adding Task 47: a small
`UserCircle` icon next to the logout button linking to `/persona`.
Live E2E-tested the exact broken click path (Attire/Closet/Outfits/logo
while on `/`) per the user's explicit instruction to test directly
rather than infer from code reading. Committed together (both touched
`Navbar.tsx`) as `c2f772b` on `phase-8-flat-outfit-builder`.

Also resolved during this pass: a task-number collision between the
newly-planned **Phase 8.5** (Tasks 40–47) and the pre-existing Phase
9/10/11 sections, which had already claimed 40–50 for unrelated work
(categories experience, persona fitting repair, documentation). Since
Tasks 40/47 were already committed under those numbers, Phase 9/10/11
were renumbered to 48–58 instead (content/scope unchanged) — see open
question #20 and the renumbering notes on each of those phase sections.

## ✅ TASKS 42 + 43 COMPLETE — SELECTION DISPLAY-ORDER HELPERS + PANEL RE-LAYOUT (Phase 8.5, Part A)

Task 42: new `frontend/src/utils/selectionDisplay.ts` exports
`SELECTION_DISPLAY_ORDER` (`JACKET → TOP → DRESS → BOTTOM → SHOES`),
`groupSelectedItemsForDisplay()`, `pairShoesForDisplay()` — pure logic,
hand-traced against a mixed selection before any UI consumed it.

Task 43: `FlatOutfitBuilderPage.tsx`'s "Your Selection" panel now
renders those buckets as labeled, denser sub-groups; shoes pair into a
2-up left/right row with unpaired extras falling to a secondary row;
accessories render in their own row below the main stack (open
question #17) and disappear cleanly when empty. Browse grid, persona
preview toggle/exclusion logic, and `useOutfitDraftStore.ts` untouched
- verified live by creating 8 temporary test items (one per category
plus a paired + unpaired shoe case) via direct API calls, selecting
all 8, confirming group order/pairing/accessory placement, confirming
remove still works, and confirming the persona preview toggle still
renders correctly and reverses cleanly. Test items deleted after
(204s confirmed). `npx tsc -b --force` / `npx vite build` both pass.
Committed together (Task 43 consumes Task 42) as `a4d0a9a` on
`phase-8-flat-outfit-builder`.

## ✅ TASK 44 COMPLETE — ADD A `markItemAsFitted` ACTION (Phase 8.5, Part B)

Thin named wrapper around the existing `updateItem`:
`markItemAsFitted(itemId) => updateItem(itemId, { personaStatus:
PersonaStatus.FITTED })`, matching the `toggleFavorite` single-purpose
action pattern already in `useClothingStore.ts`. No backend change -
Task 30 already threads `personaStatus` through the update path.
`npx tsc -b --force` / `npx vite build` both pass. Live: created a
real `NOT_FITTED` test item with a distinct transform, exercised the
exact authenticated `PUT` the wrapper makes (no UI hook exists yet for
this action - that's Task 46), confirmed `personaStatus` flipped to
`FITTED` with the transform completely unchanged. Test item deleted
after. Committed as `943d29d` on `phase-8-flat-outfit-builder`.

## ✅ TASK 45 COMPLETE — "ADJUST & FIT" ENTRY POINT (Phase 8.5, Part B)

`EditClothingModal` gained a strictly additive `promoteToFittedOnSave?:
boolean` prop (default unset) - when true, a successful save includes
`personaStatus: FITTED` in the `updateItem` call; omitted, the field is
`undefined` and dropped by `JSON.stringify`, so `ClosetPage.tsx`'s
existing use is byte-for-byte unaffected. `FlatOutfitBuilderPage`'s
exclusion note now lists each `NOT_FITTED` excluded item with an
"Adjust & Fit" pill that opens the modal with the prop set;
`INELIGIBLE_NO_CUTOUT` items are left alone (no fitting shortcut
exists - open question #14, still open). `FittingEditor.tsx` untouched.
`npx tsc -b --force` / `npx vite build` both pass. Live, two passes:
(1) edited an item via `ClosetPage`'s normal flow - `personaStatus`
stayed `NOT_FITTED`, confirming the addition is inert when unused; (2)
used the new flat-builder entry point - `personaStatus` flipped to
`FITTED` with the transform unchanged, and the exclusion note/persona
preview updated live with no manual refresh. Test items cleaned up.
Committed as `c311b02` on `phase-8-flat-outfit-builder`.

## ✅ TASK 46 COMPLETE — TOAST + UPGRADED ALERT UI (Phase 8.5, Part B, final task)

Split the previously-combined `excludedIneligibleCount`/`ineligible`
bucket into `notFittedExcluded` and a new `noCutoutExcluded`. A toast
now fires via the existing `useToast()` every time "Preview on
Persona" is switched on while exclusions exist ("N items can't be
shown on persona"), keyed only on the toggle (not the counts) so it
fires fresh on every toggle-on, matching the resolved open question.
The exclusion note's per-item rows now carry real actions split by
reason: `NOT_FITTED` → "Mark as Fitted" + "Adjust & Fit" side by side;
`INELIGIBLE_NO_CUTOUT` → "Remove from outfit" only. `Toast.tsx`,
`PersonaRenderer`/`PersonaLayer`, and Task 38's projection logic
untouched. `npx tsc -b --force` / `npx vite build` both pass. Live,
one selection covering both reasons at once: toast fired with the
correct count, both action rows worked (mark-as-fitted promoted the
item live and it appeared on the persona; remove-from-outfit cleared
the ineligible item and the note disappeared entirely), and toggling
off then back on re-fired the toast. Test items cleaned up. Committed
as `dbf230c` on `phase-8-flat-outfit-builder`. **This closes out Phase
8.5 Part B (Tasks 42-47) entirely.**

## ✅ TASK 41 COMPLETE — BACK-BUTTON COPY + SAVED OUTFITS STALE-LINK FIX (Phase 8.5, last task)

Investigation confirmed and expanded the original one-line note into
four concrete fixes: `ClosetPage.tsx`/`PersonaPage.tsx`'s "Back to
Dashboard" → "Back to Attire" (destination `/` was already correct,
only the label was stale); `SavedOutfitsPage.tsx`'s three "new outfit"
buttons and `OutfitCard.tsx`'s edit button repointed from the old
persona-first `/outfits/new`/`/outfits/edit/:id` to the item-first
`/outfits/flat/new`/`/outfits/flat/edit/:id`; `FlatOutfitBuilderPage`'s
back-chevron now hidden specifically when rendered at `/` itself (no
"back" affordance makes sense on the app's own home page), still
shown/working on the other two routes that reuse this page. Neither
old route deleted - both stay reachable by direct URL. `npx tsc -b
--force` / `npx vite build` both pass. Live-tested every path: back-
chevron hidden on `/`, "Back to Attire" on both `/closet` and
`/persona` landing on `/`, "Initialize New Look" landing on
`/outfits/flat/new`, and a real test outfit's edit button landing on
`/outfits/flat/edit/:id` with its item correctly pre-loaded. Test data
cleaned up. Also recovered mid-task: the backend/Postgres had both
stopped (unrelated to this work) and `ClothingService.java` had been
wiped to 0 bytes on disk outside of any of my changes - restored from
the last commit before continuing. Committed as `0bfcf93` on
`phase-8-flat-outfit-builder`. **This closes out Phase 8.5 entirely.**

## 🔀 GIT CHECKPOINT — PHASE 8.5 → PHASE 9 (2026-09-03)

`phase-8-flat-outfit-builder` fast-forward-merged into `main` (now at
`0bfcf93`), pushed. New branch `phase-9-categories-experience` cut
from `main` and pushed with tracking. Verified `main`, local and
remote `phase-9-categories-experience` all point to `0bfcf93`.

---

# 🏆 FINAL MVP

When every phase is complete, Digital Closet should provide:

```text
                    DIGITAL CLOSET
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
       AUTH            CLOSET          OUTFITS
          │               │               │
          │               │               │
       Secure          Upload          Persist
       JWT             AI              Backend
                       │               │
                       ▼               ▼
                   Fabric.js       PostgreSQL
                       │
                       ▼
                  PERSONA RENDER
                       │
                       ▼
                 Digital Wardrobe
```

### MVP Success Criteria

- [ ] Application builds cleanly
- [ ] Authentication is secure
- [ ] Users cannot access other users' clothing
- [ ] Clothing deletion is safe
- [ ] Outfits persist across devices
- [ ] Upload pipeline is reliable
- [ ] AI has graceful fallback
- [ ] Jackets work without additional scope
- [ ] Shoes work
- [ ] Accessories work
- [ ] Errors are recoverable
- [ ] Critical flows are tested
- [ ] Secrets are externalized
- [ ] Database migrations are controlled
- [ ] Production deployment works
- [ ] No localhost assumptions remain

---

# 🚀 THE END STATE

**Don't rebuild Digital Closet.**

The existing application already has a surprisingly strong technical foundation.

The mission is:

```text
STABILIZE
    ↓
SECURE
    ↓
UNIFY
    ↓
CONSOLIDATE
    ↓
POLISH
    ↓
TEST
    ↓
DEPLOY
```

**Build on what works. Remove what doesn't. Finish the incomplete systems. Then ship.**

---
---

# 🔭 PRODUCT PIVOT ADDENDUM (planned 2026-08-29)

Everything below was planned in a single investigation pass after Phase 3
completed. **Nothing in this addendum has been implemented.** It supersedes
nothing above it — Phases 4, 5 and 6 remain valid and still execute, but
*later* in the order (see Execution Order below).

## Why the pivot

The app is currently **persona-first**: every garment must be fitted onto a
2D mannequin before it is usable, and outfit building is a persona-centric
visual activity. The product direction is now **item-first**: assembling an
outfit is pure selection, and the persona becomes an optional secondary view
for the subset of items that support it.

```text
        BEFORE (persona-first)                AFTER (item-first)

        upload → bg removal                   upload → bg removal?
              ↓                                     ↓        (optional)
        MANDATORY fitting                     OPTIONAL fitting
              ↓                                     ↓
        persona render                        flat builder (primary)
              ↓                                     ↓
        outfit = persona state                outfit = item selection
                                                    ↓
                                              persona view (secondary,
                                              eligible items only)
```

## Execution Order

Phase numbers below continue after Phase 6 to avoid renumbering the existing
document, but **execution order is not phase-number order**:

```text
PHASE 3.5   TypeScript baseline remediation      ← DO FIRST (unblocks builds)
    ↓
PHASE 7     Item eligibility + category models   ← data foundation
    ↓
PHASE 8     Flat outfit builder
    ↓
PHASE 9     Categories experience
    ↓
PHASE 10    Persona fitting repair + deformation
    ↓
PHASE 4     UX / UI polish            (existing — deferred to here)
    ↓
PHASE 5     Testing                   (existing — deferred to here)
    ↓
PHASE 6     Production deployment     (existing — deferred to here)
    ↓
PHASE 11    Documentation + code commentary      ← DO LAST
```

**Rationale for this order:**

- **3.5 first.** `npm run build` is `tsc -b && vite build` — with 142 errors
  it currently **fails**. Only bare `npx vite build` succeeds, which is why
  the app still runs. Phase 6 (deployment) and Phase 5 (testing/CI) are both
  blocked by this, and every new feature adds noise to an already-unreadable
  error list. Cheap to fix, unblocks everything.
- **7 before 8/9.** The flat builder and categories both consume the new
  eligibility flag and category tables. Backend/data first avoids rework.
- **4/5/6 deferred.** Phase 4 polishes `UploadFlow` and adds error boundaries
  around components this pivot substantially rewrites; doing it first means
  doing it twice. Testing a system mid-redesign is wasted effort, and
  deploying before the product change ships is pointless.
- **11 last**, as requested — documenting a codebase mid-pivot documents a
  codebase that no longer exists.

---

# 🧯 PHASE 3.5 — TYPESCRIPT BASELINE REMEDIATION

**Goal:** Take the frontend from 142 errors to 0 so `npm run build` works,
without changing a single runtime behaviour.

> **Finding:** the 142 errors are not 142 problems. They are **6 root
> causes**, and 115 of the 142 (81%) are two mechanical ones.

### Root cause breakdown

```text
 77  unused declarations        TS6133/TS6192   trivial, zero runtime risk
 38  Fabric `name` property     TS2339          one .d.ts fixes all 38
 11  Fabric custom/private props TS2339         canvas pan + _last* stashes
  6  TPointerEvent clientX/Y    TS2339          union not narrowed
  4  getOriginalSize()          TS2339          FabricImage vs FabricObject
  7  segmentationService        TS2353/2578/2538 real library API mismatch
───
 142
```

**Cause 1 — unused declarations (77).** Dead imports and variables. Note
three of them (`FabricWarpvas`, `isWarpMode`, `warpvasInstances` in
`JacketCanvas.tsx`) are scaffolding for the never-built warp feature — see
Phase 10, which rebuilds it properly. Deleting them loses nothing (git has
the history).

**Cause 2 — Fabric `name` (38).** Fabric v6+ removed `name` from the object
type. The code sets `name` through constructor options and reads `obj.name`
everywhere for object lookup. Fabric assigns unknown constructor options onto
the instance at runtime, so this *works* — it is purely a typing gap. A
single `src/types/fabric.d.ts` module augmentation declaring
`name?: string` on `FabricObject` clears all 38 with zero runtime change.

**Cause 3 — Fabric custom props (11).** `lastPosX`/`lastPosY` stashed on
`Canvas` for panning (6), and `_lastLeft/_lastTop/_lastScaleX/_lastScaleY/
_lastAngle` stashed on objects in `JacketCanvas` (5). Same augmentation file
handles the canvas ones; the `_last*` group is better refactored into a
component-scoped ref.

**Cause 4 — `TPointerEvent` (6).** It is a union including `TouchEvent`;
`clientX`/`clientY` need narrowing (`'clientX' in e`). Fixing this also
closes a latent touch-device bug.

**Cause 5 — `getOriginalSize()` (4).** Exists on `FabricImage`, not
`FabricObject`. Code retrieves objects via `getObjects().find(...)` (typed
`FabricObject`) then calls it. Fix with an `instanceof FabricImage` guard.

**Cause 6 — `segmentationService.ts` (7).** A genuine API mismatch with
`@huggingface/transformers` v4: `image_processor_only` is not in
`PretrainedModelOptions` (2), two `@ts-expect-error` directives are now
stale (2), and two `null` index types (2). **This is the only group that
may hide a real bug** and needs investigation against the installed version.

### Risk ranking (lowest → highest)

```text
Cause 2  types only, no code change          ▁
Cause 1  deletions, compiler-verified        ▂
Cause 4  narrowing, fixes latent touch bug   ▃
Cause 5  narrowing, provably equivalent      ▃
Cause 3  touches JacketCanvas interaction    ▅
Cause 6  real library mismatch, may be a bug ▇
```

### Tasks

- [x] **25** Add `fabric.d.ts` augmentation for `name` + canvas pan props
- [x] **26** Sweep unused declarations
- [x] **27** Narrow Fabric API usage (`getOriginalSize`, `TPointerEvent`, `_last*`)
- [x] **28** Resolve `segmentationService.ts` typing (investigate first)

### 🏁 Definition of Done

```text
npx tsc -b --force            0 errors    ✅
npm run build                 succeeds    ✅
No runtime behaviour changed              ✅
Baseline claim retired from all tasks     ✅
```

---

# 🏷️ PHASE 7 — ITEM ELIGIBILITY & CATEGORY DATA MODEL

**Goal:** Establish the data foundation the flat builder and categories need,
backend-first, plus the upload-flow choices that produce it.

## 7a — Persona eligibility

Two new user choices at the post-background-removal step:

- **"Skip persona"** — save without fitting; usable in the flat builder, no
  persona representation.
- **"Don't remove background"** — keep the original image; because persona
  rendering needs a clean cutout, this *also* implies persona-ineligible.

### Recommended representation

A **single enum column**, not a pair of booleans. Two booleans give four
combinations of which one (`not background-removed` + `persona fitted`) is
invalid and would need defending in code forever.

```text
ClothingItem.personaStatus : PersonaStatus

FITTED                — has cutout + transform; renders on persona today
NOT_FITTED            — has cutout, never fitted; CAN be fitted later
INELIGIBLE_NO_CUTOUT  — original image kept; must be re-processed first
```

This answers all three questions the UI actually asks — *can it show on the
persona?* (`FITTED`), *why not?* (which of the other two), and *can the user
fix it later?* (`NOT_FITTED` → open fitting; `INELIGIBLE_NO_CUTOUT` → re-run
removal first) — in one column, and matches the entity's existing
`@Enumerated(EnumType.STRING)` style.

**Migration** — `V2__add_persona_status.sql`, additive and safe:

```sql
ALTER TABLE clothing_items
  ADD COLUMN persona_status varchar(255) NOT NULL DEFAULT 'FITTED';
```

Every existing row went through mandatory fitting, so `FITTED` is the
correct backfill.

## 7b — Categories ("Collections")

> ⚠️ **Naming collision.** `ClothingCategory` already exists as an enum
> (TOP/BOTTOM/SHOES/…). Introducing a second, unrelated "category" concept
> into the same codebase will cause permanent confusion. **Recommendation:
> name the new concept `Collection` in code** (entity `Collection`, table
> `collections`, `useCollectionStore`) while the UI copy still says
> "Categories". Listed as an open question because it affects UI wording.

```text
                    ┌──────────────┐
                    │  Collection  │  owner, name, createdAt
                    └──────┬───────┘
                           │
            ┌──────────────┴──────────────┐
            ▼                             ▼
   ┌──────────────────┐          ┌────────────────────┐
   │ collection_items │          │ collection_outfits │
   └────────┬─────────┘          └─────────┬──────────┘
            ▼                              ▼
      clothing_items                    outfits
```

Two explicit join tables rather than one polymorphic table — FK-enforced,
no discriminator hacks, and consistent with how `outfit_items` is already
modelled. A collection may hold a mix of loose items and whole outfits, and
may be empty.

**Migration** — `V3__add_collections.sql`: `collections`,
`collection_items`, `collection_outfits`, plus a unique index on
`(owner_user_id, lower(name))`.

### Files touched vs. created

```text
CREATE   backend/.../collection/{entity,repository,service,controller,dto}/*
CREATE   backend/.../common/enums/PersonaStatus.java
CREATE   backend/src/main/resources/db/migration/V2__*.sql, V3__*.sql
CREATE   frontend/src/api/collectionService.ts
CREATE   frontend/src/store/useCollectionStore.ts

TOUCH    backend/.../clothing/entity/ClothingItem.java        (+1 field)
TOUCH    backend/.../clothing/dto/ClothingRequest.java        (+1 field)
TOUCH    backend/.../clothing/dto/ClothingResponse.java       (+1 field — note
                                                               its 12-arg
                                                               positional ctor
                                                               and call site in
                                                               ClothingService)
TOUCH    frontend/src/types/index.ts                          (+enum, +field)
TOUCH    frontend/src/components/FittingTool/UploadFlow.tsx   (new choices)
```

### ⛔ Do NOT touch in this phase

`PersonaRenderer.tsx`, `PersonaLayer.tsx`, `CanvasUtils.ts`,
`FabricControls.ts`, `usePersonaStore.ts`, any canvas editor, or the
existing outfit contract. This phase is data + upload choices only.

### Tasks

- [x] **29** Add `PersonaStatus` enum + entity field + `V2` migration
- [x] **30** Thread `personaStatus` through clothing DTOs and service
- [x] **31** Add "skip persona" branch to `UploadFlow`
- [x] **32** Add "keep original background" branch to `UploadFlow`
- [x] **33** Create `Collection` entity, repository, service, `V3` migration
- [x] **34** Add collection REST endpoints + ownership checks (mirror outfit IDOR fix)

### 🏁 Definition of Done

```text
Item can be saved without fitting          ✅
Item can be saved without bg removal       ✅
Eligibility persisted + returned by API    ✅
Collections CRUD works, ownership enforced ✅
Existing items still render on persona     ✅
```

---

# 📋 PHASE 8 — FLAT OUTFIT BUILDER

**Goal:** Make item-first outfit assembly the primary experience; demote
persona rendering to an optional secondary view.

### Current vs. target

```text
CURRENT                              TARGET

login → DashboardPage                login → FlatOutfitBuilderPage
          ↓                                    ↓
   persona-centric sections          item list/grid, multi-select
          ↓                                    ↓
   /outfits/new = persona builder    [ Preview on persona ] ← optional,
   (category sidebar + mannequin)      eligible items only
```

### State design

The existing equip model (`usePersonaStore`: `topIds`, `bottomIds`,
`leftShoeId`, …) is **persona semantics** and must not be bent to serve a
flat builder — a flat selection is just an ordered set of item ids, and may
legitimately contain persona-ineligible items.

**Recommendation:** add a small `useOutfitDraftStore` holding
`selectedItemIds: number[]`, with pure adapters to/from the existing
`OutfitRequest.items[]` shape (slot derived from the item's category,
`itemOrder` = index). The persona *preview* projects that draft into
`PersonaState` through the **existing** `equippedFromOutfitItems`, filtered
to `personaStatus === FITTED`.

This adds a parallel, simpler model instead of rewriting the working one —
the persona path stays byte-identical when used.

### Files touched vs. created

```text
CREATE   frontend/src/pages/FlatOutfitBuilderPage.tsx
CREATE   frontend/src/store/useOutfitDraftStore.ts
CREATE   frontend/src/components/OutfitDraftBar.tsx   (selection summary/save)

TOUCH    frontend/src/App.tsx                  (routes + post-login landing)
TOUCH    frontend/src/pages/OutfitBuilderPage.tsx  (becomes the persona view,
                                                    reachable by toggle)
TOUCH    frontend/src/components/ClothingCard.tsx   (selection state + an
                                                    "not available on persona"
                                                    affordance)
```

### ⛔ Do NOT touch in this phase

`useOutfitStore.ts`'s existing conversion helpers (reuse them),
`usePersonaStore.ts`'s equip semantics, `PersonaRenderer`/`PersonaLayer`
rendering logic, or any Fabric editor.

### Tasks

- [x] **35** Create `useOutfitDraftStore` + pure draft↔`OutfitRequest` adapters
- [x] **36** Build `FlatOutfitBuilderPage` (browse + multi-select, no persona)
- [x] **37** Add save/update draft → backend outfit
- [x] **38** Add optional persona preview toggle (eligible items only)
- [ ] **39** Re-route post-login landing to the flat builder

### 🏁 Definition of Done

```text
Outfit can be built with zero fitting      ✅
Persona-ineligible items usable in outfits ✅
Persona preview still correct for eligible ✅
Existing saved outfits still load + edit   ✅
```

---

# 🗂️ PHASE 9 — CATEGORIES EXPERIENCE

*(Tasks renumbered 2026-09-01 from 40–43 to 48–51 — Phase 8.5, planned
later, already claimed 40–47 for the nav-fix/UX-pass work below, and
Tasks 40/47 there are already committed under those numbers. See Open
Question #20.)*

**Goal:** Surface collections in the UI — a management tab plus inline
"add to category" at the two points of creation.

```text
      ┌─────────── manage tab ───────────┐
      │  create / rename / delete / view │
      └──────────────┬───────────────────┘
                     │
       ┌─────────────┴─────────────┐
       ▼                           ▼
  upload flow                 outfit save
  "add to category            "add to category
   (existing or new)"          (existing or new)"
```

### Tasks

- [ ] **48** Create `useCollectionStore` + `collectionService`
- [ ] **49** Build categories management page (create/rename/delete/view)
- [ ] **50** Add inline "add to category (existing or new)" to `UploadFlow`
- [ ] **51** Add inline "add to category (existing or new)" to outfit save

### 🏁 Definition of Done

```text
Category can be created empty              ✅
Category holds mixed items + outfits       ✅
Inline creation works from both flows      ✅
Deleting a category never deletes contents ✅
```

---

# 🧵 PHASE 10 — PERSONA FITTING REPAIR & DEFORMATION

*(Tasks renumbered 2026-09-01 from 44–48 to 52–56, same reason as
Phase 9 above.)*

Two unrelated problems, planned as separate tracks.

## 10a — Crop/cut tool

> **Diagnosis (from code reading — needs live confirmation before fixing).**
> **Verdict: a pre-existing bug cluster plus a design limitation. NOT a
> regression** from Tasks 18–20 — the crop effect was untouched by all
> three, and Task 18 actually *removed* one failure mode (the load effect
> used to re-run on every resize event, calling `canvas.clear()` and
> destroying an in-progress crop box).

Defects found in `ClothingCanvas.tsx`:

1. **Stale closure.** The crop effect depends only on `[activeTool]`, but
   `updateCrop` closes over `transform`. Every crop-box drag writes
   `{...staleTransform, mask…}`, silently reverting any move/scale made
   since crop mode was entered.
2. **Mask does not follow the garment.** The clip rect is
   `absolutePositioned: true`, so moving a cropped garment slides it *under*
   a stationary window. This is most likely what "broken" feels like.
3. **No un-crop.** Once applied there is no UI to clear a mask —
   `CanvasToolbar` offers only `select` and `crop`.
4. **Race on entry.** Clicking Crop before the async garment load finishes
   hits `if (!garment) return;` and silently no-ops, leaving the toolbar
   lit with no crop box.
5. **Mask survives only via the live clipPath object.** `getVirtualTransform`
   zeroes all four mask fields unless `obj.clipPath.name === 'cropMask'`, so
   any path that rebuilds the garment without re-applying clipPath drops the
   crop.

> **Explicitly ruled out:** the apparent `toCanvasX` vs `toCanvasCoord`
> inconsistency for `maskLeft` (crop effect vs. load effect) is **not** a
> bug. With the enforced 3:4 aspect ratio (`w = 0.75h`),
> `toCanvasX(vx,w,h) = w/2 + (vx−375)·h/1000` reduces exactly to
> `vx·h/1000 = toCanvasCoord(vx,h)`. Cosmetically inconsistent, functionally
> identical — do not waste a task "fixing" it.

## 10b — Garment deformation

> **⚠️ Correction to a stated premise.** Jackets do **not** currently have
> warp capability. `fabric-warpvas@1.2.0` is installed and dynamically
> imported into a module-level `let FabricWarpvas` that is **never read**.
> `JacketCanvas` accepts an `isWarpMode` prop it never uses and builds a
> `warpvasInstances` Map it never reads. `JacketFittingEditor` calls
> `setIsWarpMode(false)` in two handlers but **no control ever sets it
> true**. All three appear in the TS6133 unused-variable list. This is
> abandoned scaffolding, not a feature — so "generalise the jacket warp"
> is not available as a starting point.

**The real architectural constraint:** persona rendering is **DOM/CSS**, not
canvas — `PersonaLayer` renders an `<img>` with CSS `transform` and
`clip-path`. A canvas mesh warp cannot be expressed in that renderer. So:

```text
(a) live mesh warp stored as control points, rendered in persona view
    → requires replacing PersonaLayer's CSS rendering with canvas/WebGL
    → large rewrite of working code            ❌ contradicts project rules

(b) bake-on-save: warp in the editor, export the warped PNG to Cloudinary,
    store as imageUrl; persona renderer completely unchanged
    → non-destructive if control points are stored alongside for re-editing
    → RECOMMENDED                              ✅

(c) do nothing; accept rigid transforms        (valid, defer)
```

### Task 52 — live reproduction results (2026-09-22)

Opened `FittingEditor` (via `ClosetPage`'s "Edit" -> "Open Studio") on a
real test item and worked through the crop tool live. One major defect
found that the earlier code-reading diagnosis didn't anticipate, plus
live corroboration for the documented ones where interaction allowed it.

**New finding, not in the original 5 - likely the primary reason the
tool "feels broken":** `ClothingCanvas`'s Fabric canvas renders
**completely blank** on every normal open - no mannequin, no garment,
nothing visible - until *something* fires a browser `resize` event.
Confirmed the exact mechanism, not just the symptom:
- `ClothingCanvas` calls `useFabricCanvas({ aspectRatio: ASPECT_RATIO,
  onResize: (size, canvas) => { canvas?.setDimensions(size); ... } })`
  *before* its own "Initialize Canvas" `useEffect` that actually
  constructs the Fabric `Canvas` instance. React runs effects in the
  order they're registered during render, so on first mount,
  `useFabricCanvas`'s own internal resize effect (registered earlier,
  since the hook is called first) fires its initial `updateSize()`
  *before* `fabricCanvasRef.current` has been set - so `onResize` runs
  with `canvas === null`, and `canvas?.setDimensions(size)` is a silent
  no-op. The Fabric `Canvas` is then constructed with no explicit
  width/height, so it keeps the HTML `<canvas>` element's built-in
  browser default: 300x150px. Nothing calls `setDimensions` again
  afterward unless the container's size genuinely changes and the
  `ResizeObserver` fires a second time - which a real user's browser
  essentially never does on its own.
- Verified live, both ways: confirmed the canvas DOM element measured
  exactly 300x150 (the browser's literal built-in default - not a
  coincidence) with nothing visible in it; then triggered a real window
  resize (not a synthetic event - an actual 1px viewport width change),
  which fixed it instantly - canvas resized to its correct ~490x660,
  mannequin and garment both rendered correctly. Reproduced this
  blank-then-fixed-by-resize sequence twice, consistently.
- This makes every one of the 5 originally-documented defects below
  harder to even notice/diagnose as a *user*, since most people would
  give up on an apparently-blank editor before ever reaching the crop
  tool itself - but it's a separate bug from all five, worth its own
  fix line rather than folding into Task 53.

**The 5 originally-documented defects, live-testing status:**
1. **Stale closure** - live evidence obtained, though not a clean
   isolated repro: with the canvas rendering correctly (post-resize-fix),
   entered crop mode, then dragged the crop box once. The sidebar's
   "Height" slider (`transform.height`, a garment property with nothing
   to do with the crop mask) changed from 450 to 300 as a direct result
   of that single crop-box drag - concrete live evidence that
   interacting with the crop box corrupts unrelated transform state,
   consistent with the diagnosed stale-closure mechanism (`updateCrop`
   spreading a `transform` object captured once at crop-mode-entry over
   whatever the live state currently is). Did not additionally isolate a
   clean "change rotation via the sidebar mid-crop, then drag, watch it
   revert" repro - the canvas's own size instability during testing (see
   below) made precisely targeting small Fabric resize handles
   unreliable enough that a negative result there wouldn't be meaningful.
2. **Mask doesn't follow the garment** - confirmed via code (the clip
   rect is `absolutePositioned: true` in both the crop effect and the
   load effect, in `ClothingCanvas.tsx`) but not independently isolated
   live this round - the same handle-targeting difficulty applied.
   High-confidence given the code is unambiguous and unchanged since the
   original diagnosis.
3. **No un-crop** - confirmed live: `CanvasToolbar` renders exactly two
   tool buttons, "Select" and "Crop & Mask" - no reset/clear affordance
   exists anywhere in the studio UI.
4. **Race on entry** - not independently reproduced this round (timing-
   dependent, and the canvas-blank bug above already produces a
   superficially similar "nothing happened" symptom that would need to
   be told apart from the real race condition first). Code-level logic
   (`if (!garment) return;` with no re-run when the garment finishes
   loading, since the effect only depends on `[activeTool]`) is
   unchanged from the original diagnosis.
5. **Mask survives only via the live clipPath object** - architectural,
   confirmed by re-reading `getVirtualTransform`; not independently
   live-tested this round.

**Open Question #11 answer:** based on the stale-closure evidence
obtained (a fresh crop-mode entry, immediately followed by one drag,
already corrupted unrelated state), this reads as broken for **new**
crops, not just on reopening an existing one - though a dedicated
reopen-an-existing-crop repro wasn't separately isolated this round.

**Also worth noting for Task 53's scope:** fixing the stale closure and
mask-follow defects without first fixing the canvas-sizing bug above
would leave the *default* experience unchanged (still blank until a
resize happens to fire) - recommend fixing the canvas sizing first (or
in the same pass), since it's what actually blocks a normal user from
reaching the crop tool at all, and it's a small, well-understood fix
(most likely: swap the two effects' registration order in
`ClothingCanvas.tsx`, or have `useFabricCanvas` call `onResize` again
once `fabricCanvasRef.current` becomes available, e.g. via its own
effect keyed off canvas creation instead of only off container resize).

### Task 53 — fixes implemented (2026-09-22, "go ahead and fix Task 53,
include the blank-canvas bug")

**Blank-canvas bug (shared across all three Fabric editors):**
`useFabricCanvas` now tracks the last computed size in a
`latestSizeRef`, kept up to date even before a Fabric `Canvas` exists,
and returns a new `setFabricCanvas(canvas)` function that callers use
in place of a direct `fabricCanvasRef.current = canvas` assignment -
it sets the ref *and* immediately re-applies the last known size via
the same `onResize` callback path, instead of only ever updating on a
container resize that may never come. Updated all three editors
(`ClothingCanvas.tsx`, `ShoeCanvas.tsx` - both had the exact same buggy
pattern; `JacketCanvas.tsx` - never actually affected, since it already
passes `width`/`height` straight to the `Canvas` constructor, updated
anyway for consistency with the shared hook's own intended usage).
Verified live, repeatedly, on fresh tabs and after a full dev-server
restart (to rule out any HMR/stale-module explanation): the canvas now
renders at its correct size (e.g. 384x512, matching the enforced 3:4
aspect ratio) with the mannequin and garment both visible on the very
first open, no resize needed, no console errors.

**Stale closure:** added `transformRef` (written on every render, not
inside an effect), and swapped every `...transform` spread inside a
closure that doesn't re-run when `transform` changes for
`...transformRef.current` - both in `updateCrop` (the originally-
diagnosed case) and in `handleModified` (registered once with `[]`
deps in the "Initialize Canvas" effect, fires on every direct garment
drag/scale/rotate on canvas - the *same* class of bug, just not
flagged in the original 5-defect list, since it doesn't corrupt mask
fields specifically - `getVirtualTransform` already re-derives those
live from the canvas - but would silently drop any other field, like a
hypothetical future `zIndex`/`openness` control, changed between mount
and a drag). Verified live: entered crop mode, changed rotation via the
sidebar slider to 45, dragged the crop box - rotation stayed at 45
(previously reverted to 0).

**Mask-follows-garment - two directions, not one:** the first pass
only fixed the React-state-pushes-a-position-onto-canvas direction (in
the "Sync Transform updates from props" effect) - by shifting the
clip's `left`/`top` by the same delta the garment is about to move,
computed against the garment's *previous* canvas position, then
persisting the shift back to `transform.maskLeft/maskTop` so it isn't
lost on save/reload. Live testing then showed this doesn't cover the
*actual* common case at all: there's no X/Y position slider anywhere in
`TransformPanel`, so a user can only ever move a garment by dragging it
directly on canvas - which goes through `handleModified`
(canvas-drag-pushes-a-position-into-React-state), the opposite
direction, never touched by the first pass. Added the same delta-shift
logic there too, comparing against a new shared `lastGarmentPosRef`
(also written by the "Sync Transform" effect, so neither direction
computes a delta against data the other direction just made stale) -
this is what actually moves the clip in real time *during* a drag,
before `handleModified` even reports the new position back to React.
Verified live with a real pre-cropped test item (mask smaller than the
garment, off-center): dragged the garment on canvas, and the visible
crop content - the same two flower blooms, same relative position
within the frame - moved together with it as a unit, rather than the
crop window staying put while a different part of the photo slid
underneath. Rotation remains a known, documented gap (an
absolutely-positioned axis-aligned clip can translate and resize with
the object but can't rotate with it without being re-expressed in the
garment's own local coordinate space) - out of scope for this pass,
translation was the specifically reported symptom.

**Found in passing during this round's live testing, NOT fixed - a
new, separate issue flagged for a future task, not expanded into
here per the user's specific request scope:** during crop mode,
`garment.set({ selectable: false })` does not reliably prevent the
garment from becoming the active object and receiving drag events.
Reproduced repeatedly, including with zero `resize_window` calls in
the test sequence (ruling out the canvas-resize-mid-crop theory as the
sole cause) and via direct instrumentation (`canvas.getActiveObject()`
genuinely returns the garment, not the crop box, immediately after a
drag that visually looked like it was on the crop box). Practical
effect: a user who thinks they're resizing/moving the crop window
during crop mode may actually be dragging the garment underneath it
instead - a plausible real contributor to the tool "feeling broken,"
separate from all three fixes above. Root cause not yet isolated
(current leading theory: `canvas.setActiveObject(cropBox)` not
reliably holding once the crop box's own bounds are hit near an edge,
but this needs dedicated investigation, not a guess baked into this
commit).

**Verification:** `tsc -b --force` + `vite build` clean after every
change, including the final pass. Live-tested all three fixes on fresh
browser tabs after a full dev-server restart. Test items created for
verification (a plain item for the blank-canvas/stale-closure checks,
a second item created directly via the API with a pre-existing
off-center mask for the mask-follow check) were deleted after,
confirmed empty on re-fetch.

### Task 53 follow-up — Crop & Mask button did nothing (2026-09-22)

User report: "when I click crop and mask it does nothing." Reproduced
live - clicking the toolbar button visibly toggled active state (the
button itself is styled purely off `FittingEditor`'s own `activeTool`
state), but nothing happened on canvas. Root cause, confirmed via a
temporary `window.__debugCanvas` exposure and direct queries against
the live Fabric canvas: `FittingEditor.tsx`'s render of `<ClothingCanvas>`
never actually passed its `activeTool` state down as a prop - the call
only passed `imageUrl`/`category`/`personaType`/`transform`/
`onTransformChange`/`onCanvasReady`. Since `ClothingCanvas`'s own
`activeTool` prop defaults to `'select'`, it silently never saw the
toolbar's `'crop'` value, so the "Handle Tool Changes (Crop)" effect
(which adds the `cropBox` and locks the garment) never ran - confirmed
directly: canvas objects stayed `[mannequin, garment]` with
`garment.selectable: true` and the active object still `garment` after
clicking the button. This is a separate bug from all three fixed above
- a missing one-line prop wire, most likely present since the crop tool
was first built, not something the other fixes touched.
(`JacketFittingEditor`/`ShoeFittingEditor` don't have a crop tool at
all, so they're unaffected.)

**Fix:** `FittingEditor.tsx` now passes `activeTool={activeTool}` to
`<ClothingCanvas>`.

**Verified live:** fresh tab, real click sequence (Edit garment → Open
Studio → Crop & Mask) - the crop box now appears with handles,
drag-resizing it live-updates the mask, and switching back to Select
shows the garment correctly clipped to the new bounds. `tsc -b --force`
+ `vite build` clean. Test item deleted after, confirmed via API.

### Task 54 — un-crop / reset affordance (2026-09-22)

Added a "Reset Crop" button to `CanvasToolbar` (new `hasMask`/`onResetCrop`
props), shown only when the current item actually has a mask
(`hasMask={!!transform.maskWidth}` in `FittingEditor`). `handleResetCrop`
(in `FittingEditor`, using the `fabricCanvasRef` it already holds via
`onCanvasReady`) clears the garment's live `clipPath`, removes any
in-progress `cropBox`, clears the four mask fields in `transform` state,
and exits crop mode back to Select if it was active.

**Also verified, per this round's explicit request, that a crop renders
correctly in both places it's used** (not just assumed from the code):
created a test item, centered it on the mannequin, cropped it down to
roughly half its content via the crop box, and confirmed the *same*
visible content (not distorted, not offset, not showing the wrong half)
appeared both in the Fabric Studio editor and in the Attire builder's
"Preview on Persona" view after saving - screenshots matched. Re-checked
the `toCanvasX`/`toCanvasCoord` (and `toVirtualX`/`toVirtualCoord`)
"inconsistency" already flagged as cosmetic-only in this doc's 10a
diagnosis - confirmed algebraically again here (both reduce to the same
formula under the enforced 3:4 aspect ratio) and now also empirically
via this live persona-render check. Clicked Reset Crop, confirmed the
full uncropped image reappeared in the editor, saved, and confirmed the
persona view also reverted to the full image and the mask fields came
back `null` from the API.

(Note: `computer`-tool coordinate clicks intermittently missed this
button in the emulated-viewport browser pane during testing - a repeat
of a known session-wide coordinate-scaling quirk, not an app bug;
confirmed by dispatching a real `.click()` via JS on the actual button
element, which worked every time.)

`tsc -b --force` + `vite build` clean. Test item deleted after.

### Task 54 correction — two real crop bugs the first verification missed (2026-09-22)

User reported, after the above: "crop image on the preview doesnt look
crop and on persona preview most of the image disappears." The first
verification pass's test crop happened to be forgiving enough (a
roughly-symmetric half-crop of a centered image) that both bugs below
were present but not visually obvious in a screenshot - a reminder that
"the screenshot looks plausible" isn't the same as "the numbers are
correct." Found both by re-testing with `toDataURL`/pixel sampling and
by checking the saved API values against the display math by hand,
after the emulated browser-pane screenshot tool turned out to be
returning stale frames mid-investigation (confirmed via `canvas.
toDataURL()` sampling the real current pixels against a screenshot that
still showed old content).

**Bug 1 - crop didn't rescale with the garment (`ClothingCanvas.tsx`).**
The crop mask's `clipPath` is `absolutePositioned: true` (canvas-space).
Task 53's mask-follow fix made it track the garment's *position*
(translate delta), but never its *size* - resizing the garment after
cropping (sidebar width/height sliders, or a direct corner-handle drag
on canvas) left the clip at its old absolute size/position while the
image grew or shrank around it, so the crop window ended up covering a
wrong, mismatched fraction of the resized image. Reproduced live:
cropped to the right half of a test image (clip ~127px wide out of a
~249px-wide garment), then increasing the width via the slider to ~387px
- the clip's raw width/height never changed, confirmed via direct
Fabric inspection. Fixed in both directions (matching the existing
translate-delta pattern): `handleModified` (direct canvas drag/resize)
and the "Sync Transform updates from props" effect (slider-driven
resize) now compute a scale ratio alongside the existing position delta
and resize the clip's `width`/`height` by that ratio, anchored on the
garment's own center - verified the ratio matches exactly (clip and
garment both grew by 1.5556x) and that `getVirtualTransform`'s mask
extraction (which reads `clipPath.width`/`height` directly, not
`getScaledWidth()`) stays correct by resizing via raw width/height, not
`scaleX`/`scaleY`.

**Bug 2 - `maskLeft`/`maskTop` used as edges when they're centers
(`PersonaLayer.tsx`).** `clipPath.left`/`.top` (and everything derived
from them - `maskLeft`/`maskTop`) are Fabric center coordinates
(`originX/Y: 'center'`, the same convention `transform.x`/`y` already
use), but `PersonaLayer`'s clip-path inset math used them directly as
if they were the crop's left/top edge, without subtracting half the
mask's own width/height first. This silently shifted every computed
inset by `maskWidth/2` / `maskHeight/2` - concretely, on the same
right-half test crop, the buggy math computed the crop's right edge as
~180 virtual units past the garment's own right edge (clamped to a
flush-right 0% inset) when the real Fabric geometry only overshoots by
~3 units; the *left* inset came out ~75% instead of the correct ~50%,
so the persona rendered a much narrower, wrongly-positioned sliver of
the image than what the editor actually showed. This is a pre-existing
bug, unrelated to Task 53/Bug 1 above, and was silently wrong for every
cropped item previously verified in this doc, including Task 54's first
pass - the earlier "screenshots matched" check just didn't happen to
expose it clearly, since a same-ish-size, roughly-centered crop still
looks superficially plausible even a couple dozen percent off. Fixed by
computing true left/top/right/bottom edges from the center + full
width/height before taking the inset percentages.

**Re-verified together:** cropped a fresh test item to its right half,
resized it via the width slider (exercising both bugs at once),
confirmed via direct Fabric inspection that the clip's size tracked the
resize exactly, confirmed via `toDataURL` pixel sampling that the
editor canvas shows real, varied flower/foliage colors across the
correct span (not a solid block or the wrong region), saved, and
confirmed via the persona view's actual computed `clipPath` CSS
(`inset(0% 0% 0% 49.6%)` - a sane, expected "roughly right half" value)
and a live screenshot that the persona now shows a full, coherent chunk
of the flower, not a sliver. `tsc -b --force` + `vite build` clean.
Test item and test account deleted/deactivated after.

### Task 54 follow-up - crop shows in flat thumbnails too (2026-09-22)

User: "make it so the crop version appears in the preview image." Every
plain `<img src={item.imageUrl}>` thumbnail (Closet grid cards, Attire
builder's browse/selection cards, item detail modals, category
add-item pickers, outfit flat-grid previews, the showcase page) always
showed the full original photo - none of them looked at
`transform.mask*` at all, only `PersonaLayer` (the actual persona-worn
render) did.

Added `frontend/src/utils/cropDisplay.ts` (`getCropBackgroundStyle`)
and `frontend/src/components/CroppedThumbnail.tsx`, a drop-in
replacement for `<img className="... object-cover/contain">`. Renders a
`background-image` div instead of an `<img>` - `background-size`/
`background-position` (not `object-fit`/`object-position`, which can't
target an arbitrary sub-region) is what lets it crop-to-a-region
regardless of the container's own aspect ratio: scale the whole image
up so the crop region alone fills 100% of the box
(`background-size: {100/fractionWidth}% {100/fractionHeight}%`), then
position it so that region's own top-left lands at the box's origin
(`background-position: {fractionLeft/(1-fractionWidth)*100}% ...`) -
the standard CSS "crop to sub-region via background" technique, derived
and verified by hand against a known crop (right-half test item),
matched the JS-computed values exactly (`200% 100%` /
`100% 50%`). Falls back to a plain `background-size: cover|contain`
(matching whatever `object-fit` the call site used before) when an item
has no mask, so uncropped items - the majority - render identically to
before.

Wired into every call site that has a full `ClothingItem` (and
therefore `.transform`) available: `ClothingCard.tsx`,
`FlatOutfitBuilderPage.tsx` (both the selection strip and the browse
grid), `ClothingDetailsModal.tsx`, `CategoryDetailPage.tsx`'s add-item
picker, `OutfitCard.tsx`'s flat-grid fallback, `OutfitBuilderPage.tsx`,
and `OutfitShowcasePage.tsx` (both the full-pieces row and the
side/off-screen outfit mini-grid - the row explicitly passes
`fit="contain"` to preserve its original letterboxed-whole-item look
for uncropped items). Deliberately left untouched: `CategoryDetailPage.tsx`'s
collection-item and `OutfitPreviewThumb`'s outfit-item thumbnails, and
`OutfitShowcasePage.tsx`'s slim outfit-item rows - these use
`CollectionItem`/`OutfitItem`, DTOs that don't carry `transform` at
all; adding it would mean widening those API responses, a separate,
bigger change not asked for here.

Verified live: created a test item via the API with a known right-half
mask (`x:375, width:450, maskLeft:487.5, maskWidth:225` - virtual-space
values matching an actual in-editor crop), confirmed the rendered
thumbnail's computed `background-size`/`background-position`
(`200% 100%` / `100% 50%`) matched the hand-derived expected values
exactly, and confirmed visually via screenshot that the Closet card
shows a zoomed-in view of just the right-half flower, not the full
two-flower photo. `tsc -b --force` + `vite build` clean. Test item
deleted, test account deactivated after.

**Correction - stretching (2026-09-22, same day):** user: "make it look
like center and good not like all strech out." The first version scaled
`background-size` X and Y *independently* (`100/fractionWidth% ×
100/fractionHeight%`) so the crop exactly filled the box on both axes -
only distortion-free by coincidence in the first test, since that crop's
225x300 region happened to already be a 3:4 aspect matching the card.
Any crop whose own aspect ratio doesn't match the container (the normal
case) stretched visibly. Rewrote `getCropBackgroundStyle` to use a single
*uniform* scale, `s = max(1/fractionWidth, 1/fractionHeight)` - the same
"smallest zoom that still covers both axes" rule `object-fit: cover`
itself uses - and a corresponding centering formula
(`(0.5 - centerFraction*s) / (1-s) * 100`) so the crop's own center lands
in the middle of the box, on whichever axis wasn't the limiting one some
of the crop's own edge is now consequently cropped further, the same
trade-off `cover` always makes, rather than stretching. Re-verified with
a deliberately mismatched-aspect test crop (full width, only the middle
1/3 of the height - about as different from a 3:4 card as a crop gets):
computed style came out `background-size: 300% 300%` (uniform),
`background-position: 50% 50%` (centered), and the resulting screenshot
showed a normally-proportioned zoomed photo - round flower petals, not
elongated - confirming no distortion. `tsc -b --force` + `vite build`
clean. Test item deleted, test account deactivated after.

**Second correction - fill vs contain (2026-09-23):** user (with a
screenshot of their real closet): the cropped item "takes the whole
space ... make it look like the other garments look." Two problems with
the version above: (1) it was still a cover-style fill, so a tightly
cropped garment ate the entire card instead of sitting centered with
breathing room like every other (transparent-margin) cutout; (2) worse,
`background-size: S% S%` with equal percentages renders the image at the
*box's* aspect ratio, not its own, so it was actually still distorting
whenever box and image aspect differed (only "looked" round on the
sample photo). Fixed both by changing the model: `getCropDisplay` now
returns the crop's own aspect ratio (`maskWidth/maskHeight`) plus the
exact-fit `background-size`/`position` for a box of *that* ratio (the
original edge-anchored formula, which is distortion-free precisely when
the box matches the crop's proportions), and `CroppedThumbnail` draws
that inner box sized to *contain* itself within the card at 90%
(`min(90cqw, 90cqh * ratio)`, container-query units on a
`container-type: size` wrapper - no JS measuring), centered. Uncropped
items are untouched. Verified live: two crops of different proportions
(half-width and a tall slim slice) render as centered, padded,
undistorted pictures inside the same-size cards as an uncropped item,
in both the Closet grid and the Attire browse grid + selection strip
(measured inner boxes ~90% of the card, no collapsed/zero-size cases).

**Not reproduced:** user also reported a blank screen while waiting for
background removal. Walked the upload flow live (TOP path, and the SHOES
pair path incl. the Cloudinary upload step): the PROCESSING step showed
the spinner and live status text ("Analyzing garment...", "Removing
background (Browser): N%", "Uploading left shoe...") the whole way and
advanced to the preview/studio step normally - nothing in this session
touched UploadFlow. Needs the exact screen/category/steps from the user.

### Crop-mode drag bug fixed (2026-09-23)

Closes the "garment becomes the active object during crop mode" issue
flagged (and left unfixed) in Task 53, plus 10a defect #4 (race on
entry). Root cause, confirmed in code and live: the crop-mode setup only
ran when `activeTool` changed, but the "Load Mannequin and Garment"
effect (re-runs on any `canvasSize`/image change - including the
canvas going from ~2x3px to its real size as the studio modal animates
in, and any later container resize) does `canvas.clear()` and then
unconditionally `setActiveObject(garment)`. That silently wiped the crop
box and returned the garment as the selectable, draggable active object
while the toolbar still read "Crop & Mask" - so a drag meant for the
crop box moved the garment. Clicking Crop before the async garment load
finished hit the old `if (!garment) return` for the same reason.
(`selectable: false` alone was also never enough - a non-selectable
object still receives pointer events.)

Fix in `ClothingCanvas.tsx`: the tool setup became one function,
`applyToolMode()`, reading only refs (new `activeToolRef`, existing
`transformRef`), called from both the `[activeTool]` effect and right
after the garment loads, so the active tool is re-applied on every
reload. In crop mode the garment is now `selectable: false, evented:
false` (fully inert), restored on leaving crop mode; and a
`selection:cleared` handler re-activates the crop box if an empty-canvas
click would otherwise drop its handles.

Verified live (against a real item, `window` debug hook removed
afterward): entered crop mode then forced a real container resize -
canvas reloaded 375x500 -> 300x400 and the crop box, locked garment and
lit toolbar all survived (previously: box gone, garment active); a
mouse drag started on the garment outside the crop box moved nothing
and left the crop box active; dragging the crop box itself moved it and
applied the mask without touching the garment; Select mode still lets
the garment be dragged and removes the crop box; clicking Crop while the
canvas was still empty (before the garment loaded) ended with the crop
box up and the garment locked. `tsc -b --force` + `vite build` clean.
Test item deleted, test account deactivated.

### Task 55 - remove dead warp scaffolding (2026-09-23)

Checked first, as the task said ("if not already done in Task 26"): Task
26 already deleted all the *source* scaffolding (`FabricWarpvas` dynamic
import, `isWarpMode` prop/ref/state, `warpvasInstances`) - a grep of
`frontend/src` for `warp`/`Warpvas` finds nothing. What remained was the
dependency itself: `fabric-warpvas@1.2.0` in `frontend/package.json`
(plus `warpvas` and `warpvas-perspective` pulled in transitively in the
lockfile), imported nowhere. Removed it with
`npm uninstall fabric-warpvas --legacy-peer-deps` (57 lines out of the
lockfile, 1 out of `package.json`).

Side benefit, confirmed: the "plain `npm install` fails on an older,
unrelated conflict (`fabric-warpvas` wants fabric 6, project is on 7)"
gotcha recorded under the onnxruntime-web fix no longer applies - a plain
`npm install` now completes with exit 0 and no `--legacy-peer-deps`
needed. Also removed the stale line in `frontend/FRONTEND_CHANGES.md`
claiming "Mesh Warping (Puppet Warp): Integrated `fabric-warpvas`..." - a
feature that was never built (per the 10b diagnosis above). Note for
Task 56: `fabric-warpvas` was not a viable starting point anyway (fabric
6 only, project is on 7), so a bake-on-save prototype will need its own
approach.

`tsc -b --force` + `vite build` clean.

### Task 56 - bake-on-save mesh warp prototype (2026-09-23)

Chosen approach (10b option b, agreed with the user): a 3x3 control-point
mesh warp on **tops**, baked into a new PNG on save, original + control
points kept for re-editing/undo, stored in the item's existing
`modularData` string (no DB migration for the prototype - `modular_data`
is unbounded `TEXT`, and `PersonaRenderer` only parses it when
`isModular` is true, so it can't collide with the jacket data; warp is
only offered when the item isn't modular).

**How it works**
- `utils/meshWarp.ts`: the 9 points (source-pixel space) define a smooth
  surface (biquadratic Lagrange through them - identity when at their
  default grid positions); the image is drawn onto it as ~2x32x32
  textured triangles via per-triangle affine transforms on a plain 2D
  canvas (own code, no dependency - `fabric-warpvas` was Fabric-6-only).
  `bakeWarp` renders at 1 source px = 1 output px into the warped
  surface's bounding box and returns a PNG blob + the box's center shift.
  `retargetTransform` keeps the garment looking the same size/position
  when its image's pixel size changes (scales virtual width/height by
  the same ratio, moves x/y by the image-center shift rotated into the
  garment's frame) and drops the crop mask (framed against the old
  image).
- `components/editor/WarpPanel.tsx`: overlay over the canvas with the
  live-warped preview, the control net, 9 draggable handles (Pointer
  Events), Reset Points / Cancel / Apply Warp. Always warps from the
  ORIGINAL image, never a previously baked one.
- `FittingEditor.tsx`: `Warp` toolbar tool (`allowWarp`, tops only) and
  `Restore Original` (when the item has a warp). Apply: bake -> upload the
  blob via `cloudinaryService` -> swap the canvas's image to the baked URL
  and retarget the transform. On save it passes `imageUrl` (baked) and
  `modularData` (warp record, `''` to clear) only if the warp changed;
  `EditClothingModal` and `UploadFlow.handleSave` forward them.
  `utils/warpData.ts` defines/parses the record (original URL + size,
  points, baked size, center shift).
- Persona view, thumbnails, outfits: **untouched** - they just see an
  ordinary image URL, which is the point of baking.

**Verified live** (test top + test bottom, real Cloudinary upload):
Warp button shows for a top, not a bottom. Dragged three points (corner
up/out, hem sag, side bulge) - live preview bent smoothly; Apply baked and
uploaded in ~2.5s; the canvas showed the curved garment with transparent
corners and a selection box fitting the new bounds. Saved: `imageUrl` = new
Cloudinary PNG, `modularData` = warp record, transform width/height scaled
1.26x/1.39x with a small center shift, crop cleared. Persona preview shows
the warped garment correctly with no persona-renderer change. Reopening
the item: `Restore Original` present, Warp panel starts from the original
864x576 image. Restore + save: `imageUrl` back to the original,
`modularData` `''`, transform back to exactly x 375 / y 400 / 450 x 300.
Math check: an identity warp bakes to the same size with zero shift and
mean pixel difference 0.06/255 (max 3). That check first exposed
hairline seams (16k interior pixels at alpha 192-249, from adjacent
anti-aliased triangle clips only ~touching); fixed by growing each clip
triangle 2px (0 interior gaps on identity; 309 stray pixels of ~613k opaque
on a strongly curved warp). `tsc -b --force` + `vite build` clean. Test
items deleted, account deactivated.

**Follow-up - warp in context on the persona (2026-09-24):** user liked
the warp but wanted the persona visible while warping so the fit is
judged where it counts. `WarpPanel` now draws a stage with the same 3:4
shape as the studio canvas: the mannequin (same base image, scaled to the
stage height, centered) with the garment drawn on top at its actual studio
placement - center (`x`,`y`), width/height, rotation, flips, opacity - so
you drag the 9 points directly on the persona. To support that,
`meshWarp.ts` replaced its scale/offset "view" with a full 2x3 affine
(`Affine`, `applyAffine`, `invertAffine`); `WarpPanel` builds the
source-px -> stage-px matrix from the transform (for an already-warped
item the transform describes the *baked* image, so the image is anchored
at the original's center plus the stored shift), and pointer drags are
mapped back through the inverse. The stage sizes itself to the room the
panel has (ResizeObserver, 300-760px tall). `FittingEditor` now passes
`warp`, `personaType` and `transform` to the panel (replacing
`initialGrid`).

Verified live: garment lands on the stage at exactly the studio's
position/size (centered, 33% down, 32.5% x 21.6% of the stage height vs
the expected 33% x 22%); dragged five points on the persona (shoulders
out, waist in, hem sag) - the reshape reads correctly against the body;
after Apply the studio's garment footprint matches the stage's (rows
18-48% / cols 23-77% of the studio canvas vs the computed 19-47% /
24-76%); reopening the warp panel on the now-baked item reproduced the
pre-apply stage footprint exactly, confirming the anchor/shift math for
re-editing. (A first bbox comparison looked off by ~6% at the top edge -
that was a few of the mannequin's own saturated pixels near the head
polluting the measurement, not garment; found by dumping per-row pixel
counts.) `tsc -b --force` + `vite build` clean. Test item/account cleaned
up.

**Follow-up - handles vanishing at the stage edges (2026-09-24):** user:
moving the garment to the top/bottom makes the resize handles disappear,
and the same happened to warp points. Cause (same for both): a canvas can
only draw inside its own element, and handles sit outside the thing they
belong to (Fabric's corner handles ~16px out with the 10px object padding
+ 12px handle; the rotate handle 40px further up; warp handle circles are
centered *on* a point that can sit exactly on the stage edge), so anything
at the edge was cut off.
- **Studio (`ClothingCanvas`):** the Fabric canvas is now `CANVAS_PAD`
  (36px, in `CanvasUtils`) bigger on every side with
  `setViewportTransform([1,0,0,1,PAD,PAD])`, so scene coordinates are
  still stage-based. All the places that read `canvas.getWidth()/
  getHeight()` as "the stage" now use `stageWidth()/stageHeight()`
  (canvas minus the margin); the mannequin is centered on the stage
  explicitly (`centerObject` would center on the padded canvas); the
  render is an outer padded box (`overflow-hidden`) around an inner
  `containerRef` box that the stage is fitted to, so the padded canvas
  overflows the inner box by exactly the margin. The rotate handle's
  offset went from -40 to -20 (`FabricControls.ts`, global) so it fits
  the margin. Cost: the stage is ~72px shorter than before (the margin has
  to come out of the same vertical space). `exportCanvasToImage` takes an
  optional region so "Capture Preview" still exports just the stage.
- **Warp stage (`WarpPanel`):** canvas is `EDGE_PAD` (17px) larger than the
  stage; everything is drawn through the matrix with the margin folded in,
  pointers are mapped minus the margin, and the stage's bounds get a faint
  outline.
Verified live: garments placed with their top edge above the stage (y=90,
top at -20) and bottom edge below it (y=910): top corner-handle pixels
draw in the margin rows above the stage edge (rows 15-27 of the canvas,
which didn't exist before) and at the bottom down to row ~730 of 746;
grabbing the top corner handle *in the margin* and dragging it resized the
garment (330x220 -> 369x246); warp points dragged to the extreme
top-left/bottom-right (clamped to the stage corners) draw as whole circles
(188 white pixels vs 201 for a full circle). First "Capture Preview" pass
exported the right size but with the persona shifted 36px - the crop
region is in canvas pixels, not scene coordinates; fixed (persona center
at 0.495/0.493 of the export width, spanning the full height). Not
changed: the rotate handle still clips if the garment's *top edge* itself
is above the stage (it needs ~36px above the object). (The shoe and jacket
studios were fixed in the next follow-up, below.) `tsc -b --force` +
`vite build` clean; test items/account cleaned up.

**Follow-up - same fix for the shoe and jacket studios (2026-09-24):**
`ShoeCanvas` (shoes sit near y=940 of 1000, so bottom handles were the
classic victim) and `JacketCanvas` had the identical clipping. The
`ClothingCanvas` helpers moved into `CanvasUtils` so all three share them:
`stageWidth`/`stageHeight` (canvas minus the margin), `applyStagePadding`
(size + viewport shift, used as `ShoeCanvas`'s resize handler and by
`ClothingCanvas`) and `centerOnStage`. `ShoeCanvas`: padded via
`applyStagePadding`, every canvas-size read switched to the stage size,
mannequin centered on the stage, outer padded box + inner `containerRef`
box. `JacketCanvas` recreates its canvas whenever the size changes, so the
padding goes in the constructor (`width/height + 2*CANVAS_PAD` +
`setViewportTransform`), plus the same size-read swaps, `centerOnStage`
and container split; `JacketFittingEditor`'s transparent preview export now
crops to the stage like Capture Preview does.
Verified live through the real upload flow: **shoe studio** - canvas is
stage + margin (stage ratio 0.751), persona centered, handles drawn up to
12px below the stage bottom into the margin (previously cut at the
stage edge), dragging a shoe moves it through the shifted viewport;
**jacket studio** (real segmentation run) - stage ratio 0.749, persona
centered (x-center 0.499) with its figure rows matching the persona image's
own opaque extent scaled to the stage exactly (predicted rows 46-640,
observed bottom row 640), and the selected segment's rotate handle drawn in
the top margin. `tsc -b --force` + `vite build` clean. Test account
deactivated. The upload flow's own Cloudinary uploads (shoe / cleaned
jacket image) from this verification remain in the account's
`digital-closet` folder.

**Known prototype limits / decisions for later**
- Tops only; jacket sleeves, pants, dresses not wired (no code blocks
  them - `allowWarp` is the gate).
- Applying a warp clears any crop; warping and cropping don't compose.
- Each Apply uploads a new PNG; superseded/undone bakes stay in Cloudinary
  (unsigned uploads can't delete) - including the one test bake from
  this session's verification, in the account's `digital-closet` folder.
- Storing the warp in `modularData` is a shortcut; if this graduates from
  prototype it wants real columns (`original_image_url`, `warp_points`) via
  a Flyway migration.
- 3x3 gives one smooth bend per axis; a 4x4 grid (or per-region control)
  would allow S-curves.
- Cropped thumbnails on a warped item use the crop-less fallback (crop is
  cleared on warp, so none applies).

### Tasks

- [x] **52** Reproduce + confirm crop tool defects live; report before fixing
- [x] **53** Fix crop stale closure + mask-follows-garment (+ the
      blank-canvas bug found in Task 52, per explicit request)
- [x] **54** Add un-crop / reset affordance to `CanvasToolbar` (+ verified
      cropped output renders correctly in-editor and on persona; + fixed
      two real bugs found while verifying - clip not rescaling with the
      garment, and PersonaLayer's center/edge coordinate bug; + flat
      browse/card thumbnails now also show the cropped region instead of
      the full original photo)
- [x] **55** Remove dead warp scaffolding (source was already gone in
      Task 26; removed the leftover `fabric-warpvas` dependency)
- [x] **56** Prototype bake-on-save deformation for one garment type
      (3x3 mesh warp on tops, baked to PNG, original + points kept in
      `modularData`)

### 🏁 Definition of Done

```text
Crop survives moving the garment            ✅
Crop can be cleared                         ✅
Deformation approach proven on one type     ✅
PersonaLayer rendering NOT rewritten        ✅
```

---

# 📚 PHASE 11 — DOCUMENTATION & CODE COMMENTARY

*(Tasks renumbered 2026-09-01 from 49–50 to 57–58, same reason as
Phase 9/10 above.)*

**Goal:** After the pivot has settled, document what the codebase became.

### Tasks

- [ ] **57** Comment the codebase thoroughly (per-file, per-function)
- [ ] **58** Write `PROJECT_STRUCTURE.md` — every file/module, its purpose,
      and how the project is organised

### 🏁 Definition of Done

```text
Every module has a purpose comment          ✅
PROJECT_STRUCTURE.md covers all directories ✅
New contributor can orient without asking   ✅
```

---

# ❓ OPEN QUESTIONS — DECIDE BEFORE IMPLEMENTING

These are genuine forks where the wrong assumption is expensive. Grouped by
the phase they block.

### Blocking Phase 7 (data model)

1. ✅ **Naming — RESOLVED 2026-09-01.** `Collection` in code (entity,
   table `collections`, `useCollectionStore`); UI copy stays "Categories".
2. ✅ **Scope — RESOLVED 2026-09-01.** Private per user only for now; no
   `visibility`/`shared_with` column in `V3`. Sharing is an additive
   schema change later if ever needed, not a rewrite.
3. ✅ **Multi-membership — RESOLVED 2026-09-01.** Yes, one item/outfit
   may belong to several collections — confirms the planned join-table
   design (`collection_items`/`collection_outfits`) rather than a direct
   `collection_id` column.
4. **`personaType` on skip-persona items.** It is currently `NOT NULL` on
   both entity and DB. An item that will never touch a persona still has to
   declare MALE/FEMALE. Keep requiring it, or make it nullable?
5. **Eligibility representation.** Confirm the single `PersonaStatus` enum
   over two booleans.

### Blocking Phase 8 (flat builder)

6. ✅ **`Outfit.avatarType` — RESOLVED (Task 37).** Defaulted to the
   user's current persona, read-only from `usePersonaStore`, no migration.
7. ✅ **Mixed-persona outfits — RESOLVED (Task 36/38).** Selection allows
   mixing (Task 36); the preview can't render true mixed-persona (a
   `PersonaRenderer` constraint), so excluded items are counted and
   explained rather than silently dropped (Task 38).
8. ✅ **Landing page — RESOLVED 2026-09-01 (Task 39).** Flat builder for
   everyone post-login. `DashboardPage` stays reachable at a new
   `/dashboard` route rather than being deleted or made unreachable.

### Blocking Phase 9 (categories)

9. **Deleting a collection** — remove membership only, never the contents?
   *(Recommend: membership only.)*
10. **Soft-deleted items inside collections/outfits.** Items are soft-deleted
    (`is_active`), and `outfit_items` FKs to `clothing_items`. Confirm what
    a collection/outfit should show when a member item is deactivated.

### Blocking Phase 10 (fitting)

11. ✅ **Crop repro — RESOLVED (Task 52, 2026-09-22).** Broken for *new*
    crops (live evidence: a fresh crop-mode entry followed by a single
    drag already corrupted unrelated transform state) - see Task 52's
    write-up under 10a for the full live-testing results, including a
    newly-found sixth defect (the canvas renders blank until a window
    resize fires) that's likely the primary reason the tool feels broken
    at all.
12. **Deformation approach.** Confirm bake-on-save (b) over a persona
    renderer rewrite (a).

### Cross-cutting

13. **Eligibility downgrade.** If an item is marked persona-ineligible *after*
    being used in a persona-rendered outfit, what happens to that outfit —
    silently drop the item from the persona view, warn, or block the
    downgrade? *(Raised directly; genuinely undecided.)*
14. **Upgrade path.** Can a user later "promote" an ineligible item —
    re-run background removal, then fit it? If so it needs its own entry
    point, which no current screen provides.
15. **Docs timing.** Phase 11 currently runs after deployment. Would
    `PROJECT_STRUCTURE.md` be more useful *before* Phase 5 testing?

---

# 🧭 PHASE 8.5 — FLAT BUILDER UX PASS (planned 2026-09-01)

Unplanned at the time Phase 8 was scoped — surfaced by using the flat
builder for real once Tasks 35–39 landed. Inserted between Phase 8 and
Phase 9 the same way Phase 3.5 was inserted between Phase 3 and the
original Phase 7, for the same reason: real usage turned up problems
the original plan didn't anticipate, small enough to fix now rather
than carry forward.

**Goal:** fix a live nav regression, then two real UX gaps in the flat
builder discovered by actually using it — the selection summary's
sizing/ordering, and the persona-eligibility alert's actionability.

## Already done

- **Task 40** — Fixed `Navbar.tsx`'s dead anchor-scroll interception
  (a live regression from Task 39: clicking Closet/Outfits/the logo
  while already on `/` silently did nothing, since `/` no longer hosts
  the old scrolling `DashboardPage` those handlers assumed). Renamed
  `Persona` → `Attire`, pointing at `/` instead of `/persona`.
  `/persona` and `/dashboard` remain reachable, unlinked. Verified live
  end-to-end. Committed with Task 47 as `c2f772b`.
- **Task 41** — queued separately (back-button copy at `/`, Saved
  Outfits' stale `/outfits/new` links). Not detailed further here; not
  part of this planning pass.

## Part A — "Your Selection" panel: sizing, ordering, pairing, accessories

### Task 42 — Add the selection display-order constant + grouping/pairing helpers

Pure logic, no UI change yet — mirrors the Task 35 pattern (adapters
built and hand-verified before Task 36 wired them into a page).

**New file:** `frontend/src/utils/selectionDisplay.ts`
```ts
export const SELECTION_DISPLAY_ORDER: ClothingCategory[] = [
  ClothingCategory.JACKET,
  ClothingCategory.TOP,
  ClothingCategory.DRESS,
  ClothingCategory.BOTTOM,
  ClothingCategory.SHOES,
];
```
Plus two pure functions:
- `groupSelectedItemsForDisplay(items: ClothingItem[])` → items bucketed
  by `SELECTION_DISPLAY_ORDER`, accessories (`ClothingCategory.ACCESSORY`)
  separated out entirely rather than included in the main stack.
- `pairShoesForDisplay(shoeItems: ClothingItem[])` → matches `side ===
  'left'` to the left cell and `'right'` to the right cell for the
  common one-pair case; any additional/unpaired shoe items (no
  recorded side, or more than one pair selected) fall back to plain
  selection order in a secondary row rather than attempting full
  multi-pair matching — deliberately simple, flagged as a known
  simplification, not a gap to silently paper over.

This is a **new file**, not an addition to `useOutfitDraftStore.ts` -
that file's exports are specifically the draft↔backend contract
(Task 35's own scope note); this is purely about how the *summary
panel* groups items for display, a different concern.

**Do NOT touch:** `useOutfitDraftStore.ts`, `FlatOutfitBuilderPage.tsx`
(consumed by Task 43, not this task), any backend file.

**Verification:** `npx tsc -b --force` / `npx vite build`. No live UI
to click yet (nothing consumes this file) - verify by hand-tracing
`groupSelectedItemsForDisplay`/`pairShoesForDisplay` against a mixed
selection (jacket + top + 2 shoes with sides + 1 shoe with no side),
matching how Task 35's adapters were verified before they had a UI.

### Task 43 — Re-layout the "Your Selection" panel using Task 42

**Files:** `frontend/src/pages/FlatOutfitBuilderPage.tsx` only.

- Denser grid for the compact summary look: `grid-cols-4 sm:grid-cols-5
  md:grid-cols-6`, shorter aspect ratio (`aspect-square` or `aspect-[4/5]`
  instead of the current `aspect-[3/4]`), smaller name text.
- Render `SELECTION_DISPLAY_ORDER`'s categories as ordered sub-groups
  (small label per group, e.g. "Jacket", "Top") instead of one flat grid.
- Shoes render as their own 2-up sub-row using `pairShoesForDisplay`'s
  output instead of the generic grid.
- Accessories render in their own labeled row, separate from the main
  stack. **Open question below on above/below placement.**
- The existing per-item remove button (hover-to-reveal `X`) stays as-is,
  just on smaller cards.

**Do NOT touch:** the browse grid (left/center panels - category
sidebar, search, "Available Pieces"), the persona preview toggle and
its exclusion-counting logic (Task 38's code - Task 46 touches that,
not this task), `useOutfitDraftStore.ts`.

**Verification:** `npx tsc -b --force` / `npx vite build`. Live: select
a mix covering every category including 2 shoes (opposite sides) and
1 accessory; confirm sub-group order matches the constant, confirm
the shoe pair renders left/right correctly, confirm the accessory
appears in its own row, confirm remove still works per item at the
new size.

## Part B — Persona toggle, eligibility alert, configure actions

### Task 44 — Add a `markItemAsFitted` action

**Files:** `frontend/src/store/useClothingStore.ts`.

A thin, named wrapper around the *already-existing* `updateItem`:
`markItemAsFitted(itemId: number) => updateItem(itemId, { personaStatus:
PersonaStatus.FITTED })`. No new backend capability is needed - Task 30
already threads `personaStatus` through the update path end-to-end;
this task just gives the "promote to fitted" concept a clear, reusable
name at the store level instead of an inline object literal at the
call site, matching the existing `toggleFavorite`-style single-purpose
action pattern already in this store.

**Do NOT touch:** the backend (nothing to change there), `ClothingRequest`/
`ClothingResponse`/`ClothingService` (Task 30 already covers this path).

**Verification:** `npx tsc -b --force` / `npx vite build`. Live: call it
against a real `NOT_FITTED` item (temporary test item, same pattern as
every prior live test this phase) and confirm via the API that
`personaStatus` flips to `FITTED` and the item's existing preset
transform is untouched.

### Task 45 — Add "Adjust & Fit" to `EditClothingModal`, reachable from the flat builder

**Files:** `frontend/src/components/EditClothingModal.tsx`,
`frontend/src/pages/FlatOutfitBuilderPage.tsx`.

`EditClothingModal`'s save path (`handleUpdate`) currently never sends
`personaStatus` at all, confirmed during the original investigation.
Add an opt-in way to promote to `FITTED` on save - e.g. a new optional
prop (`promoteToFittedOnSave?: boolean`, default `false`/unset) that,
when true, includes `personaStatus: FITTED` in the `updateItem` call.
Must be **strictly additive** - `ClosetPage.tsx`'s existing use of this
modal (its edit flow) must be byte-for-byte unaffected when the prop
is omitted.

Then wire `FlatOutfitBuilderPage` to open this modal (with the prop
set) for a specific excluded item, triggered from Task 46's alert.

**Do NOT touch:** `FittingEditor.tsx`'s own internals (used as-is),
`ClosetPage.tsx` (must keep working unmodified - verify this explicitly,
don't just assume the additive prop is safe).

**Verification:** `npx tsc -b --force` / `npx vite build`. Live, two
passes: (1) confirm `ClosetPage`'s existing edit flow still works
exactly as before (unrelated regression check, cheap insurance given
this is a shared component); (2) confirm the new flat-builder entry
point opens the modal for the right item, and saving with an adjusted
transform both updates the transform *and* flips `personaStatus` to
`FITTED`.

### Task 46 — Toast + upgraded alert UI

**Files:** `frontend/src/pages/FlatOutfitBuilderPage.tsx` only.

Ties Tasks 44/45 together with the toggle. When "Preview on Persona" is
switched on **and** exclusions exist, fire a toast via the existing
`useToast()` (already mounted app-wide via `ToastProvider` in
`main.tsx` - confirmed, no new wiring needed) summarizing the count
("N items can't be shown on persona"). Keep Task 38's persistent inline
note as-is underneath (the toast is the "something changed" moment;
the note is the "still true" reminder for anyone who toggles away and
back). Per-item actions in the note, split by exclusion reason:
- `NOT_FITTED` → "Mark as Fitted" (Task 44, one click) and "Adjust &
  Fit" (Task 45, opens the modal) side by side.
- `INELIGIBLE_NO_CUTOUT` → "Remove from outfit" only (the *existing*
  `removeItem` from `useOutfitDraftStore`, already built in Task 36) -
  no fitting shortcut, since none exists (open question #14, still
  open after this phase - see below).

**Known accepted limitation, confirmed by the user:** an item quick-
marked "Fitted" via its default preset transform may render in a
visually awkward position (never custom-positioned). Accepted for now;
not something this task attempts to solve.

**Do NOT touch:** `Toast.tsx`/`ToastProvider` (reuse only),
`PersonaRenderer`/`PersonaLayer` (still untouched through this entire
UX pass), `equippedFromOutfitItems`/`outfitItemsFromDraft` (Task 38's
projection logic stays exactly as-is).

**Verification:** `npx tsc -b --force` / `npx vite build`. Live,
covering both reasons in one pass: create a `NOT_FITTED` item and an
`INELIGIBLE_NO_CUTOUT` item, select both, toggle preview on - confirm
the toast fires with the right count, confirm both action sets appear
and work (mark-as-fitted removes that item from the exclusion list and
it appears on the persona; remove-from-outfit removes the ineligible
item from the selection entirely), confirm toggling off and back on
re-fires the toast if exclusions still exist.

## ❓ Open questions for this phase — RESOLVED 2026-09-01

16. ✅ **Persona discoverability gap — RESOLVED.** Small persona-type
    entry point added to the navbar itself (next to the logout button),
    linking to `/persona`. Not folded into Tasks 42–46 — its own task,
    **Task 47** (see below), done out of numeric order (before 42–46),
    same precedent as Task 09 being done out of order in Phase 1.
17. ✅ **Accessories row placement — RESOLVED.** Below the main
    jacket→top→dress→bottom→shoes stack (Task 43).
18. ✅ **Bulk vs. per-item "Mark as Fitted" — RESOLVED.** Per-item only
    for now (Task 46); bulk deferred as an easy follow-up if needed later.
19. ✅ **Toast re-fire behavior — RESOLVED.** Fires every toggle-on
    with exclusions present, no dismissal/seen-it state to track (Task 46).
20. ✅ **Task 39/40 commit state — RESOLVED 2026-09-01.** Both
    committed and pushed to `phase-8-flat-outfit-builder`: Task 39 as
    `887bcd9`, Tasks 40+47 combined as `c2f772b` (done together since
    both touched `Navbar.tsx`). Also resolved the task-number collision
    this raised: the original Phase 9/10/11 sections had already
    claimed 40–50 before Phase 8.5 was planned — Phase 9/10/11 renumbered
    to 48–58 (content/scope unchanged) so Phase 8.5's 40–47 stand as-is.

## Task 47 — Add a persona-type entry point to the navbar

Resolves open question #16. Small, isolated addition alongside the
logout button in `Navbar.tsx` — a `UserCircle` (or similar) icon
linking to `/persona`, giving users a discoverable way back to the
persona-type picker now that `Attire` no longer points there.

**Files:** `frontend/src/components/Navbar.tsx` only.

**Do NOT touch:** `/persona`'s own page code (`PersonaPage.tsx`),
`/dashboard`, the `navLinks` array/center-links row itself (this is a
separate icon-button near the auth controls, not a new center nav
item — keeps `Attire`/`Closet`/`Outfits` as the only primary labeled
links, matching the Task 40 rename's intent).

**Verification:** `npx tsc -b --force` / `npx vite build`. Live:
confirm the icon appears, links to `/persona`, and doesn't disturb the
existing logout button/avatar layout.

### 🏁 Definition of Done

```text
Nav regression fixed, Attire rename live           ✅ (Task 40, done)
Selection panel: compact, ordered, paired, grouped  ✅ (Tasks 42-43)
Mark as Fitted + Adjust & Fit both real, working    ✅ (Tasks 44-45)
Toast + alert surface both actions correctly        ✅ (Task 46)
PersonaRenderer / PersonaLayer untouched throughout ✅
```

---

# 🗂️ CATEGORIES POLISH + PERSONA CONSISTENCY — PHASE 9.5 (planned 2026-09-03)

Planning pass requested before starting Phase 10, covering follow-ups
on the just-shipped categories experience (Tasks 48-51 + its own
follow-up, all committed to `phase-9-categories-experience` as
`a2f40cf`) plus a persona-naming feature that touches the data model.
All six open questions this planning pass raised were resolved the
same day (2026-09-03) - see each task and the Open Questions section
below for the specific answers. Per Open Question #26's resolution,
Tasks 59-65 land on `phase-9-categories-experience` itself (same
precedent as Phase 8.5 staying on the Phase 8 branch) - the checkpoint
into `main` and the cut of `phase-10-persona-fitting` happen once this
Phase 9.5 work is complete, not before it starts.

**Tasks not yet implemented as of this planning pass being written -
see the Current Sprint section for what's actually done.**

## A — "Add Items" modal needs real search + filtering

**Confirmed:** categories do not filter by persona type today and
nothing here changes that - `Collection`/`CollectionRequest` (backend)
carry no persona field at all, membership is purely by `itemId`/
`outfitId`. A category mixing MALE and FEMALE items is already
possible and stays possible.

**Confirmed current state** (`CategoryDetailPage.tsx`'s
`AddItemsModal`): a plain `grid-cols-3 sm:grid-cols-4` grid of
`aspect-square` thumbnails, name label only - no search input, no
category-type filter, no persona-type filter, no persona badge per
card. `FlatOutfitBuilderPage.tsx`'s browse grid already has the exact
persona badge pattern to copy (`absolute top-2 left-2` pill showing
`item.personaType`).

### Task 59 — Add search, category-type filter, persona-type filter, and a persona badge to `AddItemsModal`

**Files:** `frontend/src/pages/CategoryDetailPage.tsx` only (the
modal is defined in this file, not its own component).

- Text search on item name, same live/no-debounce pattern as
  `CategoriesPage`'s new category search (Phase 9 follow-up).
- Category-type filter: reuse `ClothingCategory` enum values
  (Jacket/Top/Dress/Bottom/Shoes/Accessory) - a row of toggle buttons
  matching `FlatOutfitBuilderPage`'s left category sidebar's *values*,
  not necessarily its exact layout (this modal is narrower).
- Persona-type filter: **do not hardcode to `[MALE, FEMALE]`** -
  derive the filter's options from `Object.values(PersonaType)` (same
  pattern `UploadFlow.tsx`'s own persona-target buttons already use),
  so a future third `PersonaType` value shows up here automatically
  with no code change to this task's own filtering logic.
- Persona badge per thumbnail: copy `FlatOutfitBuilderPage.tsx`'s
  existing badge markup verbatim (same visual language, not a new
  style).
- This task also carries Point D's density fix for this exact grid
  (see below) rather than a separate task, since both land in the same
  JSX block and splitting them would mean two tasks editing the same
  ~30 lines back to back.

**Do NOT touch:** `useCollectionStore.ts`/`collectionService.ts` (no
backend or store changes needed - this is client-side filtering over
the already-fetched `items` list), `CategoriesPage.tsx`.

**Verification:** `npx tsc -b --force` / `npx vite build`. Live: with
a closet containing items across at least 3 categories and both
persona types, open Add Items and confirm search/category-filter/
persona-filter all narrow the grid correctly (including combined),
confirm each thumbnail's badge matches its actual `personaType`,
confirm adding an item still works through the filtered view.

**✅ Task 59 COMPLETE 2026-09-03.** Implemented and verified exactly
per spec above. `npx tsc -b --force` / `npx vite build` both pass.
Live: created 3 items across TOP/DRESS/SHOES with mixed persona
types, confirmed search/category-filter/persona-filter all narrow
correctly individually and combined (SHOES+FEMALE correctly showed
zero results), confirmed badges, confirmed add still works. Committed
as part of `ddb0f8e` on `phase-9-categories-experience` (bundled with
the user-feedback round below, since both touched the same file back
to back before either was committed).

**Follow-up scope beyond this task's original spec, from direct user
feedback on Task 59's own result** (2026-09-03, same file,
`CategoryDetailPage.tsx` + `CategoryPicker.tsx` + its two consumers):
- `CategoryPicker.tsx` (shared by `UploadFlow.tsx`/`FlatOutfitBuilderPage.tsx`)
  changed from single-select to multi-select - an item/outfit can now
  be filed into several categories at once, matching the
  multi-membership data model Task 33 already established. Live-
  verified: one outfit saved into two categories at once, both
  memberships persisted via the API.
- Fixed a search-bar icon/text overlap in the Add Items modal
  (`left-4`/`pl-10` → `left-5`/`pl-12`, matching `CategoriesPage`'s
  own proven spacing).
- The modal became "Add to Category" with Items/Outfits tabs - saved
  outfits can now be added to a category as a whole (previously only
  possible at outfit-save time via Task 51's picker). No new backend
  endpoint needed - reuses `useCollectionStore.addOutfit`/`removeOutfit`
  (Task 48).
- Each tab lists what's already in the category underneath the
  picker, with the same remove action the main page has - live-
  verified removing and re-adding both work correctly from inside the
  modal without closing it.
- Each outfit gets a small 2x2 image collage preview (a new
  `OutfitPreviewThumb`, reusing `OutfitCard.tsx`'s existing mini-grid
  pattern rather than a new style) instead of a plain text pill, in
  both the available and already-added outfit lists. Needed no extra
  store lookups - `Outfit.items[].imageUrl` already carries what's
  needed (Task 15's simplified outfit contract). Live-verified with a
  3-item outfit (distinct colors per item) rendering the correct
  collage in both lists.

**Found but not fixed, flagged for later:** deleting an outfit still
linked to a category currently throws an unhandled 500 (Postgres FK
violation - `collection_outfits`'s `fk_collection_outfits_outfit`
constraint, `V3__add_collections.sql`, has no `ON DELETE CASCADE`,
and `OutfitService.deleteOutfit` doesn't clean up the join row
first). Pre-existing since Task 33, but more likely to be hit now
that outfits can actually be categorized through the UI. Not in scope
for this task - noted here so it isn't lost.

## B — Persona naming — ✅ data-model decision RESOLVED (Open Question #21)

**Confirmed current state:** `PersonaType` (`MALE`/`FEMALE`) is a
plain string enum, identical on frontend (`types/index.ts`) and
backend (`AvatarType.java`). The frontend's only notion of "which
persona is active" is `usePersonaStore.persona.type` - a **purely
client-side value**, persisted to `localStorage` (`persona-storage`
key) via zustand's `persist` middleware, **never sent to or read from
the backend**. The backend `User` entity has no persona/profile/
settings fields at all - no per-user settings concept exists anywhere
in this codebase today. There is currently no display-name concept
of any kind for a persona type.

This means "add an editable display name" isn't a small addition to
an existing settings surface - there is no settings surface. Two
genuinely different shapes this could take:

- **(a) Client-side only**, mirroring exactly how `persona.type`
  itself already lives - add a `displayNames: Record<PersonaType,
  string>` field to `usePersonaStore`'s persisted state, defaulting to
  `{ MALE: 'M Persona', FEMALE: 'F Persona' }`, editable from
  `PersonaPage.tsx`. No backend change, no migration, ships fast -
  but doesn't sync across devices/browsers and is lost if the user
  clears site data (same limitation `persona.type` itself already
  has today, so at least it's not a new class of problem).
- **(b) Backend-persisted**, as a genuine per-user setting - needs a
  new table (or columns on `User`) and REST endpoint. More correct
  long-term (survives a new device/browser), but is real backend work
  where currently none exists for "settings" at all, and the first
  such feature tends to set the shape for whatever comes after it.

Either way, **the naming map must be keyed by `PersonaType`, not two
hardcoded fields** (`maleName`/`femaleName` columns or props) -
per the requirement that this "should not hardcode to exactly two."
A `Record<PersonaType, string>` (frontend) / a small key-value table
`persona_display_names(user_id, persona_type, display_name)` rather
than fixed columns (backend, if (b) is chosen) both mean a future
third `PersonaType` value needs zero schema/shape change here, only a
new enum member elsewhere.

### Task 60 — Implement persona display names (backend-persisted)

**✅ Open Question #21 RESOLVED 2026-09-03: option (b), backend-persisted.**
This is the first per-user "settings" surface in this codebase - no
existing table/pattern to extend, so it's new backend work, not a
small addition.

**Files:**
- Backend: new `PersonaDisplayName` entity + repository + service +
  controller (mirrors `Collection`'s Task 33-34 shape: thin
  controller, ownership/auth enforced in the service), new Flyway
  migration (`V4__add_persona_display_names.sql` - next version after
  `V3`'s collections migration). Table keyed by `(user_id,
  persona_type)`, **not** fixed `male_name`/`female_name` columns -
  per the "don't hardcode to two" requirement, a new `PersonaType`
  value later just means a new row is possible, no schema change.
- Frontend: new `api/personaSettingsService.ts` (mirrors
  `collectionService.ts`'s pattern), a new
  `store/usePersonaSettingsStore.ts` (separate from
  `usePersonaStore.ts` deliberately - that store's `persona.type` is
  the *selection*, purely local; this is the *display name*, backend-
  synced - conflating them would mean every `persona.type` change
  triggers a network round-trip that has nothing to do with picking
  a persona), `PersonaPage.tsx` (add the rename UI).

**Do NOT touch:** the `PersonaType` enum's own values, `AvatarType`'s
backend equivalent, or `usePersonaStore.ts`'s existing `persona.type`
selection logic - this is a **display-only overlay**, never a
replacement for the enum. `ClothingItem.personaType`/
`Outfit.avatarType` stay exactly as they are (still the enum value,
never the display name) - display names are a presentation-layer
concern only, not a new data shape flowing through items/outfits.

**Verification:** `npx tsc -b --force` / `npx vite build` (frontend);
backend verified via the established temp-instance-on-8081 pattern
(migration applies cleanly, endpoints respond, then cleanly stopped
without touching the user's own 8080 instance). Live: rename a
persona (default "M Persona"/"F Persona" confirmed on a fresh
account), confirm it persists across a page reload (proving it's
backend-read, not just local state), confirm it displays wherever
`MALE`/`FEMALE` text currently shows verbatim (`PersonaPage.tsx`,
anywhere else found during implementation), confirm the underlying
`PersonaType` value used for filtering/
rendering is completely unaffected by the display name.

**✅ Task 60 COMPLETE 2026-09-03.** New backend `persona` package
(entity/repository/service/controller/DTOs) + `V4` migration;
`GET/PUT/DELETE /api/persona-display-names[/{personaType}]`, mirroring
`CollectionController`'s pattern. Only overrides are stored - the
frontend's `usePersonaSettingsStore` applies "M Persona"/"F Persona"
for anything unset. `PersonaPage.tsx` has an inline rename control
(replacing the hardcoded "Masculine"/"Feminine" titles) and
`ClosetPage.tsx`'s "Active Persona" badge shows the custom name.
**Scoping call:** item persona badges, the upload persona-target
picker, and the closet's MALE/FEMALE filter buttons deliberately still
show the raw enum value (they classify garments, not name the
persona); `AvatarSection.tsx` (orphaned `/dashboard`) untouched per the
standing boundary. Verified: `tsc`/`vite build`/`mvnw compile` clean;
backend CRUD tested via a temp instance on 8081 (update-in-place, no
duplicate rows, reset), then stopped with the user's 8080/5432/5173
confirmed untouched; live UI test after the user restarted their
backend - rename persisted across a full reload, default kept for the
un-renamed persona, `ClosetPage` showed the custom name. Test data
cleaned up. Committed as `6d5f3ea` on `phase-9-categories-experience`.

## C — Outfit → persona alert consistency

**Confirmed: this is a genuinely separate, currently-unprotected
entry point - not something to rebuild, but something to fix.**
`FlatOutfitBuilderPage.tsx`'s persona preview (Task 38) pre-filters
to `personaStatus === FITTED` items matching the active
`persona.type` *before* calling `PersonaRenderer`, and shows the
alert/count/fit-actions (Tasks 44-46) for what got excluded.
`OutfitCard.tsx`'s own, independent `showPersona` toggle (used on
`/outfits` - Saved Outfits - the only place today an outfit can be
viewed on-persona outside the flat builder; `CategoryDetailPage.tsx`'s
outfit chips are plain name pills with a remove button, no
`OutfitCard` and no persona-preview capability of any kind yet - see
Open Question #25 below) does **not** do this filtering - it builds `outfitPersona` directly from
`equippedFromOutfitItems(outfit.items)` with no `personaStatus` check
at all, and hands it straight to `PersonaRenderer`. Confirmed via
`PersonaRenderer.tsx:41` (`getItem`): it silently drops a
`personaType` mismatch, but has **no knowledge of `personaStatus`
at all** - a `NOT_FITTED` item (real cutout, default seed transform,
never actually positioned) or an `INELIGIBLE_NO_CUTOUT` item (raw
non-transparent source image) will render as-is, badly, with no
alert that anything is wrong. This is exactly the gap the user
described, and Task 38's logic is the right thing to reuse - it
just isn't reachable from anywhere but `FlatOutfitBuilderPage.tsx`
today.

**Also found while investigating** (not asked for, but directly
adjacent): `OutfitCard.tsx`'s "WEAR STYLE" button
(`handleApply`) calls `updatePersona(equippedIds)` - mutating
`usePersonaStore`'s *global equip-id-lists* (`topIds`/`bottomIds`/
etc.), a persona-first concept nothing in the post-pivot primary flow
(`FlatOutfitBuilderPage`, reachable at `/`) reads at all - then calls
`document.getElementById('persona')?.scrollIntoView(...)`. That
element only exists in `DashboardPage.tsx` (`id="persona"`), an
orphaned route not linked from primary nav since Task 39/40. From
`/outfits` (where every `OutfitCard` lives), this button currently
does nothing visible: it silently writes to state nothing reads, then
the scroll is a no-op. **The exact same dead pattern** exists in
`ClothingCard.tsx`'s `handleEquip` (used on `/closet`). Both predate
the Phase 8 pivot and were never updated for it.

### Task 61 — Extract Task 38's persona-eligibility filtering into a shared utility

**Files:** new `frontend/src/utils/personaEligibility.ts` (or similar
- exact name/shape is an implementation detail, not a decision to
pre-make here), `frontend/src/pages/FlatOutfitBuilderPage.tsx`
(refactored to consume it).

Pure extraction, no behavior change: pull the `useMemo` block
computing `previewPersona`/`excludedIneligibleCount`/
`excludedWrongPersonaCount` (and the `notFittedExcluded`/
`noCutoutExcluded` splits from Task 46) out into a reusable function
taking `(items: ClothingItem[], targetPersonaType: PersonaType)` and
returning the same shape, so both `FlatOutfitBuilderPage.tsx` and
`OutfitCard.tsx` (Task 62) can call it instead of only the former
having this logic inline.

**Do NOT touch:** `PersonaRenderer`/`PersonaLayer`,
`equippedFromOutfitItems`/`outfitItemsFromDraft` (Task 38's own
projection logic, reused as-is, not touched by this extraction).

**Verification:** `npx tsc -b --force` / `npx vite build`, plus live:
re-run Task 46's exact live-test pass (create a `NOT_FITTED` item and
an `INELIGIBLE_NO_CUTOUT` item, select both in the flat builder,
toggle preview, confirm the toast/note/actions all still behave
identically to before the extraction) - this task must be provably a
no-op for `FlatOutfitBuilderPage.tsx`'s existing behavior.

**✅ Task 61 COMPLETE 2026-09-21.** New `utils/personaEligibility.ts`
exports `computePersonaEligibility(selectedItems, allItems,
targetPersonaType)`, returning `previewPersona` plus `ineligibleItems`
/ `notFittedItems` / `noCutoutItems` / `wrongPersonaItems`. The filter
predicates are the original Task 38/46 ones moved verbatim (including
the legacy null-status-counts-as-FITTED rule). `FlatOutfitBuilderPage`
now makes one `useMemo`'d call; `tsc` flagged four imports only the
moved block used, removed. `tsc`/`vite build` clean. Live re-run of
Task 46's test with fitted / NOT_FITTED / INELIGIBLE_NO_CUTOUT /
other-persona items: identical note text, per-reason actions, toast
("3 items can't be shown on persona", re-fires on toggle), Mark as
Fitted and Remove From Outfit both behave as before, and the mannequin
layers only the two eligible items. "Adjust & Fit" not re-clicked
(its code path is untouched). Test items cleaned up. Committed as
`b5ce469` on `phase-9-categories-experience`.

### Task 62 — Apply the shared eligibility filter + alert + fit actions to `OutfitCard`'s persona toggle

**Files:** `frontend/src/components/OutfitCard.tsx` only.

Consumes Task 61's extracted utility. When `showPersona` is on,
build `outfitPersona` from the *filtered* (eligible-only) item list
instead of the raw `equippedIds`.

**✅ Open Question #23 RESOLVED 2026-09-03: start minimal.** Not the
full per-item Mark-as-Fitted/Adjust-&-Fit action rows from
`FlatOutfitBuilderPage` - those would crowd a grid of many
`OutfitCard`s on `/outfits`. Instead: a short "N items hidden - not
shown here" note, with a single link/button that routes to
`/outfits/flat/edit/:id` (Task 45's existing "Adjust & Fit" entry
point already lives on that page) for the actual fixing, rather than
duplicating `markItemAsFitted`/`EditClothingModal` wiring into the
card itself. Expand to the fuller in-card actions later only if this
minimal version proves insufficient in practice.

**Do NOT touch:** `SavedOutfitsPage.tsx` (only the card component
changes), `PersonaRenderer`/`PersonaLayer`, the "WEAR STYLE" button/
`handleApply` (that's Task 63, a separate concern from the inline
`showPersona` toggle this task fixes).

**Verification:** `npx tsc -b --force` / `npx vite build`, plus live:
create an outfit containing a mix of `FITTED` and `NOT_FITTED`/
`INELIGIBLE_NO_CUTOUT` items, view it via `OutfitCard`'s `showPersona`
toggle on `/outfits`, confirm the note appears with the right count
and only eligible items render on the persona, confirm the note's
link lands on `/outfits/flat/edit/:id` for that outfit and Task 45's
"Adjust & Fit" is reachable from there as normal.

**✅ Task 62 COMPLETE 2026-09-21.** `OutfitCard`'s persona toggle now
decides what to show via `computePersonaEligibility` (Task 61); a
"N items hidden · Fix" note (reasons in its tooltip) sits in the
caption area under the card - not on the image, because the hover
overlay covers the image and would swallow the click - and links to
`/outfits/flat/edit/:id`. Design call: the preview is built from the
outfit's own *saved* slots filtered to the eligible items, not the
utility's `previewPersona` (which re-derives slots from category/side
and would drop an older outfit's sideless shoe); `computePersonaEligibility`
gained an additive `eligibleItems` field for this. `tsc`/`vite build`
clean. Live: mixed outfit (fitted top, NOT_FITTED bottom, female dress,
saved-slot sideless shoe) showed "2 items hidden · Fix", only top +
shoe on the mannequin; a fully-fitted outfit showed no note; the link
landed on the editor with 4 items and Adjust & Fit reachable. Test
data cleaned up. Committed as `f598cef`.

### Task 63 — Fix "WEAR STYLE" + remove the dead post-pivot scroll-target calls

**Files:** `frontend/src/components/OutfitCard.tsx`,
`frontend/src/components/ClothingCard.tsx`.

**✅ Open Question #22 RESOLVED 2026-09-03: navigate to Attire (`/`).**
`handleApply` (the "WEAR STYLE" button) keeps applying the outfit's
*eligible* items (reuse Task 61's filter here too, rather than the
current raw `updatePersona(equippedIds)`) then `navigate('/')` instead
of the dead `document.getElementById('persona')?.scrollIntoView(...)`
call - `/` is `FlatOutfitBuilderPage`, whose own persona preview
(Task 38, protected the same way after Task 61/62) is where the
result becomes visible. Note this still writes to
`usePersonaStore.persona`'s equip-id-lists, which is a genuinely
different, older representation than `FlatOutfitBuilderPage`'s own
draft-selection state (`useOutfitDraftStore`) - confirm during
implementation whether landing on `/` after this actually shows the
applied outfit, or whether "apply" needs to instead call
`setDraft`/`useOutfitDraftStore` directly to be visible on the page
it navigates to. Flag if this reveals the equip-id-list path is fully
dead too, not just its scroll call.

`ClothingCard.tsx`'s `handleEquip` scroll call is unconditionally dead
(confirmed, same as `OutfitCard`'s) and has no such nuance - just
remove it; `setEquippedItem` itself stays, that half isn't dead.

**Do NOT touch:** `usePersonaStore.ts`'s `updatePersona`/
`setEquippedItem` themselves (still valid actions - only the dead
call *sites* and their trailing scroll calls are in scope),
`DashboardPage.tsx` (the `id="persona"` element these calls
originally targeted stays exactly as-is).

**Verification:** `npx tsc -b --force` / `npx vite build`, plus live:
confirm clicking a `ClothingCard` still equips/unequips it (the
non-dead half of `handleEquip`), confirm "WEAR STYLE" on a real
outfit navigates to `/` and the outfit's eligible items are actually
visible there (not just that the navigation happens) - this is the
part that needs live proof, not just code reading, given the
equip-representation mismatch noted above.

**✅ Task 63 COMPLETE 2026-09-21 - committed as `291fcf8`.** Resolved
per open question #22 (navigate to Attire `/`, not a dead scroll).
- `OutfitCard.handleApply`: `updatePersona(outfitPersona)` (eligible
  items only, carries the outfit's `avatarType`), then
  `setDraft(draftFromOutfitItems(outfit.items))` (the WHOLE outfit, so
  anything hidden from the persona is visible and fixable in the
  builder), then `navigate('/', { state: { showPersonaPreview: true } })`.
- `FlatOutfitBuilderPage` reads that router state through `useLocation`
  to seed `showPersonaPreview`, so the preview is already on at arrival.
- The equip-id lists are still written because `/closet`'s "Equipped"
  highlight (`ClothingCard`) still reads them; the flat builder ignores
  them. Removing that second representation is out of scope here.
- `ClothingCard.handleEquip`: dead `#persona` scroll removed (element
  only exists on the orphaned `/dashboard`).
- Verified live: clicking WEAR STYLE lands on `/` with the outfit's
  items selected and the persona preview open showing the eligible
  ones; "Equipped" highlight matches (persona `topIds:[147]`, eligible
  item only).
- Finding: `SavedOutfitsPage` only lists outfits matching the active
  persona, so WEAR STYLE's persona switch is purely defensive today.
- Known minor: refreshing `/` right after Wear Style reopens the
  preview with an empty selection (router state survives, draft does not).

## D — "Looks ugly / giant items" — every remaining instance

**Confirmed candidates** (evidence-backed, from reading each
component's actual classes, not assumption):

1. `CategoryDetailPage.tsx`'s `AddItemsModal` grid -
   `grid-cols-3 sm:grid-cols-4`, `aspect-square` - notably less dense
   than the `SelectionCard` pattern (`grid-cols-4 sm:grid-cols-5
   md:grid-cols-6`, `aspect-[4/5]`) Tasks 42-43 established for
   exactly this kind of compact item grid. **Fixed as part of
   Task 59** (same file/block as the search/filter work).
2. `CategoryDetailPage.tsx`'s own item grid (not the modal) -
   `grid-cols-3 sm:grid-cols-4 md:grid-cols-6`, `aspect-square` -
   reaches the same 6-column ceiling as `SelectionCard` at the `md`
   breakpoint but differs below it (3/4 cols vs. 4/5) and uses a
   different aspect ratio/corner radius. **Task 64** below.
3. `ClothingCard.tsx` (`/closet`'s grid) - **✅ confirmed live
   2026-09-03, real layout bug, not just a size preference.** At a
   1280px viewport, `ClosetPage.tsx`'s grid computed 6 columns
   (`xl:grid-cols-6`) of **182.8px** each, but `ClothingCard`'s fixed
   `w-48` is **192px** - wider than its own grid cell. Measured live:
   the visual gap between two adjacent cards was **15px**, not the
   intended `gap-6` (24px) - the oversized fixed-width card eats into
   its neighbor's column. This is the `flex-shrink-0 w-40 md:w-48`
   pattern (written for a horizontal-scrolling row, per its own
   class names) sitting inside a CSS grid it was never designed for.
   **Task 65** below.

### Task 64 — Realign `CategoryDetailPage`'s main item grid to the `SelectionCard` compact pattern

**Files:** `frontend/src/pages/CategoryDetailPage.tsx` only.

Purely visual: match `grid-cols-4 sm:grid-cols-5 md:grid-cols-6`,
`aspect-[4/5]`, and `SelectionCard`'s name-label sizing exactly,
rather than this page's own slightly different pattern. No behavior
change to remove/click handlers.

**Do NOT touch:** the outfits section of this same page (chips are
already compact, not part of this complaint), `AddItemsModal` (Task
59 already covers its grid).

**Verification:** `npx tsc -b --force` / `npx vite build`, plus live:
a category with 8+ items shows the same density/proportions as the
flat outfit builder's "Your Selection" panel side by side.

**✅ Task 64 COMPLETE 2026-09-03 - done incidentally, not as its own
pass.** While rewriting this same file for the Task 59 feedback round
(multi-select/outfits-tab/already-added-sections/previews), the main
page's items grid was brought in line with this exact spec
(`grid-cols-4 sm:grid-cols-5 md:grid-cols-6`, `aspect-[4/5]`) as a
side effect of touching the surrounding code - confirmed via `git
diff` against `a2f40cf` (before: `grid-cols-3 sm:grid-cols-4
md:grid-cols-6` / `aspect-square`). Live-verified during that same
session's testing (the grid was visibly on-screen throughout). No
separate task effort was spent - noting this so the task list stays
accurate rather than silently skipping a checkbox. Committed as part
of `ddb0f8e`.

### Task 65 — Fix `ClothingCard`'s fixed-width-in-grid layout bug

**Files:** `frontend/src/components/ClothingCard.tsx` only.

Remove `flex-shrink-0 w-40 md:w-48` from the card's root element and
let it stretch to fill its `ClosetPage.tsx` grid cell naturally
(CSS grid's default `justify-items: stretch`), matching how every
other grid card in this codebase (`SelectionCard`, `CategoryDetailPage`'s
item grid, the flat builder's browse grid) already sizes itself purely
from its grid column, not a fixed pixel width. This is a **narrower**
fix than a full redesign - `ClosetPage.tsx`'s own grid column counts
(`grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5
xl:grid-cols-6`) stay as-is; only the card's own conflicting fixed
width goes.

**Do NOT touch:** `ClosetPage.tsx`'s grid column classes themselves,
`ClothingCard`'s `aspect-[3/4]` (unrelated to this bug - stays), any
other consumer of `ClothingCard` if one exists beyond `ClosetPage.tsx`
(confirm there isn't one before assuming this is safe to change
unconditionally).

**Verification:** `npx tsc -b --force` / `npx vite build`, plus live:
re-measure what this planning pass measured (card width vs. computed
`grid-template-columns` column width, and the actual gap between two
adjacent cards) at the same 1280px viewport and confirm the card now
exactly fills its column with a true 24px gap, at a few other
viewport widths too (mobile/tablet) to confirm no regression at
breakpoints this bug wasn't measured at.

**✅ Task 65 COMPLETE 2026-09-21 - implemented differently than
specced, because the spec's own caveat turned out to be real.** The
spec said to confirm no other `ClothingCard` consumer before removing
the fixed width; there is one: the orphaned `/dashboard`'s
`ClosetSection` renders it in a `flex overflow-x-auto` horizontal-scroll
row, which is the context `flex-shrink-0 w-40 md:w-48` was written for.
Removing the width outright would have collapsed those cards, and that
page is off-limits. So: new optional `fluid` prop on `ClothingCard`
(default false = unchanged), and `ClosetPage` passes `fluid` (one-line
edit there, none of its grid classes touched). Measured after, at
1280px: card 183px in a 182.8px column with a true 24px gap (was 192px
in 182.8px, gap 15px); 768px: 158px/158px, gap 24; mobile: 152px in a
151.5px column, gap 24; no horizontal overflow at either. `/dashboard`
cards confirmed still 192px with the original classes. Committed as
`291fcf8`.

## ❓ Open questions for this plan — ALL RESOLVED 2026-09-03

### Blocking Point B (persona naming)

21. ✅ **Persona display-name data model — RESOLVED: (b)
    backend-persisted.** New per-user setting, `PersonaType`-keyed
    (never fixed `male`/`female` columns). Detailed in Task 60 above -
    this is a real new backend surface, since no per-user settings
    concept exists in this codebase today.

### Blocking Point C (persona alert consistency)

22. ✅ **`OutfitCard`'s "WEAR STYLE" button — RESOLVED: navigate to
    `/`.** Applies the outfit's eligible items then routes to Attire,
    where `FlatOutfitBuilderPage`'s own (Task 61/62-protected) preview
    shows the result, replacing the dead scroll-to-`#persona` call.
    Detailed in Task 63 above, including a flagged nuance found while
    writing that task's spec: `handleApply` writes to
    `usePersonaStore`'s older equip-id-list representation, not
    `useOutfitDraftStore` (what `FlatOutfitBuilderPage` actually reads
    for its own selection) - Task 63 must confirm live whether landing
    on `/` after "applying" actually shows anything, not just that the
    navigation itself works.
23. ✅ **Compactness of Task 62's alert/actions — RESOLVED: start
    minimal.** A short "N items hidden" note linking to
    `/outfits/flat/edit/:id` (reusing Task 45's existing entry point
    there) rather than duplicating full per-item action rows into
    every `OutfitCard`. Detailed in Task 62 above.
24. ✅ **`ClothingCard.tsx`'s sizing on `/closet` — RESOLVED: checked
    live, confirmed real.** Measured at a 1280px viewport: the card's
    fixed `w-48` (192px) is wider than its own grid column (182.8px,
    computed from `xl:grid-cols-6`), squeezing the visual gap between
    cards down to 15px against an intended 24px `gap-6`. In scope -
    **Task 65** (new, added after this measurement).
25. ✅ **`CategoryDetailPage`'s outfit chips gaining a persona-preview
    — RESOLVED: no, out of scope for now.** Chips stay plain name
    pills with a remove button; no new persona-preview capability
    added here. Not reflected in any task above (there was never a
    draft task for it, only the open question) - noting the "no"
    explicitly so it isn't silently revisited.

### Cross-cutting

26. ✅ **Phase 9 checkpoint — RESOLVED: stay on
    `phase-9-categories-experience`.** Matches the Phase 8.5 precedent
    exactly - that inserted phase stayed on the Phase 8 branch and
    only checkpointed into Phase 9 once fully done. Tasks 59-65 land
    on `phase-9-categories-experience`; the merge into `main` and the
    cut of `phase-10-persona-fitting` happen only once this Phase 9.5
    work is complete, not before it starts.

## 🏁 Definition of Done

```text
Add Items modal: searchable, filterable by type + persona, badged ✅ (Task 59)
Persona display names implemented (backend-persisted)               ✅ (Task 60)
Eligibility filtering reusable, not duplicated                     ✅ (Task 61)
OutfitCard's persona toggle protected the same way the builder is  ✅ (Task 62)
Dead scroll-target calls gone; WEAR STYLE does something real      ✅ (Task 63)
CategoryDetailPage's item grid matches the established compact style ✅ (Task 64)
ClothingCard fills its grid column correctly, no more squeezed gap ✅ (Task 65)
```

---

# Phase 9.6 — Shoe fix + VYSVI redesign *(planned 2026-09-21, before Phase 10)*

Two requests from the user before Phase 10 resumes: (1) shoes never
appear on the persona, (2) a full visual redesign around the new VYSVI
logo. Decisions taken with the user: they supply the logo files
(transparent PNG/SVG + a dark-ink variant for light mode); the app is
renamed **VYSVI / Digital Wardrobe** everywhere; **pure silver/graphite**
palette (no colored accent); **editorial fashion look** (serif headings,
lighter type, softer corners, no glows), not colors-only; light + dark
mode, defaulting to the device's setting ("system"), with a manual
toggle. Lands on `phase-9-categories-experience`, same precedent as 9.5.
Full plan: `C:\Users\javid\.claude\plans\partitioned-painting-crab.md`.

### Task 66 — Shoes not appearing on the persona

**✅ COMPLETE 2026-09-21.** Reproduced live first (test account, items
created through the API, image = the dev server's `favicon.svg`):
- Shoes with a recorded `side` render correctly (layers at z 200/201,
  feet region) - so the pair-upload flow itself was not the problem.
- A shoe with **no `side`** produced no layer at all. Cause:
  `outfitItemsFromDraft` (`useOutfitDraftStore.ts`) only maps
  `side: 'left'|'right'` to a `leftShoe`/`rightShoe` slot, so an unsided
  shoe got no slot and never reached `PersonaRenderer` - in the flat
  builder's preview *and* in `OutfitCard`'s persona view (Task 62).
- Fix: `applyLegacyShoeFallback(equipped, eligibleItems)` in
  `utils/personaEligibility.ts`, mirroring `usePersonaStore`'s existing
  legacy-shoe rule: both feet free -> the shoe becomes the pair
  (`PersonaRenderer`'s existing `leftShoe.itemId === rightShoe.itemId`
  branch draws it once with the category default transform); one foot
  free -> takes that foot; extras ignored; already-slotted shoes
  untouched. Applied in `computePersonaEligibility` and in
  `OutfitCard.outfitPersona`. Stale comment in `useOutfitDraftStore.ts`
  updated.
- Verified live: unsided shoe now shows in the flat builder preview
  (z200) and in a saved outfit's card persona view; sided pair still
  correct; `tsc -b --force` + `vite build` clean; test data removed.
- Open point for the user: if their real shoes DO have a side and still
  don't show, that's a different cause (likely their saved transform) and
  needs a look at one of their actual items.

### Task 66b — Background remover broken (found right after Task 66)

**✅ COMPLETE 2026-09-21.** User report: "background remover doesn't
work anymore." Reproduced by calling `BrowserBgRemover` directly in the
browser pane: `Failed to create session: TypeError:
r._OrtGetInputOutputMetadata is not a function`. Because the hybrid
service (`lib/background-removers/index.ts`) falls back to the FastAPI
service on `:8000` - which isn't running here (no Python installed) -
and then to the original image, the user just saw "AI unavailable /
original image used".
- **Cause:** `@imgly/background-removal 1.7.0` has a peer dependency on
  `onnxruntime-web` **exactly 1.21.0**, but `package.json` didn't pin it,
  so npm resolved the single top-level copy to `1.26.0-dev...` (wanted by
  `@huggingface/transformers 4.2.0`, used by `segmentationService`). imgly
  ran the 1.26 JS runtime against its own 1.21-era wasm from its CDN.
- **Fix:** added `"onnxruntime-web": "1.21.0"` (exact) as a direct
  dependency (`frontend/package.json` + lockfile). imgly now resolves
  1.21.0 at top level; transformers keeps its own nested 1.26 copy
  (`node_modules/@huggingface/transformers/node_modules/onnxruntime-web`).
  Installed with `--legacy-peer-deps` - plain `npm install` fails on an
  older, unrelated conflict (`fabric-warpvas` wants fabric 6, project is
  on 7; that package is the dead warp scaffolding slated for Task 55).
- **Gotcha:** Vite keeps a pre-bundled dependency cache; after this change
  the dev server must be restarted with `node_modules/.vite` cleared or
  the old (broken) bundle keeps being served. Anyone pulling this needs
  `npm install --legacy-peer-deps` and a dev-server restart.
- **Verified live:** `BrowserBgRemover` and the full `bgRemovalService`
  (method `browser`) return a PNG with the background removed (79%
  transparent on the mannequin test image); `segmentationService` still
  imports; `tsc -b --force` + `vite build` clean.

### Tasks 67-72 — VYSVI redesign (planned, not started)

Findings that shape it: the app is dark-only; semantic tokens
(`background-main`, `background-secondary`, `card`, `text-primary`,
`text-secondary`, `accent`, `accent-hover`) exist in `index.css` and are
used ~536 times (keep those names), but there are **669 hard-coded
`white`/`black` utilities across 38 files** plus 31 hard-coded hex/rgba
(mostly Fabric.js `#5B8CFF`), and 35 `text-white`-on-`bg-accent` spots
that would be unreadable on a silver accent.

- **67 Theme infrastructure** - CSS-variable tokens switched by
  `data-theme` on `<html>`; add `ink`, `on-accent`, `line`; new
  `useThemeStore` (`system|light|dark`, default system, persisted,
  live-follows OS changes); inline no-flash script in `index.html`;
  sun/moon/monitor toggle in `Navbar`; fonts: serif display (Cormorant
  Garamond) + Jost for UI. Starting palette - dark: bg `#0B0B0C`,
  surface `#131315`, card `#1A1A1D`, ink `#F2F2F3`, secondary `#9A9CA3`,
  accent silver `#C7CBD1`; light: bg `#F6F5F3`, surface `#EDECE9`, card
  `#FFFFFF`, ink `#16171A`, secondary `#666971`, accent graphite
  `#3A3D44` (silver kept for borders/decoration - too faint as text on
  white). To be tuned live and contrast-checked to WCAG AA.

  **✅ Task 67 COMPLETE 2026-09-21.** Implemented as planned:
  - `index.css`: palette as `--vy-*` variables per theme (dark default,
    `[data-theme="light"]`, plus a `prefers-color-scheme` fallback when the
    attribute is absent), exposed through `@theme inline` so every
    existing utility (`bg-background-main`, `text-text-primary`,
    `bg-accent/30`...) follows the theme unchanged. New tokens:
    `ink`, `on-accent`, `line`. Palette values are exactly the starting
    palette above. Fonts: Jost (body) + Cormorant Garamond (h1/h2 via the
    base layer); Inter dropped. Contrast (computed): secondary text is
    ~7.1:1 on the dark bg and ~5.0:1 on the light bg.
  - `store/useThemeStore.ts` (`system|light|dark`, default system,
    persisted under `vysvi-theme` with try/catch, `initTheme()` called in
    `main.tsx`), inline no-flash script + `color-scheme` meta in
    `index.html`, `components/ThemeToggle.tsx` (icon = the *preference*,
    cycles system -> light -> dark) in the navbar for logged-in and
    logged-out users.
  - Verified live: dark/light token values resolve correctly; toggle
    cycles and persists across reload; fresh visitor with OS dark -> dark,
    OS light + `system` -> light on cold load; handler logic follows the
    device only while the preference is `system` (tested with an injected
    fake `matchMedia`, because the browser pane's color-scheme emulation
    flips `matches` but never dispatches the `change` event - a pane
    limitation, the real OS event isn't testable here); `tsc -b --force` +
    `vite build` clean.
  - **Known and expected until Task 68:** light mode looks broken (white
    text on off-white) because 669 hard-coded `white`/`black` utilities
    don't follow the theme yet; the dark palette is already fully applied
    (blue accent is gone).
  - **Found, deferred to Task 69:** the navbar pill is already wider than
    a 375px phone (455px without the toggle, 503px with it - the toggle
    adds 48px). Pre-existing; fix with the navbar restyle (hide/condense
    items on small screens).
- **68 Token migration** - scripted `text-white` -> `text-text-primary`,
  `*-white/N` -> `*-ink/N`, `text-white` on accent -> `text-on-accent`;
  manual review for text/scrims over item photos, recessed `bg-black/N`
  panels, and status colors; strip glows / accent shadows / decorative
  pulses.

  **✅ Task 68 COMPLETE 2026-09-21.**
  - **Migration:** a context-aware Node codemod (kept out of the repo; it
    needs no Python) rewrote **593 of 669** hard-coded `white`/`black`
    utilities across 36 files: `*-white/N` -> `*-ink/N` (text, bg, border,
    ring, shadow, placeholder, gradients, hover/focus variants, bracket
    opacities like `/[0.08]`), `bg-white` -> `bg-ink`, `text-white` ->
    `text-text-primary`, `text-white` on a solid accent -> `text-on-accent`
    (30), recessed `bg-black/10-30` panels -> `bg-ink/5`. It scans real
    string/template literals (nested `${}` branches included) and decides
    per element, and holds back anything ambiguous.
  - **Manual review of the held-back cases** (22 `text-white` near a photo
    scrim or accent background + 2 ambiguous): 9 converted by hand
    (item-name label under a card, empty-state icon, editor headings,
    OutfitCard/CategoryDetail preview-tile backgrounds, the shoe editor
    header; the segmentation-card label became `text-text-primary
    group-hover:text-white` because its dark gradient only shows on hover).
  - **67 tokens deliberately left hard-coded:** white text/borders over
    photos and dark scrims, white on solid rose/red/emerald status buttons,
    `bg-black/40-60` modal backdrops and chips, `from-black/80` photo
    gradients, and the editor canvas stages (`bg-black/40` in
    `ClothingCanvas`, `JacketCanvas`, `ShoeCanvas`, `GarmentCleanup`) which
    Task 71 owns.
  - **Effects removed:** 28 colored accent shadows (`shadow-accent/N`) and
    neon glow shadows (`shadow-[0_0_..]`) in 18 files; the decorative
    blurred glow blobs in `ClosetPage`, `LandingPage`, `PersonaPage`,
    `SavedOutfitsPage` (whole wrapper elements deleted); the decorative
    `animate-pulse` on the persona dot; the unused `.glow-effect` CSS. The
    remaining `animate-pulse` is a real loading indicator and stays.
    `.glass-panel` / `.premium-card` now use `border-ink/10` (they had
    hard-coded `white/5` in `index.css`).
  - **Verified:** `tsc -b --force` + `vite build` clean; live in both
    themes - `/closet` (dark + light), `/categories/:id` (light), Attire
    with the persona preview (light: the mannequin sits cleanly on the
    off-white; photo labels stay white on their gradients). Test data
    created for the check was deleted.
  - **Found, for Tasks 69/70:** (1) **32 places pair `text-text-secondary`
    with `opacity-10..40`** (e.g. the subtitle and the card category label
    on `/closet`) - readable enough on dark, too faint on light; needs
    real contrast values. (2) **`no-scrollbar` is used 17 times but never
    defined**, so the category chip row shows a native scrollbar in both
    themes (pre-existing). (3) The persona indicator dot still uses
    `bg-blue-400`/`bg-rose-400` (`ClosetPage`) and the shoe editor has
    `blue` accents - off-palette for the silver look. (4) Full
    page-by-page light/dark review is still Task 70; only the pages above
    were looked at here.
- **69 Shared components** - Navbar, footer, Toast, SectionWrapper,
  ClothingCard, OutfitCard, CategoryPicker, the modals. Rules:
  `font-black` -> medium/light, label floor ~10-11px (currently 7-8px),
  radii `2rem/3rem` -> `xl/2xl`, hairline silver borders, serif headings.

  **✅ Task 69 COMPLETE 2026-09-21.** Scope: `Navbar`, `MainLayout`
  (footer read as already understated - left alone), `Toast`,
  `ClothingCard`, `OutfitCard`, `CategoryPicker`, `ClothingDetailsModal`,
  `EditClothingModal`, `DeleteConfirmationModal`. `SectionWrapper` is
  purely structural (layout/motion, no color or type) - nothing to change.
  - `font-black` -> `font-medium` on every uppercase-tracked label/button
    across the 8 files (all confirmed to be labels/buttons, not headings -
    real headings are `<h1>/<h2>` tags, already serif+light via Task 67's
    base-layer rule and untouched here).
  - `text-[7px]`/`text-[8px]` -> `text-[10px]` (13 spots: category tags,
    footer captions, form field labels, chip buttons).
  - `rounded-[2rem]` -> `rounded-xl`, `rounded-[2.5rem]` -> `rounded-2xl`
    on the 4 modal/card outer shells that had them (`OutfitCard`,
    `ClothingDetailsModal`, `EditClothingModal`, `DeleteConfirmationModal`).
    Pill shapes (`rounded-full` on nav, chips, primary buttons) are a
    deliberate silhouette, not the "2rem/3rem card blob" the rule targets,
    and were left alone.
  - `shadow-2xl` -> `shadow-lg`, `shadow-xl` -> `shadow-md` throughout (on
    top of Task 68's removal of the colored accent/neon shadows).
  - `EditClothingModal`'s "EDIT GARMENT" heading was uppercase where every
    other modal heading (`ClothingDetailsModal`, `DeleteConfirmationModal`)
    is sentence case - dropped the `uppercase` class for consistency; both
    are `<h2>`, so both already render in the serif display font.
  - **Found while checking Task 67's flagged mobile-navbar overflow**
    (455px pill on a 375px screen even before the toggle) and fixed here
    rather than deferred to 70, since it's the same component: the pill's
    padding/gaps now step down at each breakpoint
    (`px-4 sm:px-6 md:px-8`, `gap-3 sm:gap-8 md:gap-12`, similarly for the
    auth-button row) instead of one fixed size. No icon links were hidden.
    Verified at 375px: pill now 363px, no horizontal page overflow.
  - Verified live in both themes: `/closet` grid + navbar (light, dark,
    375px mobile), `ClothingDetailsModal`, `EditClothingModal` (incl. its
    graphite-accent "Open Studio"/"Save Changes" buttons in light mode),
    `DeleteConfirmationModal` (light) - serif headings, hairline borders,
    restrained shadows, no neon glow, medium-weight tracked labels read
    clearly at the new floor size. `tsc -b --force` + `vite build` clean.
    Test item created for the check was deleted.
  - **Not done here (still Task 70/71):** the 32 low-contrast
    `text-secondary` + low-opacity spots, the missing `no-scrollbar` CSS
    rule, off-palette blue/rose hues, and every page not named above.
- **70 Page passes** - each checked in both modes at desktop + mobile.
  Orphaned pages (`/dashboard`, `DemoPage`, `OutfitBuilderPage`,
  `sections/*`, `PersonaSpotlight`) get the token migration only.

  **✅ Task 70 COMPLETE 2026-09-21.**
  - Applied the same mechanical rules as Task 69 to all 9 in-scope pages:
    `font-black` -> `font-medium`, the `text-[6-9px]` label floor raised
    to `text-[10px]`, `rounded-[2rem]` -> `rounded-xl` and
    `rounded-[2.5rem]/[2.8rem]/[3rem]` -> `rounded-2xl`,
    `shadow-2xl`/`shadow-xl` -> `shadow-lg`/`shadow-md`.
  - **Fixed the 3 findings carried over from Tasks 68/69:**
    - The 12 real low-contrast spots (of the 15 matched - 2 in
      `FlatOutfitBuilderPage` were `disabled:opacity-20`, correctly
      faint only when disabled, left alone) had their `opacity-20/30/40`
      modifier removed outright - `text-secondary`'s own color already
      reads as muted in both themes; stacking opacity on top of an
      already-muted color is what washed it out to near-invisible in
      light mode.
    - Added the missing `.no-scrollbar` utility to `index.css`
      (`scrollbar-width: none` + the `::-webkit-scrollbar` equivalent) -
      it had been referenced 17 times across the app (category chips,
      `CategoryPicker`, `EditClothingModal`, the shoe-pair row) with no
      definition backing it, so every one of those rows showed a native
      scrollbar in both themes until now.
    - `ClosetPage`'s active-persona dot was a hard-coded `bg-blue-400`/
      `bg-rose-400` keyed off persona type - off-palette, and redundant
      since the label right next to it already names the persona.
      Replaced with a single `bg-accent` dot for both types.
  - `FittingTool/ShoeFittingEditor.tsx`'s own `blue`/`emerald` left/right
    tab colors are the same category of off-palette issue but live in a
    component, not a page - left for Task 71 as planned, not fixed here.
  - Verified live in both themes (Landing, Login, Signup logged out;
    Closet, Saved Outfits, Attire with the persona preview, Categories,
    Category Detail incl. its Add-to-Category modal, Persona logged in),
    plus a 375px mobile check on Landing and Closet (no horizontal
    overflow, text wraps correctly). `tsc -b --force` + `vite build`
    clean. Test items/outfit/category created for the check were deleted.
  - **Found, not fixed (out of scope for a styling pass):** `OutfitCard`
    shows "Invalid Date" under an outfit created directly through the
    API in this session (no `createdAt` in the payload) - a
    `formatDate`/data issue, not a color or typography one; flagging for
    a future task rather than fixing blind here.
- **71 Editor / fitting tools** - Fabric colors via a small
  `utils/themeColors.ts` reading the CSS variables; neutral canvas
  surfaces; check the persona base PNGs on the light background.

  **✅ Task 71 COMPLETE 2026-09-21.**
  - **Design decision (not in the original plan text, made while
    implementing it):** the 4 Fabric.js editing stages
    (`ClothingCanvas`, `JacketCanvas`, `ShoeCanvas`, `GarmentCleanup`)
    stay a deliberately dark backdrop in **both** site themes, same
    reasoning as the white captions kept on photo thumbnails throughout
    Tasks 68-70 - the stage has to contrast against transparent-background
    garment cutouts and light-colored fabrics, not follow the surrounding
    chrome. Formalized as two new theme-independent CSS variables in
    `index.css` (`--vy-stage`, `--vy-stage-accent` - defined once at
    `:root`, outside the light/dark blocks, so they never change with
    `data-theme`), exposed as `bg-stage`/`text-stage-accent` Tailwind
    utilities via `@theme inline`.
  - **Bug found and fixed while implementing this:** the small watermark
    captions inside each stage ("Fabric.js v7.4 Core", "Modular Jacket
    Engine", "SHOE STUDIO ENGINE") used `text-text-primary`/`text-accent`
    - fine when the app was dark-only, but since those tokens now flip to
    near-black in light mode while the stage itself stays dark, they
    would have rendered invisible text on a dark background the first
    time anyone opened an editor in light mode. Switched to fixed
    `text-white/80`/`text-stage-accent`.
  - New `utils/themeColors.ts`: `getStageAccentHex()`/`getStageAccentRgba()`
    read `--vy-stage-accent` via `getComputedStyle` (Fabric draws directly
    on `<canvas>`, not the DOM, so it can't use Tailwind classes/CSS vars
    directly). Documented limitation: read once per call, not live - a
    canvas already open when the user flips the site theme won't redraw
    its selection chrome until it re-initializes (e.g. reopening the
    modal).
  - Replaced every hard-coded `#5B8CFF` (the app's old blue accent) with
    the stage accent: `FabricControls.ts`'s selection border/corner-stroke
    (used by all 3 `editor`/`FittingTool` canvases via
    `customizeFabricControls()`), `ClothingCanvas`'s crop-box fill/stroke,
    `JacketCanvas`'s selected-segment outline, `ShoeCanvas`'s foot-indicator
    fill/stroke, and all 4 stages' decorative dot-grid background
    (`GarmentCleanup`'s was already a neutral white, unified to match the
    other 3 for a consistent look).
  - Normalized the stage wrappers themselves: `bg-black/40`/
    `bg-[#0a0a0a]` (arbitrary, one file even used a different literal
    from the other three) -> `bg-stage`; `border-white/5` -> `border-white/10`
    for a bit more definition against the now-opaque stage;
    `rounded-[2rem]/[2.5rem]/[3rem]` -> `rounded-xl`/`rounded-2xl`
    (Task 69/70's bucketing, applied here since these files were untouched
    until now); `font-black` -> `font-medium`; label floor to `text-[10px]`;
    `shadow-2xl`/`xl` -> `lg`/`md`. Applied to the 5 files the plan names
    (`ClothingCanvas`, `JacketCanvas`, `ShoeCanvas`, `GarmentCleanup`,
    `FittingEditor`).
  - **Also fixed, as promised in Task 70's note:** `ShoeFittingEditor`'s
    blue/emerald "Calibrating..." badge (color-coded by which foot is
    active) was off-palette and redundant next to the "LEFT FOOT"/"RIGHT
    FOOT" heading right above it - now a single `bg-accent/10 text-accent`
    badge, same reasoning as `ClosetPage`'s persona-dot fix.
  - Verified live: opened the Fabric Studio (`ClothingCanvas` via
    `FittingEditor`) in both themes - the selection handle border/corners
    are silver in both, confirmed programmatically
    (`getStageAccentHex() === '--vy-stage-accent' === '#C7CBD1'`); the
    stage stays a clean dark backdrop with the mannequin/garment clearly
    visible regardless of the surrounding modal chrome's theme. Persona
    base PNGs (`public/personas/*-base.png`, grayscale) already confirmed
    readable on the light page background in Tasks 69/70's screenshots -
    re-confirmed here in the editor's own dark stage too.
    `tsc -b --force` + `vite build` clean; `bg-stage`/`text-stage-accent`
    confirmed present in the built CSS. Test item deleted.
  - **Deliberately out of scope (not named in the plan's Task 71 text):**
    `JacketFittingEditor.tsx`, `UploadFlow.tsx`, `JacketSegmentationTool.tsx`,
    `ShoeSymmetryCheck.tsx`, `CanvasToolbar.tsx`, `TransformPanel.tsx` still
    carry pre-redesign `font-black`/tiny-label/big-radius styling (their
    color *tokens* were already migrated in Task 68, just not this
    editorial pass) - flagging in case full coverage there is wanted as
    its own follow-up task, since re-scoping to the whole `FittingTool`
    directory here would have been a substantially bigger change than
    what was planned and approved for this task.
- **72 Branding** - `BrandMark` (theme-aware logo; interim tracked-caps
  text wordmark until the user's files land in `frontend/public`),
  rename strings (`Navbar`, `MainLayout` footer,
  `ClothingDetailsModal.tsx:156`, `sections/AvatarSection.tsx:100`),
  `index.html` title + favicon, remove unused `App.css`.

  **✅ Task 72 COMPLETE 2026-09-21.**
  - New `components/BrandMark.tsx`: the interim VYSVI text wordmark
    (`font-display`, wide-tracked, matching the logo's letterforms), with
    an optional `withSubline` prop for the two-line "VYSVI / DIGITAL
    WARDROBE" lockup. Explicitly the placeholder the plan called for -
    its own top comment says where the real `<img>` swap (keyed off
    `data-theme`) goes once the user's transparent PNG/SVG + dark-ink
    files land in `frontend/public`. `frontend/public/logo.png` (which
    the user has already dropped in) is **not** wired in yet - it has a
    solid light background baked in, so it would show as a white box in
    the dark navbar; still needs a transparent version.
  - Wired into `Navbar.tsx` in place of the old "DIGITALCLOSET" text logo.
  - Renamed every remaining brand string: `MainLayout` footer, `index.html`
    `<title>` (was the Vite default "frontend"), `ClothingDetailsModal.tsx`'s
    collection caption, the orphaned `sections/AvatarSection.tsx`'s
    decorative side label, and `LandingPage.tsx`'s hero - rebuilt as
    VYSVI's own two-line lockup (`VYSVI` + a tracked "DIGITAL WARDROBE"
    subline) rather than just swapping the word "Digital Closet" for
    "VYSVI" inside the old two-line "DIGITAL / CLOSET" heading shape.
  - **Judgment call:** `ClosetPage.tsx`'s own `<h1>` also said "DIGITAL
    CLOSET", but that was always this *page's* title coinciding with the
    old *app* name, not the brand mark itself - the nav link to it is
    just "Closet". Renamed to "MY WARDROBE" (matching "Complete Wardrobe
    Management" directly beneath it) instead of putting "VYSVI" on a
    page whose route is `/closet`.
  - `App.css` confirmed unreferenced anywhere in `src` and removed.
  - **Not done, both flagged rather than acted on unilaterally:**
    - **Favicon:** left as the existing purple lightning-bolt SVG. A
      proper "V" monogram needs a clean vector/transparent source, which
      a raster lockup with a baked-in background can't reliably provide
      automatically - same blocker as the navbar logo itself.
    - **Landing hero body copy** ("build *futuristic* outfits... in a
      high-end fashion ecosystem") still uses the pre-redesign
      "futuristic" voice, which sits oddly against the new editorial
      direction. Left alone - a marketing copy rewrite is a content/voice
      decision, not a rename, and wasn't part of what this task's plan
      text asked for.
  - Verified live in both themes: navbar wordmark, Landing hero lockup,
    footer, `/closet`'s "MY WARDROBE" heading, and the browser tab title
    ("VYSVI — Digital Wardrobe", confirmed via the tab's own title, not
    just the HTML source). `grep` confirms zero remaining "Digital
    Closet"/"DIGITALCLOSET" strings anywhere in `frontend` (source,
    `public`, `index.html`, the READMEs). `tsc -b --force` + `vite build`
    clean.

**Phase 9.6 is now complete (Tasks 66-72).** Remaining open item: the
user's transparent-background logo files, for the real `BrandMark`/favicon
swap - not blocking, since the text wordmark stands on its own.

Verification for each: `tsc -b --force`, `vite build`, live in both modes
(browser `colorScheme` emulation for system-follow), screenshots of every
changed page, contrast spot-checks, Fabric handles visible in both modes.

**Open dependency:** logo files from the user for Task 72's final swap.

---

# Phase 9.7 — Shoe-save bug, real logo, Outfit Showcase, Attire redesign *(planned 2026-09-21, before Phase 10)*

Four new requests from the user, given together right after Phase 9.6
shipped: a real bug (shoe images disappearing after save), wiring in the
real logo file the user placed at `frontend/public/logo.png` (favicon +
other spots, keeping the navbar's text wordmark as-is), a new "Outfit
Showcase" page reachable only via the logo, and a redesign of the Attire
page's browse panel. Planned as `/plan` before starting, per the user's
own request - full plan at
`C:\Users\javid\.claude\plans\partitioned-painting-crab.md`. Same
precedent as 9.5/9.6: lands on `phase-9-categories-experience`, Phase 10
(crop tool) still waits until this is done too. Tasks numbered onward
from 72, i.e. 73-76.

### Task 73 — Fix shoe-save losing its image

**✅ COMPLETE 2026-09-21.** Root cause (confirmed by reading every save
path in `UploadFlow.tsx`): `bgRemovalService` always returns a local
`URL.createObjectURL(...)` blob URL (`lib/background-removers/{browser,api}.ts`
- every code path, success or fallback). Every *other* save path in
`UploadFlow.tsx` (`handleCleanupComplete`, `handleCleanupSkip`,
`handleSkipSave`) uploads that blob to Cloudinary before persisting the
URL - the shoe path (`startProcessing`'s `SHOES` branch) never did, so
the item saved with `imageUrl` = a `blob:` URL that only lives for the
tab's session. Not a race condition (the save itself correctly awaits
before closing the modal) and not a backend gap (`ClothingRequest.java`
only validates non-blank/length, no scheme check - it just stores
whatever it's handed).

**Fix:** after each `bgRemovalService.removeBackground(...)` call in the
`SHOES` branch, convert the blob URL to a `Blob` (`fetch` + `.blob()`)
and upload it via `cloudinaryService.uploadImage(...)` - the exact
pattern `handleCleanupComplete` already used elsewhere in the same file
- storing the returned hosted URL instead of the raw blob URL. For a
symmetrical pair (the common case), uploads once and reuses the URL for
both shoes, matching the existing "reuse one result" structure; an
asymmetrical pair uploads both sides separately.

**Verified live:** drove the real upload flow end-to-end in the browser
(file input -> SHOES category -> "No, Mirror This" -> background removal
-> Shoe Studio -> Complete Pair), then read the created items back from
the API: both shoes got the *same* real `https://res.cloudinary.com/...`
URL (confirming the symmetrical-pair dedup), and that URL resolves to a
real 95KB PNG (`curl` `200`, `image/png`). Reloaded `/closet` afterward
and confirmed both `<img>` elements actually loaded (`complete: true`,
real `naturalWidth`) - the precise repro of "the image disappears" no
longer reproduces. `tsc -b --force` + `vite build` clean. Test items
deleted after.

### Task 74 — Process the real logo

**✅ COMPLETE 2026-09-21.** The plan assumed `logo.png` needed
chroma-keying to remove a baked-in background - turned out to be wrong,
and worth recording: a per-pixel alpha scan (`getImageData`, sampling a
grid across the whole image) showed the file **already has real alpha
transparency** - the flat "cream background" seen in every preview
(this plan's own investigation included) was just the image viewer's own
light backdrop showing through, not part of the file. No chroma-keying
was needed at all; `public/logo.png` is used as-is.
- **Favicon:** auto-cropped to just the "V" ribbon mark (excluding the
  wordmark, illegible at favicon size) by scanning the alpha channel for
  the mark's bounding box within the image's upper portion, padding it,
  and squaring it. Getting the resulting canvas data safely out of the
  browser pane and onto disk needed its own workaround - long base64
  strings hand-typed through the model corrupt in transit (proven by two
  failed attempts, one truncated by a tool-side length limit, one
  transcribed wrong) - so the crop is instead uploaded through the app's
  own `cloudinaryService.uploadImage` (already working, no new
  infrastructure) and then `curl`ed straight to `public/favicon.png`,
  byte-exact, no manual transcription anywhere in the path. Wired into
  `index.html` in place of the old placeholder `favicon.svg` (left in
  `public/`, unreferenced, not deleted).
- **Light-mode contrast:** measured, not guessed - a luminance scan of
  every opaque pixel gives the artwork an average contrast of only
  ~1.7:1 against the light theme's background (the palest highlight/text
  pixels closer to ~1:1, effectively invisible), versus ~8.9:1 on the
  dark background. The planned `filter: invert(1)` trick was analyzed
  mathematically (grayscale inversion is exactly `1 - luminance` here)
  rather than eyeballed, since the browser pane's screenshot tool was
  unreliable this session (see below) - it turned out to be only a
  partial fix (roughly half the wordmark's tonal range crosses into good
  contrast, half doesn't), not worth the risk of an odd color cast for a
  modest gain. Went with the plan's stated fallback instead: the same
  asset in both themes. **Known result:** the logo reads clearly in dark
  mode and only "soft"/muted in light mode - a real dark-ink variant from
  the user would look meaningfully better; not blocking, since this is
  decorative branding, not functional text.
- Used for the favicon and `LandingPage`'s hero (replacing Task 72's text
  lockup, confirmed with the user beforehand) - an `sr-only` `<h1>` kept
  alongside the `<img>` for accessibility/SEO. `Navbar`/`BrandMark` stay
  text, per the user's explicit preference.
- **Tooling note:** the in-app browser pane's screenshot tool rendered
  at a tiny, unusable size for most of this task regardless of tab or
  resize calls (host-side, not a page bug) - verification leaned on
  DOM-level checks instead (`naturalWidth`/`complete` on the loaded
  `<img>`, `get_page_text` confirming full page content, the favicon
  `<link>`'s resolved `href`), which is why this task's evidence is
  programmatic rather than a screenshot. One resize call later in the
  task did recover a normal screenshot, confirming the page itself was
  never actually broken.
- `tsc -b --force` + `vite build` clean.
### Task 75 — New Outfit Showcase page

**✅ COMPLETE 2026-09-21.** New `frontend/src/pages/OutfitShowcasePage.tsx`
at route `/showcase` (protected). `Navbar.tsx`'s logo link is now
`to={isAuthenticated ? '/showcase' : '/'}` - guests keep landing on
`LandingPage` as before (no outfits to show).
- **Extracted, not duplicated:** `OutfitCard.tsx`'s inline `outfitPersona`
  construction (eligibility filter + `equippedFromOutfitItems` +
  `applyLegacyShoeFallback`) moved to a new `buildOutfitPersona(outfit,
  allItems)` in `utils/personaEligibility.ts`, used by both `OutfitCard`
  (refactored to call it) and the new page - one implementation, not two.
- **The carousel mechanic:** three slots (left/active/right), each a
  `motion.div` sharing a `layoutId` keyed by outfit id. When the active
  index changes, the *same* outfit's element moves from a side slot to
  the center slot (or back) and framer-motion's `layout` prop animates
  that move automatically (the FLIP technique) - no custom slide-direction
  variants needed, confirming the plan's own finding that no carousel
  library or existing pattern was needed. A 2-outfit edge case (left and
  right would otherwise resolve to the same outfit, colliding as
  React keys) only shows that outfit on the right.
- Each visible outfit renders on its **own** persona type via
  `PersonaRenderer` - verified live with a mixed MALE/MALE/FEMALE set of
  3 outfits, confirming the active slot correctly showed `female-base.png`
  when that outfit was centered while the MALE side outfits kept
  `male-base.png`, with no bleed from the app's single global persona
  selection.
- Zero-outfit state: the real logo (Task 74) + a line of copy + a
  "Let's Get Started" button into the Attire builder, matching
  `LandingPage`'s visual language (eyebrow badge, `rounded-full` accent
  button) rather than a new style.
- **Verified live:** logo link resolves to `/showcase`; empty state
  renders correctly with 0 outfits; created 3 test outfits (2 MALE, 1
  FEMALE) and confirmed default active index, the "Next" button, and
  directly clicking a side card all switch the active outfit correctly
  (checked via the heading text and the persona base image actually
  rendered, not just component state). `tsc -b --force` + `vite build`
  clean; test data deleted after.
- **Tooling note (same as Task 74):** the browser pane's screenshot
  capture rendered at a small fraction of true size for this entire task
  regardless of viewport/resize calls - confirmed via one screenshot that
  did come through recognizably (a correctly-proportioned small/large/
  small three-mannequin row) that this was a capture-scale issue, not a
  real layout bug; everything else was verified through DOM state and
  `get_page_text` instead.

**Follow-up revision, same task, before committing** - user feedback
after seeing the first version: the active outfit's *default* view
shouldn't be the persona render at all.
- New `buildShowcaseRows(items)` in `utils/selectionDisplay.ts` (next to
  its existing `groupSelectedItemsForDisplay`, a deliberately different
  set of rules, not a shared codepath - see that function's own comment):
  fixed rows Jacket, Top, Bottom, Shoes, each collapsed to one
  representative image + a "+N" badge for anything beyond it, with a
  Dress replacing the Jacket+Top rows entirely when present rather than
  sitting alongside them, and Accessories reduced to a trailing count
  only ("+N Accessories", no row/image - there's no single "first"
  accessory to picture). Shoes are the one exception to "one image": a
  matched left/right pair shows both feet as the row's normal content
  (not one foot + a misleading "+1"), only counting anything beyond the
  pair as "extra".
- The active slot now shows this row breakdown by default; persona mode
  is an explicit "View on Persona" button below the rows (toggle back via
  "Show Pieces"), reset to the row view whenever the active outfit
  changes. The button sits after a row list tall enough to often need a
  scroll to reach, rather than being pinned near the top - matches "only
  appears if you scroll down" as a natural consequence of row-list
  height, not a special scroll-triggered reveal.
- Persona mode gets its own "majestic" treatment per the feedback (an
  "aura"): a new `PersonaAura` wrapper layers two blurred, softly pulsing
  `bg-accent` glow circles behind the `PersonaRenderer`, using the theme's
  own accent token (silver in dark mode, graphite in light) rather than a
  fixed always-bright color - consistent with the rest of the redesign's
  theme-driven palette instead of a one-off hard-coded glow.
- Side slots (the small peek previews) switched from a persona render to
  a plain item-photo collage (reusing the 2x2-grid-with-overflow-badge
  idiom `OutfitCard.tsx` already uses for its own non-persona view) -
  consistent with "not persona mode by default" applying to the whole
  page, not just the active slot.
- **Verified live** with 3 new test outfits built specifically to hit
  each rule: a dress outfit (dress + 2 bottoms + a shoe pair + 2
  accessories) confirmed the Dress row replacing Jacket/Top, a "+1" badge
  on the extra bottom, the shoe pair showing both feet with no badge, and
  "+ 2 Accessories"; a layered outfit (2 jackets + top + bottom + one
  unsided shoe) confirmed the Jacket row's own "+1" badge with no badge
  on the single-count rows, and the "View on Persona" toggle (confirmed
  the persona image actually swaps in, the aura's glow elements mount,
  and the button's label flips to "Show Pieces"). `tsc -b --force` +
  `vite build` clean; test data deleted after.
- **Not yet tuned:** the vertical alignment between the (now much taller)
  active card and the smaller side-slot thumbnails uses an estimated
  fixed offset rather than a measured one, since this session's screenshot
  tooling couldn't reliably confirm the exact visual alignment - flagged
  for a look once the user can see it live.

**Second follow-up, same task, before committing** - user feedback after
actually trying it live: "random outfits" were appearing, and the row
labels needed to go.
- **Root cause of the "random outfits":** the page never filtered by
  persona type at all - it showed every saved outfit regardless of
  `avatarType`. `SavedOutfitsPage.tsx` already established the convention
  that outfit listings scope to the active persona
  (`outfits.filter(o => o.avatarType === persona.type)`); this page just
  hadn't followed it, so an outfit saved for the *other* persona type
  would show up unprompted - which is exactly what "random" outfits
  appearing means, and also explains "if there is only one then only
  one" (once correctly scoped, a single matching outfit no longer had a
  phantom second one keeping it company). Fixed by adding the same
  filter, sourced from `usePersonaStore`.
- **The row labels ("Jacket"/"Top"/etc.):** removed from `CategoryRow` -
  the photos are shown without a text label now, per feedback (user
  referred to this page as "the landing page" since it's what you land
  on from the logo - there's no such labeling on the actual marketing
  `LandingPage.tsx` to have removed there).
- **Verified live:** created one MALE and one FEMALE outfit, confirmed
  the page defaults to showing only the MALE one (pagination dots
  correctly hidden, since exactly one outfit matches) and switching the
  active persona to FEMALE (via `usePersonaStore`) correctly swaps to
  showing only the FEMALE outfit instead; confirmed no `JACKET`/`TOP`/
  `BOTTOM`/`SHOES`/`DRESS` text appears anywhere on the page. `tsc -b
  --force` + `vite build` clean; test data deleted, persona reset to
  MALE after.

**Third follow-up, same task, before committing** - "center the items and
don't do that weird square", and a real request for drama: "an aura flow
like dragon ball when they go super saiyan."
- **Row items:** `CategoryRow` was left-aligned with each image boxed in
  a bordered/background tile - centered it (`justify-center`) and dropped
  the box entirely; these are already-cutout garment photos, so a
  hard-edged square around each one fought the image rather than framing
  it. They now float directly on the card with just a drop-shadow for
  definition.
- **The aura:** replaced the earlier soft pulsing glow with an actual
  power-up flare - an entry flash that blooms and fades on mount, 8
  spinning energy rays, 2 expanding shockwave rings, a hot core that never
  fully settles, and rising sparks - all framer-motion + CSS gradients,
  no new dependency or image asset. **Deliberate exception to the
  redesign's own silver/graphite-only rule:** uses a fixed warm gold
  (`rgba(255,214,130,...)`) rather than the theme accent token, since the
  ask was specifically for something bright and dramatic in both themes
  for this one moment, not a blend-in glow - the same kind of considered,
  called-out exception as the Fabric.js editor stage staying dark
  regardless of theme (Task 71).
- **Verified live:** confirmed the row container has `justify-center` and
  its images no longer sit inside a `<div>` wrapper box; toggled persona
  mode and confirmed all 18 expected gold-colored elements mount (1 flash
  + 8 rays + 2 rings + 1 core + 6 sparks - an exact match to the design).
  `tsc -b --force` + `vite build` clean; test data deleted after.

**Fourth follow-up, same task, before committing** - "I like it" on the
aura, plus: center the carousel row with the heading above it, remove the
card box still surrounding the active outfit's content, and extend the
aura to the default (rows) view, not only persona mode.
- **The remaining "square":** the per-item image tiles were fixed last
  round, but the active slot's *content* was still sitting inside its own
  `rounded-2xl border bg-card shadow-2xl` card. Removed that wrapper
  entirely - the rows/persona content and its aura now float straight on
  the page background, no boxed container left anywhere on this page.
- **Centering:** the carousel row (prev arrow / side slots / active slot
  / next arrow) had `items-start` with a guessed `mt-24` on the side
  slots, left over from when the active slot was a much taller card and
  needed a rough manual offset to line up against the small side
  thumbnails. With the card gone this hack was no longer needed or
  correct - switched to a plain `items-center`, matching the heading
  above it, same axis as everything else on the page.
- **Aura on both views:** `PersonaAura` renamed `AuraGlow` and moved to
  wrap the *entire* active slot (both the rows view and the persona view,
  via one shared `AnimatePresence`) instead of only the persona branch -
  it now plays its entry flash once when an outfit becomes active and
  keeps pulsing underneath whichever of the two views is currently shown,
  reading as "this outfit has the stage" rather than "you're now in
  persona mode."
- **Verified live:** confirmed 18 gold aura elements are already mounted
  on the *default* rows view with no click needed (previously only
  appeared after pressing "View on Persona"); confirmed zero elements
  anywhere on the page still combine `bg-card` + `shadow-2xl` (the old
  card wrapper); confirmed the carousel row's container class is exactly
  `items-center justify-center`. `tsc -b --force` + `vite build` clean;
  test data deleted after.

**Fifth follow-up, same task, before committing** - "items appear too
small and section not center with the page itself."
- **Item size:** `CategoryRow` images bumped from `w-16 h-16` (64px) to
  `w-24 h-24 sm:w-28 sm:h-28` (96/112px) - a real "too small" complaint,
  not a judgment call.
- **The actual centering bug:** centering a *group* of unevenly-present
  elements centers the group, not any one element inside it. The carousel
  row's side slots are conditionally rendered (no left slot below 3 total
  outfits; either side can be entirely empty at 0-1), so `justify-center`
  on the row was centering however much content happened to be present -
  e.g. with only a right slot showing (the common 2-outfit case), the
  active card sat visibly left-of-center, pulled by the extra width on
  its right. Fixed by giving both the left and right positions a fixed
  width (`w-[150px] sm:w-[180px]`, matching the side-slot width)
  regardless of whether an outfit is currently occupying it, so the row's
  total width - and therefore its center - stays constant no matter how
  many side outfits exist.
- **Verified live, numerically, not just by eye** (screenshot tooling was
  still unreliable this session): measured the active card's actual
  `getBoundingClientRect()` center against the viewport's center at
  1000px wide. With 1 outfit (no side slots): 492.5 vs a true center of
  500. Added a 2nd outfit (right slot only, the case that was actually
  broken before this fix): still 492.5 - identical, confirming a
  present/absent side slot no longer shifts the active card. The
  remaining 7.5px is the prev/next buttons' own width/gap, not a bug (they
  sit outside the reserved-width region and are already symmetric).
  Confirmed the bumped item images measure 112px at this viewport width.
  `tsc -b --force` + `vite build` clean; test data deleted after.

**Sixth follow-up, same task, before committing** - "items pics still
look small make them bigger", "aura flow make it way way way slower",
"change it to silver not gold."
- **Item size, again:** the 112px bump apparently still read as small -
  went further this time, to `w-32 h-32 sm:w-40 sm:h-40` (128/160px), and
  widened the active card itself (`w-[300px]/[400px]` ->
  `w-[340px]/[460px]`) so two-shoe rows and a "+N" badge still have room
  at the larger size.
- **Aura speed:** every looping duration roughly tripled - ray rotation
  14s -> 48s, ray flicker 1.6s -> 5.5s, shockwave rings 2.5s -> 8s, hot
  core pulse 2s -> 7s, rising sparks 2.2s -> 7.5s (stagger delays scaled
  with them). The one-time entry flash only moved slightly, 0.7s -> 1.2s
  - it is not part of the "flow" that needed slowing, it is a single
  burst.
- **Aura color:** every gold `rgba(255,214/236/224,...)` value replaced
  with silver (`rgba(199,203,209,...)` - the app's own dark-theme accent
  hex - plus near-white `rgba(226,230,235,...)`/`rgba(240,242,245,...)`
  for the brighter highlights). Still a fixed color rather than the theme
  accent token, for the same reason as before (light mode's accent is a
  dark graphite that would kill the "bright" glow) - it just happens to
  now be the same hue as the theme's dark-mode accent instead of an
  unrelated gold.
- **Verified live:** confirmed item images measure 160px at this
  viewport's `sm:` breakpoint; dumped every aura element's actual
  rendered `style` attribute and confirmed zero occurrences of any gold
  value (`214`, `236,190`, `224,160`) and exclusively the new silver/
  near-white rgba tuples across all 11 top-level aura elements (the
  browser normalizes `rgba(199,203,209,...)` to `rgba(199, 203,
  209,...)` on readback, which is why an earlier same-session substring
  check without spaces came back with a false "0 found" for both colors -
  worth remembering for next time). `tsc -b --force` + `vite build`
  clean; test data deleted after.

**Seventh follow-up, same task, still before committing** - two real
screenshots this time (not just DOM measurements) showing the aura as a
tall, stretched oval rather than a circle, and the four category rows
spaced far enough apart that the full outfit required scrolling to see -
"look how the clothes look way to separated ... you even need to scroll
down to see full outfit", plus "make aura flow go 100x slower."
- **The oval's actual root cause (not just "too tall"):** every aura
  layer (flash, spinning rays, shockwave rings, hot core) was sized as a
  *percentage of its own container* (`w-[140%]`, `w-[70%]`, `w-[85%]`,
  `inset-0`), and that container is the rows content block - 4 stacked
  128px image rows, portrait by construction (much taller than wide). A
  percentage of a portrait box is itself a portrait box, so the "circles"
  were mathematically guaranteed to render as ellipses no matter how
  tight the row spacing got; the prior rounds' padding/size tweaks could
  shrink the oval but never round it. Fixed at the source: every circular
  aura layer now gets a fixed, explicitly square pixel size
  (`w-[Npx] h-[Npx]`, same value both axes, responsive at `sm:`) and
  centers itself with `top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`
  instead of inheriting the content box's shape. Confirmed live: the
  rendered shockwave ring and hot core both measured with identical
  width and height (e.g. 319x319, 337x337) at multiple points during
  their own looping scale animation - genuinely circular, not
  coincidentally similar.
- **Row/page spacing tightened further:** `CategoryRow` padding
  `py-3` -> `py-0.5`; images `w-32/h-32 sm:w-40/h-40` (128/160px) ->
  `w-28/h-28 sm:w-32/h-32` (112/128px) - still well above the original
  64px, per the earlier "still too small" feedback, but no longer the
  main driver of a tall content block; `AuraGlow`'s own `py-6` -> `py-2`;
  active card width `w-[340px]/[460px]` -> `w-[300px]/[400px]` to match.
- **The real scroll cause turned out to be page-level, not the rows:**
  a full breakdown of the rendered layout (walking every ancestor's
  `getBoundingClientRect()` from an image up to the page root) found
  `OutfitShowcasePage`'s own wrapper had `py-24` (96px top **and**
  bottom), stacked on top of `MainLayout`'s `<main className="pt-24">`,
  which every other page already relies on alone for navbar clearance
  (confirmed against `SavedOutfitsPage.tsx`'s topping-padding-free
  wrapper) - a redundant 96px gap above the outfit before a single row
  even rendered. Changed to `pb-16` (no top padding, main's `pt-24`
  covers it) and trimmed the heading's `mb-12` to `mb-8`.
- **Aura speed, round 2:** every looping duration roughly tripled again
  on top of the prior round's tripling - ray rotation 48s -> 150s, ray
  flicker 5.5s -> 16s, shockwave rings 8s -> 22s, hot core pulse 7s ->
  18s, rising sparks 7.5s -> 16s (stagger delays scaled proportionally).
  The one-time entry flash is unchanged - still a single burst, not part
  of the looping "flow."
- **Verified live:** at a realistic 1280x900 viewport, the active
  outfit's full row stack *and* its "View on Persona" toggle button now
  fit entirely above the fold (button bottom measured at 821px, well
  within the 900px viewport) - the page still scrolls further than that
  only to reach the site-wide footer every page has, not to see the rest
  of the outfit. `tsc -b --force` + `vite build` clean; the "Spacing
  Test" test outfit and its 5 items were deleted after (verified an
  empty result on re-fetch). Screenshot tooling was unreliable again
  this round (rendered at the wrong scale regardless of viewport/resize)
  - verification relied on `getBoundingClientRect()` measurements plus
  the user's own two screenshots for the qualitative "does this look
  right" judgment.

**Eighth follow-up, same task, still before committing** - two more real
screenshots: one of a real 4-row outfit ("size is correct" - the
Seventh follow-up's fixes were working as intended), and one of a real
2-row outfit (just a jacket + a shoe pair) reporting "too much space
between garments" even though the size was right.
- **Images had actually gotten smaller than approved, not just tight:**
  the Seventh follow-up's scroll fix had shrunk `CategoryRow`'s images
  from 160px back to 128px as a side effect (it wasn't the point of that
  fix, but it rode along). Since the scroll problem's real cause turned
  out to be the page-level double-padding bug (also fixed that round),
  there was no longer any reason to keep images smaller than the size
  already validated live before - restored to `w-32 h-32 sm:w-40 sm:h-40`
  (128/160px) and widened the active card back to `w-[340px] sm:w-[460px]`
  to match (both exactly reverting to the pre-Seventh-follow-up values).
- **The "too much space" was the aura, not the rows:** measured the
  actual gap between a jacket image's bottom edge and a shoe image's top
  edge in a real 2-row (jacket + shoes) outfit - 5px, i.e. still packed
  tight. The visual impression of empty space was the aura: it had one
  fixed size (380px/480px) picked to look right around a *full 4-row*
  outfit, so on a sparser 2-row outfit the same circle simply overshoots
  the actual garments, and an oversized glow around a small cluster of
  images reads as "space between them" even when the images themselves
  aren't far apart.
- **Fix:** `AuraGlow` now takes a `rowCount` prop (`rows.length`, already
  computed in `ShowcaseSlot`) and picks its flash/ray/ring/core sizes
  from a small lookup keyed 1-4 rows, diameter scaling roughly with
  `sqrt(rowCount)` off the already-validated 4-row size (aura is a 2D
  area, so a linear-with-count scale would shrink too aggressively).
  Every size in the lookup is still a literal, fully-written Tailwind
  arbitrary-value class string (`w-[270px] h-[270px] sm:w-[340px]...`)
  rather than one built from a template at runtime - Tailwind's build-time
  scanner can only pick up literal class text, confirmed by the CSS
  bundle growing (71.42kB -> 72.35kB) after adding the new literal
  entries. The aura's *shape* fix from the Seventh follow-up is untouched
  - each size is still explicitly square, so it's still always a circle,
  just a differently-sized one depending on how many rows the outfit has.
- **Verified live:** a real 2-row test outfit (jacket + shoe pair)
  measured its glow ring at 238x238px (square) nested inside a ~325px
  content span, vs. the old fixed ring (445x445px, bigger than the
  content) - now sized *under* the content instead of dwarfing it. A
  fresh 4-row outfit still measured the original, already-approved
  336x336px ring with 160px images, unaffected by the change. `tsc -b
  --force` + `vite build` clean; all test outfits/items (2-row, 4-row,
  and a 3rd minimal one used below) deleted after, confirmed empty on
  re-fetch.
- **Found in passing while testing the above, then fixed the same round
  (user asked for it immediately):** clicking "Next" between two test
  outfits to compare row counts revealed the outfit-switch transition
  itself getting stuck - the outgoing side-slot thumbnail and the
  incoming active view stayed simultaneously rendered and overlapping
  (confirmed via two matching `<img alt="...">` elements at once, one
  with the collage's classes, one with the active row's classes),
  reproduced twice. See the Ninth follow-up below for the investigation
  and fix.

**Ninth follow-up, same task, still before committing** - fixing the
switching bug found above, at the user's request the same round it was
reported.
- **First attempt (shared `layoutId` removed, `AnimatePresence
  mode="wait"` added):** the original theory was that a `ShowcaseSlot`
  moving from a side slot to the active slot isn't actually the same
  React component instance at the same tree position (side slots live
  inside their own `AnimatePresence`, the active slot is a separate
  sibling) - only a shared `layoutId` tied them together for framer-
  motion's FLIP animation, and combined with the same component
  conditionally rendering totally different markup (collage vs.
  rows+button) between those two mount points, that looked like it was
  confusing framer-motion's layout projection. Removed `layout`/
  `layoutId` entirely and wrapped each slot's conditional render in its
  own `AnimatePresence mode="wait"` (exit the outgoing outfit fully
  before mounting the incoming one) instead.
- **That attempt didn't work either - a different stuck state, not a
  dev-mode artifact:** re-tested the same click sequence and found the
  outgoing active outfit's wrapper had genuinely finished its exit
  animation (`style="opacity: 0"`, confirmed by reading the live inline
  style) but was never removed from the DOM, and the incoming outfit
  never mounted into that slot at all - meanwhile the heading (bound
  directly to `activeOutfit?.name`, no animation involved) had already
  updated correctly, confirming the *data* was right and only the
  *animated swap* was stuck. Suspected this might be a React 18
  `StrictMode` double-invoke artifact (a known category of dev-only
  `AnimatePresence` desync) - `main.tsx` does have `<StrictMode>` - so
  verified against an actual `vite build` + `vite preview` (production
  React, no double-invoke): identical stuck state, ruling that out. This
  is a genuine limitation of `AnimatePresence mode="wait"` swapping a
  single child by key in this setup, not a dev artifact.
- **Actual fix:** removed `AnimatePresence` from all three slots
  entirely. Each slot now renders `<ShowcaseSlot key={outfit.outfitId}>`
  directly - on a key change, React unmounts the old instance and mounts
  the new one synchronously, with no exit animation to wait on and
  therefore no way to get stuck between two children. `ShowcaseSlot`'s
  own mount-time `initial`/`animate` opacity fade still plays for
  whichever outfit newly occupies a slot; the outgoing one now
  disappears instantly instead of fading out, a smaller visual effect
  traded for one that cannot fail this way.
- **Verified live:** reproduced the exact previously-broken sequence
  (click "Next" between two single-item test outfits) - heading and DOM
  now agree immediately (the newly active outfit's image carries the
  active row markup, the demoted one carries the side collage markup),
  exactly one `<img>` match per item, no duplicates. Repeated with four
  rapid clicks in a row (next, prev, next, next) - still exactly one
  match per item afterward, no stuck or doubled state. `tsc -b --force`
  + `vite build` clean; test outfits/items deleted after, confirmed
  empty on re-fetch.

**Tenth follow-up, after Phase 9.7 shipped, `/plan`ned first** - "when
you click an arrow I want it to be a smoth animation to the next set of
clothes right now the next set just appears," plus "I want the screen
to stay the same when switching right now if a set is full and another
only has one item the screen size changes and arrow move around." Asked
for explicitly via `/plan` given the history above - two earlier
attempts at animating this exact swap both got stuck.
- **Approach, chosen specifically to avoid retrying either prior
  failure:** both previous attempts depended on framer-motion's
  `AnimatePresence`/`exit` lifecycle resolving an unmount, which proved
  unreliable in this file's nested-`AnimatePresence` structure (the
  active slot's own inner rows/persona toggle already uses
  `AnimatePresence mode="wait"`). This round avoids that mechanism
  entirely: the active `ShowcaseSlot` is now a single **persistent**
  instance (`key="active-slot"`, never remounted by outfit id) rather
  than being swapped per outfit, fed by a small lagging
  `displayedOutfit`/`displayedPersona` state that only catches up to the
  real `activeOutfit` after a fixed 250ms via `setTimeout` (with an
  `isFading` boolean driving a plain `animate` opacity fade on a
  wrapper - `animate`, not `exit`, so there is no unmount for anything
  to get stuck on).
- **A real bug found while verifying this round's own new code (not a
  repeat of the old one):** `ShowcaseSlot`'s own root already had its
  own `initial`/`animate` opacity fade (left over from when it used to
  remount per outfit). With the new outer fade wrapper ALSO animating
  opacity around it, the two nested, independently-animating opacity
  controls conflicted - live testing found the active slot stuck at
  `opacity: 0` indefinitely after a switch (confirmed via
  `getComputedStyle`, not just the inline style, and confirmed it was
  not the old duplicate-element bug - only one instance existed, it was
  just invisible). Fixed by giving `ShowcaseSlot` `initial={isActive ?
  false : { opacity: 0 }}` - the outer wrapper now solely owns opacity
  for the active role; the side role (which still remounts per outfit,
  unchanged) keeps its own fade exactly as before.
- **Preserving the entry flash:** the one-time "power-up flash" used to
  replay on every switch as a side effect of the whole slot remounting.
  Since the active slot no longer remounts, `AuraGlow` now takes a
  `flashKey` prop (the outfit id) applied as a plain `key` on just the
  flash element (no `exit`, not wrapped in `AnimatePresence` - a bare
  `key` change is a synchronous remount with nothing to get stuck on,
  unlike an awaited exit). The looping rays/rings/core/sparks
  deliberately do NOT get this treatment - they stay the same instance
  and keep cycling uninterrupted through a switch, which reads better
  than restarting on every click. Verified both halves directly: tagged
  the flash element and the ray wrapper with a custom DOM property
  before a switch, then checked identity after - the flash was a
  provably new node (property gone), the ray wrapper was the same node
  (property survived).
- **Layout stability:** the carousel row had no fixed height, so
  `items-center` recentered the prev/next arrows against whatever
  height the active outfit's own row count (1-4) happened to produce -
  measured live, a real 4-row/2-shoe outfit needed 731px of content at
  the `sm:` breakpoint and 603px at the base breakpoint. Added
  `min-h-[630px] sm:min-h-[760px]` to the row (values include a buffer
  over those measurements) - `items-center`/`justify-center`, already in
  place, now centers shorter content inside a constant-size box instead
  of the box itself changing size. Verified live switching between a
  real 4-row outfit and a real 1-row outfit at the `sm:` breakpoint: the
  arrow buttons' Y-position moved only 4px (previously this kind of
  swing was on the order of 100+px) and the row's own rendered height
  matched the fixed floor in both cases.
- **Verified live, working around a tooling limitation:** confirmed no
  stuck/duplicate DOM state under a rapid-click stress test (next, prev,
  next, next, same test used for the original switching bug) - exactly
  one active-slot instance afterward, correctly settled at `opacity: 1`.
  Confirmed the state machine's timing is correct (the heading's name
  swaps at ~250-280ms after a click, matching `FADE_DURATION_MS`).
  Could NOT get a reliable direct visual read on the fade's smoothness
  specifically (not whether it happens, but whether it visibly
  interpolates) - the Browser pane reported `document.visibilityState:
  "hidden"` throughout this session's testing, and hidden tabs commonly
  suspend `requestAnimationFrame` entirely (what framer-motion's
  `animate` prop drives), which would make a real, smooth fade appear
  as a flat, unchanging reading to any poll-based check run from here
  regardless of whether it's actually smooth for someone looking at the
  open app. Flagged rather than glossed over - the underlying mechanics
  (correct state timing, correct final values, no stuck state, no
  duplicate elements) are all independently verified and support the
  fade working correctly, but the specific "does it look smooth"
  question is one the user should confirm themselves. `tsc -b --force` +
  `vite build` clean; test outfits/items deleted after, confirmed empty
  on re-fetch.

**Eleventh follow-up, same request** - "before we continue please check
the aura flow when a outfit have less pieces example two it cuts off so
it looks weird and not sylish also remove the center circle thats goes
up from the aura flow I dont like it."
- **The clipping's real cause:** every aura layer (flash/rays, rings,
  core) is sized off `AURA_SIZE_BY_ROWS`/`RING_SIZE_BY_ROWS`/
  `CORE_SIZE_BY_ROWS` - a fixed diameter per row-count bucket, decoupled
  from the actual content height (that decoupling is what fixed the
  earlier "tall oval" bug). But `AuraGlow`'s own wrapper `div` had no
  height of its own beyond whatever its `children` (the garment rows)
  needed - for a sparse outfit (1-2 rows), that's shorter than the
  aura's own diameter. A parent further up the tree (the carousel's
  middle row) clips overflow, so the aura's top and bottom edges were
  getting visibly cut off instead of rendering as a clean circle - worse
  the fewer rows an outfit had, since the gap between "how tall the
  wrapper naturally is" and "how big the aura needs to be" only grows.
- **Fix:** new `AURA_MIN_HEIGHT_BY_ROWS` lookup (same diameters as
  `AURA_SIZE_BY_ROWS`, the largest layer) applied as a `min-h` on
  `AuraGlow`'s own wrapper, keyed off the same row-count bucket as the
  aura layers themselves - guarantees the wrapper is always at least as
  tall as the aura needs, regardless of how little garment content is
  inside it.
- **Removed the rising sparks** ("the center circle thats goes up") -
  the six small dots that animated upward (`y: [0, -140]`) out of the
  aura. Deleted the whole block; the flash/rays/rings/core stay as they
  are. This also removes what was likely the single biggest contributor
  to the clipping bug on its own (a 140px vertical travel range well
  beyond any of the aura's own circle sizes), though the `min-h` fix
  above stands on its own regardless.
- **Verified live:** two real test outfits (a 2-row "Two Pieces" and a
  1-row "One Piece") - measured the ring and core elements' rendered
  bounds against the `AuraGlow` wrapper's own bounds for the 2-row case:
  both fully contained (ring 433-671px vs. wrapper 380-725px, core
  408-697px vs. the same wrapper bounds) - previously these would have
  exceeded the wrapper and been clipped. Confirmed zero rising-spark
  elements remain in the DOM (searched by their distinctive
  `boxShadow`). Visually confirmed with real screenshots for both
  outfits - a clean, fully-formed circle with no visible clipping in
  either case, entry flash still firing, no sparks. `tsc -b --force` +
  `vite build` clean; test outfits/items deleted after, confirmed empty
  on re-fetch.

**Twelfth follow-up, same request** - "it still cuts off at the top
please look at it even in the pic you sent at the top it cuts off." The
Eleventh follow-up's `min-h` fix was real but insufficient by a small,
specific margin.
- **Two things the diameter-matched min-height didn't budget for:**
  (1) Tailwind's global border-box reset means an element's `min-height`
  INCLUDES its own padding rather than adding on top of it - `AuraGlow`'s
  wrapper also has `py-2`, so a `min-h` set to exactly the aura's
  diameter left only `diameter - 16px` of actual content room, a real
  (if small) deficit. (2) The "hot core" layer uses `blur-2xl` - a CSS
  blur filter visually bleeds past its own element's geometric box
  (unlike the radial-gradient layers, which fade within their own
  bounds), and that bleed was never accounted for at all. Live
  measurement confirmed the wrapper's top edge sat exactly flush with
  the overflow-hidden ancestor's own top (both at the same pixel) with
  only ~5px of computed slack for a 340px element - well inside normal
  rendering/rounding noise, let alone blur bloom.
  - **Fix:** bumped every bucket in `AURA_MIN_HEIGHT_BY_ROWS` by +100px
  over the base diameter (e.g. row-count 2: `min-h-[270px] sm:min-h-
  [340px]` -> `min-h-[370px] sm:min-h-[440px]`) - comfortably covers
  both the padding deficit and the blur bleed without needing to compute
  the blur radius's exact falloff.
- **Verified live, this time checking actual visual output, not just
  bounding boxes:** the earlier round's verification measured the ring
  and core elements' own `getBoundingClientRect()` against the
  wrapper's - correct as far as it went, but a blurred element's visible
  bloom extends past what `getBoundingClientRect()` reports for its own
  box, so that check could never have caught this specific gap. This
  round re-measured (ring/core now sit 76-101px inside the wrapper's
  edges, not ~5px) and, more importantly, took real screenshots at both
  the `sm:` breakpoint (1280px) and a real mobile width (390px) - both
  show a clean, fully round circle with no visible cut at the top or
  bottom, including a screenshot taken right after a fresh page load to
  catch the entry flash near its largest scale. `tsc -b --force` +
  `vite build` clean; test outfit/items deleted after, confirmed empty
  on re-fetch.

- **76** - removes the `w-20` vertical category sidebar; a new
  single-select `ClothingCategory` dropdown (modeled on
  `CategoryPicker.tsx`'s toggle-button + panel-below pattern, different
  data/selection model) sits under the search bar instead. Browse grid
  reorganized into ordered sections - Top (DRESS first if any, then TOP,
  then JACKET, one flowing grid), Bottom, Shoes, then Accessories last,
  naturally requiring a scroll once there's enough above it - plus a new
  scroll-hint affordance (no existing pattern to reuse). Also fixes a
  real bug: the "Your Selection" panel jumps from an empty placeholder to
  a much denser card grid (`aspect-[4/5]`, up to 6 columns) the instant
  an item is selected, next to the browse panel's own larger
  `aspect-[3/4]` 2-column cards - reads as "everything shrank"; brought
  closer in size and reordered to match the new section structure.

### Task 76 — Redesign the Attire browse panel

**Files:** `frontend/src/pages/FlatOutfitBuilderPage.tsx`; new
`frontend/src/components/ClothingCategoryFilter.tsx`.

- Removed the `w-20` vertical category-icon sidebar entirely. In its
  place, directly under the search input, a new `ClothingCategoryFilter`
  component - a single-select dropdown modeled on `CategoryPicker.tsx`'s
  toggle-button + absolute-panel-below structure and look, but a
  different data/selection model (the fixed `ClothingCategory` enum
  values plus "All", single-select with a reset, vs. `CategoryPicker`'s
  multi-select of arbitrary user-created Collections) - reusing the
  pattern, not the component, since the selection model genuinely
  differs.
- Browse grid reorganized from one flat, unordered grid into fixed
  sections via a new `browseSections` memo: **Top** (Dress items first,
  then Tops, then Jackets, all in one flowing grid - a Dress doesn't
  replace anything here, unlike the Outfit Showcase's rows, it just sorts
  first), **Bottom**, **Shoes**, **Accessories** last. A section with
  nothing in it (including when the new category filter narrows to just
  one category) is skipped rather than rendered empty.
- New scroll-hint affordance on the browse column: a bottom gradient
  fade + a bouncing chevron (framer-motion), shown only while the
  scrollable container has more content below the current scroll
  position (`scrollHeight - scrollTop - clientHeight` past a small
  threshold), hidden once actually scrolled to the bottom. Re-checked
  whenever the visible section list changes (a filter or search
  narrowing/widening it can change whether there's more below, even
  though the scroll position itself hasn't moved). No existing
  scroll-hint pattern anywhere in the codebase to reuse - built directly
  off the scroll container's own metrics.
- **The "everything goes small" bug - real root cause found live,
  deeper than the original investigation assumed:** the pre-task
  investigation (see the Phase 9.7 plan) attributed this entirely to the
  "Your Selection" panel's cards being smaller/denser than the browse
  panel's own cards (`aspect-[4/5]` at up to 6 columns vs. browse's
  `aspect-[3/4]` at 2 columns) - true, and fixed (`SelectionCard` now
  matches browse's `aspect-[3/4]`; its grids dropped from
  4/5/6 columns to 3/4/5). But live testing turned up a second, larger
  effect stacked on top of it: the selection panel (`flex-grow`, no
  `shrink-0`) had no `min-width` override, so as an ordinary flex item
  its `flex-shrink: 1` default was live - empty, its content was narrow
  enough that no shrinking occurred (the browse panel measured its
  correct 384px), but the moment the selection panel had ANY grid
  content at all, its flex-basis grew and the browser proportionally
  shrank **both** flex children to fit, squeezing the browse panel down
  to ~148px (measured live, toggling `flex-shrink` on it directly in the
  browser confirmed 148px without vs. 384px with `flex-shrink: 0`) - not
  just the selection panel's own cards reading smaller than browse's,
  the entire browse column and ITS cards visibly shrinking too, every
  time anything was selected. Fixed by adding `shrink-0` to the browse
  panel (`<aside className="w-96 shrink-0 ...">`), pinning it to its
  intended width regardless of what the selection panel's content
  demands. This is very plausibly the more complete explanation for what
  was originally reported as "everything goes small," not just the two
  panels' differing card density.
- **Verified live:** created 18 real test items (3 per category) and
  confirmed section order (Top flowing Dress→Top→Jacket, then Bottom,
  Shoes, Accessories); opened the category dropdown, selected "Shoes",
  confirmed the grid narrowed to just that section, then reset via "All"
  and confirmed it returned to all four sections; confirmed the
  scroll-hint chevron shows when the browse column has more below the
  fold and disappears once scrolled to the bottom (measured
  `scrollHeight`/`scrollTop`/`clientHeight` directly, not just visually);
  selected 3 items across categories and confirmed both panels held
  their correct widths (384px / 881px) throughout, with browse and
  selection cards at comparable, no-longer-jarring sizes (160x213 vs.
  136x181, same aspect ratio) - visually confirmed with an actual
  rendered screenshot this round (the screenshot tool worked this time,
  unlike the last several tasks). `tsc -b --force` + `vite build` clean.
  Spot-checked dark mode by inspecting the new component's source for
  any hardcoded colors (none - every class is one of the app's existing
  theme tokens, same convention as the rest of the app) rather than a
  full visual pass, since the screenshot tool went back to its unreliable
  tiny-scale rendering for that specific check. All 18 test items deleted
  after, confirmed empty on re-fetch.

**Follow-up, after committing** - "on list view please center the items
right now they are to the side", plus a request for a persona-type
switcher below the Your Selection/Persona Preview header, explicitly "a
list" rather than a toggle, "cause later you could add a third person."
- **The centering bug:** the "Your Selection" list view laid its cards
  out with CSS Grid (`grid-cols-3 sm:grid-cols-4 md:grid-cols-5`). A grid
  always reserves all N column tracks regardless of how many children
  exist, and fills them left-to-right - with fewer items than columns
  (the common case here), the cards packed into the left-most tracks and
  left the rest of the row visibly blank, reading as "off to the side."
  Fixed by switching every selection-panel card row (`SelectionCard`'s
  containers, both grouped-category rows and the accessories row) from
  `grid grid-cols-N` to `flex flex-wrap justify-center`, and giving
  `SelectionCard` itself a fixed width (`w-36 sm:w-40`, matching its
  prior grid-track size) instead of letting a grid track size it - a
  flex row centers however many cards are actually present, in any row,
  at any count. Also applied to `ShoeSubRow`'s two sub-rows (the paired
  left/right shoes, and any unpaired overflow), which had the same
  issue (plus the paired row's old `max-w-[220px]` was dropped since the
  cards' own fixed width now does that job).
- **Persona-type switcher:** new `PersonaTypeSwitcher.tsx`, a small
  dropdown-list control (not a cycle-on-click toggle like
  `ThemeToggle.tsx`) placed directly under the Your Selection/Persona
  Preview header, wired to `usePersonaStore`'s existing `setPersonaType`
  (previously only reachable from the standalone `/persona` page - this
  page already *read* `persona.type` for Persona Preview's eligibility
  filtering and the outfit's default `avatarType`, but had no way to
  change it itself). Modeled on `ClothingCategoryFilter`'s toggle-button
  + panel-below structure (itself modeled on `CategoryPicker`) - a third
  reuse of that interaction pattern in the codebase now. Built as a list
  rendered from `Object.values(PersonaType)` rather than two hardcoded
  branches, per explicit request - adding a third `PersonaType` enum
  member in the future needs no change here, it just becomes another
  row.
- **Verified live:** created a Top item and a left/right shoe pair,
  selected all three, measured each row's actual rendered card
  positions (not just the container's) against the panel's true visible
  center - both the single Top card and the shoe pair (as a unit)
  centered exactly on it (825px, matching the panel's own computed
  center to the pixel). Opened the persona switcher, confirmed it shows
  "Male"/"Female" as a list (not a two-state toggle), selected "Female"
  and confirmed the button's label updated, then switched back to
  "Male" to leave the test account's persisted persona-type unchanged.
  `tsc -b --force` + `vite build` clean; test items deleted after,
  confirmed empty on re-fetch.

**Second follow-up, after committing** - "now to see the entire outfit I
need to scroll can you make it so that I can see all the outfit or at
least most of it, also the female/male button depending on whats
selected only garments of that gender should appear also add a any
option and if you add to the outfit both male and female garments...
switch to female and add female garments it should give you an alert
that you are mixing."
- **Gender-filtered browse + "Any":** the browse grid now filters by the
  persona switcher's value (`item.personaType === genderFilter`), on top
  of the existing search/category filters - directly supersedes the
  page's original "deliberately does NOT filter by persona type" design
  call (file-level comment updated to explain why). "Any" was added as a
  third list entry in `PersonaTypeSwitcher` (now typed
  `PersonaType | 'ANY'`, exported as `PersonaFilterValue`) to get back
  the unfiltered view - it's local UI/filter state, not a real
  `PersonaType`, since the global persona store and every other page
  reading it (Persona Preview's eligibility, `SavedOutfitsPage`'s own
  filtering, etc.) only ever expect Male or Female. Selecting Male/Female
  here still also calls `setPersonaType` (keeps the first follow-up's
  wiring to Persona Preview/the save default); selecting "Any" only
  updates the local filter, leaving the global persona type wherever it
  last was.
- **Mixed-gender alert:** a new `selectedPersonaTypes`/`isMixedPersona`
  memo (distinct `personaType` values across the current selection) feeds
  a `useEffect` keyed on `isMixedPersona` - fires a toast ("This outfit
  mixes Male and Female garments") the moment the selection newly
  becomes mixed, same "just happened, not a live nag" shape as the
  existing Persona Preview exclusion toast. Mixed outfits are still
  allowed to be built (that part of the original design stands) - this
  only makes it visible instead of only being discoverable later in
  Persona Preview.
- **The scroll fix - three changes together, not one big one:**
  1. Merged Jacket/Top/Dress into one flowing "Top" row in the selection
     panel (`selectionSections`, replacing `groupSelectedItemsForDisplay`
     on this page), matching the browse panel's own `browseSections`
     grouping (Task 76) - one fewer row when a Jacket and Top/Dress are
     both selected, and the two panels now group the same way.
  2. Tightened vertical rhythm throughout the selection panel: inter-
     section gaps `space-y-8` → `space-y-3`, label-to-row gaps `space-y-3`
     → `space-y-1.5`, the panel's own padding `p-8` → `p-6`, and the
     header/persona-switcher rows' margins trimmed.
  3. A modest card-size trim, `w-36 sm:w-40` (144/160px) → `w-32 sm:w-36`
     (128/144px) - deliberately NOT back to the pre-Task-76 size that
     drew the original "too small" complaint, just enough to help close
     the gap without the first two changes having to carry the whole fix
     alone.
- **Verified live, with numbers, not just "looks better":** a real
  6-item outfit (Jacket, Top, Bottom, a left/right Shoe pair, an
  Accessory - 4 rendered rows after the Top merge) measured at
  `scrollHeight` 1390px against a 739px visible panel height (53%
  visible, only Top and part of Jacket/Top's old separate rows in view)
  *before* this round's changes; 1139px after the row merge alone (65%
  visible); 1026px after also trimming spacing and card size (72%
  visible) - and critically, measured each section's own position: Top
  and Bottom now render fully inside the visible area, Shoes renders
  ~95% inside it (a sliver of its bottom edge below the fold), and only
  Accessories requires scrolling to reach. Visually confirmed with an
  actual screenshot (worked this round) showing centered, appropriately-
  sized cards, not cramped. `tsc -b --force` + `vite build` clean;
  gender-filter/mixing-alert/scroll test items (7 total, one deliberately
  the opposite gender) deleted after, confirmed empty on re-fetch.

**Phase 9.7 is now complete (Tasks 73-76, plus twelve rounds of live
follow-up feedback on Task 75 and two on Task 76 - see each task's own
write-up above for the full history).** Per the checkpoint precedent set
in Phase 9.5's own planning note, the checkpoint into `main` and the cut
of `phase-10-persona-fitting` waited until all of Phase 9.5/9.6/9.7 was
done - that happened 2026-09-22: `phase-9-categories-experience` merged
into `main` cleanly (no conflicts), verified with `tsc -b --force` +
`vite build` on the frontend and `./mvnw compile` on the backend (all
clean) post-merge, then pushed; `phase-10-persona-fitting` cut from the
updated `main` and pushed. Phase 10 (Tasks 52-56, crop-tool repair)
starts fresh on that branch.

**Phase 10 is now complete (Tasks 52-56, plus follow-ups: crop-mode drag
fix, thumbnails showing the crop, mesh warp shown in context on the
persona, and handle-clipping fixes across all three studios).**
Checkpoint done 2026-09-24: `phase-10-persona-fitting` merged into `main`
(`--no-ff`, no conflicts, `main` had no commits it lacked), verified
post-merge with `tsc -b --force` + `vite build` on the frontend and
`./mvnw compile` on the backend (all clean), pushed; `phase-4-auth-and-guards`
cut from the updated `main` and pushed. Phase 4 (Task 21 Forgot Password,
Task 22 route guards + error boundaries) starts on that branch.
