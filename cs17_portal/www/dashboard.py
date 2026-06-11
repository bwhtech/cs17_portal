import frappe
from frappe import _
from frappe.utils import get_system_timezone

no_cache = 1


def get_context():
	if frappe.session.user == "Guest":
		frappe.local.flags.redirect_location = f"/login?redirect-to={frappe.request.path}"
		raise frappe.Redirect

	csrf_token = frappe.sessions.get_csrf_token()
	context = frappe._dict()
	context.boot = get_boot()
	context.boot.csrf_token = csrf_token
	return context


@frappe.whitelist(methods=["POST"], allow_guest=True)
def get_context_for_dev():
	if not frappe.conf.developer_mode:
		frappe.throw(_("This method is only meant for developer mode"))
	return get_boot()


def get_boot():
	current_user = frappe.session.user
	student = None

	if current_user and current_user != "Guest":
		try:
			doc = frappe.get_doc("CS17 Student", {"user": current_user})
			student = {
				"name": doc.name,
				"full_name": doc.full_name,
				"cohort": doc.cohort,
				"profile_picture": doc.profile_picture,
			}
		except frappe.DoesNotExistError:
			student = None

	return frappe._dict(
		{
			"frappe_version": frappe.__version__,
			"site_name": frappe.local.site,
			"read_only_mode": frappe.flags.read_only,
			"system_timezone": get_system_timezone(),
			"current_user": current_user,
			"student": student,
		}
	)
