import frappe


def execute():
	submissions = frappe.get_all(
		"CS17 Assignment Submission",
		filters={"project": ["is", "set"]},
		fields=["project", "assignment"],
	)
	for submission in submissions:
		if frappe.db.exists("CS17 Project", submission.project):
			frappe.db.set_value(
				"CS17 Project",
				submission.project,
				"assignment",
				submission.assignment,
				update_modified=False,
			)
