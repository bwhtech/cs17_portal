# Running the portal locally

## Site

```bash
bench new-site cs17.localhost --db-root-password <root> --admin-password admin \
    --install-app cs17_portal
bench --site cs17.localhost execute cs17_portal.demo.run
```

`*.localhost` resolves to `127.0.0.1` on macOS and Linux with no `/etc/hosts` entry, so
the site is reachable at <http://cs17.localhost:8000> as soon as `bench start` is up.

A fresh site opens on the setup wizard, which stands between you and every other page.
Skip it:

```python
# bench --site cs17.localhost console
settings = frappe.get_doc("System Settings")
settings.language, settings.time_zone, settings.setup_complete = "en", "Asia/Kolkata", 1
settings.save()
```

## Demo data

`cs17_portal/demo.py` seeds a term's worth of realistic data. It is re-runnable: it
clears everything tagged with the `@cs17.test` user domain or the `C6` / `C7` cohort
codes, then seeds again. Nothing else on the site is touched.

Everyone shares the password `Cs17-Demo-Pass-123`.

| Who | Sign in as | Sees |
|---|---|---|
| Student | `zoya@cs17.test` | 5 published assignments, a marked poster, two Scratch projects, 3 announcements, two published results |
| Student | `meera@cs17.test` | an `A` on the worksheet — the other evaluation type |
| Student | `rohan@cs17.test` | one marked assignment and nothing else, for a quieter dashboard; his Q3 result reads `Fail` |
| Faculty | `priya@cs17.test` | 7 assignments across both cohorts (published, scheduled, draft), 13 submissions, 5 announcements |
| Faculty | `arjun@cs17.test` | two submissions assigned to him, for "assigned to you" |

What the seed covers, deliberately: every submission type (Scratch, PDF, URL, Image, ZIP,
Any); an assignment in each publish state (published, scheduled, draft); grades on both
evaluation types (marks out of 20 or 10, and the A–E scale); a published grade, an
unpublished one, and submissions with no grade at all; announcements in all three
variants, dismissible and not, cohort-scoped and all-cohorts; and a second cohort so the
faculty cohort filter has two sides.

Two exams as well — a Q3 assessment over three subjects (two split by a pattern, one marked as a
single total, graded on two different scales) and a simpler Q2 one. Results are published for
three students and held back for a fourth, so the permission rule has a result that must stay
invisible to its own student.

Quarters, subjects, patterns and grading scales are not scoped to a cohort, so the seed creates
them only when they are missing and `wipe` leaves them behind.

Submissions carry real files — a generated PNG and a one-page PDF — so the image and PDF
previews have something to show.

## Frontend

```bash
cd dashboard
yarn dev        # Vite on :8080, proxying to the bench on :8000
yarn build      # writes cs17_portal/public/dashboard + www/dashboard.html
yarn typecheck  # vue-tsc
yarn lint       # eslint + prettier --check
```

`/dashboard/dev` is an unlisted sandbox rendering every shared component.

## End-to-end tests

```bash
SITE_HOST=cs17.localhost:8000 yarn test:e2e
```

The default host is `cs17.portal:8000`, which needs a hosts entry; `SITE_HOST` overrides
it. The admin password must be `admin`, or set `FRAPPE_PASSWORD`.
