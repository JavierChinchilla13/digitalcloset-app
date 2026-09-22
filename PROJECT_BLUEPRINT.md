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
- [ ] **67** Theme infrastructure: semantic tokens, light/dark/system store,
      no-flash script, navbar toggle, fonts
- [ ] **68** Mechanical token migration (`white`/`black` utilities -> `ink`
      tokens, `on-accent`) + remove glows
- [ ] **69** Shared components restyle (Navbar, footer, Toast, cards, modals)
- [ ] **70** Page passes in both modes (Landing, Login/Signup, Closet,
      Outfits, Attire, Categories, Category detail, Persona)
- [ ] **71** Editor / fitting tools (Fabric.js colors from tokens)
- [ ] **72** Branding: VYSVI rename, logo swap-in, favicon, page title

### Phase 10 — Persona fitting repair & deformation

*(renumbered 2026-09-01 from 44–48 to 52–56, same reason as Phase 9 above)*

- [ ] **52** Reproduce + confirm crop tool defects live; report before fixing
- [ ] **53** Fix crop stale closure + mask-follows-garment
- [ ] **54** Add un-crop / reset affordance to `CanvasToolbar`
- [ ] **55** Remove dead warp scaffolding (if not already done in Task 26)
- [ ] **56** Prototype bake-on-save deformation for one garment type

### Phase 4 *(deferred — runs after Phase 10)*

- [ ] **21** Resolve Forgot Password
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

### Tasks

- [ ] **52** Reproduce + confirm crop tool defects live; report before fixing
- [ ] **53** Fix crop stale closure + mask-follows-garment
- [ ] **54** Add un-crop / reset affordance to `CanvasToolbar`
- [ ] **55** Remove dead warp scaffolding (if not already done in Task 26)
- [ ] **56** Prototype bake-on-save deformation for one garment type

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

11. **Crop repro.** Is it broken for *new* crops, for *reopening* an existing
    crop, or both? This decides which of the five defects gets fixed first.
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
- **68 Token migration** - scripted `text-white` -> `text-text-primary`,
  `*-white/N` -> `*-ink/N`, `text-white` on accent -> `text-on-accent`;
  manual review for text/scrims over item photos, recessed `bg-black/N`
  panels, and status colors; strip glows / accent shadows / decorative
  pulses.
- **69 Shared components** - Navbar, footer, Toast, SectionWrapper,
  ClothingCard, OutfitCard, CategoryPicker, the modals. Rules:
  `font-black` -> medium/light, label floor ~10-11px (currently 7-8px),
  radii `2rem/3rem` -> `xl/2xl`, hairline silver borders, serif headings.
- **70 Page passes** - each checked in both modes at desktop + mobile.
  Orphaned pages (`/dashboard`, `DemoPage`, `OutfitBuilderPage`,
  `sections/*`, `PersonaSpotlight`) get the token migration only.
- **71 Editor / fitting tools** - Fabric colors via a small
  `utils/themeColors.ts` reading the CSS variables; neutral canvas
  surfaces; check the persona base PNGs on the light background.
- **72 Branding** - `BrandMark` (theme-aware logo; interim tracked-caps
  text wordmark until the user's files land in `frontend/public`),
  rename strings (`Navbar`, `MainLayout` footer,
  `ClothingDetailsModal.tsx:156`, `sections/AvatarSection.tsx:100`),
  `index.html` title + favicon, remove unused `App.css`.

Verification for each: `tsc -b --force`, `vite build`, live in both modes
(browser `colorScheme` emulation for system-follow), screenshots of every
changed page, contrast spot-checks, Fabric handles visible in both modes.

**Open dependency:** logo files from the user for Task 72's final swap.
