# Repository Guidelines

## Project Structure & Module Organization

This repository is a Vue 3 + Vite + TypeScript dashboard fork. Main code lives in `src/`: use `src/api` for backend calls, `src/components` for reusable UI, `src/views` for route pages, `src/store` for state, `src/composables` for shared logic, and `src/router` for navigation. Static assets belong in `public/`, release output goes to `dist/`, and should not be edited directly. Fork-maintenance notes and upstream planning live in `upstream-followup/`.

## Build, Test, and Development Commands

Use `pnpm` (`packageManager: pnpm@10.15.0`).

- `pnpm dev` — start the local Vite dev server.
- `pnpm build` — create a production build in `dist/`.
- `pnpm preview` — serve the built app locally.
- `pnpm type-check` — run `vue-tsc --build --force`.
- `pnpm lint` — run ESLint with auto-fix.
- `pnpm format` — format `src/` with Prettier.
- `pnpm build:no-fonts` / `pnpm build:cdn-fonts` — alternate release builds.

Before merging, at minimum run `pnpm type-check`, `pnpm lint`, and `pnpm build`.

## Coding Style & Naming Conventions

Follow `.editorconfig`: UTF-8, 2-space indentation, final newline, trimmed trailing whitespace. Prettier uses single quotes, no semicolons, `printWidth: 100`, one Vue attribute per line, and sorted Tailwind classes/imports. Use PascalCase for Vue components such as `ProxyGroup.vue`, and lower camelCase for functions, stores, and composables such as `fetchProxyProviders`.

## Testing Guidelines

There is no dedicated test runner committed yet. Treat type-checking, linting, and production builds as required validation. If you add tests later, colocate them near the feature or under a clear test directory, and use names like `feature.spec.ts`.

## Commit & Pull Request Guidelines

Recent history follows Conventional Commit style, for example `feat: upgrade proxy grouping and chain navigation` and `docs: update upgrade guide and checklist`. Keep commits focused and imperative. Pull requests should summarize user-visible changes, list validation commands, link related issues, and include screenshots or recordings for UI work.

## Security & Maintenance Notes

Do not commit secrets, backend passwords, or generated credentials. Keep OpenClash- and upstream-tracking work documented in `README-改动说明.md` and `upstream-followup/`. When syncing from the upstream fork, fetch from `upstream` and push only to `origin`.

## NebulaDash Maintenance Log

Every local NebulaDash change must be recorded in `upstream-followup/NEBULADASH-CHANGELOG.md` before completion. Include the date, commit hash or working state, purpose, touched files, behavior changes, validation commands, and follow-up notes. This is mandatory for proxy page, rule page, search, provider loading/caching, update-source, release, and upstream-sync work, because these areas contain local OpenClash-specific changes that upstream Zashboard may overwrite.
