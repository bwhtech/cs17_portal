import frappe
from frappe.utils import getdate, now_datetime
from frappe.utils.background_jobs import defer_enqueue_after_commit


def auto_publish_assignments():
	_publish_due("CS17 Assignment", "publish_on")


def auto_publish_grades():
	_publish_due("CS17 Assignment Grade", "published_on")


def auto_publish_results():
	results = frappe.get_all(
		"CS17 Result",
		filters=[
			["is_published", "=", 0],
			["published_on", "is", "set"],
			["published_on", "<=", now_datetime()],
		],
		fields=["name", "modified"],
		as_list=True,
	)
	for name, modified in results:
		try:
			frappe.get_lazy_doc("CS17 Result", name).publish()
		except Exception:
			title = "Scheduled result not published"
			if not frappe.get_all(
				"Error Log",
				filters={
					"method": title,
					"reference_doctype": "CS17 Result",
					"reference_name": name,
					"creation": (">", modified),
				},
				limit=1,
			):
				frappe.log_error(title=title, reference_doctype="CS17 Result", reference_name=name)


def auto_publish_announcements():
	announcements = frappe.get_all(
		"CS17 Announcement",
		filters=[["is_published", "=", 0], ["publish_on", "is", "set"], ["publish_on", "<=", now_datetime()]],
		fields=["name", "modified"],
		as_list=True,
	)
	for name, modified in announcements:
		frappe.db.savepoint("publish_announcement")
		try:
			doc = frappe.get_doc("CS17 Announcement", name)
			doc.is_published = 1
			doc.published_date = getdate(doc.publish_on)
			doc.publish_on = None
			with defer_enqueue_after_commit():
				doc.save(ignore_permissions=True)
		except Exception:
			frappe.db.rollback(save_point="publish_announcement")
			title = "Scheduled announcement not published"
			if not frappe.get_all(
				"Error Log",
				filters={
					"method": title,
					"reference_doctype": "CS17 Announcement",
					"reference_name": name,
					"creation": (">", modified),
				},
				limit=1,
			):
				frappe.log_error(title=title, reference_doctype="CS17 Announcement", reference_name=name)


def _publish_due(doctype: str, publish_on_field: str) -> None:
	"""Publish records whose scheduled publish time has passed."""
	table = frappe.qb.DocType(doctype)
	publish_on = table[publish_on_field]
	now = now_datetime()
	(
		frappe.qb.update(table)
		.set(table.is_published, 1)
		.set(table.modified, now)
		.set(table.modified_by, frappe.session.user)
		.where((table.is_published == 0) & publish_on.notnull() & (publish_on <= now))
	).run()
