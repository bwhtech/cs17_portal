# Appendix — inventory of the React dashboard

Snapshot of `dashboard/` at the time the rewrite plan was written: 8.3k LOC, React 19 +
shadcn + `frappe-react-sdk`, mounted at `/dashboard` by `website_route_rules`.

## Routes

`BrowserRouter basename="/dashboard"`. Two role trees; `Layout` redirects Faculty to
`/faculty`, `FacultyLayout` redirects non-Faculty to `/`.

| Path | Component | Role | Notes |
|---|---|---|---|
| `/` | `DashboardPage` | Student | greeting, alerts, 3 upcoming assignments |
| `/assignments` | `AssignmentsPage` | Student | full assignment table |
| `/assignments/:assignmentId/submission` | `AssignmentDetailPage` | Student | description + meta card + submit |
| `/projects` | `ProjectsPage` | Student | Scratch project card grid |
| `/projects/:id/edit?assignment=&readonly=1` | `ProjectEditorPage` | Student | Scratch editor iframe, zen on mount |
| `/announcements` | `AlertsPage` | Student | announcement list with dismiss |
| `/settings` | `SettingsPage` | Student | profile, dark mode, logout |
| `/faculty` | `FacultyDashboardPage` | Faculty | greeting, published count, assigned-to-you |
| `/faculty/assignments` | `FacultyAssignmentsPage` | Faculty | table, drafts, create/publish/delete |
| `/faculty/assignments/:assignmentId` | `FacultyAssignmentDetailPage` | Faculty | submissions table, grade/assign/bulk assign |
| `/faculty/announcements` | `FacultyAnnouncementsPage` | Faculty | table + create/edit/preview/publish/delete |
| `/faculty/submissions` | `FacultySubmissionsPage` | Faculty | cohort submissions table |
| `/faculty/submissions/:submissionId` | `FacultyGradingPage` | Faculty | player pane + grade form, zen on mount |
| `/faculty/settings` | `FacultySettingsPage` | Faculty | same shape as student settings |

## Backend surface

Whitelisted methods (`cs17_portal/api.py`, 921 lines) used by the frontend:

```
get_user_profile              get_student_assignments        get_student_grades
get_student_announcements     is_assignment_closed           get_submission_project
create_project                list_my_projects               save_project
submit_scratch_project        get_faculty_assignments        get_assignment
create_assignment             update_assignment              delete_assignment
publish_assignment            get_assignment_submissions     grade_submission
save_grade                    get_submission_grade           list_cohort_submissions
get_assigned_submissions      assign_submission              assign_submissions
unassign_submission           get_faculty_members            get_faculty_announcements
create_announcement           update_announcement            delete_announcement
publish_announcement
```

Doctype methods:
`cs17_portal.cs17_portal.doctype.cs17_assignment_submission.cs17_assignment_submission.submit_assignment`
and `.edit_submission`.

Direct doc access (`useFrappeGetDoc` / `GetDocList` / `GetDocCount`):

| Doctype | Where | Shape |
|---|---|---|
| `CS17 Assignment` | `AssignmentDetailPage` (doc), `ProjectEditorPage` submit picker (list), `FacultyDashboardPage` (count) | filters `cohort`, `submission_type=Scratch`, `is_published=1` |
| `CS17 Assignment Submission` | `DashboardPage`, `AssignmentsPage`, `AssignmentDetailPage` | filters `student`, `assignment` |
| `CS17 Announcement` | `TopBar`, `FacultyTopBar` | filters `is_published=1`, `cohort` |
| `CS17 Cohort` | `FacultyAssignmentsPage`, `FacultyAnnouncementsPage` | names only |
| `CS17 Project` | `ProjectEditorPage` (doc) | `sb3_file`, `project_title`, `last_saved_at` |
| `File` | `SubmitAssignmentDialog` via `useFrappeFileUpload` | private uploads |

Boot data: `cs17_portal/www/dashboard.py` `get_boot()` returns `frappe_version`,
`site_name`, `read_only_mode`, `system_timezone`, `current_user`, `profile`
(`CS17 Profile`: `name`, `full_name`, `profile_type`, `cohort`, `profile_picture`) plus
`csrf_token`. `get_context_for_dev` exposes the same dict over the API in developer mode.

## localStorage keys

| Key | Written by | Kept? |
|---|---|---|
| `theme` (`"light"`/`"dark"`) | `lib/theme.ts`, pre-paint script in `index.html` | yes — same key `useColorScheme` uses |
| `dismissed-alerts` (JSON array of names) | `TopBar`, `FacultyTopBar`, `AlertsPage` | yes |
| `cs17-new-assignment-draft` | `CreateAssignmentSheet` | yes |
| `tw:theme`, `tw:addons` | `lib/scratch.ts`, read by the Scratch iframe | yes — the iframe's own contract |

## Scratch integration

`lib/scratch.ts` + `useScratchEditor.ts` + `ProjectEditorPage` + `ScratchSubmissionPlayer`.
The editor is a TurboWarp build served as a static asset at
`/assets/cs17_portal/scratch/editor.html`, driven over `postMessage`:

| Message | Direction | Payload |
|---|---|---|
| `ready` | iframe → app | — |
| `load-project` | app → iframe | `{ sb3: ArrayBuffer }`, transferred |
| `dirty` | iframe → app | — (debounced into a 15s idle autosave) |
| `request-sb3` | app → iframe | — |
| `project-sb3` | iframe → app | `{ sb3: ArrayBuffer, thumbnail?: dataURL }` |

Read-only is enforced by injecting a stylesheet into the iframe document
(`applyScratchReadOnly`) that hides the toolbox, menu bar, target pane and addon
buttons, and by blocking `contextmenu`. `applyScratchDefaults` mirrors the app theme
into `tw:theme` and disables the pause addon before the iframe boots.
See `docs/scratch-integration-spec.md`.

## Cross-cutting React pieces

| File | Job |
|---|---|
| `components/ui/ResponsiveTable.tsx` | table on `md:`, stacked cards below; `Column<T>` API with `variant: primary/field/actions`, optional `selection` |
| `components/ui/RichText.tsx` | `react-markdown` + `rehype-raw` renderer for descriptions and announcement content |
| `context/ZenModeContext.tsx` | hides sidebar + top bar; `useZenOnMount` for the editor and grading pages |
| `context/BreadcrumbContext.tsx` | detail pages push `Workspace / Assignments / <title>` into the top bar |
| `hooks/useAuthGuard.ts` | reads boot, redirects Guests to `/login?redirect-to=…` |
| `lib/liveQuery.ts` | SWR `refreshInterval: 45000` so scheduled publishes appear without a reload |
| `lib/submissionTypes.ts` | per-submission-type `accept`/`label`/`help`/`error` + `previewKind` |
| `lib/frappeError.ts` | pulls the message out of a Frappe error response |

## e2e suite

`playwright.config.ts` + `e2e/` (11 specs, ~2.4k LOC). Helpers (`e2e/helpers/*`) drive the
API only and are unaffected by the rewrite. UI specs that assert on markup:

| Spec | Coupling to fix |
|---|---|
| `student-theme.spec.ts` | asserts `html.dark` and `#root` empty — becomes `html[data-theme="dark"]` and `#app` |
| `student-submission.spec.ts` | role/text selectors on the submit dialog and assignment table |
| `faculty-assignments-ui.spec.ts` | the create sheet's fields and the drafts row |
| `faculty-announcements.spec.ts` | announcement dialog fields, table actions by `aria-label` |
| `profile.spec.ts`, `auth.spec.ts` | sidebar name, login redirect — and `auth.spec.ts`'s `readBoot()` reads `window.frappe_boot`, which `jinjaBootData` replaces with a `window.<key>` per boot key (`window.current_user`) |
