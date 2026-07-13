# CS17 Portal — Scratch Integration Spec

Status: **Draft for approval** · Owner: Hussain · Date: 2026-07-07

## 1. Goal

Give CS17 students a block-based **Scratch** editor inside the portal so they can:

1. Create and freely save their own Scratch **projects** (a personal workspace).
2. **Submit** a project against an assignment.
3. Let **faculty open, run, and grade** submitted projects without leaving the portal.

This extends the existing assignment/submission/grading spine; it does not replace it.

## 2. Architecture (decided)

- **Host / chrome stays React.** The existing `dashboard/` SPA (React 19 + Vite + shadcn + Tailwind v4 + `frappe-react-sdk`, served at `/dashboard`) gains new routes. All page chrome — project grid, editor toolbar, submit picker, grading panel — reuses the **existing shadcn/Tailwind components**.
- **Scratch editor is an embedded iframe, not a React component.** We self-host a prebuilt **TurboWarp/scratch-gui** bundle and embed it in an `<iframe>`. Host ↔ editor talk over `postMessage`. This isolates Scratch's React 16 from the app's React 19 (no bundling conflict) and works fully offline.
- **The `.sb3` file is the artifact.** A Scratch project serializes to a single `.sb3` (zip of `project.json` + assets). That file is what we store, snapshot, and re-open.

```
┌─────────────────────────── React dashboard (/dashboard) ───────────────────────────┐
│  Projects grid   │  Editor page                         │  Faculty grading panel    │
│  (shadcn cards)  │  ┌── toolbar (shadcn) ──────────────┐│  ┌── read-only player ──┐ │
│                  │  │  Save / Submit / autosave state  ││  │  <iframe> TurboWarp   │ │
│                  │  ├──────────────────────────────────┤│  │  ?readonly  loads .sb3│ │
│                  │  │  <iframe> TurboWarp scratch-gui   ││  └───────────────────────┘ │
│                  │  │  postMessage: load-project /      ││  marks + grade (shadcn)   │
│                  │  │               request-sb3 / saved ││                           │
│                  │  └──────────────────────────────────┘│                           │
└──────────────────┴──────────────────────────────────────┴───────────────────────────┘
                                    │  frappe-react-sdk (REST/RPC)
                                    ▼
                        Frappe backend — DocTypes + whitelisted API
```

## 3. postMessage bridge (the one custom thing in the bundle)

We fork TurboWarp/scratch-gui minimally to add a small bridge (a few lines wired to the VM):

| Direction | Message | Payload | Effect |
|---|---|---|---|
| host → editor | `load-project` | `{ sb3: ArrayBuffer }` | `vm.loadProject(sb3)` — open an existing project |
| host → editor | `request-sb3` | `{}` | editor serializes and replies |
| editor → host | `project-sb3` | `{ sb3: ArrayBuffer, thumbnail?: dataURL }` | host uploads to Frappe |
| editor → host | `ready` | `{}` | editor booted; safe to `load-project` |
| editor → host | `dirty` | `{}` | project changed since last save (drives autosave + unsaved-guard) |

Read-only mode: same bundle loaded with `?readonly=1` hides the palette/editing and only allows green-flag/run — used in the faculty grading player.

## 4. Data model

### 4.1 New DocType — `CS17 Project` (standalone, student-owned)

| Field | Type | Notes |
|---|---|---|
| `project_title` | Data (reqd) | |
| `student` | Link `CS17 Profile` (reqd) | owner; set from session, not user-editable |
| `sb3_file` | Attach | private file, the live saved project |
| `thumbnail` | Attach Image | stage snapshot for the grid (optional/nice-to-have) |
| `last_saved_at` | Datetime | updated on every autosave/save |

- **Permissions:** student reads/writes **only their own** (permission query condition: `student.user == frappe.session.user`). Faculty read projects within their cohort. No `ignore_permissions` in normal paths.
- Naming: `PROJ-.{student}.-.####` (or a simple hash series).

### 4.2 Extend `CS17 Assignment`

- Add **`Scratch`** to the `submission_type` Select options (currently `Any/PDF/URL/Image/ZIP`).

### 4.3 Extend `CS17 Assignment Submission`

- Add `project` : Link `CS17 Project` — which project was submitted (reference).
- **Snapshot on submit:** at submit time, copy the project's current `.sb3` into the existing `submission_document` (Attach) as an **immutable** snapshot. Later edits to the live `CS17 Project` must NOT change an already-submitted artifact.
- Reuse existing `submitted_at`, `student`, `assignment`, submittable workflow.

### 4.4 Grading — unchanged

`CS17 Assignment Grade` is untouched. Faculty just get the in-portal player fed from `submission_document`.

## 5. Backend API (`cs17_portal/api.py`, all whitelisted, ORM-only)

- `create_project(project_title) -> dict` — new `CS17 Project` for the current student.
- `list_my_projects() -> list` — current student's projects (title, thumbnail, last_saved_at).
- `save_project(project, file) -> dict` — attach uploaded `.sb3` (+ optional thumbnail) to the project, update `last_saved_at`. Ownership enforced.
- `submit_scratch_project(assignment, project) -> dict` — validate ownership + assignment is Scratch-type + open/published; snapshot `.sb3` into a new `CS17 Assignment Submission`; submit it.
- `get_submission_project(submission) -> {sb3_url}` — faculty fetch the snapshot for the read-only player (permission-checked: grader in cohort).

File upload uses Frappe's file API (`frappe.client` / `upload_file`), not custom handlers.

## 6. Frontend routes (React, under `/dashboard`)

| Route | Who | Purpose |
|---|---|---|
| `/projects` | student | Grid of my projects (thumbnails) + "New Project" |
| `/projects/:id/edit` | student | Full editor: iframe + Save/Submit toolbar, autosave |
| `/assignments/:id/submission` | student | Existing page; when assignment is Scratch-type, show a **project picker** to submit |
| faculty grading dialog | faculty | Existing `GradeDialog`/`SubmissionPreviewDialog`; when submission is Scratch, embed **read-only player** loading the snapshot, then enter marks/grade |

**Autosave:** debounced; on `dirty` from the editor, after N seconds idle the host requests the `.sb3` and calls `save_project` (draft). Separate from **Submit** (explicit, immutable snapshot). Unsaved-changes guard on navigation.

## 7. Build & hosting of the Scratch bundle

- Vendor a **built** TurboWarp/scratch-gui (with our bridge) into the app so day-to-day `bench build` doesn't need the heavy Scratch webpack toolchain. Serve from `cs17_portal/public/scratch/` → `/assets/cs17_portal/scratch/index.html`, embedded via iframe.
- Keep the fork/build recipe documented so the bundle can be regenerated.
- **This is the main risk/unknown** → tackled first as a spike (Phase 0).

## 8. Phased plan (agent-delegated)

- **Phase 0 — Scratch bundle spike (highest risk first).** Build TurboWarp/scratch-gui, add the postMessage bridge, prove load `.sb3` → edit → get `.sb3` round-trips in a bare iframe harness. Nothing Frappe-specific yet. *Gate: a working embeddable bundle.*
- **Phase 1 — Data model + API.** `CS17 Project` DocType, assignment/submission extensions, whitelisted API, permissions. `frappe-implementer` → `frappe-reviewer`.
- **Phase 2 — Student editor + projects grid.** React routes, iframe host, autosave, save/load wiring. Vue/React reviewer.
- **Phase 3 — Submit flow.** Project picker on assignment page, immutable snapshot on submit.
- **Phase 4 — Faculty grading player.** Read-only embed in grading dialog + marks.
- **Phase 5 — Tests + e2e.** `frappe-tester` (API/permissions), Playwright student-submission flow.

## 9. Open questions / risks

- **TurboWarp build weight** — mitigated by vendoring the built bundle; confirmed in Phase 0.
- **File size** — `.sb3` with media can be large; may need an assignment/portal max-size setting. Deferred until real projects exist.
- **Autosave frequency vs. server load** — start conservative (e.g. 15s idle debounce), tune later.
