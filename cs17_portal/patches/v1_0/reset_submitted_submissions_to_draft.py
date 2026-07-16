import frappe

# Scratch submissions used to be submitted (docstatus 1) by submit_scratch_project.
# The flow now revises a single submission in place as a draft, like every other
# submission type, so re-submitting a legacy row failed with UpdateAfterSubmitError.
# Reset every submitted submission back to a draft — there are no submit side
# effects to unwind (the immutable snapshot lives in its own file, not the
# docstatus).


def execute():
	submitted = frappe.get_all(
		"CS17 Assignment Submission", filters={"docstatus": 1}, pluck="name"
	)
	for name in submitted:
		frappe.db.set_value(
			"CS17 Assignment Submission", name, "docstatus", 0, update_modified=False
		)
