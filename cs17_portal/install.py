import frappe


def allow_scratch_files() -> None:
	allowed = frappe.db.get_single_value("System Settings", "allowed_file_extensions")
	if not allowed or "SB3" in allowed.splitlines():
		return
	frappe.db.set_single_value("System Settings", "allowed_file_extensions", f"{allowed}\nSB3")
