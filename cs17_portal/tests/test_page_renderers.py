# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import set_request
from frappe.website.serve import get_response


class TestPageRenderers(FrappeTestCase):
	def test_serves_the_dashboard_service_worker_to_a_visitor(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user("Guest")
		self.addCleanup(delattr, frappe.local, "request")
		set_request(method="GET", path="/dashboard/sw.js")

		response = get_response()

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.mimetype, "text/javascript")
		self.assertEqual(response.headers["Service-Worker-Allowed"], "/dashboard")
