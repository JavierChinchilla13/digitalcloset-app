# Backend Implementation Summary - Digital Closet

## Phase 1: Backend Foundation Completed

### 1. Project Infrastructure
- **Root Package**: `com.javier.closetapp`
- **Tech Stack**: Java 21, Spring Boot 3.3.0, Spring Security, JWT, PostgreSQL.
- **Architecture**: Separated by feature (auth, user, clothing, outfit) with clean Controller-Service-Repository layers.
- **Global Error Handling**: Centralized exception management for consistent API responses.

### 2. Authentication & Security
- **JWT Stateless Auth**: Implemented secure token-based authentication.
- **RBAC (Role-Based Access Control)**: Support for `ROLE_USER` and `ROLE_ADMIN`.
- **Endpoints**:
    - `POST /api/auth/register`: User registration (default role: `ROLE_USER`).
    - `POST /api/auth/login`: User login returning a JWT.
- **Persistence**: User data stored in `users` table with BCrypt password hashing and `active` status for soft deletes.

### 3. User Management
- **Profile Management**: Authenticated users can manage their own profile.
- **Admin Capabilities**: Admins can view all users and manage their activation status.
- **Endpoints**:
    - `GET /api/users/me`: View current user profile.
    - `PUT /api/users/me`: Update current user profile.
    - `PATCH /api/users/me/deactivate`: Soft-delete current user account.
    - `GET /api/users`: List all users (Admin only).
    - `PATCH /api/users/{id}/deactivate`: Deactivate a user (Admin only).
    - `PATCH /api/users/{id}/reactivate`: Reactivate a user (Admin only).

### 4. Clothing Management (Virtual Closet)
- **Entity**: `ClothingItem` with fields for `name`, `description`, `category` (Enum), and `imageUrl`.
- **Advanced Metadata**: Augmented with `ClothingTransform` and `PersonaType` (Gender) fields to support precision studio fitting.
- **Endpoints**:
    - `POST /api/clothing`: Create a new item (automatically linked to authenticated user).
    - `GET /api/clothing`: List all items owned by the authenticated user (context-aware gender filtering handled by frontend).
    - `PUT /api/clothing/{id}`: Update an existing item's details and transform data.
    - `DELETE /api/clothing/{id}`: Delete an item (with ownership verification).
- **Categories**: `TOP`, `BOTTOM`, `SHOES`, `DRESS`, `JACKET` (Accessory deactivated in current UI cycle).

### 5. Outfit System (Evolution)
- **Entities**: `Outfit` and `OutfitItem` (Junction table).
- **Architecture Shift**: The system has transitioned from a free-form Konva canvas builder to a structured **Layered Persona System**. 
- **Hybrid Storage**: 
    - **Cloud Persistence**: Garments and basic outfit metadata are stored in PostgreSQL.
    - **Local Orchestration**: Real-time style sets and user-defined outfit combinations are currently prioritized in the `LocalOutfitStore` for zero-latency iteration and instant "Wear Style" application.

## Phase 6: Advanced Modular Orchestration Completed

### 1. Modular Garment Persistence
- **Entity Evolution**: Augmented `ClothingItem` with `isModular` and `modularData` (TEXT/JSON).
- **Metadata Orchestration**: Supports storing multiple sub-segments (torso, sleeves) and their specific transforms within a single item record.
- **DTO Enhancements**: Updated `ClothingRequest` and `ClothingResponse` to seamlessly transmit modular fashion architecture.

### 2. Side-Aware Clothing
- **Pair Identification**: Added `side` property to track left vs. right items (essential for the new Footwear Engine).
- **Asymmetrical Support**: Backend now handles independent storage for items belonging to the same category but occupying different side slots.

## Phase 7: Infrastructure & Security Refinement Completed

### 1. Payload Optimization
- **Multipart Limits**: Increased `max-file-size` and `max-request-size` to **10MB** to support high-resolution garment images and complex modular assets.
- **Service Integration**: Optimized `application.properties` for seamless integration with external AI and Cloudinary services.

### 2. Robust Error Orchestration
- **Accurate Exception Handling**: Refined the `GlobalExceptionHandler` to distinguish between client-side errors (400) and server-side/AI failures (500), ensuring clearer frontend debugging. *(This described the intent at the time; `GlobalExceptionHandler` actually only returned 500 for everything until Phase 12 below implemented real 404/403/400 handling.)*
- **Dynamic Authorization**: Updated `SecurityConfig` to explicitly manage permissions for AI and other core API utility paths. *(The `/api/ai/**` rule this refers to never had a controller behind it and was removed as dead config in Phase 12.)*

---

## Technical Decisions
- **Manual POJOs**: I used standard Java Constructors/Getters/Setters instead of Lombok to ensure 100% compatibility with the local Java 21 environment.
- **Soft Deletes**: Implemented `isActive` flags to preserve data integrity while providing a clean user experience.
- **Transactional Consistency**: Garment and user operations use `@Transactional` to ensure data atomicity during complex updates.
- **Coordinate Precision**: Standardized on center-anchored virtual coordinates with 2-decimal rounding to ensure mathematical parity between localized studio fitting and global dashboard rendering.

## Phase 10: Hybrid AI Microservice & Professional Tooling Completed

### 1. Python AI Microservice (Background Removal)
- **Engine**: Developed a secondary FastAPI microservice using the `rembg` library (U2-Net).
- **Architecture**: Implemented a hybrid "Provider" pattern where the frontend can fail over to this high-accuracy microservice if client-side AI fails.
- **Interoperability**: CORS-enabled streaming response that returns transparent PNGs directly to the React application.

### 2. Studio-Grade Data Preservation
- **Non-Destructive Workflows**: Refactored the garment saving logic to preserve manually cleaned assets while maintaining modular segment identifiers.
- **High-Fidelity Metadata**: Jacket items now store complex synchronized transform data (scale, rotation, offsets) ensuring that modular parts remain "attached" during global ensemble transformations.
- **Thumbnail Optimization**: Implemented selective visibility during asset initialization to generate clean, mannequin-free thumbnails for the digital closet.

## Phase 12: Stabilization & Security Hardening Completed

### 1. Critical Fixes
- **Build Repair**: Removed a stray, build-breaking line accidentally committed to the frontend.
- **Registration Privilege Escalation**: `AuthService.register()` previously trusted a client-supplied `role` field, letting any caller self-assign `ROLE_ADMIN`. The field is now removed from `RegisterRequest` entirely - registration always assigns `ROLE_USER`.
- **Outfit Ownership (IDOR)**: `OutfitService` now verifies that every `ClothingItem` referenced in an outfit actually belongs to the authenticated user before attaching it, closing a cross-user data-access gap in `saveOutfit`/`updateOutfit`.

### 2. Secrets & Configuration
- **Externalized Secrets**: `spring.datasource.password` and `app.jwt.secret` no longer live in plaintext in `application.properties` - both resolve from environment variables, with a gitignored `application-local.properties` (see the committed `application-local.properties.example` template) supplying local dev defaults via the `local` Spring profile.
- **JWT Secret Fix**: The signing secret was previously a hex string decoded as if it were Base64 - it worked by accident, not by design. Replaced with a properly generated random Base64 secret.

### 3. Database
- **Flyway Migrations**: Schema is now Flyway-managed (`spring.jpa.hibernate.ddl-auto=validate`) instead of Hibernate `ddl-auto=update` plus ad hoc SQL scripts. `V1__baseline.sql` consolidates the full schema - generated directly from the JPA entity mappings via Hibernate's own schema-export, and verified against the live database with zero mismatches.
- **Soft-Delete**: `ClothingItem.isActive` is now actually honored - `deleteItem()` deactivates rather than hard-deletes, and `getAllItems()` filters to active items only, preventing orphaned references from saved outfits.

### 4. API Correctness
- **Proper Exception Handling**: Added `ResourceNotFoundException` (→404) and `ForbiddenOperationException` (→403). `GlobalExceptionHandler` no longer leaks raw exception text on unexpected errors - it logs the real exception server-side and returns a generic message to the client instead.
- **Request Validation**: Added `@NotBlank`/`@Email`/`@Size`/`@NotNull`/`@NotEmpty` to `RegisterRequest`, `LoginRequest`, `ClothingRequest` (create only - update stays partial and unvalidated by design), and `OutfitRequest`/`OutfitItemRequest`, with a dedicated validation-failure handler returning structured 400 responses with per-field messages.
- **CORS**: Added an explicit, environment-driven `CorsConfigurationSource` - no CORS configuration existed before this; it only worked in dev because of the Vite proxy.
- **Dead Config Removed**: The `/api/ai/**` security rule referenced a controller that was never implemented - removed.

### 5. Python AI Microservice
- **Hardened**: Restricted CORS to configured origins (was wide-open `*` + credentials, an invalid combination browsers reject anyway), added image content-type and 10MB size validation before processing, replaced `print()` with proper logging (errors are captured server-side without leaking internals to the client), removed an unused `PIL` import, and pinned all dependency versions in `requirements.txt`.

