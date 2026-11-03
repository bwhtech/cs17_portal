import hmac

import frappe
from frappe import _
from frappe.utils import get_host_name_from_request, sha256_hash
from frappe.utils.password import get_decrypted_password


class SafeExamBrowserRequiredError(frappe.PermissionError):
	pass


def require_safe_exam_browser(exam: str) -> None:
	if not frappe.db.get_value("CS17 Coding Exam", exam, "require_seb"):
		return
	query = frappe.request.query_string.decode()
	url = get_host_name_from_request() + frappe.request.path + (f"?{query}" if query else "")
	request_hash = frappe.get_request_header("X-SafeExamBrowser-RequestHash", "").encode()
	keys = get_decrypted_password("CS17 Coding Exam", exam, "seb_browser_exam_key", raise_exception=False)
	if not any(
		hmac.compare_digest(sha256_hash(url + key).encode(), request_hash)
		for key in (keys or "").replace(",", " ").split()
	):
		frappe.throw(_("Open this exam in Safe Exam Browser."), SafeExamBrowserRequiredError)
