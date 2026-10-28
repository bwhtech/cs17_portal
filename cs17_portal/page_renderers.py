import frappe
from frappe.website.page_renderers.base_renderer import BaseRenderer
from werkzeug.wrappers import Response


class DashboardServiceWorker(BaseRenderer):
	"""Served from /dashboard, not /assets: a service worker only controls pages under its own path."""

	def can_render(self):
		request = getattr(frappe.local, "request", None)
		return bool(request) and request.path == "/dashboard/sw.js"

	def render(self):
		return Response(
			frappe.read_file(
				frappe.get_app_path("cs17_portal", "public", "dashboard", "sw.js"), raise_not_found=True
			),
			mimetype="text/javascript",
			headers={
				"Cache-Control": "no-cache, max-age=0, must-revalidate",
				"Service-Worker-Allowed": "/dashboard",
			},
		)
