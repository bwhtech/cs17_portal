# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal.install import allow_scratch_files


class TestInstall(FrappeTestCase):
	def test_adds_sb3_to_a_restricted_extension_list(self):
		frappe.db.set_single_value("System Settings", "allowed_file_extensions", "PDF\nPNG")

		allow_scratch_files()

		self.assertEqual(
			frappe.db.get_single_value("System Settings", "allowed_file_extensions"), "PDF\nPNG\nSB3"
		)
