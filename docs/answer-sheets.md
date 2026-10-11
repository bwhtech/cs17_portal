# Answer sheets

A faculty uploads one file per assignment. Each student then sees the expected answer for
every task next to how they did, and the faculty marks each answer Correct, Half or
Incorrect. It is separate from grading: an answer sheet never changes a grade.

## For faculty

1. Open the assignment in the dashboard. The **Answer sheet** box is above the submissions.
2. Click **Upload answer sheet** and pick a CSV or Excel (`.xlsx`) file. Nothing is typed in
   by hand; the file is the answer sheet.
3. Each student in the sheet gets an **Answers** button on their row, whether or not they
   submitted. It opens their tasks, the expected answers and what the sheet says about them.
4. Change any answer with one click: Correct, Half, Incorrect or Not scored. It saves at once.
5. Turn on **Show to students** when you are ready. Until then students see nothing.

**Replace** uploads a new file and starts the marks over. The bin removes the sheet after
asking.

## The file

The first row is the heading: `#`, `Task`, `Expected answer`, `Scored`, then one column per
student.

```csv
#,Task,Expected answer,Scored,Chandni,Dalika
1,Create gallery folder,gallery/ at the assignment root,Yes,Named gallary,OK
2,Print README.txt,cat README.txt,No,Seen in history,Seen in history
,Score (out of 20),Scored rows only,,19,20
,Notes,,,Untouched copy left in the folder,
```

| Row | What it is |
|---|---|
| Has a number in `#` | A task. Under each student, write `OK` when the answer is right, or a short note on what went wrong. |
| No number, but student cells are filled | An extra line for each student, named by its `Task` cell: Score, Errors, Grade, Notes. Each student sees their own. |
| No number and no student cells | A note for everyone, shown under the answers. |

`Scored` is Yes or No. A "No" row is shown to the student but starts as Not scored.

A file with a different first row is refused, and the message repeats the layout.

## How a column finds its student

A column heading is matched against the students of the assignment's cohort. It can be the
student's full name, first name or email. A first name only works when exactly one student
in the cohort has it. A column that matches no one is kept, and the box names it so the
heading can be fixed and the file uploaded again.

## Starting marks

| Cell | Mark |
|---|---|
| `OK` | Correct |
| Any other text | Incorrect |
| Empty, or the row's `Scored` is No | Not scored |

Half is never guessed. Set it on the answers that deserve it.

## For students

Once the sheet is shown, a student with a column gets an **Answers** button on their
assignment list and a **View answers** button on the assignment page. They see their own
answers, a count of correct, half and incorrect, and their own extra lines. They never see
another student's column.

## How it is stored

`CS17 Assignment` has two fields: `show_answers` (the switch) and `answer_sheet` (the parsed
file as JSON: the tasks, one entry per student column with a remark and a mark per task, and
the note). The code is in `cs17_portal/answer_sheet.py`; the dashboard side is
`components/faculty/AnswerSheetCard.vue` and `components/answers/`.

The whole sheet is one value. If two faculty mark the same sheet at the same moment, the
later save wins.
