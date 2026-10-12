import frappe
from frappe import _
from frappe.utils import cint, cstr
from frappe.utils.csvutils import read_csv_content
from frappe.utils.xlsxutils import read_xlsx_file_from_attached_file

from cs17_portal.api import get_student_assignment, require_current_student, require_faculty_for_assignment

ASSIGNMENT = "CS17 Assignment"
STATUSES = ("Correct", "Half", "Incorrect", "")
HALF_PREFIX = "half:"


@frappe.whitelist(methods=["GET"])
def get_answer_sheet(assignment: str) -> dict:
	require_faculty_for_assignment(assignment)
	return read_answer_sheet(assignment)


@frappe.whitelist(methods=["POST"])
def upload_answer_sheet(assignment: str, file_url: str) -> dict:
	require_faculty_for_assignment(assignment)
	file = frappe.get_doc(
		"File",
		{"file_url": file_url, "owner": frappe.session.user, "attached_to_name": ("is", "not set")},
	)
	cohort = frappe.db.get_value(ASSIGNMENT, assignment, "cohort")
	try:
		sheet = parse_answer_sheet(read_rows(file), cohort)
	except Exception:
		frappe.enqueue("frappe.delete_doc", doctype="File", name=file.name, ignore_permissions=True)
		raise
	frappe.db.set_value(ASSIGNMENT, assignment, "answer_sheet", frappe.as_json(sheet))
	frappe.delete_doc("File", file.name, ignore_permissions=True)
	return read_answer_sheet(assignment)


@frappe.whitelist(methods=["POST"])
def set_answer_status(
	assignment: str, column: str, task: int, status: str, student: str | None = None
) -> None:
	require_faculty_for_assignment(assignment)
	if status not in STATUSES:
		frappe.throw(_("Mark the answer as Correct, Half or Incorrect."))
	sheet = read_answer_sheet(assignment, for_update=True)["sheet"]
	get_student_answers(sheet, column, student)["results"][cint(task)]["status"] = status
	frappe.db.set_value(ASSIGNMENT, assignment, "answer_sheet", frappe.as_json(sheet))


@frappe.whitelist(methods=["POST"])
def set_answer_remark(
	assignment: str, column: str, task: int, remark: str, student: str | None = None
) -> None:
	require_faculty_for_assignment(assignment)
	sheet = read_answer_sheet(assignment, for_update=True)["sheet"]
	get_student_answers(sheet, column, student)["results"][cint(task)]["remark"] = remark.strip()
	frappe.db.set_value(ASSIGNMENT, assignment, "answer_sheet", frappe.as_json(sheet))


def get_student_answers(sheet: dict, column: str, student: str | None) -> dict:
	answers = next(
		(
			row
			for row in sheet["students"]
			if (row["student"] == student if student else row["column"] == column)
		),
		None,
	)
	if not answers:
		answers = {"column": column, "student": student, "results": unmarked_results(sheet), "summary": []}
		sheet["students"].append(answers)
	return answers


@frappe.whitelist(methods=["POST"])
def show_answers(assignment: str, show: bool) -> None:
	require_faculty_for_assignment(assignment)
	frappe.db.set_value(ASSIGNMENT, assignment, "show_answers", cint(show))


@frappe.whitelist(methods=["POST"])
def remove_answer_sheet(assignment: str) -> None:
	require_faculty_for_assignment(assignment)
	frappe.db.set_value(ASSIGNMENT, assignment, {"answer_sheet": None, "show_answers": 0})


@frappe.whitelist(methods=["GET"])
def get_my_answers(assignment: str) -> dict | None:
	get_student_assignment(assignment)
	return get_answers_for(assignment, require_current_student())


def get_answers_for(assignment: str, student: str) -> dict | None:
	current = read_answer_sheet(assignment)
	if not (current["sheet"] and current["show_answers"]):
		return None
	sheet = current["sheet"]
	mine = next((row for row in sheet["students"] if row["student"] == student), None)
	results = mine["results"] if mine else unmarked_results(sheet)
	return {
		"answers": [{**task, **result} for task, result in zip(sheet["tasks"], results, strict=True)],
		"summary": mine["summary"] if mine else [],
		"note": sheet["note"],
	}


def unmarked_results(sheet: dict) -> list:
	return [{"remark": "", "status": ""} for _task in sheet["tasks"]]


def read_answer_sheet(assignment: str, for_update: bool = False) -> dict:
	sheet, show = frappe.db.get_value(
		ASSIGNMENT, assignment, ["answer_sheet", "show_answers"], for_update=for_update
	)
	return {"sheet": frappe.parse_json(sheet) if sheet else None, "show_answers": bool(show)}


def read_rows(file) -> list:
	name = file.file_name.lower()
	if name.endswith(".xlsx"):
		return read_xlsx_file_from_attached_file(fcontent=file.get_content())
	if name.endswith(".csv"):
		return read_csv_content(file.get_content())
	frappe.throw(_("Upload the answer sheet as a CSV or XLSX file."))


def parse_answer_sheet(rows: list, cohort: str | None) -> dict:
	"""The first row is `#, Task, Expected answer, Scored`, then an optional column per student.

	A row with a number is a task. A row without one that has student cells is a
	summary line (score, grade, notes), named by its Task cell. Anything else is a note.
	"""
	rows = [[cstr(cell).strip() for cell in row] for row in rows if any(row)]
	if not rows or len(rows[0]) < 4 or rows[0][1].lower() != "task":
		frappe.throw(
			_("The first row must be: #, Task, Expected answer, Scored. A column per student can follow.")
		)
	header, *body = rows
	matched = match_students(header[4:], cohort)
	students = [
		{"column": column, "student": matched[column], "results": [], "summary": []} for column in header[4:]
	]
	tasks, notes = [], []
	for row in body:
		number, task, expected, scored, *cells = row + [""] * (len(header) - len(row))
		if number:
			is_scored = scored.lower() != "no"
			tasks.append({"number": number, "task": task, "expected": expected, "scored": is_scored})
			for student, cell in zip(students, cells, strict=False):
				status = default_status(cell, is_scored)
				remark = cell[len(HALF_PREFIX) :].strip() if status == "Half" else cell
				student["results"].append({"remark": remark, "status": status})
		elif any(cells):
			for student, cell in zip(students, cells, strict=False):
				student["summary"].append({"label": task, "value": cell})
		else:
			notes.append(task or expected)
	return {"tasks": tasks, "students": students, "note": "\n".join(notes)}


def default_status(remark: str, is_scored: bool) -> str:
	if not (is_scored and remark):
		return ""
	if remark.lower() == "ok":
		return "Correct"
	return "Half" if remark.lower().startswith(HALF_PREFIX) else "Incorrect"


def match_students(columns: list, cohort: str | None) -> dict:
	profiles = frappe.get_all(
		"CS17 Profile",
		filters={"profile_type": "Student", "cohort": cohort},
		fields=["name", "first_name", "full_name", "user"],
	)
	names_by_key: dict[str, set] = {}
	for profile in profiles:
		for key in (profile.full_name, profile.first_name, profile.user):
			if key:
				names_by_key.setdefault(" ".join(key.lower().split()), set()).add(profile.name)
	matched = {}
	for column in columns:
		names = names_by_key.get(" ".join(column.lower().split()), set())
		matched[column] = next(iter(names)) if len(names) == 1 else None
	students = [matched[column] for column in columns]
	return {column: student if students.count(student) == 1 else None for column, student in matched.items()}
