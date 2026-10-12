# Answer sheets

A faculty uploads one file per assignment. Each student then sees the expected answer for
every task, and the faculty marks each student's answers Correct, Half or Incorrect and can
leave a note on any of them. It is separate from grading: an answer sheet never changes a
grade.

## For faculty

1. Open the assignment in the dashboard. The **Answer sheet** box is above the submissions.
2. Click **Upload answer sheet** and pick a CSV or Excel (`.xlsx`) file. Nothing is typed in
   by hand; the file is the answer sheet.
3. Every student row gets an **Answers** button, whether or not they submitted. It opens the
   tasks and the expected answers for that student.
4. Mark an answer with one click: Correct, Half, Incorrect or Not scored. It saves at once.
5. Write a short note under any answer to say why. It saves when you leave the field.
6. Turn on **Show to students** when you are ready. Until then students see nothing.

**Replace** uploads a new file and starts the marks and notes over. The bin removes the
sheet after asking.

## The file

The first row is the heading: `#`, `Task`, `Expected answer`, `Scored`.

```csv
#,Task,Expected answer,Scored
1,Create gallery folder,gallery/ at the assignment root,Yes
2,Print README.txt,cat README.txt,No
```

| Column | What goes in it |
|---|---|
| `#` | The task's number. A row with a number is a task. |
| `Task` | What the student was asked to do. |
| `Expected answer` | What a right answer looks like. |
| `Scored` | Yes or No: whether the row counts. A "No" row is shown with its expected answer but is not marked. |

A row with no number is a note for everyone, shown under the answers.

A file with a different first row is refused, and the message repeats the layout.

## A sheet that is already graded

If the work was graded in a spreadsheet, the grading can come in with the file: add one
column per student after `Scored`.

```csv
#,Task,Expected answer,Scored,Chandni,Dalika
1,Create gallery folder,gallery/ at the assignment root,Yes,Named gallary,OK
2,Print README.txt,cat README.txt,No,Seen in history,Seen in history
,Score (out of 20),Scored rows only,,19,20
```

- Under a student, `OK` becomes Correct and any other text becomes Incorrect, with the text
  kept as the note. Text that starts with `Half:` becomes Half, and the rest of it is the
  note: `Half: named gallary`. An empty cell, or a row with Scored "No", is Not scored.
- A row with no number but with student cells is an extra line for each student, named by
  its `Task` cell: Score, Errors, Grade, Notes. Each student sees their own.
- A column heading is matched to a student of the assignment's cohort by full name, first
  name or email. A name, full or first, only works when exactly one student in the cohort
  has it. Two
  columns that match the same student, such as a name and that student's email, match no
  one. A column that matches no one is kept, and the box names it so the heading can be
  fixed.

## For students

Once the sheet is shown, every student of the cohort gets an **Answers** button on their
assignment list and a **View answers** button on the assignment page. They see the tasks,
the expected answers, their own marks and notes, and a count of correct, half and incorrect
once something is marked. They never see another student's marks.

## How it is stored

`CS17 Assignment` has two fields: `show_answers` (the switch) and `answer_sheet` (the parsed
file as JSON: the tasks, one entry per student with a note and a mark per task, and the
closing note). The code is in `cs17_portal/answer_sheet.py`; the dashboard side is
`components/faculty/AnswerSheetCard.vue` and `components/answers/`.

The uploaded file is not kept. It is deleted once it has been read, and a file that was
refused is removed as well, so keep your own copy.

The whole sheet is one value. Saving a mark or a note locks the assignment's row while the
sheet is read and written back, so two saves close together wait for each other and
neither is lost.
