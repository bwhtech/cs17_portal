import frappe
from frappe.utils import now_datetime


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


def _publish_due(doctype: str, publish_on_field: str) -> None:
	"""Publish records whose scheduled publish time has passed."""
	table = frappe.qb.DocType(doctype)
	publish_on = table[publish_on_field]
	(
		frappe.qb.update(table)
		.set(table.is_published, 1)
		.where((table.is_published == 0) & publish_on.notnull() & (publish_on <= now_datetime()))
	).run()
