# CS17 Portal dashboard rewrite — React → Vue 3 + frappe-ui

Status: PROPOSED. Replaces `dashboard/` (React 19 + shadcn + `frappe-react-sdk`, ~8.3k LOC)
with a Vue 3 app on `frappe-ui@1.0.0-beta.55`. Same product surface, same URLs, same
backend. Written to be executed by many agents in parallel.

Model for this plan: `apps/bwh_hive/plans/frappe-ui-rewrite.md`, which took Hive through
the same migration (React 19 + shadcn → Vue 3 + frappe-ui) in one serial foundation
phase, eight parallel page streams and three integration streams. Everything marked
"reference" below points at working code in `apps/bwh_hive/frontend/`.

Appendix: [react-inventory.md](frappe-ui-rewrite/react-inventory.md) — every route, API
call, doctype, localStorage key, Scratch message and e2e coupling.

---

## 1. Goals and non-goals

Goals
- Same product surface. Same URLs (`/dashboard/...`), same query params, same whitelisted
  methods, same doctypes.
- frappe-ui components and design language everywhere. No custom primitive where
  frappe-ui has one.
- Small dependency list, few concepts, disjoint file ownership so streams don't collide.

Non-goals
- No new features, no information-architecture change. Only the visual language changes
  (Frappe gray-first, semantic tokens).
- No backend change beyond the two small items in §9.
- No redesign of the Scratch integration. The iframe contract is ported verbatim.

---

## 2. Decisions (locked)

| Topic | Decision |
|---|---|
| Location | React app moves to `dashboard-react/` in W0 and is deleted in W11. The new app is scaffolded in `dashboard/`. Build output stays `cs17_portal/public/dashboard`, entry stays `cs17_portal/www/dashboard.html`, `website_route_rules` unchanged. |
| Stack | Vue 3.5 + TypeScript, `vue-router@4`, `frappe-ui@1.0.0-beta.55`, Tailwind **v3** (the frappe-ui preset is v3-only — this is a downgrade from the current Tailwind 4), Vite 7 + `@vitejs/plugin-vue@6`, `frappe-ui/vite` with `buildConfig` + `jinjaBootData` + `frappeProxy` + `lucideIcons`. |
| Data layer | `useCall` for whitelisted methods, `useList` for doc lists, `useDoc` for single docs, `upload()` / `FileUploader` for files. No `createResource`, no raw `fetch`, no `frappe-react-sdk`. |
| Doc counts | `useList` has no count. The one count in the app (`FacultyDashboardPage`) becomes `useCall('frappe.client.get_count', { doctype, filters })`. |
| Polling | `useList`/`useCall` have no `refreshInterval`. `composables/usePolling.ts` (W0) reloads a handle on an interval; it replaces `lib/liveQuery.ts` (45s) wherever that was applied. |
| Theme | `useColorScheme()` from frappe-ui. Same `localStorage` key (`theme`), but it writes `<html data-theme>` instead of `<html class="dark">`. `index.html` keeps a pre-paint script, rewritten to set `data-theme`. The theme e2e spec changes with it (§10). |
| Boot data | `jinjaBootData` writes every key of `dashboard.py`'s boot dict onto `window`, so `window.profile` / `window.current_user` / `window.csrf_token` replace `window.frappe_boot.*`. In dev, `main.ts` fetches `cs17_portal.www.dashboard.get_context_for_dev` and `Object.assign`s it onto `window` — the method already exists. Reference: `bwh_hive/frontend/src/main.ts`. |
| Shell | `DesktopShell` + `Sidebar` family on desktop, `MobileShell` + `MobileNav` below `md`. One `AppShell.vue` driven by a role-keyed nav config; no separate faculty shell component. |
| Tables | `frappe-ui/list` (`List`, `ListRow`, `ListCell`) inside one shared `DataTable.vue` that keeps today's `Column<T>` API and the desktop-table / mobile-card split. Every table in the app goes through it. |
| Rich text | Descriptions and announcement content stay **Markdown**. `MarkdownText.vue` renders with `markdown-it` (`html: true`) + `dompurify` (already a dependency). frappe-ui's tiptap `Editor` is not used — authoring stays a `Textarea` with a "Markdown supported" hint, as today. |
| Dialogs, confirms | `<Dialog v-model:open>` for forms; `dialog.confirm` / `dialog.danger` for the delete confirmations. The faculty create-assignment `Sheet` becomes a `Dialog size="3xl"` on desktop and a `BottomSheet` below `sm`. |
| Toasts | `toast.*` (vue-sonner) replaces the inline `<p class="text-destructive">` error lines, except inside dialogs where the error stays in place under the field. |
| Zen mode | `composables/useZenMode.ts` singleton, same behaviour (hide sidebar + header). Reference for a shell reading a singleton: `bwh_hive/frontend/src/composables/useOverlays.ts`. |
| Breadcrumbs | `composables/useBreadcrumbs.ts` singleton feeding `AppHeader`'s `#left` slot, same `Workspace / Assignments / <title>` trail. |
| Icons | `lucide-*` CSS classes via `unplugin-icons` + `lucideIcons: true`. Drop `lucide-react`. |
| Dates | Keep `dayjs` and today's `formatDate` / `formatDateTime` / `toFrappeDatetime` / `toDatetimeLocal` helpers, ported as-is. Datetime inputs become frappe-ui `DateTimePicker`. |
| Scratch | Ported verbatim. `lib/scratch.ts` is a straight copy (no React in it); the iframe + `postMessage` wiring becomes `components/scratch/ScratchFrame.vue`, a W0 contract that both the editor (W3) and the player (W7) build on. |
| Auth guard | Router `beforeEach` reads boot: Guest → `window.location.href = '/login?redirect-to=' + encodeURIComponent('/dashboard' + path)`. Role redirect (`Faculty` → `/faculty`, non-Faculty → `/`) also moves into the guard, out of the layout components. |
| Routes | Unchanged, including `?assignment=` and `?readonly=1` on the editor. `createWebHistory('/dashboard')`. |
| Tests | Keep the Playwright suite. Update selectors only. Green `e2e/` is the acceptance bar for every stream. |

### Cut list

| Thing | Reason |
|---|---|
| `components/ui/*` shadcn primitives (button, card, dialog, select, sheet, switch, table, tabs, textarea, input, badge, alert, alert-dialog, separator, skeleton) | frappe-ui equivalents. ~1.1k LOC deleted, nothing ported. |
| `window.prompt` for the new-project name (`ProjectsPage`) | `dialog.prompt`. Same flow, no browser modal. |
| The hand-rolled bell popover (click-outside listener, inline `backgroundColor: "white"` that ignores dark mode) | frappe-ui `Popover` on desktop, `BottomSheet` on mobile. The white-background bug goes with it. |
| The hand-rolled `role="switch"` with inline styles in `SettingsPage` | `Switch`. |
| `tw-animate-css`, `class-variance-authority`, `tailwind-merge`, `clsx`, `radix-ui`, `@radix-ui/react-slot`, `shadcn` | shadcn machinery. |
| Duplicate `Sidebar`/`FacultySidebar` and `TopBar`/`FacultyTopBar` (~700 LOC, near-identical) | one `AppSidebar.vue` + `AppHeader.vue` over a role-keyed nav config. |
| Duplicate `SettingsPage`/`FacultySettingsPage` | one `SettingsPage.vue`. |

Kept as is: Scratch editor and player, zen mode, breadcrumbs, announcement dismissal in
localStorage, the assignment draft in localStorage, publish/schedule flows, bulk assign,
the `Geist` font.

---

## 3. Target project layout

```
dashboard/
  index.html                     # <div id="app">, pre-paint data-theme script
  vite.config.ts                 # frappeui({ buildConfig, jinjaBootData, frappeProxy, lucideIcons }) + vue()
  tailwind.config.js             # presets: [frappeUIPreset]
  postcss.config.js
  tsconfig.json
  src/
    main.ts                      # dev boot fetch, createApp, router, FrappeUI
    App.vue                      # <FrappeUIProvider><AppShell/></FrappeUIProvider>
    router.ts                    # routes + auth/role guard
    style.css                    # frappe-ui/style.css, tailwind directives, .cs17-prose
    types.ts                     # CS17 doctype interfaces + status/enum constants
    shims.d.ts                   # `~icons/*` ambient module, so vue-tsc resolves them
    lib/
      dates.ts                   # formatDate, formatDateTime, toFrappeDatetime, toDatetimeLocal
      frappeError.ts             # message out of a Frappe error
      status.ts                  # student assignment status ladder + grade filter (W2)
      submissionTypes.ts         # accept/label/help/error + previewKind
      scratch.ts                 # verbatim port (messages, base64, read-only CSS)
      storage.ts                 # typed localStorage helpers for the keys in the appendix
    composables/
      useSession.ts              # boot-backed profile, isFaculty/isStudent/isGuest
      usePolling.ts              # interval reload + usePublishTimer
      useBreakpoint.ts           # one shared matchMedia at Tailwind `md`
      useZenMode.ts              # singleton
      useBreadcrumbs.ts          # singleton
      useAnnouncementDismissals.ts
    components/
      shell/    AppShell.vue AppSidebar.vue AppHeader.vue AppMobileNav.vue
                nav.ts           # the role-keyed nav config both of them read
      common/   DataTable.vue MarkdownText.vue GradeBadge.vue PublishFields.vue
                EmptyState.vue PageSkeleton.vue
      scratch/  ScratchFrame.vue
      announcements/  AnnouncementsBell.vue AlertBanner.vue AnnouncementCard.vue
      assignments/    AssignmentTable.vue SubmitAssignmentDialog.vue
                      SubmissionPreviewDialog.vue GradeDialog.vue
      projects/       ProjectCard.vue SubmitProjectDialog.vue
      faculty/        AssignmentFormDialog.vue AssignmentPreview.vue
                      PublishAssignmentDialog.vue DeleteAssignmentDialog.vue
                      GradeSubmissionDialog.vue AssignSubmissionDialog.vue
                      BulkAssignBar.vue FacultySelect.vue
                      AnnouncementFormDialog.vue AnnouncementPreview.vue
                      PublishAnnouncementDialog.vue DeleteAnnouncementDialog.vue
                      PreviewAnnouncementDialog.vue
    pages/
      DashboardPage.vue AssignmentsPage.vue AssignmentDetailPage.vue
      ProjectsPage.vue ProjectEditorPage.vue AnnouncementsPage.vue SettingsPage.vue
      FacultyDashboardPage.vue FacultyAssignmentsPage.vue FacultyAssignmentDetailPage.vue
      FacultyAnnouncementsPage.vue FacultySubmissionsPage.vue FacultyGradingPage.vue
      DevPage.vue                  # /dev — every shared contract, rendered
```

Rules for every stream
- One component per file. Composition API, `<script setup lang="ts">`.
- Only frappe-ui semantic tokens (`bg-surface-*`, `text-ink-*`, `border-outline-*`).
  No `text-gray-*`, no `text-muted-foreground`, no `bg-background`, no raw hex.
- The bare `rounded` utility does not exist in the beta preset. Use `rounded-1`…`rounded-9`
  or `rounded-full`. Cards are `rounded-4`.
- Every table goes through `DataTable.vue`. Every scroll region uses `ScrollArea`.
- Every input carries `label` / `error` / `required` through component props. No
  placeholder-as-label.
- Writes: `immediate: false` + `submit()`. Loading bound to `<Button :loading>`.
- Page gutters `px-3 py-5 pb-10 sm:px-5`, matching the header.
- Mobile is checked for every screen, not just desktop.

---

## 4. Component mapping (React/shadcn → frappe-ui)

| Today | Vue + frappe-ui |
|---|---|
| shadcn `Button` | `Button` (`variant` + `theme`) |
| `Dialog` / `AlertDialog` | `Dialog v-model:open` / `dialog.confirm`, `dialog.danger` |
| `Sheet` (create assignment, mobile sidebar) | `Dialog size="3xl"` desktop / `BottomSheet` mobile; the sidebar drawer is `MobileShell`'s own |
| `Tabs` (create-assignment edit/preview) | `Tabs` + `TabList` + `TabTrigger variant="underline"` |
| `Select` | `Select` or `FormControl type="select"` |
| `Input`, `Textarea`, `Switch` | `TextInput`, `Textarea`, `Switch`, or `FormControl` |
| `Input type="datetime-local"` | `DateTimePicker` (values still stored as `YYYY-MM-DD HH:mm:ss`) |
| `Input type="file"` | `FileUploader` + `upload()` |
| `Badge` | `Badge :theme :variant="subtle"` |
| `Table` + `ResponsiveTable` | `List` table mode inside `DataTable.vue` |
| `Card` | `rounded-4 border border-outline-gray-1 bg-surface-base p-4` |
| `Skeleton` | `Skeleton` |
| bell popover | `Popover` desktop / `BottomSheet` mobile |
| breadcrumb strip in the top bar | `Breadcrumbs :items` in `AppHeader` |
| custom avatar `<img>` / initial circle | `Avatar` |
| `react-markdown` + `rehype-raw` | `markdown-it` + `dompurify` in `MarkdownText.vue` |
| `useFrappeGetCall` | `useCall` (GET) |
| `useFrappePostCall` | `useCall` (POST, `immediate: false`, `submit()`) |
| `useFrappeGetDocList` | `useList` |
| `useFrappeGetDoc` | `useDoc` |
| `useFrappeGetDocCount` | `useCall('frappe.client.get_count')` |
| `useFrappeFileUpload` | `upload()` |
| SWR `mutate()` | `handle.reload()` |
| SWR `refreshInterval` | `usePolling(handle.reload, ms)` |
| `useAuthGuard` | router `beforeEach` |
| `lib/theme.ts` | `useColorScheme` |

---

## 5. Shared contracts (Phase 0, frozen before parallel work)

Every stream imports these. W0 ships them with a `/dev` sandbox route that renders each
one, so a stream can see the real thing before building on it.

**Shipped in W0.** The signatures below are what is on disk; where W0 found a better
shape than this plan first sketched, the plan was updated to match the code, not the
other way round. Those places are called out inline.

```ts
// composables/useSession.ts   — boot-backed, no request
export function useSession(): {
  profile: Ref<CS17Profile | null>          // name, full_name, profile_type, cohort, profile_picture
  user: Ref<string | null>                  // window.current_user
  isGuest: ComputedRef<boolean>
  isFaculty: ComputedRef<boolean>
  isStudent: ComputedRef<boolean>
  cohort: ComputedRef<string | null>
  logout(): Promise<void>
}

// composables/usePolling.ts
export function usePolling(reload: () => unknown, ms = 45000): void
// starts on mount, clears on unmount, skips while the tab is hidden — and
// reloads immediately when a tab that missed a tick comes back

export function usePublishTimer(
  nextPublishOn: () => string | null | undefined,
  reload: () => unknown,
): void
// The student endpoints return `next_publish_on` beside their rows. Watching it
// and reloading on the second is what the React app's per-response setTimeout
// did; `usePolling` alone would show a scheduled publish up to 45s late.

// composables/useBreakpoint.ts   — one shared matchMedia for the whole app
export function useBreakpoint(): { isDesktop: Ref<boolean> }   // Tailwind `md`

// composables/useZenMode.ts
export function useZenMode(): { isZen: Ref<boolean>; toggle(): void }
export function useZenOnMount(): void

// composables/useBreadcrumbs.ts
export const breadcrumbItems: Ref<BreadcrumbItem[]>        // for readers (AppHeader)
export function useBreadcrumbs(): {                        // for setters (pages)
  items: Ref<BreadcrumbItem[]>
  set(items: BreadcrumbItem[]): void                       // auto-clears on unmount
}
// Split in two so only the page that set a trail clears it — a reader calling
// useBreadcrumbs() would wipe the trail whenever *it* unmounted.

// composables/useAnnouncementDismissals.ts   — localStorage `dismissed-alerts`
export function useAnnouncementDismissals(): {
  dismissed: Ref<Set<string>>
  isDismissed(name: string): boolean
  dismiss(name: string): void
}
```

```ts
// components/common/DataTable.vue     — the ResponsiveTable replacement
export type Column = {
  header: string
  key: string                                   // names the slot, and the fallback field
  variant?: 'primary' | 'field' | 'actions'     // drives the mobile card layout
  width?: string                                // a grid track, e.g. '10rem'
  align?: 'left' | 'right'
}
props: {
  columns: Column[]
  rows: T[]                                     // generic component: <script setup generic="T">
  rowKey: (row: T) => string
  empty?: string
  loading?: boolean                             // renders skeleton rows
  selectable?: boolean
  selection?: string[]                          // v-model:selection
  onRowClick?: (row: T) => void
}
emits: ['update:selection']
slots: `cell-${column.key}` per column, receiving `{ row }`
// Desktop: frappe-ui List table mode. Below `md`: one bordered card per row —
// primary column as the heading, `field` columns as label/value rows, `actions` at
// the foot. Same contract as today's ResponsiveTable, so pages port 1:1.
//
// Selection is `selectable` + `v-model:selection` rather than the callback bag
// this plan first sketched: that is exactly frappe-ui's own List model, so the
// header's select-all (which reasons over `ListRows`' full item set) works with
// no translation layer in between.
```

```ts
// components/common/MarkdownText.vue
props: { content?: string | null; fallback?: string }   // markdown-it + dompurify, class="cs17-prose"

// components/common/GradeBadge.vue
props: { graded: boolean; marksObtained?: number | null; grade?: string | null; maxMarks?: number }

// components/common/PublishFields.vue     — the draft/now/schedule fragment
props: { mode: 'draft' | 'now' | 'schedule'; publishOn: string }
emits: ['update:mode', 'update:publishOn']

// components/scratch/ScratchFrame.vue     — the whole iframe + postMessage bridge
props: { sb3?: ArrayBuffer | null; readOnly?: boolean }
emits: {
  ready: []                      // iframe booted, sb3 (if any) already pushed in
  dirty: []                      // project changed; the parent owns the debounce
  sb3: [{ sb3: ArrayBuffer; thumbnail?: string }]   // answer to requestSb3()
}
expose: { requestSb3(): void }
// Applies applyScratchDefaults() before boot and applyScratchReadOnly() when readOnly.
```

Frozen page-level props, so streams that mount each other's work don't wait:

```ts
// components/assignments/SubmitAssignmentDialog.vue     (W2, mounted by W1 and W2)
props: { open: boolean; assignment: CS17Assignment; existingSubmission?: CS17Submission | null }
emits: ['update:open', 'success']

// components/assignments/AssignmentTable.vue            (W2, mounted by W1)
props: { assignments: CS17Assignment[]; submissionMap: Record<string, CS17Submission>;
         gradeMap?: Record<string, CS17Grade>; loading?: boolean }
emits: ['submitted', 'view-grade']

// components/announcements/AnnouncementsBell.vue        (W1, mounted by W0's header)
props: {}   // reads useSession().cohort itself

// components/faculty/FacultySelect.vue                  (W6, mounted by W6 and W8)
props: { modelValue: string; placeholder?: string }   emits: ['update:modelValue']
```

---

## 6. Workstreams

### Phase 0 — Foundation (serial, blocks everything, ~1 day)

**W0 · Scaffold + shell + contracts**

1. `git mv dashboard dashboard-react`. Scaffold `dashboard/` per the frappe-ui skill's
   `SETUP.md`: Tailwind **v3**, `frappe-ui@1.0.0-beta.55`, `vue-router`,
   `unplugin-icons` / `unplugin-vue-components` / `unplugin-auto-import`,
   `optimizeDeps.exclude: ['frappe-ui']`. Copy `bwh_hive/frontend/{vite.config.ts,
   tailwind.config.js,postcss.config.js,tsconfig.json}` and adjust the paths.
2. `vite.config.ts`:
   ```ts
   frappeui({
     frontendRoute: '/dashboard',
     frappeProxy: { port: 8080 },
     jinjaBootData: true,
     lucideIcons: true,
     buildConfig: {
       indexHtmlPath: '../cs17_portal/www/dashboard.html',
       outDir: '../cs17_portal/public/dashboard',
       baseUrl: '/assets/cs17_portal/dashboard/',
     },
   })
   ```
   The root `package.json`'s `copy-html-entry` script goes away — `buildConfig` writes
   `www/dashboard.html` itself. Keep `dashboard.py` as it is; drop the manual
   `window.frappe_boot` / `window.csrf_token` block from `index.html` and keep only the
   pre-paint `data-theme` script.
3. `router.ts`: lazy routes for all 13 pages, `createWebHistory('/dashboard')`, the
   auth + role guard (`/dev` is exempt from the role redirect, since it belongs to
   neither tree), `usePageMeta` titles.
4. `AppShell.vue`: `DesktopShell` + `Sidebar` over a role-keyed nav config (student:
   Dashboard / Assignments / Projects, Handbook + Courses external, Chat + Inbox +
   Settings, Announcements below the divider; faculty: Dashboard / Assignments,
   Faculty Handbook + Courses, Chat + Inbox + Settings, Announcements) with the profile
   row (`Avatar`, name, `cohort '<code>'` or `Faculty`) and the CS17 mark + Beta badge.
   `AppHeader.vue`: breadcrumbs from `useBreadcrumbs`, `<AnnouncementsBell />`,
   `#actions` slot. Below `md`: `MobileShell` + `AppMobileNav`, whose "You" tab opens a
   `BottomSheet` carrying the sidebar rows that didn't fit. Both shells are skipped
   entirely under zen mode.

   **Each page renders its own `<AppHeader>`**, not the shell: frappe-ui's `PageHeader`
   teleports into the shell's pinned target, which is what gives a page its `#actions`
   slot. `AppHeader` picks `PageHeader` or `PageHeaderMobile` off the breakpoint, so a
   page writes it once. A zen page simply renders its own header instead.

   `components/announcements/AnnouncementsBell.vue` ships as an inert placeholder that
   renders nothing — W1 owns that directory and replaces the file.
5. All §5 contracts, `types.ts`, `lib/*`, `style.css` (including `.cs17-prose` for
   rendered markdown).
6. Placeholder pages (heading only) for all 13 routes, plus a `/dev` route rendering
   `DataTable`, `MarkdownText`, `GradeBadge`, `PublishFields` and `ScratchFrame`.
7. Verify `e2e/tests/auth.setup.ts`, `student.setup.ts` and `faculty.setup.ts` still pass
   against the placeholder shell.

Exit: `yarn build` writes `cs17_portal/www/dashboard.html` and
`cs17_portal/public/dashboard/`; `/dashboard` loads for a student and a faculty member;
the Guest redirect works; dark mode works with no flash; `/dev` renders every contract.

### Phase 1 — Pages (parallel, 8 streams, disjoint ownership)

| Stream | Owns | Builds | Backend |
|---|---|---|---|
| **W1 Student dashboard + announcements** | `pages/DashboardPage.vue`, `pages/AnnouncementsPage.vue`, `components/announcements/*` | Greeting + long date; `AlertBanner` for undismissed announcements; "Upcoming assignments" card — the 3 assignments due in the future, newest-modified first, through W2's `AssignmentTable`, with a "View all →" link. Announcements page: bordered list, variant bar, title, truncated content, date, dismiss (localStorage), "Dismissed" state. `AnnouncementsBell`: `Popover` desktop / `BottomSheet` mobile, unread count badge, per-announcement dismiss; student sees own cohort, faculty sees all published. | `get_student_announcements`, `get_student_assignments`, `get_student_grades`, `useList` CS17 Assignment Submission, `useList` CS17 Announcement (bell) |
| **W2 Student assignments** | `pages/AssignmentsPage.vue`, `pages/AssignmentDetailPage.vue`, `components/assignments/*` | Assignments page: count subtitle + `AssignmentTable` (Title / Due / Status / Submitted / actions; status = graded or past-due → Closed, submission → Submitted, else Pending; actions Preview, View Grade, Edit, Submit; Scratch rows jump to the editor instead of the dialog). Detail page: description via `MarkdownText`, meta card (Due — red when overdue, Evaluation Type, Max Marks, Submitted, grade block), Submit / Edit Submission / "Deadline Passed". `SubmitAssignmentDialog` (URL vs file by submission type, image preview, private upload, submit vs edit). `SubmissionPreviewDialog` (image / pdf / link / Scratch player). `GradeDialog`. `usePolling` on the assignment list. | `get_student_assignments`, `get_student_grades`, `useDoc` CS17 Assignment, `useList` CS17 Assignment Submission, `submit_assignment`, `edit_submission`, `upload()` |
| **W3 Projects + Scratch editor** | `pages/ProjectsPage.vue`, `pages/ProjectEditorPage.vue`, `components/projects/*` | Projects: card grid (thumbnail or fallback icon, title, "Saved <when>"), "New Project" via `dialog.prompt` → create → navigate to the editor, empty state. Editor: `useZenOnMount`, header (back to Projects, title, save status, zen toggle, Save, Submit), `ScratchFrame` filling the rest, 15s idle autosave on `dirty`, manual save, thumbnail upload, read-only when `?readonly=1` or `is_assignment_closed`. `SubmitProjectDialog`: picker → confirm → success, honouring `?assignment=`. | `list_my_projects`, `create_project`, `save_project`, `submit_scratch_project`, `is_assignment_closed`, `useDoc` CS17 Project, `useList` CS17 Assignment |
| **W4 Settings (both roles)** | `pages/SettingsPage.vue` (routed at `/settings` and `/faculty/settings`) | Profile card (`Avatar`, name, cohort or "Faculty"), Appearance row with a `Switch` bound to `useColorScheme`, Account section with Log out → `dialog.danger` → `/api/method/logout` → `/login`. | `useSession`, `useColorScheme` |
| **W5 Faculty assignments list + authoring** | `pages/FacultyAssignmentsPage.vue`, `components/faculty/{AssignmentFormDialog,AssignmentPreview,PublishAssignmentDialog,DeleteAssignmentDialog}.vue` | Table (Title / Cohort / Type / Due / Submissions / Status / actions), cohort `Select` filter, collapsible Drafts row opening a draft in the form, Publish/Reschedule and Delete actions, status badge (Published / Scheduled + date / Draft). Form dialog: Edit/Preview tabs, title, cohort, submission type, assignment type, evaluation (Grade/Marks/Non-graded), max marks, due date, markdown description, publishing mode via `PublishFields`; draft autosaved to `cs17-new-assignment-draft` for new assignments only. | `get_faculty_assignments`, `get_assignment`, `create_assignment`, `update_assignment`, `delete_assignment`, `publish_assignment`, `useList` CS17 Cohort |
| **W6 Faculty assignment detail + grading dialogs** | `pages/FacultyAssignmentDetailPage.vue`, `components/faculty/{GradeSubmissionDialog,AssignSubmissionDialog,BulkAssignBar,FacultySelect}.vue` | Header + breadcrumb, assignment meta, submissions `DataTable` with checkbox selection (Student / Submitted / Grade / actions: Preview, Grade, Assign), assignees parsed out of `_assign`, `BulkAssignBar` when a selection exists. Grade dialog: marks or grade scale by evaluation type, remarks, publish mode via `PublishFields`. Assign dialog: `FacultySelect`, current assignees with unassign. | `get_assignment_submissions`, `grade_submission`, `assign_submission`, `assign_submissions`, `unassign_submission`, `get_faculty_members` |
| **W7 Faculty submissions + grading workspace** | `pages/FacultySubmissionsPage.vue`, `pages/FacultyGradingPage.vue` | Submissions list: `DataTable` (Student / Assignment / Type / Submitted / Grade / Grade-or-Review), whole row navigates. Grading page: `useZenOnMount`, header (back, assignment title, student · out of N marks, zen toggle, `GradeBadge`), player pane (`ScratchFrame readOnly` fed by `get_submission_project`, or the file/PDF/link viewer), grade form pinned to the foot, both the zen and non-zen layouts. | `list_cohort_submissions`, `get_submission_grade`, `save_grade`, `get_submission_project` |
| **W8 Faculty announcements + faculty dashboard** | `pages/FacultyAnnouncementsPage.vue`, `pages/FacultyDashboardPage.vue`, `components/faculty/{AnnouncementFormDialog,AnnouncementPreview,PublishAnnouncementDialog,DeleteAnnouncementDialog,PreviewAnnouncementDialog}.vue` | Announcements table (Title / Cohort / Variant / Status / Published / actions Preview, Edit, Publish, Delete) with the same draft/scheduled/published badge ladder; form dialog with title, markdown content, variant, cohort (or All cohorts), dismissible `Switch` and a live preview. Dashboard: greeting, "Published Assignments" stat, "Assigned to you" list linking into W6's detail page. | `get_faculty_announcements`, `create_announcement`, `update_announcement`, `delete_announcement`, `publish_announcement`, `get_assigned_submissions`, `frappe.client.get_count`, `useList` CS17 Cohort |

Cross-stream mounts, all against the §5 frozen props: W1 mounts W2's `AssignmentTable`;
W0's header mounts W1's `AnnouncementsBell`; W7 and W3 both build on W0's `ScratchFrame`;
W8 uses W6's `FacultySelect`. Merge order: **W2 → W1**, **W6 → W8**, the rest in any
order. Until a dependency merges, a stream stubs the component with the frozen props —
or, if the streams share one working tree, mounts the real file directly (this is what
Hive did, and no stub was needed).

### Phase 2 — Integration (after Phase 1 merges)

| Stream | Work |
|---|---|
| **W9 e2e** | Update the specs listed in the appendix. The theme spec changes from `html.dark` / `#root` to `html[data-theme="dark"]` / `#app`; the rest is frappe-ui locators. Add `e2e/helpers/ui.ts` for frappe-ui's dialog, select and list markup — reference `bwh_hive/e2e/helpers/ui.ts`. Suite green is the gate. |
| **W10 Polish pass** | One walk of every screen against the frappe-ui `DESIGN.md`: token audit (`grep -E 'text-gray-|bg-gray-|border-gray-|muted-foreground|bg-background' src` → empty), consistent card radius, page gutters, mobile checks, loading and empty states, Prettier + ESLint settled and pinned in the pre-commit hook. |
| **W11 Remove React** | Delete `dashboard-react/`, prune the root `package.json` (`copy-html-entry`, Tailwind 4 devDependencies), rewrite `README.md`'s development section, and write the `CLAUDE.md` this repo does not yet have: Vue 3 + frappe-ui, `yarn dev/build/lint/typecheck`, the frappe-ui skill and tokens, `useList` / `useDoc` / `useCall`. |

---

## 7. Screen notes worth writing down

- **Assignment status ladder** (student) is shared by three surfaces and must stay
  identical: graded → Closed, submission present → Submitted, `due_date` past → Closed,
  else Pending. It lives in `lib/status.ts` under W2 and is imported, never re-derived.
- **Grade visibility**: a grade only counts when its `submission` is one of the student's
  own, or (for older rows with no `submission`) when a submission exists for that
  assignment. Port the filter in `DashboardPage`/`AssignmentsPage` as one helper.
- **Scratch read-only** has two triggers — `?readonly=1` and `is_assignment_closed` — and
  both must also suppress the autosave timer, not just the toolbar.
- **The editor's `-m-6` layout hack** goes away: `AppShell` gives the editor a full-height
  slot under zen mode instead of a padded page that the editor un-pads.
- **Datetime round-tripping**: `DateTimePicker` values are written back as
  `YYYY-MM-DD HH:mm:ss`. Keep `toFrappeDatetime` / `toDatetimeLocal` as the only place
  that knows the format.
- **Faculty bell** lists every published announcement, the student bell only their
  cohort's. One component, the filter comes from `useSession`.

---

## 8. Dependencies

```
dependencies:    vue@^3.5  vue-router@^4  frappe-ui@1.0.0-beta.55  dayjs
                 markdown-it  dompurify  @fontsource-variable/geist
devDependencies: vite@^7  @vitejs/plugin-vue@^6  typescript  vue-tsc
                 tailwindcss@^3.4  postcss  autoprefixer
                 unplugin-icons unplugin-vue-components unplugin-auto-import
                 lucide-static @iconify/json  @types/markdown-it
                 eslint + eslint-plugin-vue  prettier
```

Everything else in today's `dashboard/package.json` goes away.

---

## 9. Backend touch points (small)

- `cs17_portal/www/dashboard.html` becomes generated output from `frappe-ui/vite`
  `buildConfig`. `dashboard.py` keeps returning the same boot dict; `jinjaBootData`
  injects `window[key]` for each key, so the manual inline script in `index.html` goes.
- `get_context_for_dev` already exists and needs no change — `main.ts` calls it in dev.
- No new whitelisted methods. Every screen maps to a method or doc access that exists
  today (appendix).

---

## 10. Acceptance per stream

- `yarn build` green; `vue-tsc --noEmit` clean; ESLint and Prettier clean.
- Zero raw color utilities: `grep -rE 'text-gray-|bg-gray-|border-gray-|muted-foreground|bg-background|text-destructive' src` → empty.
- Works as a student and as a faculty member, desktop and mobile, light and dark.
- Relevant `e2e/` specs green or updated in the same PR.
- One stream per PR, against `develop`, description in Why / What / How.

---

## 11. Suggested execution order

```
Day 1        W0 (serial)
Day 2–4      W1 W2 W3 W4 W5 W6 W7 W8 in parallel (8 agents, worktrees)
             merge order: W2 → W1, W6 → W8, rest any order
Day 5        W9 e2e, W10 polish, W11 delete React
```
