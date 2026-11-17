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


def remove_helpdesk_home_pages() -> None:
	for field, value in {"default_portal_home": "/helpdesk", "default_role": "HD Customer"}.items():
		if frappe.db.get_single_value("Portal Settings", field) == value:
			frappe.db.set_single_value("Portal Settings", field, "")
	frappe.db.set_value("Role", {"home_page": "/helpdesk"}, "home_page", "")
