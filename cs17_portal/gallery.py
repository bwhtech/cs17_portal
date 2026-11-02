import base64

import frappe
from frappe import _

from cs17_portal.api import (
	attach_private_file,
	get_current_faculty,
	require_current_profile,
	require_current_student,
	require_owned_project,
)

SHARED_PROJECT_FIELDS = [
	"name",
	"project_title",
	"project_type",
	"profile.full_name as student_name",
	"thumbnail",
	"last_saved_at",
]


def get_gallery_filters() -> list:
	viewer = frappe.db.get_value(
		"CS17 Profile", {"user": frappe.session.user}, ["profile_type", "cohort"], as_dict=True
	)
	if not viewer or (viewer.profile_type == "Student" and not viewer.cohort):
		frappe.throw(_("Not permitted"), frappe.PermissionError)
	return [["is_shared", "=", 1], *([["profile.cohort", "=", viewer.cohort]] if viewer.cohort else [])]


def require_shared_project(project: str, fields: list) -> frappe._dict:
	shared = frappe.get_all(
		"CS17 Project", filters=[["name", "=", project], *get_gallery_filters()], fields=fields, limit=1
	)
	if not shared:
		frappe.throw(_("This project is not shared with your class."), frappe.PermissionError)
	return shared[0]


def read_project_file(project: str, file_url: str) -> tuple[str, bytes]:
	file_doc = frappe.get_doc(
		"File", {"file_url": file_url, "attached_to_doctype": "CS17 Project", "attached_to_name": project}
	)
	try:
		return file_doc.file_name, file_doc.get_content(encodings=())
	except FileNotFoundError:
		frappe.throw(_("This project's file is missing."), frappe.DoesNotExistError)


@frappe.whitelist(methods=["GET"])
def get_shared_projects() -> list:
	return frappe.get_all(
		"CS17 Project",
		filters=get_gallery_filters(),
		fields=SHARED_PROJECT_FIELDS,
		order_by="last_saved_at desc",
	)


@frappe.whitelist(methods=["GET"])
def get_shared_project(project: str) -> dict:
	shared = require_shared_project(project, [*SHARED_PROJECT_FIELDS, "code", "sb3_file"])
	shared.content = (
		base64.b64encode(read_project_file(project, shared.sb3_file)[1]).decode() if shared.sb3_file else None
	)
	return shared


@frappe.whitelist(methods=["GET"])
def get_shared_thumbnail(project: str) -> None:
	thumbnail = require_shared_project(project, ["thumbnail"]).thumbnail
	frappe.response.filename, frappe.response.filecontent = read_project_file(project, thumbnail)
	frappe.response.type = "download"
	frappe.response.display_content_as = "inline"


@frappe.whitelist(methods=["POST"])
def copy_shared_project(project: str) -> dict:
	student = require_current_student()
	require_shared_project(project, ["name"])
	source = frappe.get_doc("CS17 Project", project)
	copy = frappe.copy_doc(source)
	copy.update(
		{
			"profile": student,
			"project_title": f"{source.project_title} (copy)",
			"is_shared": 0,
			"sb3_file": None,
			"thumbnail": None,
		}
	)
	copy.insert(ignore_permissions=True)
	for field in ("sb3_file", "thumbnail"):
		if source.get(field):
			file_name, content = read_project_file(project, source.get(field))
			copy.db_set(
				field, attach_private_file("CS17 Project", copy.name, field, file_name, content).file_url
			)
	return {"name": copy.name, "project_title": copy.project_title, "project_type": copy.project_type}


@frappe.whitelist(methods=["POST"])
def share_project(project: str) -> None:
	require_current_student()
	project_doc = require_owned_project(project)
	project_doc.is_shared = 1
	project_doc.save(ignore_permissions=True)


@frappe.whitelist(methods=["POST"])
def unshare_project(project: str) -> None:
	project_doc = frappe.get_doc("CS17 Project", project)
	if project_doc.profile != require_current_profile():
		faculty_cohort = get_current_faculty().cohort
		if faculty_cohort and faculty_cohort != frappe.db.get_value(
			"CS17 Profile", project_doc.profile, "cohort"
		):
			frappe.throw(_("Not permitted"), frappe.PermissionError)
	project_doc.is_shared = 0
	project_doc.save(ignore_permissions=True)
