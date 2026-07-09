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


@frappe.whitelist()
def get_recent_submissions(faculty: str, limit: int = 5) -> list:
	profile = frappe.get_doc("CS17 Profile", faculty)
	if profile.user != frappe.session.user:
		frappe.throw(_("Not permitted"), frappe.PermissionError)
	if not profile.cohort:
		return []
	return frappe.get_list(
		"CS17 Assignment Submission",
		filters=[["assignment.cohort", "=", profile.cohort]],
		fields=["name", "student", "full_name", "assignment", "assignment_title", "submitted_at"],
		order_by="submitted_at desc",
		limit=limit,
		ignore_permissions=True,
	)


def get_current_profile_name(profile_type: str) -> str | None:
	return frappe.db.get_value(
		"CS17 Profile",
		{"user": frappe.session.user, "profile_type": profile_type},
		"name",
	)


def validate_membership(profile_type: str) -> None:
	if not get_current_profile_name(profile_type):
		frappe.throw(
			_("No {0} profile found for current user").format(profile_type),
			frappe.PermissionError,
		)


def require_current_student() -> str:
	student = get_current_profile_name("Student")
	if not student:
		frappe.throw(_("No Student profile found for current user"), frappe.PermissionError)
	return student


def require_owned_project(project: str) -> "frappe.model.document.Document":
	student = require_current_student()
	project_doc = frappe.get_doc("CS17 Project", project)
	if project_doc.student != student:
		frappe.throw(_("Not permitted"), frappe.PermissionError)
	return project_doc


def attach_private_file(
	attached_to_doctype: str,
	attached_to_name: str,
	attached_to_field: str,
	filename: str,
	content: str | bytes,
	decode: bool = False,
) -> "frappe.model.document.Document":
	# decode=True means `content` is a base64 string (the browser sends the .sb3 ArrayBuffer that way);
	# decode=False means `content` is already raw bytes (used when snapshotting an existing file).
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
	# save_project is the autosave endpoint, so drop the previous file for this field before attaching the
	# new one — otherwise every autosave leaves an orphan File row (and physical file) behind. A submitted
	# snapshot keeps its own File, and File.on_trash preserves shared content, so this never touches submissions.
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
# Keyed on the (student-owned) project rather than IP so a shared lab IP isn't throttled as one user.
@rate_limit(key="project", limit=120, seconds=60, methods=["POST"], ip_based=False)
def save_project(
	project: str,
	filename: str,
	content: str,
	thumbnail_filename: str | None = None,
	thumbnail_content: str | None = None,
) -> dict:
	"""Attach an uploaded `.sb3` (and optional thumbnail) to a project and stamp `last_saved_at`.

	`content` (and `thumbnail_content`) are the file bytes encoded as a base64 string — the React
	host base64-encodes the `.sb3` ArrayBuffer returned by the Scratch editor before sending it.
	Ownership is enforced: only the student who owns the project may save to it.
	"""
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
def submit_scratch_project(assignment: str, project: str) -> dict:
	project_doc = require_owned_project(project)
	if not project_doc.sb3_file:
		frappe.throw(_("Save the project before submitting it."))

	assignment_doc = frappe.db.get_value(
		"CS17 Assignment", assignment, ["submission_type", "is_published"], as_dict=True
	)
	if not assignment_doc or assignment_doc.submission_type != "Scratch":
		frappe.throw(_("This assignment does not accept Scratch projects."))
	if not assignment_doc.is_published:
		frappe.throw(_("This assignment is not open for submission."))

	source_file = frappe.get_doc("File", {"file_url": project_doc.sb3_file, "attached_to_name": project})

	# Ownership is already enforced by require_owned_project above; the CS17 Student role has no submit
	# permission on the submittable doctype, so the API acts as the trust boundary (same pattern as
	# submit_assignment / edit_submission).
	submission = frappe.new_doc("CS17 Assignment Submission")
	submission.student = project_doc.student
	submission.assignment = assignment
	submission.project = project
	submission.submitted_at = frappe.utils.now_datetime()
	submission.insert(ignore_permissions=True)

	# Copy the current .sb3 into a NEW file so later edits to the live project never mutate this snapshot.
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


def require_current_faculty_cohort() -> str | None:
	"""Return the current user's Faculty CS17 Profile cohort, throwing PermissionError if not a faculty.

	Faculty in this app are a CS17 Profile with profile_type Faculty (there is no Faculty role). The cohort
	may be blank (returns None) which callers treat as "no submissions".
	"""
	faculty = frappe.db.get_value(
		"CS17 Profile",
		{"user": frappe.session.user, "profile_type": "Faculty"},
		["name", "cohort"],
		as_dict=True,
	)
	if not faculty:
		frappe.throw(_("Not permitted"), frappe.PermissionError)
	return faculty.cohort


def require_faculty_for_assignment(assignment: str) -> str:
	"""Return the current user's Faculty CS17 Profile name, scoped to the assignment's cohort.

	Faculty in this app are a CS17 Profile with profile_type Faculty (there is no Faculty role), and are
	only permitted on assignments within their own cohort. Throws PermissionError otherwise.
	"""
	faculty = frappe.db.get_value(
		"CS17 Profile",
		{"user": frappe.session.user, "profile_type": "Faculty"},
		["name", "cohort"],
		as_dict=True,
	)
	assignment_cohort = frappe.db.get_value("CS17 Assignment", assignment, "cohort")
	if not faculty or not faculty.cohort or faculty.cohort != assignment_cohort:
		frappe.throw(_("Not permitted"), frappe.PermissionError)
	return faculty.name


@frappe.whitelist()
def get_submission_project(submission: str) -> dict:
	"""Return the immutable `.sb3` snapshot bytes for the faculty read-only player.

	Faculty have no doctype read perm on the submission (they're gated behind whitelisted APIs), so a direct
	browser download of the private `.sb3` is refused by Frappe's file-permission check. This whitelisted API
	is the trust boundary: it runs the cohort check, then reads the snapshot bytes through the File doc and
	returns them base64-encoded so the browser never touches the private file directly. `content` decodes to
	the raw `.sb3` bytes.
	"""
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
	"""Return the current faculty's cohort submissions with assignment meta and grade status in one call.

	The submission/assignment/grade doctypes only grant read to System Manager + CS17 Student, so a real
	(non-admin) faculty user sees nothing through direct doctype reads. This whitelisted API is the trust
	boundary: it resolves the caller's own Faculty cohort first, then reads with ignore_permissions scoped
	to that cohort — the same pattern as get_recent_submissions / save_grade. Assignment meta and grades are
	fetched in bulk and stitched by name (no get_doc in loops, no N+1).
	"""
	cohort = require_current_faculty_cohort()
	if not cohort:
		return []

	submissions = frappe.get_all(
		"CS17 Assignment Submission",
		filters=[["assignment.cohort", "=", cohort]],
		fields=["name", "student", "full_name", "assignment", "assignment_title", "submitted_at"],
		order_by="submitted_at desc",
		ignore_permissions=True,
	)
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
	"""Return the existing grade for a submission to prefill the faculty grading dialog (None if ungraded).

	Scoped to faculty whose cohort matches the submission's assignment cohort, same trust boundary as
	get_submission_project — the grade doctype grants read to System Manager + CS17 Student only.
	"""
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
	"""Create or update the published grade for a submission (create if none exists, else update).

	Only a Faculty CS17 Profile in the submission's assignment cohort may grade. The CS17 Assignment Grade
	doctype grants create/write to System Manager only, so the API is the trust boundary: ignore_permissions
	is used only after the cohort check passes — same pattern as submit_scratch_project.
	"""
	assignment = frappe.db.get_value("CS17 Assignment Submission", submission, "assignment")
	if not assignment:
		frappe.throw(_("Submission not found"))

	require_faculty_for_assignment(assignment)

	if marks_obtained is not None:
		marks_obtained = flt(marks_obtained)
		max_marks = flt(frappe.db.get_value("CS17 Assignment", assignment, "max_marks"))
		if marks_obtained < 0 or marks_obtained > max_marks:
			frappe.throw(_("Marks must be between 0 and {0}.").format(max_marks))

	grade_name = frappe.db.get_value("CS17 Assignment Grade", {"submission": submission}, "name")
	grade_doc = (
		frappe.get_doc("CS17 Assignment Grade", grade_name)
		if grade_name
		else frappe.new_doc("CS17 Assignment Grade")
	)
	grade_doc.assignment = assignment
	grade_doc.submission = submission
	grade_doc.marks_obtained = marks_obtained
	grade_doc.grade = grade
	grade_doc.remarks = remarks
	grade_doc.graded_by = frappe.session.user
	grade_doc.is_published = 1
	grade_doc.save(ignore_permissions=True)
	return grade_doc.as_dict()
