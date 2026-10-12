import base64
import io
import mimetypes
import tarfile
import zipfile
import zlib
from collections.abc import Callable, Iterator

import frappe
from frappe import _

from cs17_portal.api import (
	get_current_faculty,
	get_current_profile_name,
	require_faculty_for_assignment,
)
from cs17_portal.cs17_portal.doctype.cs17_assignment_submission.cs17_assignment_submission import (
	SUBMISSION_EXTENSIONS,
)

MAX_ENTRIES = 1000
MAX_UNPACKED_SIZE = 200 * 1024 * 1024
MAX_PREVIEW_SIZE = 512 * 1024
MAX_PREVIEW_TOTAL = 8 * 1024 * 1024


@frappe.whitelist(methods=["GET"])
def get_submission_archive(submission: str) -> dict:
	submitted = frappe.db.get_value(
		"CS17 Assignment Submission",
		submission,
		["assignment", "submission_document", "student"],
		as_dict=True,
	)
	student = get_current_profile_name("Student")
	if not (student and submitted and submitted.student == student):
		get_current_faculty()
		if not submitted:
			frappe.throw(_("Submission not found"), frappe.DoesNotExistError)

		require_faculty_for_assignment(submitted.assignment)

	if not submitted.submission_document:
		frappe.throw(_("This submission has no file."))

	attached_file = frappe.db.get_value(
		"File",
		{"file_url": submitted.submission_document, "attached_to_name": submission},
		"*",
		as_dict=True,
	)
	if not attached_file:
		frappe.throw(_("This submission's file is missing."), frappe.DoesNotExistError)

	file = frappe.get_doc({"doctype": "File", **attached_file})
	return {"filename": file.file_name, "entries": read_archive(file.get_content())}


def read_archive(content: bytes) -> list[dict]:
	entries = []
	unpacked_size = 0
	preview_left = MAX_PREVIEW_TOTAL
	try:
		for path, size, is_dir, read in archive_members(content):
			if path.startswith("__MACOSX/"):
				continue
			unpacked_size += size
			if len(entries) >= MAX_ENTRIES or unpacked_size > MAX_UNPACKED_SIZE:
				frappe.throw(_("This archive is too large to show here. Download it to check it."))

			entry = {
				"path": path.rstrip("/"),
				"size": size,
				"is_dir": is_dir,
				"preview": None,
				"content": None,
			}
			if read and size <= min(MAX_PREVIEW_SIZE, preview_left):
				entry["preview"], entry["content"] = preview_of(path, read)
				preview_left -= size
			entries.append(entry)
	except (zipfile.BadZipFile, tarfile.TarError, zlib.error, EOFError, OSError):
		frappe.throw(_("This archive could not be read. Download it to check it."))
	return entries


def archive_members(content: bytes) -> Iterator[tuple[str, int, bool, Callable[[], bytes] | None]]:
	if zipfile.is_zipfile(io.BytesIO(content)):
		with zipfile.ZipFile(io.BytesIO(content)) as archive:
			for info in archive.infolist():
				read = None if info.is_dir() else lambda info=info: archive.read(info)
				yield info.filename, info.file_size, info.is_dir(), read
		return

	with tarfile.open(fileobj=io.BytesIO(content)) as archive:
		for member in archive:
			read = (lambda member=member: archive.extractfile(member).read()) if member.isfile() else None
			yield member.name, member.size if member.isfile() else 0, member.isdir(), read


def preview_of(path: str, read: Callable[[], bytes]) -> tuple[str | None, str | None]:
	try:
		content = read()
	except (RuntimeError, NotImplementedError):
		return None, None
	if path.lower().endswith(SUBMISSION_EXTENSIONS["Image"]):
		encoded = base64.b64encode(content).decode()
		return "image", f"data:{mimetypes.guess_type(path)[0]};base64,{encoded}"
	if b"\0" not in content:
		try:
			return "text", content.decode()
		except UnicodeDecodeError:
			pass
	return None, None
