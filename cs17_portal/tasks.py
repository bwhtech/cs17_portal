import frappe
from frappe.utils import now_datetime, today


def publish_all_existing_assignments():
	"""One-time: publish all assignments that have no publish_on schedule (legacy records)."""
	Assignment = frappe.qb.DocType("CS17 Assignment")
	(
		frappe.qb.update(Assignment)
		.set(Assignment.is_published, 1)
		.where((Assignment.is_published == 0) & Assignment.publish_on.isnull())
	).run()


def auto_publish_assignments():
	_publish_due("CS17 Assignment", "publish_on")


def auto_publish_grades():
	_publish_due("CS17 Assignment Grade", "published_on")


def auto_publish_results():
	_publish_due("CS17 Result", "published_on")


def auto_publish_announcements():
	names = frappe.get_all(
		"CS17 Announcement",
		filters=[["is_published", "=", 0], ["publish_on", "is", "set"], ["publish_on", "<=", now_datetime()]],
		pluck="name",
	)
	for name in names:
		doc = frappe.get_doc("CS17 Announcement", name)
		doc.is_published = 1
		doc.published_date = today()
		doc.save(ignore_permissions=True)


def _publish_due(doctype: str, publish_on_field: str) -> None:
	"""Publish records whose scheduled publish time has passed."""
	table = frappe.qb.DocType(doctype)
	publish_on = table[publish_on_field]
	(
		frappe.qb.update(table)
		.set(table.is_published, 1)
		.where((table.is_published == 0) & publish_on.notnull() & (publish_on <= now_datetime()))
	).run()
