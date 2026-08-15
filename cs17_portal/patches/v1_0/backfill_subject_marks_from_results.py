import frappe

# Marks used to be typed straight into CS17 Result. They now live in CS17 Subject Marks
# and the result only rolls them up, so every existing score row needs a document to
# roll up from - otherwise the next save of an old result would zero it out.
WHOLE_SUBJECT = "Total"


def execute():
	for result in frappe.get_all("CS17 Result", fields=["name", "exam", "student"]):
		rows = frappe.get_all(
			"CS17 Result Subject Score",
			filters={"parent": result.name, "parenttype": "CS17 Result"},
			fields=["subject", "marks_obtained"],
		)
		for row in rows:
			if frappe.db.exists(
				"CS17 Subject Marks",
				{"exam": result.exam, "student": result.student, "subject": row.subject},
			):
				continue
			frappe.get_doc(
				{
					"doctype": "CS17 Subject Marks",
					"exam": result.exam,
					"student": result.student,
					"subject": row.subject,
					"components": [{"component": WHOLE_SUBJECT, "marks_obtained": row.marks_obtained}],
				}
			).insert(ignore_permissions=True)
