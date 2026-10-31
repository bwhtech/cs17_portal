import frappe

SUBMISSION_FILE_EXTENSIONS = ("SB3", "ZIP", "GZ", "TGZ", "GIF", "WEBP", "WEBM", "OGG", "M4A")


def allow_submission_files() -> None:
	allowed = frappe.db.get_single_value("System Settings", "allowed_file_extensions")
	if not allowed:
		return
	missing = [extension for extension in SUBMISSION_FILE_EXTENSIONS if extension not in allowed.splitlines()]
	if missing:
		frappe.db.set_single_value(
			"System Settings", "allowed_file_extensions", "\n".join([allowed, *missing])
		)
