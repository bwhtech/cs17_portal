import frappe
from frappe.utils import getdate, now_datetime


def auto_publish_assignments():
	_publish_due("CS17 Assignment", "publish_on")


def auto_publish_grades():
	_publish_due("CS17 Assignment Grade", "published_on")


def auto_publish_results():
	names = frappe.get_all(
		"CS17 Result",
		filters=[
			["is_published", "=", 0],
			["published_on", "is", "set"],
			["published_on", "<=", now_datetime()],
		],
		pluck="name",
	)
	for name in names:
		try:
			frappe.get_lazy_doc("CS17 Result", name).publish()
		except Exception:
			title = "Scheduled result not published"
			if not frappe.db.exists(
				"Error Log", {"method": title, "reference_doctype": "CS17 Result", "reference_name": name}
			):
				frappe.log_error(title=title, reference_doctype="CS17 Result", reference_name=name)


def auto_publish_announcements():
	names = frappe.get_all(
		"CS17 Announcement",
		filters=[["is_published", "=", 0], ["publish_on", "is", "set"], ["publish_on", "<=", now_datetime()]],
		pluck="name",
	)
	for name in names:
		try:
			doc = frappe.get_doc("CS17 Announcement", name)
			doc.is_published = 1
			doc.published_date = getdate(doc.publish_on)
			doc.publish_on = None
			doc.save(ignore_permissions=True)
		except Exception:
			title = "Scheduled announcement not published"
			if not frappe.db.exists(
				"Error Log",
				{"method": title, "reference_doctype": "CS17 Announcement", "reference_name": name},
			):
				frappe.log_error(title=title, reference_doctype="CS17 Announcement", reference_name=name)


def _publish_due(doctype: str, publish_on_field: str) -> None:
	"""Publish records whose scheduled publish time has passed."""
	table = frappe.qb.DocType(doctype)
	publish_on = table[publish_on_field]
	(
		frappe.qb.update(table)
		.set(table.is_published, 1)
		.where((table.is_published == 0) & publish_on.notnull() & (publish_on <= now_datetime()))
	).run()
