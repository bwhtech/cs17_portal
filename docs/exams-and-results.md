# Exams & Results

Subject-wise exam results for a cohort, graded from marks and published to students.

Eleven DocTypes: four masters (`CS17 Subject`, `CS17 Subject Pattern`, `CS17 Grading Scale`,
`CS17 Exam`), two transactions (`CS17 Subject Marks`, `CS17 Result`), and five child tables.

Marks flow in one direction. They are typed **only** into `CS17 Subject Marks`; everything
downstream is derived:

```
CS17 Subject Pattern    Theory 20% / Practical 30% / Project 50%
        │
CS17 Exam Subject       Mathematics, max 100, uses that pattern
        │               → component max marks: 20 / 30 / 50
CS17 Subject Marks      one per (exam, student, subject) — marks typed here
        │               → subject total, percentage, grade
CS17 Result             read-only rollup of every subject total
```

`CS17 Result.scores.marks_obtained` is read-only and pulled from those documents on every save, so
the two can never disagree. Saving or deleting a `CS17 Subject Marks` re-saves the matching result,
so the rollup stays current without anyone reopening it.

## Where each number lives

| Value | Owned by | Reason |
|---|---|---|
| Which subjects an exam covers | `CS17 Exam.subjects` | Varies per exam, not global |
| Max marks per subject | `CS17 Exam.subjects.max_marks` | A subject can be worth 50 in one exam and 100 in another |
| How a subject splits into components | `CS17 Subject Pattern.components` | Reusable shape (Theory/Practical/Project), not tied to a subject |
| Which split an exam uses for a subject | `CS17 Exam.subjects.subject_pattern` | The same subject can split differently per exam |
| Marks a student scored | `CS17 Subject Marks.components.marks_obtained` | The only value a human types anywhere |
| Marks → grade mapping | `CS17 Grading Scale.bands` | Shared across exams, versioned per scale |
| Which scale grades a subject | `CS17 Exam.subjects.grading_scale` | Subjects in the same exam can grade differently |
| Grade, percentage, totals | `CS17 Result` (read-only) | Derived on every save; never entered |

The result never stores its own subject list or max marks — it copies them from the exam on save.
That keeps a result from silently disagreeing with the exam it belongs to.

## Grading is on percentage, not raw marks

Grade bands are defined as percentage ranges, not mark ranges. A single scale can then serve
subjects with different max marks — 45/50 and 90/100 both grade as 90%.

Each `CS17 Grade Band` row is `grade`, `min_percent`, `max_percent`, optional `grade_point` and
`description`. Lookup takes the band with the highest `min_percent` at or below the percentage, so
the ranges are total: any value from 0 to 100 resolves to a grade.

The scale validates that bands do not overlap, that the lowest starts at 0 and the highest ends at
100, and that no grade letter is repeated. Rows are re-ordered by `min_percent` on save.

`passing_percentage` on the scale decides pass/fail per subject. A result is `Pass` only when every
subject passes.

## Each subject can grade differently

Subjects in one exam rarely share a curve — marks are distributed differently and different teachers
set the paper. So the scale is chosen **per subject**, on the exam's subject row:

- `CS17 Exam.grading_scale` is the exam default. It grades the **overall** percentage, and any
  subject row left blank.
- `CS17 Exam Subject.grading_scale` overrides it for that subject only. Blank is filled in from the
  exam default when the exam is saved, so every row always resolves to a real scale.

Three subjects with three different criteria is just three scales:

| Subject | Max marks | Grading scale |
|---|---|---|
| Python Basics | 100 | Strict — A starts at 90 |
| Scratch Project | 50 | Project — A starts at 75 |
| Viva | 25 | Lenient — A starts at 70 |

Each row also takes an optional `examiner` (a Faculty `CS17 Profile`), so the teacher who set and
marked a paper is recorded next to the scale their paper is graded on.

`CS17 Result Subject Score.grading_scale` stores the scale each subject was actually graded on, so a
result stays readable after a scale is later edited.

The **overall** grade uses the exam-level scale on the overall percentage. Note that when subjects
carry very different scales, the overall grade is a blunt summary — the subject-wise grades are the
meaningful output, and the print format should lead with them.

## DocTypes

### CS17 Subject
Master list of subjects. Named by `subject_code` (so `MATH101`, not a hash). `is_active` filters
which subjects appear when building an exam.

### CS17 Grading Scale (+ CS17 Grade Band)
A named, reusable mapping from percentage to grade, plus `passing_percentage`. `is_default` marks
one scale as the house default and unsets the flag on all others when saved.

### CS17 Exam (+ CS17 Exam Subject)
One exam sitting for one cohort. Named `EXAM-{cohort}-###`. Holds the subject list with per-subject
`max_marks`, `grading_scale` and `examiner`, the exam-level default `grading_scale`, and optional
start/end dates. `total_max_marks` is summed on save.

`cohort` is `set_only_once` — an exam cannot be moved to a different cohort after creation.

Once any result for the exam is published, the subject list, max marks and grading scales are
frozen. Changing them would invalidate report cards already handed out.

### CS17 Subject Pattern (+ CS17 Subject Pattern Component)
A reusable named split, e.g. `Theory 20 / Practical 30 / Project 50`. Each component carries a
**weightage percent**; they must add up to 100. The pattern has no link to a subject - the exam
decides which subject uses which pattern.

Component max marks are derived, never typed: `component max = subject max marks x weightage / 100`.
So the same pattern works for a 100 mark paper and a 50 mark paper.

### CS17 Subject Marks (+ CS17 Subject Marks Component)
One student's component marks for one subject in one exam. Named `SM-{exam}-###`. The exam's
subject row supplies the max marks, the pattern and the grading scale; the components are rebuilt
from the pattern on every save. Computes the subject `total_marks_obtained`, `percentage`, `grade`
and `is_pass`.

A subject with no pattern on its exam row gets a single implicit `Total` component at 100%, so an
exam can mix split and unsplit subjects.

One document per (exam, student, subject), enforced by a validate check and a unique index.

Once a subject has recorded marks, its `max_marks` and `subject_pattern` are frozen on the exam -
component max marks are derived from them, so moving them would silently invalidate entered marks.

### CS17 Result (+ CS17 Result Subject Score)
One student's rolled-up result for one exam. Named `RES-{exam}-###`.

- `exam` and `student` are `set_only_once`; `cohort`, `student_name` and `grading_scale` are pulled
  from them and read-only.
- `scores` is rebuilt from the exam on every save: missing subjects are appended, `max_marks`,
  `subject_name` and `grading_scale` are refreshed from the exam, rows are ordered to match the
  exam, and a row for a subject not in the exam is rejected.
- `marks_obtained` is **read-only**, pulled from the matching `CS17 Subject Marks`. A subject with
  no marks document reads as 0.
- Per row, `percentage`, `grade` and `is_pass` are computed against that row's own scale.
- Publishing is blocked while any subject still has no marks document, so a missing entry cannot
  go out as a silent zero.
- On the parent, `total_marks_obtained`, `total_max_marks`, `percentage`, `overall_grade` and
  `result_status` are computed.

One result per (exam, student) is enforced twice: a `validate` check for a readable error message,
and a unique index added by `cs17_portal.patches.v1_0.add_unique_result_per_exam_student` for the
concurrent case.

## Publishing

Same pattern as assignments and grades: `is_published` plus a scheduled `published_on`. Setting a
future `published_on` and leaving `is_published` unchecked lets `cs17_portal.tasks.auto_publish_results`
flip the flag when the time passes, so a whole cohort's results go live at once instead of trickling
out as each is entered.

Students only ever see published results — `get_permission_query_conditions` filters to
`student = <their profile> and is_published = 1`, and `has_permission` applies the same rule to
direct document access.

## Usage

1. **CS17 Subject** — create one per subject.
2. **CS17 Subject Pattern** — create the splits you use, e.g. Theory 20 / Practical 30 / Project 50.
   Skip for subjects marked as a single total.
3. **CS17 Grading Scale** — create one scale per distinct grading criterion, add bands covering
   0–100, set `passing_percentage`. Tick `is_default` on the house standard.
4. **CS17 Exam** — pick the cohort and the default grading scale, then add subjects with their max
   marks, a pattern where the subject is split, a grading scale where it differs, and the examiner.
5. **CS17 Subject Marks** — one per student per subject. Pick exam, student, subject; the component
   rows load from the pattern with their max marks already worked out. Type the marks and save.
6. **CS17 Result** — pick the exam and student. Every subject total is pulled in automatically,
   nothing to type. Save — grades, totals and pass/fail fill in.
7. Set `published_on` (or tick `is_published`) to release.

## Assumptions

These were not specified and are easy to change:

- **Pass/fail** is included, driven by `passing_percentage` on the scale. Remove `is_pass` and
  `result_status` if the course does not fail anyone.
- **Weightage** is not modelled. Every subject contributes its raw marks to the total. If subjects
  need different weights toward the overall percentage, add a `weightage` column to
  `CS17 Exam Subject`.
- **Desk permissions** are `System Manager` (full) and `CS17 Student` (read). Faculty entry today
  goes through a System Manager. A faculty-facing screen in the dashboard SPA, and the API methods
  behind it, are not part of this change.
- **Attendance / absent** is not modelled; an absent student is currently a 0.

## Not yet built

- The print format for the report card — pending the design.
- Faculty and student UI in the `dashboard` SPA. Results are desk-only for now.
- Tests. `test_cs17_result.py` should cover grade-band lookup at boundaries (0, exactly on a band
  edge, 100), the duplicate guard, and the frozen-after-publish rule.
