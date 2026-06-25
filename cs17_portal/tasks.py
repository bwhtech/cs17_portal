import frappe
from frappe.utils import now_datetime


def publish_all_existing_assignments():
	"""One-time: publish all assignments that have no publish_on schedule (legacy records)."""
	frappe.db.sql(
		"UPDATE `tabCS17 Assignment` SET is_published = 1 WHERE is_published = 0 AND publish_on IS NULL"
	)


def auto_publish_assignments():
	frappe.db.sql(
		"""
		UPDATE `tabCS17 Assignment`
		SET is_published = 1
		WHERE is_published = 0
		  AND publish_on IS NOT NULL
		  AND publish_on <= %s
		""",
		now_datetime(),
	)
