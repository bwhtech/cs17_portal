# CS17 Portal

A Frappe app for CS17 students and faculty: assignments, submissions, grading, Scratch
projects, announcements and results.

## Layout

- `cs17_portal/`: the Frappe app. Doctypes are under `cs17_portal/cs17_portal/doctype/`,
  whitelisted methods the dashboard calls are in `cs17_portal/api.py`.
- `dashboard/`: the Vue 3 + TypeScript app served at `/dashboard`, built on frappe-ui.
- `cs17_portal/www/`: `dashboard.html` is build output; `index.html` is the public
  quick links page; `submission` only redirects into the dashboard.
- `cs17_portal/public/scratch/`: a vendored Scratch editor bundle. Do not edit it by
  hand; see `docs/scratch-bundle/BUILD.md`.
- `e2e/`: Playwright specs and helpers.
- `docs/`: reference notes. Start with `dev-site.md` for a local site and demo data.

A user is a student or faculty by the `profile_type` of their CS17 Profile, not by a role.

## Commands

```bash
# dashboard, from dashboard/
yarn dev          # dev server, proxies the API to the bench on port 8000
yarn build        # writes cs17_portal/public/dashboard and www/dashboard.html
yarn typecheck    # vue-tsc
yarn lint         # eslint and prettier --check
yarn format       # prettier --write src

# server tests, from the bench
bench --site <site> run-tests --app cs17_portal

# end to end, from the app root
SITE_HOST=<site>:8000 yarn test:e2e
```

Rebuild the dashboard before running the e2e suite; it tests the built app, not the dev
server.

## Dashboard conventions

- Reach for a frappe-ui component before writing markup. No hand rolled buttons, inputs,
  dialogs or tables.
- Colours are frappe-ui semantic tokens only: `bg-surface-*`, `text-ink-*`,
  `border-outline-*`. No palette classes such as `text-gray-500`, no raw hex.
- Radii come from the frappe-ui scale: `rounded-1` to `rounded-9` and `rounded-full`.
- Data: `useCall` for whitelisted methods, `useList` for doc lists, `useDoc` for one doc.
  Writes use `immediate: false` and `submit()`, with loading bound to the button.
- Every table goes through `components/common/DataTable.vue`.
- Each page renders its own `<AppHeader>`; a detail page sets its trail with
  `useBreadcrumbs()`.
- One component per file, `<script setup lang="ts">`.
- Icons are lucide classes, for example `lucide-plus`. An icon only button needs an
  `aria-label`.
- Navigation props on frappe-ui components are `route` and `href` (`fallback-route` on
  `PageHeaderBackButton`). An unknown prop is ignored without a warning, so a wrong name
  type checks and still does nothing. To find them, run `vue-tsc` once with
  `vueCompilerOptions.strictTemplates` set to `true` and read the errors under `src/`.
- Check every screen at phone width as well as desktop.

## Checks before a pull request

`yarn typecheck`, `yarn lint` and `yarn build` in `dashboard/`, then the e2e specs that
cover the screens you touched. `pre-commit` runs ruff, eslint and prettier.
