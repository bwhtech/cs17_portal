import base64

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import flt


@frappe.whitelist()
def get_user_profile() -> dict | None:
	return frappe.db.get_value(
		"CS17 Profile",
		{"user": frappe.session.user},
		["name", "full_name", "profile_type", "cohort", "profile_picture"],
		as_dict=True,
	)


def get_current_profile_name(profile_type: str) -> str | None:
	return frappe.db.get_value(
		"CS17 Profile",
		{"user": frappe.session.user, "profile_type": profile_type},
		"name",
	)


def validate_membership(profile_type: str) -> str:
	name = get_current_profile_name(profile_type)
	if not name:
		frappe.throw(
			_("No {0} profile found for current user").format(profile_type),
			frappe.PermissionError,
		)
	return name


def require_current_student() -> str:
	return validate_membership("Student")


def require_owned_project(project: str) -> "frappe.model.document.Document":
	student = require_current_student()
	project_doc = frappe.get_doc("CS17 Project", project)
	if project_doc.student != student:
		frappe.throw(_("Not permitted"), frappe.PermissionError)
	return project_doc


def get_current_faculty() -> "frappe._dict":
	faculty = frappe.db.get_value(
		"CS17 Profile",
		{"user": frappe.session.user, "profile_type": "Faculty"},
		["name", "cohort"],
		as_dict=True,
	)
	if not faculty:
		frappe.throw(_("Not permitted"), frappe.PermissionError)
	return faculty


def require_faculty_for_assignment(assignment: str) -> None:
	faculty = get_current_faculty()
	assignment_cohort = frappe.db.get_value("CS17 Assignment", assignment, "cohort")
	if not faculty.cohort or faculty.cohort != assignment_cohort:
		frappe.throw(_("Not permitted"), frappe.PermissionError)


def get_cohort_submissions(cohort: str, limit: int | None = None) -> list:
	return frappe.get_all(
		"CS17 Assignment Submission",
		filters=[["assignment.cohort", "=", cohort]],
		fields=["name", "student", "full_name", "assignment", "assignment_title", "submitted_at"],
		order_by="submitted_at desc",
		limit=limit,
		ignore_permissions=True,
	)


def attach_private_file(
	attached_to_doctype: str,
	attached_to_name: str,
	attached_to_field: str,
	filename: str,
	content: str | bytes,
	decode: bool = False,
) -> "frappe.model.document.Document":
	return frappe.get_doc(
		{
			"doctype": "File",
			"file_name": filename,
			"is_private": 1,
			"content": content,
			"decode": decode,
			"attached_to_doctype": attached_to_doctype,
			"attached_to_name": attached_to_name,
			"attached_to_field": attached_to_field,
		}
	).insert()


def replace_project_file(
	project_doc: "frappe.model.document.Document", field: str, filename: str, content: str
) -> None:
	previous_files = frappe.get_all(
		"File",
		filters={
			"attached_to_doctype": "CS17 Project",
			"attached_to_name": project_doc.name,
			"attached_to_field": field,
		},
		pluck="name",
	)
	for file_name in previous_files:
		frappe.delete_doc("File", file_name, ignore_permissions=True)

	new_file = attach_private_file("CS17 Project", project_doc.name, field, filename, content, decode=True)
	project_doc.set(field, new_file.file_url)


@frappe.whitelist()
def create_project(project_title: str) -> dict:
	student = require_current_student()
	project_doc = frappe.new_doc("CS17 Project")
	project_doc.project_title = project_title
	project_doc.student = student
	project_doc.insert()
	return {"name": project_doc.name, "project_title": project_doc.project_title}


@frappe.whitelist()
def list_my_projects() -> list:
	student = require_current_student()
	return frappe.get_all(
		"CS17 Project",
		filters={"student": student},
		fields=["name", "project_title", "thumbnail", "last_saved_at"],
		order_by="creation desc",
	)


@frappe.whitelist()
@rate_limit(key="project", limit=120, seconds=60, methods=["POST"], ip_based=False)
def save_project(
	project: str,
	filename: str,
	content: str,
	thumbnail_filename: str | None = None,
	thumbnail_content: str | None = None,
) -> dict:
	project_doc = require_owned_project(project)

	replace_project_file(project_doc, "sb3_file", filename, content)
	if thumbnail_filename and thumbnail_content:
		replace_project_file(project_doc, "thumbnail", thumbnail_filename, thumbnail_content)

	project_doc.last_saved_at = frappe.utils.now_datetime()
	project_doc.save()
	return {
		"name": project_doc.name,
		"sb3_file": project_doc.sb3_file,
		"thumbnail": project_doc.thumbnail,
		"last_saved_at": project_doc.last_saved_at,
	}


@frappe.whitelist()
@rate_limit(key="project", limit=30, seconds=60, methods=["POST"], ip_based=False)
def submit_scratch_project(assignment: str, project: str) -> dict:
	project_doc = require_owned_project(project)
	if not project_doc.sb3_file:
		frappe.throw(_("Save the project before submitting it."))

	source_file = frappe.get_doc("File", {"file_url": project_doc.sb3_file, "attached_to_name": project})

	submission = frappe.new_doc("CS17 Assignment Submission")
	submission.student = project_doc.student
	submission.assignment = assignment
	submission.project = project
	submission.submitted_at = frappe.utils.now_datetime()
	submission.insert(ignore_permissions=True)

	snapshot = attach_private_file(
		"CS17 Assignment Submission",
		submission.name,
		"submission_document",
		f"{submission.name}.sb3",
		source_file.get_content(),
	)
	submission.submission_document = snapshot.file_url
	submission.flags.ignore_permissions = True
	submission.submit()
	return {"name": submission.name, "submission_document": submission.submission_document}


@frappe.whitelist()
def get_recent_submissions(limit: int = 5) -> list:
	faculty = get_current_faculty()
	if not faculty.cohort:
		return []
	return get_cohort_submissions(faculty.cohort, limit=limit)


@frappe.whitelist()
def get_submission_project(submission: str) -> dict:
	submission_doc = frappe.db.get_value(
		"CS17 Assignment Submission",
		submission,
		["assignment", "submission_document"],
		as_dict=True,
	)
	if not submission_doc:
		frappe.throw(_("Submission not found"))

	require_faculty_for_assignment(submission_doc.assignment)

	if not submission_doc.submission_document:
		frappe.throw(_("This submission has no project file."))

	snapshot_file = frappe.get_doc(
		"File",
		{"file_url": submission_doc.submission_document, "attached_to_name": submission},
	)
	return {
		"filename": snapshot_file.file_name,
		"content": base64.b64encode(snapshot_file.get_content()).decode(),
	}


@frappe.whitelist()
def list_cohort_submissions() -> list:
	faculty = get_current_faculty()
	if not faculty.cohort:
		return []

	submissions = get_cohort_submissions(faculty.cohort)
	if not submissions:
		return []

	assignment_meta = {
		row.name: row
		for row in frappe.get_all(
			"CS17 Assignment",
			filters={"name": ["in", list({row.assignment for row in submissions if row.assignment})]},
			fields=["name", "submission_type", "max_marks"],
			ignore_permissions=True,
		)
	}
	grade_by_submission = {
		row.submission: row
		for row in frappe.get_all(
			"CS17 Assignment Grade",
			filters={"submission": ["in", [row.name for row in submissions]]},
			fields=["submission", "marks_obtained", "grade"],
			ignore_permissions=True,
		)
	}

	for row in submissions:
		meta = assignment_meta.get(row.assignment)
		row.submission_type = meta.submission_type if meta else None
		row.max_marks = meta.max_marks if meta else 0
		grade = grade_by_submission.get(row.name)
		row.marks_obtained = grade.marks_obtained if grade else None
		row.grade = grade.grade if grade else None
		row.graded = bool(grade)

	return submissions


@frappe.whitelist()
def get_submission_grade(submission: str) -> dict | None:
	assignment = frappe.db.get_value("CS17 Assignment Submission", submission, "assignment")
	if not assignment:
		frappe.throw(_("Submission not found"))

	require_faculty_for_assignment(assignment)
	return frappe.db.get_value(
		"CS17 Assignment Grade",
		{"submission": submission},
		["name", "marks_obtained", "grade", "remarks"],
		as_dict=True,
	)


@frappe.whitelist()
def save_grade(
	submission: str,
	marks_obtained: float | None = None,
	grade: str | None = None,
	remarks: str | None = None,
) -> dict:
	assignment = frappe.db.get_value("CS17 Assignment Submission", submission, "assignment")
	if not assignment:
		frappe.throw(_("Submission not found"))

	require_faculty_for_assignment(assignment)

	grade_name = frappe.db.get_value("CS17 Assignment Grade", {"submission": submission}, "name")
	grade_doc = (
		frappe.get_doc("CS17 Assignment Grade", grade_name)
		if grade_name
		else frappe.new_doc("CS17 Assignment Grade")
	)
	grade_doc.assignment = assignment
	grade_doc.submission = submission
	grade_doc.marks_obtained = flt(marks_obtained) if marks_obtained is not None else None
	grade_doc.grade = grade
	grade_doc.remarks = remarks
	grade_doc.is_published = 1
	grade_doc.save(ignore_permissions=True)
	return {
		"name": grade_doc.name,
		"marks_obtained": grade_doc.marks_obtained,
		"grade": grade_doc.grade,
		"remarks": grade_doc.remarks,
		"graded_by": grade_doc.graded_by,
		"is_published": grade_doc.is_published,
	}
