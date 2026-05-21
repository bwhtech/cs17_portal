import frappe
from frappe.utils.file_manager import save_file


@frappe.whitelist(allow_guest=True)
def upload_assignment():

    full_name = frappe.form_dict.get("full_name")
    uploaded_file = frappe.request.files.get("file")

    if not full_name:
        return {"status": "error", "message": "Full name is required"}

    if not uploaded_file:
        return {"status": "error", "message": "File is required"}

    # 1. Save the file first so we have the URL ready
    saved_file = save_file(
        uploaded_file.filename,
        uploaded_file.read(),
        "CS17 Assignment Submission",
        None,
        is_private=1
    )

    # 2. Insert the doc with both mandatory fields already populated
    doc = frappe.get_doc({
        "doctype": "CS17 Assignment Submission",
        "full_name": full_name,
        "submission_document": saved_file.file_url
    })
    doc.insert(ignore_permissions=True)
    frappe.db.commit()

    return {
        "status": "success",
        "file_url": saved_file.file_url,
        "submission": doc.name
    }