# Virtual Closet - Project Instructions

## Project Overview

This is a virtual wardrobe / digital closet application.

Users can:

- Upload clothing items
- Remove image backgrounds
- Edit clothing images
- Position and resize clothing
- Save outfits
- Use male/female 2D personas
- Layer clothing over personas
- Manage wardrobe items
- Create and save outfits

The main goal is to provide a clean fashion-editor experience where users can upload clothing images and virtually place them on a standardized 2D human persona.

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Fabric.js
- Framer Motion
- PostgreSQL
- Node.js
- Python microservices when needed

## Important Architecture Rules

Before modifying code:

1. Inspect the existing implementation.
2. Understand how the current feature works.
3. Reuse existing components and utilities whenever possible.
4. Do not rewrite working systems unnecessarily.
5. Do not create duplicate functionality.
6. Keep components modular.
7. Keep TypeScript strongly typed.
8. Do not introduce unnecessary dependencies.

## UI/UX

The application should have a premium modern fashion-tech aesthetic.

Priorities:

- Clean
- Minimal
- Modern
- Responsive
- Smooth animations
- Good spacing
- Avoid clutter
- Avoid oversized UI elements

The UI should feel like a polished commercial product, not a developer prototype.

## Persona System

There are two 2D personas:

- Male
- Female

The personas are standardized visual templates used as the base for clothing.

Clothing should be positioned as layers over the persona.

Do not modify the persona proportions unless explicitly requested.

## Clothing System

Clothing items can include:

- Shirts
- Pants
- Jackets
- Shoes
- Accessories

Each clothing type may require different editing behavior.

Clothing images should:

- Have transparent backgrounds
- Be editable
- Be movable
- Be scalable
- Maintain aspect ratio by default

## Image Editing

Fabric.js is currently used for clothing manipulation.

Do not replace Fabric.js unless there is a strong technical reason.

Image editing should preserve:

- Transparency
- Image quality
- Original aspect ratio
- User adjustments

## Background Removal

Background removal should be modular.

Do not tightly couple the UI to a specific provider.

The system should allow changing the background-removal implementation later.

## Important Development Rule

Before implementing a feature, first inspect:

- Existing components
- Existing types
- Existing state management
- Existing services
- Existing database models
- Existing image utilities

Then explain briefly what you found and implement the smallest clean change necessary.

## Testing

After making changes:

1. Run TypeScript checks.
2. Run the existing test suite if available.
3. Run the build.
4. Fix errors before considering the task complete.

Do not claim a feature works without verifying it.

## Git

Create focused commits.

Do not:

- Commit secrets
- Commit .env files
- Commit API keys
- Make unrelated changes

Before committing, review the changed files.

## Current Development Philosophy

Prefer:
"small, tested, incremental improvements"

over:
"rewrite everything."

If an existing implementation is broken, identify why before replacing it.
