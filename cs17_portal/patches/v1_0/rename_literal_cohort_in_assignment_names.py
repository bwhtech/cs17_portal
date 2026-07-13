import re

import frappe

# A malformed naming series (`GRADED-{cohort}-.###`) baked the literal string
# `{cohort}` into demo document names instead of the cohort value. The series is
# fixed going forward; this patch cleans up the already-created rows. Assignments
# are renamed first so the link cascade repoints submissions/grades before their
# own names are corrected.
PLACEHOLDER = "{cohort}"
TRAILING_NUMBER = re.compile(r"^(.*?)(\d+)$")


def execute():
	rename_documents("CS17 Assignment", get_assignment_cohort)
	rename_documents("CS17 Assignment Submission", get_linked_assignment_cohort)
	rename_documents("CS17 Assignment Grade", get_linked_assignment_cohort)


def rename_documents(doctype, cohort_getter):
	stale = frappe.get_all(doctype, filters={"name": ["like", f"%{PLACEHOLDER}%"]}, pluck="name")
	for name in stale:
		cohort = cohort_getter(doctype, name)
		if not cohort:
			continue
		new_name = name.replace(PLACEHOLDER, str(cohort))
		if new_name == name or frappe.db.exists(doctype, new_name):
			continue
		frappe.rename_doc(doctype, name, new_name, force=True, show_alert=False)

	# Renaming leaves the `Series` counter untouched, so the fresh prefix would hand
	# out a suffix that already exists. Bump every prefix past its highest suffix.
	for name in frappe.get_all(doctype, pluck="name"):
		sync_series_counter(name)


def sync_series_counter(name):
	match = TRAILING_NUMBER.match(name)
	if not match:
		return
	prefix, number = match.group(1), int(match.group(2))
	current = frappe.db.get_value("Series", prefix, "current", order_by="name")
	if current is None:
		frappe.qb.into("Series").columns("name", "current").insert(prefix, number).run()
	elif number > int(current):
		frappe.db.set_value("Series", prefix, "current", number)


def get_assignment_cohort(doctype, name):
	return frappe.db.get_value(doctype, name, "cohort")


def get_linked_assignment_cohort(doctype, name):
	assignment = frappe.db.get_value(doctype, name, "assignment")
	return frappe.db.get_value("CS17 Assignment", assignment, "cohort") if assignment else None
