import frappe
from frappe import _

from cs17_portal.api import get_current_faculty

SAVED_REMARK = "CS17 Saved Remark"


@frappe.whitelist(methods=["GET"])
def get_saved_remarks() -> list[dict]:
	get_current_faculty()
	return frappe.get_all(
		SAVED_REMARK,
		filters={"owner": frappe.session.user},
		fields=["name", "remark"],
		order_by="creation asc",
	)


@frappe.whitelist(methods=["POST"])
def save_remark(remark: str) -> str:
	get_current_faculty()
	remark = remark.strip()
	if not remark:
		frappe.throw(_("Enter the remarks to save."))
	saved_remark = frappe.db.get_value(SAVED_REMARK, {"owner": frappe.session.user, "remark": remark})
	if saved_remark:
		return saved_remark
	return frappe.get_doc({"doctype": SAVED_REMARK, "remark": remark}).insert(ignore_permissions=True).name


@frappe.whitelist(methods=["POST"])
def delete_saved_remark(saved_remark: str) -> None:
	get_current_faculty()
	if frappe.db.get_value(SAVED_REMARK, saved_remark, "owner") != frappe.session.user:
		frappe.throw(_("Not permitted"), frappe.PermissionError)
	frappe.delete_doc(SAVED_REMARK, saved_remark, ignore_permissions=True)
