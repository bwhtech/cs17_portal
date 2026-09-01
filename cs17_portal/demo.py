"""Demo data for a development site.

Not shipped to any real site — this exists so the portal can be run and looked at
without hand-entering a cohort, a term of assignments and a class of students.

Re-runnable. Everything it creates is tagged with the `@cs17.test` user domain or
one of the two cohort codes below, and it clears exactly that set before seeding.
Nothing else on the site is touched.

    bench --site <site> execute cs17_portal.demo.run
"""

import struct
import zlib

import frappe
from frappe.utils import add_days, add_to_date, now_datetime

DOMAIN = "@cs17.test"
PASSWORD = "Cs17-Demo-Pass-123"
COHORT_NOW = "C7"
COHORT_PAST = "C6"


# --------------------------------------------------------------------------- files


def png_bytes(width: int, height: int, rgb: tuple[int, int, int]) -> bytes:
	"""A solid-colour PNG, so an image submission has something real to preview."""

	def chunk(tag: bytes, data: bytes) -> bytes:
		return (
			struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
		)

	raw = b"".join(b"\x00" + bytes(rgb) * width for _ in range(height))
	return (
		b"\x89PNG\r\n\x1a\n"
		+ chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
		+ chunk(b"IDAT", zlib.compress(raw, 9))
		+ chunk(b"IEND", b"")
	)


def pdf_bytes(line: str) -> bytes:
	"""A one-page PDF with a single line of text — enough for the PDF preview."""
	objects = [
		b"<< /Type /Catalog /Pages 2 0 R >>",
		b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
		+ b"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
		None,  # filled in below, needs its own length
		b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
	]
	stream = f"BT /F1 18 Tf 72 740 Td ({line}) Tj ET".encode()
	objects[3] = b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream"

	out = bytearray(b"%PDF-1.4\n")
	offsets = []
	for index, body in enumerate(objects, start=1):
		offsets.append(len(out))
		out += str(index).encode() + b" 0 obj\n" + body + b"\nendobj\n"

	xref_at = len(out)
	out += b"xref\n0 " + str(len(objects) + 1).encode() + b"\n0000000000 65535 f \n"
	for offset in offsets:
		out += f"{offset:010d} 00000 n \n".encode()
	out += (
		b"trailer\n<< /Size "
		+ str(len(objects) + 1).encode()
		+ b" /Root 1 0 R >>\nstartxref\n"
		+ str(xref_at).encode()
		+ b"\n%%EOF\n"
	)
	return bytes(out)


def attach(doctype: str, name: str, field: str, filename: str, content: bytes) -> str:
	import base64

	file_doc = frappe.get_doc(
		{
			"doctype": "File",
			"file_name": filename,
			"is_private": 1,
			"content": base64.b64encode(content).decode(),
			"decode": True,
			"attached_to_doctype": doctype,
			"attached_to_name": name,
			"attached_to_field": field,
		}
	).insert(ignore_permissions=True)
	return file_doc.file_url


# --------------------------------------------------------------------------- reset


def wipe():
	"""Drop anything a previous run of this script created."""
	# Seeding as the record's real author, so the data reads true.
	frappe.set_user("Administrator")  # nosemgrep

	users = frappe.get_all("User", filters={"name": ["like", f"%{DOMAIN}"]}, pluck="name")
	profiles = frappe.get_all("CS17 Profile", filters={"user": ["in", users or [""]]}, pluck="name")
	cohorts = [COHORT_NOW, COHORT_PAST]

	exams = frappe.get_all("CS17 Exam", filters={"cohort": ["in", cohorts]}, pluck="name")

	# Children before parents: grades hang off submissions, submissions off
	# assignments, and every one of them off a profile. Results come before the
	# marks they roll up, so deleting a marks document has no result to re-save.
	for doctype, filters in [
		("CS17 Result", {"exam": ["in", exams or [""]]}),
		("CS17 Subject Marks", {"exam": ["in", exams or [""]]}),
		("CS17 Exam", {"name": ["in", exams or [""]]}),
		("CS17 Assignment Grade", {"assignment": ["in", assignments_in(cohorts) or [""]]}),
		("CS17 Assignment Submission", {"student": ["in", profiles or [""]]}),
		("CS17 Project", {"student": ["in", profiles or [""]]}),
		("CS17 Assignment", {"cohort": ["in", cohorts]}),
		("CS17 Announcement", {"cohort": ["in", [*cohorts, None]]}),
		("CS17 Profile", {"name": ["in", profiles or [""]]}),
		("User", {"name": ["in", users or [""]]}),
		("CS17 Cohort", {"name": ["in", cohorts]}),
	]:
		for name in frappe.get_all(doctype, filters=filters, pluck="name"):
			frappe.delete_doc(doctype, name, force=True, ignore_permissions=True, delete_permanently=True)
	# `bench execute` has no request to commit for it.
	frappe.db.commit()  # nosemgrep


def assignments_in(cohorts: list[str]) -> list[str]:
	return frappe.get_all("CS17 Assignment", filters={"cohort": ["in", cohorts]}, pluck="name")


# --------------------------------------------------------------------------- people


def make_user(email: str, first: str, last: str, roles: list[str]) -> str:
	user = frappe.get_doc(
		{
			"doctype": "User",
			"email": email,
			"first_name": first,
			"last_name": last,
			"new_password": PASSWORD,
			"send_welcome_email": 0,
			"enabled": 1,
			"roles": [{"role": role} for role in roles],
		}
	).insert(ignore_permissions=True)
	return user.name


def make_profile(email: str, first: str, last: str, kind: str, cohort: str | None) -> str:
	profile = frappe.get_doc(
		{
			"doctype": "CS17 Profile",
			"profile_type": kind,
			"first_name": first,
			"last_name": last,
			"user": email,
			"cohort": cohort,
		}
	).insert(ignore_permissions=True)
	return profile.name


# --------------------------------------------------------------------------- exams


def ensure(doctype: str, key: dict, **values) -> str:
	"""Get-or-create a shared master.

	Quarters, subjects, patterns and grading scales are not scoped to a cohort, so
	`wipe` leaves them alone and this reuses whatever is already there rather than
	overwriting a real record that happens to share a name.
	"""
	existing = frappe.db.exists(doctype, key)
	if existing:
		return existing
	return frappe.get_doc({"doctype": doctype, **key, **values}).insert(ignore_permissions=True).name


def grade_bands(bands: list[tuple[str, float, float]]) -> list[dict]:
	"""Grade bands from `(grade, min, max)` triples. Ranges may not overlap, so a
	band ends just short of where the next one starts."""
	return [{"grade": grade, "min_percent": low, "max_percent": high} for grade, low, high in bands]


def split_marks(exam: str, student: str, subject: str, marks: tuple[float, float]) -> str:
	"""Marks for a subject split by a pattern: theory first, then practical."""
	theory, practical = marks
	return subject_marks(
		exam,
		student,
		subject,
		[
			{"component": "Theory", "marks_obtained": theory},
			{"component": "Practical", "marks_obtained": practical},
		],
	)


def total_marks(exam: str, student: str, subject: str, marks: float) -> str:
	"""Marks for a subject with no pattern, scored as one total."""
	return subject_marks(exam, student, subject, [{"component": "Total", "marks_obtained": marks}])


def subject_marks(exam: str, student: str, subject: str, components: list[dict]) -> str:
	doc = frappe.get_doc(
		{
			"doctype": "CS17 Subject Marks",
			"exam": exam,
			"student": student,
			"subject": subject,
			"components": components,
		}
	).insert(ignore_permissions=True)
	return doc.name


def result(exam: str, student: str, published_on: str | None = None, remarks: str | None = None) -> str:
	"""One student's result, published when a timestamp is given.

	Every total on it is pulled from the subject marks already entered, so this
	types nothing but the two fields a human would: what to say, and when to release.
	"""
	doc = frappe.get_doc(
		{
			"doctype": "CS17 Result",
			"exam": exam,
			"student": student,
			"remarks": remarks,
			"is_published": 1 if published_on else 0,
			"published_on": published_on,
		}
	).insert(ignore_permissions=True)
	return doc.name


# --------------------------------------------------------------------------- seed


def run():
	# Publishing an announcement emails the cohort. On a dev site there is no
	# outgoing account, so `sendmail` raises, the controller logs the error, and
	# the logging rolls the open transaction back — taking the seed with it.
	frappe.flags.mute_emails = True

	wipe()
	# Seeding as the record's real author, so the data reads true.
	frappe.set_user("Administrator")  # nosemgrep
	now = now_datetime()

	for code, start in [(COHORT_PAST, "2025-01-13"), (COHORT_NOW, "2026-01-12")]:
		frappe.get_doc({"doctype": "CS17 Cohort", "cohort_code": code, "start_date": start}).insert(
			ignore_permissions=True
		)

	# Faculty. Both sit in the current cohort: `list_cohort_submissions` and the
	# assignment permission check are both gated on the faculty's own cohort.
	faculty = {}
	for first, last in [("Priya", "Raman"), ("Arjun", "Mehta")]:
		email = f"{first.lower()}{DOMAIN}"
		make_user(email, first, last, ["System Manager"])
		faculty[first] = {
			"email": email,
			"profile": make_profile(email, first, last, "Faculty", COHORT_NOW),
		}

	students = {}
	for first, last in [
		("Zoya", "Khan"),
		("Kabir", "Nair"),
		("Meera", "Iyer"),
		("Rohan", "Das"),
		("Ananya", "Bose"),
		("Vikram", "Rao"),
	]:
		email = f"{first.lower()}{DOMAIN}"
		make_user(email, first, last, ["CS17 Student"])
		students[first] = {
			"email": email,
			"profile": make_profile(email, first, last, "Student", COHORT_NOW),
		}

	# `bench execute` has no request to commit for it.
	frappe.db.commit()  # nosemgrep

	# Assignments are authored as faculty: `before_insert` rejects anyone else.
	# Seeding as the record's real author, so the data reads true.
	frappe.set_user(faculty["Priya"]["email"])  # nosemgrep
	assignments = {}

	def assignment(key: str, **values):
		doc = frappe.get_doc({"doctype": "CS17 Assignment", **values})
		doc.naming_series = (
			"GRADED-.{cohort}.-.###"
			if values["assignment_type"] == "Graded"
			else "NOT-GRADED-.{cohort}.-.###"
		)
		doc.insert()
		assignments[key] = doc.name
		return doc.name

	assignment(
		"maze",
		title="Scratch: build a maze game",
		cohort=COHORT_NOW,
		submission_type="Scratch",
		assignment_type="Graded",
		remarks="Marks",
		max_marks=20,
		due_date=add_days(now, 6),
		is_published=1,
		description=(
			"## Brief\n\n"
			"Build a maze in Scratch where the sprite **cannot** walk through walls.\n\n"
			"1. Draw the maze on the backdrop\n"
			"2. Add collision detection with the wall colour\n"
			"3. Add a goal square that ends the game\n\n"
			"> Save your project, then hit **Submit** from the editor.\n\n"
			"The [handbook](/student-handbook) has the marking rubric."
		),
	)
	assignment(
		"worksheet",
		title="Algorithms worksheet 3",
		cohort=COHORT_NOW,
		submission_type="PDF",
		assignment_type="Graded",
		remarks="Grade",
		max_marks=0,
		due_date=add_days(now, 2),
		is_published=1,
		description=(
			"Work through questions 1-8 on sorting and searching.\n\n"
			"Show your working — an answer with no reasoning gets no marks. "
			"Scan or export to a single PDF before submitting."
		),
	)
	assignment(
		"quiz",
		title="Binary numbers quiz",
		cohort=COHORT_NOW,
		submission_type="URL",
		assignment_type="Not Graded",
		due_date=add_days(now, -3),
		is_published=1,
		description="Take the quiz and paste the link to your results page.",
	)
	assignment(
		"poster",
		title="Poster: how the internet works",
		cohort=COHORT_NOW,
		submission_type="Image",
		assignment_type="Graded",
		remarks="Marks",
		max_marks=10,
		due_date=add_days(now, -10),
		is_published=1,
		description=(
			"One A3 poster explaining a packet's journey from your laptop to a "
			"server and back. Hand-drawn is fine — photograph it and upload the image."
		),
	)
	assignment(
		"portfolio",
		title="Portfolio site",
		cohort=COHORT_NOW,
		submission_type="ZIP",
		assignment_type="Graded",
		remarks="Grade",
		max_marks=0,
		due_date=add_days(now, 14),
		is_published=0,
		publish_on=add_to_date(now, hours=18),
		description="A single-page site about you. Zip the folder and upload it.",
	)
	assignment(
		"reading",
		title="Reading response: The Soul of a New Machine",
		cohort=COHORT_NOW,
		submission_type="Any",
		assignment_type="Not Graded",
		due_date=add_days(now, 20),
		is_published=0,
		description="Two paragraphs on chapters 1-3. Draft, not published yet.",
	)
	assignment(
		"legacy",
		title="Recursion problem set",
		cohort=COHORT_PAST,
		submission_type="PDF",
		assignment_type="Graded",
		remarks="Grade",
		max_marks=0,
		due_date=add_days(now, -120),
		is_published=1,
		description="Last cohort's problem set, kept so the cohort filter has two sides.",
	)

	# `bench execute` has no request to commit for it.
	frappe.db.commit()  # nosemgrep

	# Submissions and grades go in as Administrator: the submission's own
	# deadline check only fires for the student who owns it, and these are
	# deliberately backdated.
	# Seeding as the record's real author, so the data reads true.
	frappe.set_user("Administrator")  # nosemgrep
	poster_png = png_bytes(480, 300, (58, 92, 160))
	worksheet_pdf = pdf_bytes("Algorithms worksheet 3 - answers")

	def submit(student: str, key: str, when, *, file=None, filename=None, url=None, project=None) -> str:
		doc = frappe.get_doc(
			{
				"doctype": "CS17 Assignment Submission",
				"student": students[student]["profile"],
				"assignment": assignments[key],
				"submitted_at": when,
				"submission_url": url,
				"project": project,
			}
		).insert(ignore_permissions=True)
		if file:
			doc.db_set(
				"submission_document",
				attach("CS17 Assignment Submission", doc.name, "submission_document", filename, file),
			)
		return doc.name

	# The poster is closed and marked: everyone submitted, most are graded.
	poster_subs = {}
	for index, student in enumerate(["Zoya", "Kabir", "Meera", "Rohan", "Ananya"]):
		poster_subs[student] = submit(
			student,
			"poster",
			add_to_date(now, days=-11, hours=index),
			file=poster_png,
			filename=f"poster-{student.lower()}.png",
		)

	# The worksheet is still open: three in, three still to come.
	worksheet_subs = {}
	for index, student in enumerate(["Zoya", "Meera", "Vikram"]):
		worksheet_subs[student] = submit(
			student,
			"worksheet",
			add_to_date(now, days=-1, hours=index),
			file=worksheet_pdf,
			filename=f"worksheet3-{student.lower()}.pdf",
		)

	# The quiz closed with two links in and no grading (it isn't graded).
	for index, student in enumerate(["Zoya", "Kabir"]):
		submit(
			student,
			"quiz",
			add_to_date(now, days=-4, hours=index),
			url="https://quiz.cs17.org/binary/results/8f31c2",
		)

	# `bench execute` has no request to commit for it.
	frappe.db.commit()  # nosemgrep

	# Scratch projects. Zoya has one submitted to the maze assignment and one
	# still being worked on; the editor opens an empty stage for both.
	# Seeding as the record's real author, so the data reads true.
	frappe.set_user(students["Zoya"]["email"])  # nosemgrep
	maze_project = frappe.get_doc(
		{
			"doctype": "CS17 Project",
			"project_title": "Maze game",
			"student": students["Zoya"]["profile"],
			"last_saved_at": add_to_date(now, hours=-5),
		}
	).insert()
	frappe.get_doc(
		{
			"doctype": "CS17 Project",
			"project_title": "Dodge the asteroids",
			"student": students["Zoya"]["profile"],
			"last_saved_at": add_to_date(now, days=-2),
		}
	).insert()
	# `bench execute` has no request to commit for it.
	frappe.db.commit()  # nosemgrep

	# Seeding as the record's real author, so the data reads true.
	frappe.set_user("Administrator")  # nosemgrep
	submit("Zoya", "maze", add_to_date(now, hours=-4), project=maze_project.name)
	for student in ["Kabir", "Meera"]:
		project = frappe.get_doc(
			{
				"doctype": "CS17 Project",
				"project_title": f"{student}'s maze",
				"student": students[student]["profile"],
				"last_saved_at": add_to_date(now, days=-1),
			}
		).insert(ignore_permissions=True)
		submit(student, "maze", add_to_date(now, days=-1), project=project.name)
	# `bench execute` has no request to commit for it.
	frappe.db.commit()  # nosemgrep

	# Grading, as the faculty member who did it.
	# Seeding as the record's real author, so the data reads true.
	frappe.set_user(faculty["Priya"]["email"])  # nosemgrep
	poster_marks = {"Zoya": 9, "Kabir": 7, "Meera": 8, "Rohan": 6}
	poster_notes = {
		"Zoya": "Clear packet path and a genuinely good DNS aside. Full marks bar the missing TTL.",
		"Kabir": "Solid, but the router and the switch are doing the same job in your diagram.",
		"Meera": "Lovely drawing. Say what happens when a packet is dropped.",
		"Rohan": "The idea is right; the labels are hard to read. Worth redrawing for your portfolio.",
	}
	for student, marks in poster_marks.items():
		frappe.get_doc(
			{
				"doctype": "CS17 Assignment Grade",
				"assignment": assignments["poster"],
				"submission": poster_subs[student],
				"marks_obtained": marks,
				"evaluation_type": "Marks",
				"remarks": poster_notes[student],
				"is_published": 1,
				"published_on": add_to_date(now, days=-6),
			}
		).insert()

	# Ananya's poster is marked but not published yet — the faculty grading
	# workspace should show one still in flight.
	frappe.get_doc(
		{
			"doctype": "CS17 Assignment Grade",
			"assignment": assignments["poster"],
			"submission": poster_subs["Ananya"],
			"marks_obtained": 8,
			"evaluation_type": "Marks",
			"remarks": "Good, holding until the rest are marked.",
			"is_published": 0,
		}
	).insert()

	# One worksheet graded on the letter scale, the other two waiting.
	frappe.get_doc(
		{
			"doctype": "CS17 Assignment Grade",
			"assignment": assignments["worksheet"],
			"submission": worksheet_subs["Meera"],
			"grade": "A",
			"evaluation_type": "Grade",
			"remarks": "Every step shown. Question 6 is the neatest solution I've seen.",
			"is_published": 1,
			"published_on": add_to_date(now, hours=-3),
		}
	).insert()
	# `bench execute` has no request to commit for it.
	frappe.db.commit()  # nosemgrep

	# Assign two submissions to Arjun so the faculty dashboard's "assigned to
	# you" list and the assignee chips have something in them.
	from frappe.desk.form.assign_to import add as assign_to

	for submission in [worksheet_subs["Zoya"], worksheet_subs["Vikram"]]:
		assign_to(
			{
				"assign_to": [faculty["Arjun"]["email"]],
				"doctype": "CS17 Assignment Submission",
				"name": submission,
				"description": "Please mark this one.",
			}
		)
	# `bench execute` has no request to commit for it.
	frappe.db.commit()  # nosemgrep

	# Exams and results, so the student results pages and the report card print
	# format have something to show.
	# Seeding as the record's real author, so the data reads true.
	frappe.set_user("Administrator")  # nosemgrep

	quarters = {
		"Q2": ensure("CS17 Quarter", {"quarter_name": "Q2"}, description="Second term."),
		"Q3": ensure("CS17 Quarter", {"quarter_name": "Q3"}, description="Third term."),
	}

	subjects = {
		"python": ensure(
			"CS17 Subject", {"subject_code": "PY101"}, subject_name="Python Basics", is_active=1
		),
		"scratch": ensure(
			"CS17 Subject", {"subject_code": "SCR101"}, subject_name="Scratch & Games", is_active=1
		),
		"maths": ensure(
			"CS17 Subject",
			{"subject_code": "MATH101"},
			subject_name="Computational Maths",
			is_active=1,
		),
	}

	pattern = ensure(
		"CS17 Subject Pattern",
		{"pattern_name": "Theory 40 / Practical 60"},
		components=[
			{"component": "Theory", "weightage": 40},
			{"component": "Practical", "weightage": 60},
		],
	)

	# Two scales, because a Scratch project and a written paper are not marked on
	# the same curve — the per-subject scale is the point of the model.
	standard_scale = ensure(
		"CS17 Grading Scale",
		{"scale_name": "CS17 Standard"},
		passing_percentage=40,
		is_default=1,
		bands=grade_bands(
			[("E", 0, 39.99), ("D", 40, 54.99), ("C", 55, 69.99), ("B", 70, 84.99), ("A", 85, 100)]
		),
	)
	project_scale = ensure(
		"CS17 Grading Scale",
		{"scale_name": "CS17 Project"},
		passing_percentage=35,
		bands=grade_bands(
			[("E", 0, 34.99), ("D", 35, 49.99), ("C", 50, 64.99), ("B", 65, 79.99), ("A", 80, 100)]
		),
	)

	# The result reports the quarter's assignments beside the exam, so the two
	# published ones are filed under the quarter the current exam sits in.
	for key in ("poster", "worksheet"):
		frappe.db.set_value("CS17 Assignment", assignments[key], "quarter", quarters["Q3"])

	q3_exam = frappe.get_doc(
		{
			"doctype": "CS17 Exam",
			"exam_name": "Quarter 3 Assessment",
			"cohort": COHORT_NOW,
			"quarter": quarters["Q3"],
			"grading_scale": standard_scale,
			"start_date": add_days(now, -12),
			"end_date": add_days(now, -9),
			"subjects": [
				{
					"subject": subjects["python"],
					"max_marks": 100,
					"subject_pattern": pattern,
					"grading_scale": standard_scale,
					"examiner": faculty["Priya"]["profile"],
				},
				{
					"subject": subjects["scratch"],
					"max_marks": 50,
					"subject_pattern": pattern,
					"grading_scale": project_scale,
					"examiner": faculty["Arjun"]["profile"],
				},
				# No pattern: a subject marked as one total, alongside two split ones.
				{
					"subject": subjects["maths"],
					"max_marks": 50,
					"grading_scale": standard_scale,
					"examiner": faculty["Priya"]["profile"],
				},
			],
		}
	).insert(ignore_permissions=True)

	q2_exam = frappe.get_doc(
		{
			"doctype": "CS17 Exam",
			"exam_name": "Quarter 2 Assessment",
			"cohort": COHORT_NOW,
			"quarter": quarters["Q2"],
			"grading_scale": standard_scale,
			"start_date": add_days(now, -75),
			"end_date": add_days(now, -73),
			"subjects": [
				{"subject": subjects["python"], "max_marks": 50, "grading_scale": standard_scale},
				{"subject": subjects["maths"], "max_marks": 50, "grading_scale": standard_scale},
			],
		}
	).insert(ignore_permissions=True)

	# Marks are the only figure typed anywhere; every grade, percentage and
	# total below is derived from these on save.
	q3_marks = {
		# student:  Python (Theory /40, Practical /60), Scratch (/20, /30), Maths (/50)
		"Zoya": [(34, 52), (17, 26), 44],
		"Meera": [(28, 44), (13, 20), 32],
		# Rohan fails Python, so a result reads `Fail` even though he passes the rest.
		"Rohan": [(15, 22), (12, 19), 24],
		"Kabir": [(30, 45), (15, 24), 38],
	}
	for student, (python_marks, scratch_marks, maths_marks) in q3_marks.items():
		profile = students[student]["profile"]
		split_marks(q3_exam.name, profile, subjects["python"], python_marks)
		split_marks(q3_exam.name, profile, subjects["scratch"], scratch_marks)
		total_marks(q3_exam.name, profile, subjects["maths"], maths_marks)

	for student, (python_marks, maths_marks) in {
		"Zoya": (41, 45),
		"Meera": (33, 36),
		"Rohan": (26, 29),
	}.items():
		profile = students[student]["profile"]
		total_marks(q2_exam.name, profile, subjects["python"], python_marks)
		total_marks(q2_exam.name, profile, subjects["maths"], maths_marks)

	# Published for three students; Kabir's is entered but held back, so the
	# permission rule has a result that must stay invisible to its own student.
	for student in ("Zoya", "Meera", "Rohan"):
		result(q2_exam.name, students[student]["profile"], published_on=add_days(now, -60))
	for student in ("Zoya", "Meera", "Rohan"):
		result(
			q3_exam.name,
			students[student]["profile"],
			published_on=add_to_date(now, hours=-4),
			remarks="Report card for the third quarter. Speak to your mentor about anything unclear.",
		)
	result(q3_exam.name, students["Kabir"]["profile"])

	# `bench execute` has no request to commit for it.
	frappe.db.commit()  # nosemgrep

	# Announcements.
	# Seeding as the record's real author, so the data reads true.
	frappe.set_user(faculty["Priya"]["email"])  # nosemgrep
	for values in [
		{
			"title": "Quarter 3 starts on Monday",
			"content": (
				"New timetable is up on the handbook. **Two** changes worth knowing:\n\n"
				"- Lab moves to Tuesday afternoons\n"
				"- Mentor sessions are now fortnightly"
			),
			"alert_variant": "info",
			"cohort": COHORT_NOW,
			"is_dismissible": 1,
			"is_published": 1,
			"published_date": add_days(now, -2),
		},
		{
			"title": "Lab closed this Friday",
			"content": "Electrical work on the whole floor. Bring your laptop to the library instead.",
			"alert_variant": "warning",
			"cohort": COHORT_NOW,
			"is_dismissible": 1,
			"is_published": 1,
			"published_date": add_days(now, -1),
		},
		{
			"title": "Consent forms are overdue",
			"content": "The trip is next month and we cannot book without them. Hand them in this week.",
			"alert_variant": "error",
			"cohort": None,
			"is_dismissible": 0,
			"is_published": 1,
			"published_date": add_days(now, -4),
		},
		{
			"title": "Demo day: save the date",
			"content": "Scheduled — students see this once `publish_on` passes.",
			"alert_variant": "info",
			"cohort": COHORT_NOW,
			"is_dismissible": 1,
			"is_published": 0,
			"publish_on": add_to_date(now, hours=20),
		},
		{
			"title": "Summer reading list",
			"content": "Draft. Not published, so only faculty can see it.",
			"alert_variant": "info",
			"cohort": COHORT_NOW,
			"is_dismissible": 1,
			"is_published": 0,
		},
	]:
		frappe.get_doc({"doctype": "CS17 Announcement", **values}).insert()

	# `bench execute` has no request to commit for it.
	frappe.db.commit()  # nosemgrep
	# Seeding as the record's real author, so the data reads true.
	frappe.set_user("Administrator")  # nosemgrep

	print("\nSeeded cs17.localhost")
	print(f"  cohorts     {COHORT_NOW} (current), {COHORT_PAST}")
	print(f"  faculty     {faculty['Priya']['email']}, {faculty['Arjun']['email']}")
	print(f"  students    {', '.join(s['email'] for s in students.values())}")
	print(f"  password    {PASSWORD}")
