import frappe
from frappe.utils.file_manager import save_file


def get_context(context):
	context.title = "CS17 Assignment Submission"


@frappe.whitelist()
def upload_assignment():
	full_name = frappe.form_dict.get("full_name")
	uploaded_file = frappe.request.files.get("file")

	# Validation
	if not full_name:
		return {"status": "error", "message": "Full name is required"}

	if not uploaded_file:
		return {"status": "error", "message": "File is required"}

	# ZIP validation
	if not uploaded_file:
		return {"status": "error", "message": "File is required"}

	# Save file in Frappe
	saved_file = save_file(uploaded_file.filename, uploaded_file.stream.read(), "File", None, is_private=1)

	# Create submission entry
	submission = frappe.get_doc(
		{
			"doctype": "CS17 Assignment Submission",
			"full_name": full_name,
			"submission_document": saved_file.file_url,
		}
	)

	submission.insert(ignore_permissions=True)

	return {"status": "success", "message": "Assignment submitted successfully"}
