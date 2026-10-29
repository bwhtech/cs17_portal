import frappe
from frappe.utils import add_to_date, getdate, now_datetime
from frappe.utils.background_jobs import defer_enqueue_after_commit


def auto_publish_assignments():
	_publish_due("CS17 Assignment", "publish_on", "Scheduled assignment not published")


def auto_publish_grades():
	_publish_due("CS17 Assignment Grade", "published_on", "Scheduled grade not published")


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


def remind_due_assignments():
	hour = now_datetime().replace(minute=0, second=0, microsecond=0)
	assignments = frappe.get_all(
		"CS17 Assignment",
		filters=[
			["is_published", "=", 1],
			["due_date", ">", add_to_date(hour, hours=23)],
			["due_date", "<=", add_to_date(hour, hours=24)],
		],
		pluck="name",
	)
	for name in assignments:
		frappe.get_doc("CS17 Assignment", name).remind_students()


def _publish_due(doctype: str, publish_on_field: str, error_title: str) -> None:
	"""Publish records whose scheduled publish time has passed."""
	due = frappe.get_all(
		doctype,
		filters=[
			["is_published", "=", 0],
			[publish_on_field, "is", "set"],
			[publish_on_field, "<=", now_datetime()],
		],
		fields=["name", "modified"],
		as_list=True,
	)
	for name, modified in due:
		frappe.db.savepoint("publish_due")
		try:
			doc = frappe.get_doc(doctype, name)
			doc.is_published = 1
			with defer_enqueue_after_commit():
				doc.save(ignore_permissions=True)
		except Exception:
			frappe.db.rollback(save_point="publish_due")
			if not frappe.get_all(
				"Error Log",
				filters={
					"method": error_title,
					"reference_doctype": doctype,
					"reference_name": name,
					"creation": (">", modified),
				},
				limit=1,
			):
				frappe.log_error(title=error_title, reference_doctype=doctype, reference_name=name)
