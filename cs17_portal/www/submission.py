import frappe
from frappe.utils.file_manager import save_file


@frappe.whitelist(allow_guest=True)
def upload_assignment():

    full_name = frappe.form_dict.get("full_name")

    uploaded_file = frappe.request.files.get("file")

    if not full_name:
        return {
            "status": "error",
            "message": "Full name is required"
        }

    if not uploaded_file:
        return {
            "status": "error",
            "message": "ZIP file is required"
        }

    saved_file = save_file(
        uploaded_file.filename,
        uploaded_file.read(),
        "File",
        None,
        is_private=1
    )

    return {
        "status": "success",
        "file_url": saved_file.file_url
    }