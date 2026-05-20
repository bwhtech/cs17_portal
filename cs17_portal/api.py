import frappe
from frappe.utils.file_manager import save_file


@frappe.whitelist(allow_guest=True)
def upload_assignment():
	full_name = frappe.form_dict.get("full_name")
	uploaded_file = frappe.request.files.get("file")

	if not full_name:
		return {"status": "error", "message": "Full name is required"}

	if not uploaded_file:
		return {"status": "error", "message": "ZIP file is required"}

	if not uploaded_file.filename.lower().endswith(".zip"):
		return {"status": "error", "message": "Only ZIP files are allowed"}

	# Save ZIP file
	saved_file = save_file(uploaded_file.filename, uploaded_file.stream.read(), "File", None, is_private=1)

	# Create DocType entry
	doc = frappe.get_doc(
		{
			"doctype": "CS17 Assignment Submission",
			"full_name": full_name,
			"submission_document": saved_file.file_url,
		}
	)

	doc.insert(ignore_permissions=True)

	frappe.db.commit()

	return {"status": "success", "message": "Assignment submitted successfully"}
