import frappe


def execute():
	submissions = frappe.get_all(
		"CS17 Assignment Submission", filters={"submitted_at": ["is", "not set"]}, fields=["name", "creation"]
	)
	for submission in submissions:
		frappe.db.set_value(
			"CS17 Assignment Submission",
			submission.name,
			"submitted_at",
			submission.creation,
			update_modified=False,
		)
